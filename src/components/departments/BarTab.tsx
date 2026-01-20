import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, ShoppingCart, Check, CreditCard, History, ChevronDown, ChevronRight, DollarSign, Download, Beer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import mpesaLogo from '@/assets/mpesa-logo.png';
import kcbLogo from '@/assets/kcb-logo.png';
import cashLogo from '@/assets/cash-logo.png';
import jsPDF from 'jspdf';

// Now using bar_inventory as menu items
interface BarMenuItem {
  id: string;
  name: string;
  category: string;
  price: number; // selling_price from inventory
  quantity: number; // stock quantity
}

interface BarOrderItem {
  id: string;
  quantity: number;
  price: number;
  item_name: string;
}

interface BarOrder {
  id: string;
  order_number: number;
  status: string;
  total_amount: number;
  amount_paid: number;
  payment_method: string | null;
  is_debt: boolean;
  debtor_name: string | null;
  created_at: string;
  staff_id: string | null;
  bar_order_items?: BarOrderItem[];
}

interface CartItem {
  menuItem: BarMenuItem;
  quantity: number;
}

interface PaymentSplit {
  method: 'cash' | 'mpesa' | 'kcb' | 'debt';
  amount: number;
}

interface Props {
  employeeId: string;
  employeeName: string;
}

const VAT_RATE = 0.16;
const formatKES = (amount: number) => `KES ${amount.toLocaleString('en-KE')}`;
const generateOrderId = (orderNumber: number) => `BAR${orderNumber}`;

export default function BarTab({ employeeId, employeeName }: Props) {
  const [menuItems, setMenuItems] = useState<BarMenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pendingOrders, setPendingOrders] = useState<BarOrder[]>([]);
  const [debtOrders, setDebtOrders] = useState<BarOrder[]>([]);
  const [historyOrders, setHistoryOrders] = useState<BarOrder[]>([]);
  
  const [payments, setPayments] = useState<PaymentSplit[]>([]);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<BarOrder | null>(null);
  const [debtorName, setDebtorName] = useState('');
  
  const [menuOpen, setMenuOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(true);
  const [debtorsOpen, setDebtorsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    fetchMenuItems();
    fetchPendingOrders();
    fetchDebtOrders();
    fetchHistory();
    
    const channel = supabase
      .channel(`bar-orders-${employeeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bar_orders' }, () => {
        fetchPendingOrders();
        fetchDebtOrders();
        fetchHistory();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [employeeId]);

  const fetchMenuItems = async () => {
    // Fetch all bar_inventory items with selling_price > 0 (including out of stock)
    const { data } = await supabase
      .from('bar_inventory')
      .select('id, name, category, selling_price, quantity')
      .gt('selling_price', 0)
      .order('category')
      .order('name');
    if (data) {
      setMenuItems(data.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category || 'drinks',
        price: item.selling_price,
        quantity: item.quantity,
      })));
    }
  };

  const fetchPendingOrders = async () => {
    const { data } = await supabase
      .from('bar_orders')
      .select(`*, bar_order_items (id, quantity, price, item_name)`)
      .eq('staff_id', employeeId)
      .eq('status', 'pending')
      .eq('is_debt', false)
      .order('created_at', { ascending: false });
    if (data) setPendingOrders(data as BarOrder[]);
  };

  const fetchDebtOrders = async () => {
    const { data } = await supabase
      .from('bar_orders')
      .select(`*, bar_order_items (id, quantity, price, item_name)`)
      .eq('staff_id', employeeId)
      .eq('is_debt', true)
      .neq('status', 'paid')
      .order('created_at', { ascending: false });
    if (data) setDebtOrders(data as BarOrder[]);
  };

  const fetchHistory = async () => {
    const { data } = await supabase
      .from('bar_orders')
      .select(`*, bar_order_items (id, quantity, price, item_name)`)
      .eq('staff_id', employeeId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setHistoryOrders(data as BarOrder[]);
  };

  const addToCart = (menuItem: BarMenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItem.id === menuItem.id);
      if (existing) {
        return prev.map(c => c.menuItem.id === menuItem.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { menuItem, quantity: 1 }];
    });
  };

  const updateCartQuantity = (menuItemId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(c => c.menuItem.id !== menuItemId));
    } else {
      setCart(prev => prev.map(c => c.menuItem.id === menuItemId ? { ...c, quantity } : c));
    }
  };

  const getCartTotal = () => cart.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0);

  const placeOrder = async () => {
    if (cart.length === 0) {
      toast({ title: 'Cart is empty', variant: 'destructive' });
      return;
    }

    const total = getCartTotal();

    try {
      // Get cost prices for profit tracking from bar_inventory
      const { data: inventoryData } = await supabase
        .from('bar_inventory')
        .select('id, cost_price');
      const costMap = new Map(inventoryData?.map(i => [i.id, i.cost_price]) || []);

      const { data: order, error } = await supabase
        .from('bar_orders')
        .insert({
          staff_id: employeeId,
          total_amount: total,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      const orderItems = cart.map(item => ({
        bar_order_id: order.id,
        bar_menu_item_id: item.menuItem.id,
        item_name: item.menuItem.name,
        quantity: item.quantity,
        price: item.menuItem.price,
        cost_price: costMap.get(item.menuItem.id) || 0,
      }));

      await supabase.from('bar_order_items').insert(orderItems);

      toast({ title: 'Order placed!' });
      setCart([]);
      setMenuOpen(false);
      fetchPendingOrders();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const getTotalPaid = () => payments.filter(p => p.method !== 'debt').reduce((sum, p) => sum + (p.amount || 0), 0);
  const getDebtAmount = () => payments.find(p => p.method === 'debt')?.amount || 0;

  const addPayment = (method: 'cash' | 'mpesa' | 'kcb' | 'debt') => {
    const existingIndex = payments.findIndex(p => p.method === method);
    if (existingIndex >= 0) {
      setPayments(prev => prev.filter((_, i) => i !== existingIndex));
      return;
    }
    setPayments(prev => [...prev, { method, amount: 0 }]);
  };

  const updatePaymentAmount = (index: number, amount: number) => {
    const newPayments = [...payments];
    newPayments[index].amount = amount;
    setPayments(newPayments);
  };

  const handlePayOrder = async () => {
    if (!selectedOrderForPayment) return;

    const order = selectedOrderForPayment;
    const balance = order.total_amount - order.amount_paid;
    
    const cashPaid = payments.filter(p => p.method !== 'debt').reduce((sum, p) => sum + (p.amount || 0), 0);
    const debtAmount = payments.find(p => p.method === 'debt')?.amount || 0;
    const totalPayment = cashPaid + debtAmount;
    
    if (totalPayment === 0) {
      toast({ title: 'Enter payment amount', variant: 'destructive' });
      return;
    }

    if (debtAmount > 0 && !debtorName.trim()) {
      toast({ title: 'Debtor name required', variant: 'destructive' });
      return;
    }

    if (totalPayment > balance) {
      toast({ title: 'Amount exceeds balance', variant: 'destructive' });
      return;
    }

    try {
      const newAmountPaid = order.amount_paid + cashPaid;
      const isFullyPaid = newAmountPaid >= order.total_amount && debtAmount === 0;
      const hasDebt = debtAmount > 0;

      // Build payment method string
      const methodParts = payments.filter(p => p.amount > 0 && p.method !== 'debt').map(p => `${p.method}:${p.amount}`);
      const paymentMethodStr = methodParts.join(',') || null;

      const { error } = await supabase
        .from('bar_orders')
        .update({
          amount_paid: newAmountPaid,
          payment_method: paymentMethodStr,
          status: isFullyPaid ? 'paid' : order.status,
          is_debt: hasDebt,
          debtor_name: hasDebt ? debtorName.trim() : order.debtor_name,
        })
        .eq('id', order.id);

      if (error) throw error;

      // Reduce inventory when paid
      if (isFullyPaid) {
        const items = order.bar_order_items || [];
        for (const item of items) {
          // Find inventory by name and reduce quantity
          const { data: invItems } = await supabase
            .from('bar_inventory')
            .select('id, quantity')
            .eq('name', item.item_name);
          
          if (invItems && invItems.length > 0) {
            const inv = invItems[0];
            const newQty = Math.max(0, inv.quantity - item.quantity);
            await supabase.from('bar_inventory').update({ quantity: newQty }).eq('id', inv.id);
          }
        }
        toast({ title: 'Payment complete! Stock updated.' });
      } else {
        toast({ title: 'Payment recorded' });
      }

      setPayments([]);
      setDebtorName('');
      setSelectedOrderForPayment(null);
      fetchPendingOrders();
      fetchDebtOrders();
      fetchHistory();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const downloadReceipt = (order: BarOrder) => {
    const doc = new jsPDF({ unit: 'mm', format: [80, 150] });
    const pageWidth = 80;
    let y = 10;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('ENAITOTI BAR', pageWidth / 2, y, { align: 'center' });
    y += 8;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Order: ${generateOrderId(order.order_number)}`, pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.text(format(new Date(order.created_at), 'dd/MM/yyyy HH:mm'), pageWidth / 2, y, { align: 'center' });
    y += 8;

    doc.line(5, y, 75, y);
    y += 5;

    order.bar_order_items?.forEach(item => {
      doc.text(`${item.quantity}x ${item.item_name}`, 5, y);
      doc.text(formatKES(item.price * item.quantity), 75, y, { align: 'right' });
      y += 5;
    });

    doc.line(5, y, 75, y);
    y += 5;

    const vatAmount = order.total_amount * (VAT_RATE / (1 + VAT_RATE));
    const preVat = order.total_amount - vatAmount;

    doc.text(`Subtotal: ${formatKES(preVat)}`, 5, y);
    y += 5;
    doc.text(`VAT (16%): ${formatKES(vatAmount)}`, 5, y);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.text(`Total: ${formatKES(order.total_amount)}`, 5, y);
    y += 8;

    if (order.payment_method) {
      doc.setFont('helvetica', 'normal');
      doc.text(`Paid via: ${order.payment_method.replace(/:/g, ' KES ').replace(/,/g, ', ')}`, 5, y);
      y += 8;
    }

    doc.setFontSize(6);
    doc.text('4on4 tech', pageWidth / 2, y + 5, { align: 'center' });

    doc.save(`bar-receipt-${order.order_number}.pdf`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30';
      case 'paid': return 'bg-green-500/10 text-green-600 border-green-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const PaymentMethodButton = ({ method, logo, label }: { method: 'cash' | 'mpesa' | 'kcb'; logo: string; label: string }) => {
    const isActive = payments.some(p => p.method === method);
    return (
      <button
        onClick={() => addPayment(method)}
        className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
          isActive 
            ? 'border-primary bg-primary/10 ring-2 ring-primary/30' 
            : 'border-border hover:border-primary/50 bg-card hover:bg-muted/50'
        }`}
      >
        <img src={logo} alt={label} className="w-12 h-12 object-contain" />
        <span className="text-xs font-medium">{label}</span>
        {isActive && <Check className="w-4 h-4 text-primary" />}
      </button>
    );
  };

  const CollapsibleSection = ({ 
    title, icon: Icon, isOpen, onToggle, badge, children 
  }: { 
    title: string; icon: React.ElementType; isOpen: boolean; onToggle: () => void; badge?: number; children: React.ReactNode;
  }) => (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="w-5 h-5" />
                {title}
                {badge !== undefined && badge > 0 && <Badge variant="secondary">{badge}</Badge>}
              </div>
              {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );

  // Group menu items by category
  const groupedMenuItems = menuItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, BarMenuItem[]>);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Beer className="w-6 h-6" />
            Bar
          </h2>
          <p className="text-muted-foreground">Staff: {employeeName}</p>
        </div>
        <Button onClick={() => setMenuOpen(true)} size="lg">
          <Plus className="w-4 h-4 mr-2" />
          New Order
        </Button>
      </div>

      {/* Menu Dialog */}
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bar Menu</DialogTitle>
          </DialogHeader>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Menu Items */}
            <div className="space-y-4">
              {Object.entries(groupedMenuItems).map(([category, items]) => (
                <div key={category}>
                  <h3 className="font-semibold text-lg capitalize mb-2">{category}</h3>
                  <div className="grid gap-2">
                    {items.map(item => (
                      <button
                        key={item.id}
                        onClick={() => item.quantity > 0 && addToCart(item)}
                        disabled={item.quantity === 0}
                        className={`flex justify-between items-center p-3 rounded-lg border transition-colors ${
                          item.quantity === 0 
                            ? 'bg-muted/30 border-muted cursor-not-allowed opacity-60' 
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex flex-col items-start">
                          <span>{item.name}</span>
                          <span className={`text-xs ${item.quantity === 0 ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                            {item.quantity === 0 ? 'Out of stock' : `Stock: ${item.quantity}`}
                          </span>
                        </div>
                        <span className="font-medium">{formatKES(item.price)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {menuItems.length === 0 && (
                <p className="text-muted-foreground text-center py-8">No menu items available</p>
              )}
            </div>

            {/* Cart */}
            <div className="bg-muted/30 rounded-lg p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Cart ({cart.length})
              </h3>
              
              {cart.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Cart is empty</p>
              ) : (
                <div className="space-y-3">
                  {cart.map(item => (
                    <div key={item.menuItem.id} className="flex items-center justify-between bg-background rounded-lg p-2">
                      <div className="flex-1">
                        <p className="font-medium">{item.menuItem.name}</p>
                        <p className="text-sm text-muted-foreground">{formatKES(item.menuItem.price)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => updateCartQuantity(item.menuItem.id, item.quantity - 1)}
                        >
                          -
                        </Button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => updateCartQuantity(item.menuItem.id, item.quantity + 1)}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  <div className="border-t pt-3 mt-3">
                    <div className="flex justify-between font-semibold text-lg">
                      <span>Total:</span>
                      <span>{formatKES(getCartTotal())}</span>
                    </div>
                  </div>
                  
                  <Button onClick={placeOrder} className="w-full" size="lg">
                    Place Order
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Section */}
      <CollapsibleSection
        title="Payment"
        icon={CreditCard}
        isOpen={paymentOpen}
        onToggle={() => setPaymentOpen(!paymentOpen)}
        badge={pendingOrders.length}
      >
        {pendingOrders.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No pending orders</p>
        ) : (
          <div className="space-y-4">
            {/* Order Selection */}
            <div className="grid gap-2">
              {pendingOrders.map(order => (
                <button
                  key={order.id}
                  onClick={() => {
                    setSelectedOrderForPayment(order);
                    setPayments([]);
                    setDebtorName('');
                  }}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    selectedOrderForPayment?.id === order.id
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex justify-between">
                    <span className="font-bold">{generateOrderId(order.order_number)}</span>
                    <span className="font-medium">{formatKES(order.total_amount)}</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {order.bar_order_items?.map(i => `${i.quantity}x ${i.item_name}`).join(', ')}
                  </div>
                </button>
              ))}
            </div>

            {/* Payment Methods */}
            {selectedOrderForPayment && (
              <div className="space-y-4 border-t pt-4">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Balance Due:</span>
                  <span>{formatKES(selectedOrderForPayment.total_amount - selectedOrderForPayment.amount_paid)}</span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <PaymentMethodButton method="cash" logo={cashLogo} label="Cash" />
                  <PaymentMethodButton method="mpesa" logo={mpesaLogo} label="M-Pesa" />
                  <PaymentMethodButton method="kcb" logo={kcbLogo} label="KCB" />
                  <button
                    onClick={() => addPayment('debt')}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                      payments.some(p => p.method === 'debt')
                        ? 'border-red-500 bg-red-500/10 ring-2 ring-red-500/30'
                        : 'border-border hover:border-red-500/50 bg-card hover:bg-muted/50'
                    }`}
                  >
                    <DollarSign className="w-12 h-12 text-red-500" />
                    <span className="text-xs font-medium">Debt</span>
                    {payments.some(p => p.method === 'debt') && <Check className="w-4 h-4 text-red-500" />}
                  </button>
                </div>

                {/* Payment Amounts */}
                {payments.length > 0 && (
                  <div className="space-y-2">
                    {payments.map((payment, idx) => (
                      <div key={payment.method} className="flex items-center gap-2">
                        <span className="capitalize w-20">{payment.method}:</span>
                        <Input
                          type="number"
                          placeholder="Amount"
                          value={payment.amount || ''}
                          onChange={(e) => updatePaymentAmount(idx, parseFloat(e.target.value) || 0)}
                          className="flex-1"
                        />
                      </div>
                    ))}
                    
                    {payments.some(p => p.method === 'debt') && (
                      <Input
                        placeholder="Debtor Name"
                        value={debtorName}
                        onChange={(e) => setDebtorName(e.target.value)}
                      />
                    )}
                    
                    <div className="flex justify-between pt-2">
                      <span>Total Entered:</span>
                      <span className="font-semibold">{formatKES(getTotalPaid() + getDebtAmount())}</span>
                    </div>
                    
                    <Button onClick={handlePayOrder} className="w-full" size="lg">
                      Complete Payment
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CollapsibleSection>

      {/* Debtors Section */}
      <CollapsibleSection
        title="Debts Unpaid"
        icon={DollarSign}
        isOpen={debtorsOpen}
        onToggle={() => setDebtorsOpen(!debtorsOpen)}
        badge={debtOrders.length}
      >
        {debtOrders.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No unpaid debts</p>
        ) : (
          <div className="space-y-2">
            {debtOrders.map(order => (
              <div key={order.id} className="p-3 rounded-lg border bg-red-50 border-red-200">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold">{generateOrderId(order.order_number)}</span>
                    <p className="text-sm font-medium text-red-600">{order.debtor_name}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-medium">{formatKES(order.total_amount - order.amount_paid)}</span>
                    <p className="text-xs text-muted-foreground">{format(new Date(order.created_at), 'dd MMM')}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* History Section */}
      <CollapsibleSection
        title="My History"
        icon={History}
        isOpen={historyOpen}
        onToggle={() => setHistoryOpen(!historyOpen)}
      >
        {historyOrders.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No order history</p>
        ) : (
          <div className="space-y-2">
            {historyOrders.map(order => (
              <div key={order.id} className="p-3 rounded-lg border">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold">{generateOrderId(order.order_number)}</span>
                    <Badge className={`ml-2 ${getStatusColor(order.status)}`}>{order.status}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatKES(order.total_amount)}</span>
                    {order.status === 'paid' && (
                      <Button size="sm" variant="outline" onClick={() => downloadReceipt(order)}>
                        <Download className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {format(new Date(order.created_at), 'dd MMM yyyy HH:mm')}
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}
