import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, ShoppingCart, User, Printer, Check, X, CreditCard, History, ChevronDown, ChevronRight, ChefHat, DollarSign, Download, Edit, Trash2, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, isToday } from 'date-fns';
import mpesaLogo from '@/assets/mpesa-logo.png';
import kcbLogo from '@/assets/kcb-logo.png';
import cashLogo from '@/assets/cash-logo.png';
import enaitotiLogo from '@/assets/enaitoti-logo.jpg';
import { downloadReceiptPdf } from '@/utils/receiptPdf';
import FullPageMenu from './FullPageMenu';
import { notificationSounds } from '@/utils/notificationSounds';
import PaymentRedistributionDialog from './PaymentRedistributionDialog';

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  item_name: string | null;
  item_type: string | null;
  menu_items: { name: string } | null;
}

interface Order {
  id: string;
  order_number: number;
  status: string;
  total_amount: number;
  amount_paid: number;
  payment_method: string | null;
  is_debt: boolean;
  debtor_name: string | null;
  notes?: string | null;
  created_at: string;
  waiter_id: string | null;
  linked_order_id?: string | null;
  order_items?: OrderItem[];
}

interface PaymentSplit {
  method: 'cash' | 'mpesa' | 'kcb' | 'debt';
  amount: number;
}

interface Props {
  employeeId: string;
  employeeName: string;
  readOnly?: boolean;
}

const VAT_RATE = 0.16;

const formatKES = (amount: number) => `KES ${amount.toLocaleString('en-KE')}`;
const generateOrderId = (orderNumber: number) => `EH${orderNumber}`;

const calculateVatFromInclusive = (total: number) => total * (VAT_RATE / (1 + VAT_RATE));
const calculatePreVatAmount = (total: number) => total / (1 + VAT_RATE);

export default function NewRestaurantTab({ employeeId, employeeName, readOnly = false }: Props) {
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [debtOrders, setDebtOrders] = useState<Order[]>([]);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  
  const [payments, setPayments] = useState<PaymentSplit[]>([]);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Order | null>(null);
  const [debtorName, setDebtorName] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptOrders, setReceiptOrders] = useState<Order[]>([]);
  
  const [menuOpen, setMenuOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(true);
  const [debtorsOpen, setDebtorsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [redistributionOrder, setRedistributionOrder] = useState<Order | null>(null);
  const [redistributionDialogOpen, setRedistributionDialogOpen] = useState(false);
  
  const receiptRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!employeeId) return;
    
    fetchPendingOrders();
    fetchDebtOrders();
    fetchHistory();

    // Track previous order statuses to detect "served" transitions
    let previousOrderStatuses: Map<string, string> = new Map();

    const channel = supabase
      .channel(`restaurant-orders-${employeeId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        const newOrder = payload.new as any;
        const oldStatus = previousOrderStatuses.get(newOrder.id);
        
        // If order just became "served" and waiter owns it, play notification
        if (newOrder.status === 'served' && oldStatus !== 'served' && newOrder.waiter_id === employeeId) {
          notificationSounds.playOrderServedSound();
          toast({
            title: '✅ Order Served!',
            description: `Order EH${newOrder.order_number} is ready for payment`,
          });
        }
        
        // Update tracked status
        previousOrderStatuses.set(newOrder.id, newOrder.status);
        
        fetchPendingOrders();
        fetchDebtOrders();
        fetchHistory();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const newOrder = payload.new as any;
        previousOrderStatuses.set(newOrder.id, newOrder.status);
        fetchPendingOrders();
        fetchDebtOrders();
        fetchHistory();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, () => {
        // Refetch orders when any order is deleted (e.g., by admin or kitchen decline)
        fetchPendingOrders();
        fetchDebtOrders();
        fetchHistory();
      })
      .subscribe();

    // Initialize status tracking from current orders
    fetchPendingOrders().then(() => {
      pendingOrders.forEach(o => previousOrderStatuses.set(o.id, o.status));
    });

    return () => { supabase.removeChannel(channel); };
  }, [employeeId]);

  const fetchPendingOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select(`*, order_items (id, quantity, price, item_name, item_type, menu_items (name))`)
      .eq('waiter_id', employeeId)
      .in('status', ['pending', 'preparing', 'served'])
      .eq('is_debt', false)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setPendingOrders(data as Order[]);
  };

  const fetchDebtOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select(`*, order_items (id, quantity, price, item_name, item_type, menu_items (name))`)
      .eq('is_debt', true)
      .eq('waiter_id', employeeId)
      .neq('status', 'paid')
      .order('created_at', { ascending: false });
    if (data) setDebtOrders(data as Order[]);
  };

  const fetchHistory = async () => {
    const { data } = await supabase
      .from('orders')
      .select(`*, order_items (id, quantity, price, item_name, item_type, menu_items (name))`)
      .eq('waiter_id', employeeId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setHistoryOrders(data as Order[]);
  };

  const handleDeleteOrderItem = async (orderId: string, itemId: string) => {
    try {
      const order = pendingOrders.find(o => o.id === orderId);
      if (!order) return;
      
      // Only allow deletion if order is pending (not yet accepted by kitchen)
      if (order.status !== 'pending') {
        toast({ title: 'Cannot edit', description: 'Order already accepted by kitchen', variant: 'destructive' });
        return;
      }

      const item = order.order_items?.find(i => i.id === itemId);
      if (!item) return;

      // Delete the item
      await supabase.from('order_items').delete().eq('id', itemId);
      
      // Update order total
      const newTotal = order.total_amount - (item.price * item.quantity);
      await supabase.from('orders').update({ total_amount: newTotal }).eq('id', orderId);

      // If no items left, delete the order
      const remainingItems = (order.order_items?.length || 0) - 1;
      if (remainingItems === 0) {
        await supabase.from('orders').delete().eq('id', orderId);
      }

      toast({ title: 'Item removed' });
      fetchPendingOrders();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      const order = pendingOrders.find(o => o.id === orderId);
      if (!order) return;

      // Keep waiter rule: only pending orders are cancellable
      if (order.status !== 'pending') {
        toast({ title: 'Cannot delete', description: 'Order already accepted by kitchen', variant: 'destructive' });
        return;
      }

      // If this is a split order, delete the entire group so nothing remains in Kitchen.
      const ids = new Set<string>([orderId]);

      const { data: baseOrder, error: baseErr } = await supabase
        .from('orders')
        .select('id, status, linked_order_id')
        .eq('id', orderId)
        .maybeSingle();
      if (baseErr) throw baseErr;

      if (baseOrder?.linked_order_id) ids.add(baseOrder.linked_order_id);

      const { data: reverseLinked, error: reverseErr } = await supabase
        .from('orders')
        .select('id, status')
        .eq('linked_order_id', orderId);
      if (reverseErr) throw reverseErr;
      reverseLinked?.forEach((o) => ids.add(o.id));

      const groupIds = Array.from(ids);

      // Safety: waiter cannot cancel if any linked part is already preparing/served/paid.
      const { data: groupOrders, error: groupErr } = await supabase
        .from('orders')
        .select('id, status')
        .in('id', groupIds);
      if (groupErr) throw groupErr;

      const hasNonPending = (groupOrders || []).some((o) => o.status !== 'pending');
      if (hasNonPending) {
        toast({ title: 'Cannot delete', description: 'A linked part of this order is already in progress.', variant: 'destructive' });
        return;
      }

      await supabase.from('order_items').delete().in('order_id', groupIds);
      await supabase.from('orders').delete().in('id', groupIds);

      toast({ title: 'Order deleted' });
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

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
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

    const dbPaymentMethod = (() => {
      const methods = payments
        .filter(p => p.amount > 0 && p.method !== 'debt')
        .map(p => p.method);
      const unique = Array.from(new Set(methods));
      if (unique.length === 0) return null;
      if (unique.length === 1) {
        const m = unique[0];
        return m === 'cash' ? 'cash' : m === 'mpesa' ? 'mobile' : 'card';
      }
      return 'mixed';
    })();

    try {
      const newAmountPaid = order.amount_paid + cashPaid;
      const isFullyPaid = newAmountPaid >= order.total_amount && debtAmount === 0;
      const hasDebt = debtAmount > 0;

      const { error } = await supabase
        .from('orders')
        .update({
          amount_paid: newAmountPaid,
          payment_method: dbPaymentMethod,
          status: isFullyPaid ? 'paid' : order.status,
          is_debt: hasDebt,
          debtor_name: hasDebt ? debtorName.trim() : order.debtor_name,
        })
        .eq('id', order.id);

      if (error) throw error;

      if (isFullyPaid) {
        const ordersToShow: Order[] = [];
        const { data: fullOrder } = await supabase
          .from('orders')
          .select(`*, order_items (id, quantity, price, item_name, item_type, menu_items (name))`)
          .eq('id', order.id)
          .single();
        
        if (fullOrder) {
          ordersToShow.push(fullOrder as Order);
          if (fullOrder.linked_order_id) {
            const { data: linkedOrder } = await supabase
              .from('orders')
              .select(`*, order_items (id, quantity, price, item_name, item_type, menu_items (name))`)
              .eq('id', fullOrder.linked_order_id)
              .single();
            if (linkedOrder && linkedOrder.status === 'paid') {
              ordersToShow.push(linkedOrder as Order);
            }
          }
        }
        
        setReceiptOrders(ordersToShow);
        setShowReceipt(true);
        toast({ title: 'Payment complete!', description: 'Receipt generated' });
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30';
      case 'preparing': return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
      case 'served': return 'bg-purple-500/10 text-purple-600 border-purple-500/30';
      case 'paid': return 'bg-green-500/10 text-green-600 border-green-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const servedOrders = pendingOrders.filter(o => o.status === 'served' && (o.total_amount - o.amount_paid) > 0);
  const kitchenOrders = pendingOrders.filter(o => o.status === 'pending' || o.status === 'preparing');

  const PaymentMethodButton = ({ method, logo, label }: { method: 'cash' | 'mpesa' | 'kcb'; logo: string; label: string }) => {
    const isActive = payments.some(p => p.method === method);
    return (
      <button
        onClick={() => addPayment(method)}
        disabled={readOnly}
        className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
          isActive 
            ? 'border-primary bg-primary/10 ring-2 ring-primary/30' 
            : 'border-border hover:border-primary/50 bg-card hover:bg-muted/50'
        } ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <img src={logo} alt={label} className="w-12 h-12 object-contain" />
        <span className="text-xs font-medium">{label}</span>
        {isActive && <Check className="w-4 h-4 text-primary" />}
      </button>
    );
  };

  const CollapsibleSection = ({ 
    title, 
    icon: Icon, 
    isOpen, 
    onToggle, 
    badge,
    children 
  }: { 
    title: string; 
    icon: React.ElementType; 
    isOpen: boolean; 
    onToggle: () => void;
    badge?: number;
    children: React.ReactNode;
  }) => (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="w-5 h-5" />
                {title}
                {badge !== undefined && badge > 0 && (
                  <Badge variant="secondary">{badge}</Badge>
                )}
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

  const getReceiptTotal = () => receiptOrders.reduce((sum, o) => sum + o.total_amount, 0);
  const getAllReceiptItems = () => {
    const items: OrderItem[] = [];
    receiptOrders.forEach(order => {
      if (order.order_items) {
        items.push(...order.order_items);
      }
    });
    return items;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Restaurant</h2>
          <p className="text-muted-foreground">Waiter: {employeeName}</p>
        </div>
        {!readOnly && (
          <Button onClick={() => setMenuOpen(true)} size="lg">
            <Plus className="w-4 h-4 mr-2" />
            New Order
          </Button>
        )}
      </div>

      {/* Full Page Menu */}
      <FullPageMenu 
        isOpen={menuOpen} 
        onClose={() => setMenuOpen(false)} 
        employeeId={employeeId}
        onOrderPlaced={() => {
          fetchPendingOrders();
          setMenuOpen(false);
        }}
      />

      {/* Pending Kitchen Orders */}
      {kitchenOrders.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <ChefHat className="w-5 h-5" />
              In Kitchen ({kitchenOrders.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {kitchenOrders.map(order => (
              <div key={order.id} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-bold">{generateOrderId(order.order_number)}</span>
                    <Badge className={`ml-2 ${getStatusColor(order.status)}`}>{order.status}</Badge>
                  </div>
                  <span className="font-medium">{formatKES(order.total_amount)}</span>
                </div>
                <div className="text-sm space-y-1">
                  {order.order_items?.map(item => (
                    <div key={item.id} className="flex justify-between items-center">
                      <span>{item.quantity}x {item.item_name || item.menu_items?.name}</span>
                      {!readOnly && order.status === 'pending' && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-6 w-6 p-0"
                          onClick={() => handleDeleteOrderItem(order.id, item.id)}
                        >
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {!readOnly && order.status === 'pending' && (
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    className="mt-2"
                    onClick={() => handleDeleteOrder(order.id)}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Cancel Order
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Payment Section */}
      <CollapsibleSection 
        title="Payment" 
        icon={CreditCard} 
        isOpen={paymentOpen} 
        onToggle={() => setPaymentOpen(!paymentOpen)}
        badge={servedOrders.length}
      >
        <div className="space-y-4">
          {servedOrders.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No orders ready for payment</p>
          ) : (
            <div className="grid gap-3">
              {servedOrders.map(order => {
                const isSelected = selectedOrderForPayment?.id === order.id;
                const balance = order.total_amount - order.amount_paid;
                
                return (
                  <Card 
                    key={order.id} 
                    className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}
                    onClick={() => !readOnly && setSelectedOrderForPayment(isSelected ? null : order)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-bold">{generateOrderId(order.order_number)}</span>
                          <Badge className="ml-2 bg-purple-500/10 text-purple-600">Ready</Badge>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{formatKES(balance)}</div>
                          <div className="text-xs text-muted-foreground">to pay</div>
                        </div>
                      </div>
                      
                      <div className="text-sm space-y-1 bg-muted/50 p-2 rounded">
                        {order.order_items?.map(item => (
                          <div key={item.id}>{item.quantity}x {item.item_name || item.menu_items?.name}</div>
                        ))}
                      </div>

                      {isSelected && !readOnly && (
                        <div className="mt-4 space-y-4" onClick={e => e.stopPropagation()}>
                          <div className="grid grid-cols-4 gap-2">
                            <PaymentMethodButton method="cash" logo={cashLogo} label="Cash" />
                            <PaymentMethodButton method="mpesa" logo={mpesaLogo} label="M-Pesa" />
                            <PaymentMethodButton method="kcb" logo={kcbLogo} label="KCB" />
                            <button
                              onClick={() => addPayment('debt')}
                              className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                                payments.some(p => p.method === 'debt')
                                  ? 'border-orange-500 bg-orange-500/10'
                                  : 'border-border hover:border-orange-500/50'
                              }`}
                            >
                              <User className="w-8 h-8 text-orange-500" />
                              <span className="text-xs font-medium">Debt</span>
                            </button>
                          </div>

                          {payments.map((payment, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <Badge variant="outline" className="capitalize">{payment.method}</Badge>
                              <Input
                                type="number"
                                placeholder="Amount"
                                className="flex-1"
                                defaultValue={payment.amount > 0 ? payment.amount : ''}
                                onBlur={(e) => updatePaymentAmount(idx, parseFloat(e.target.value) || 0)}
                              />
                              <Button size="icon" variant="ghost" onClick={() => removePayment(idx)}>
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}

                          {payments.some(p => p.method === 'debt') && (
                            <Input
                              placeholder="Debtor name"
                              value={debtorName}
                              onChange={(e) => setDebtorName(e.target.value)}
                            />
                          )}

                          <div className="flex justify-between text-sm">
                            <span>Paid: {formatKES(getTotalPaid())}</span>
                            <span>Remaining: {formatKES(Math.max(0, balance - getTotalPaid() - getDebtAmount()))}</span>
                          </div>

                          <Button onClick={handlePayOrder} className="w-full">
                            <Check className="w-4 h-4 mr-2" />
                            Confirm Payment
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Debtors */}
      <CollapsibleSection 
        title="My Debtors" 
        icon={User} 
        isOpen={debtorsOpen} 
        onToggle={() => setDebtorsOpen(!debtorsOpen)}
        badge={debtOrders.length}
      >
        <div className="space-y-3">
          {debtOrders.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No outstanding debts</p>
          ) : (
            debtOrders.map(order => {
              const balance = order.total_amount - order.amount_paid;
              return (
                <div key={order.id} className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-bold">{generateOrderId(order.order_number)}</span>
                      <div className="text-sm text-orange-700">{order.debtor_name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-orange-600">{formatKES(balance)}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(order.created_at), 'MMM d, yyyy')}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm space-y-1">
                    {order.order_items?.map(item => (
                      <div key={item.id}>{item.quantity}x {item.item_name || item.menu_items?.name}</div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CollapsibleSection>

      {/* History */}
      <CollapsibleSection 
        title="My History" 
        icon={History} 
        isOpen={historyOpen} 
        onToggle={() => setHistoryOpen(!historyOpen)}
      >
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {historyOrders.map(order => {
            const orderDate = new Date(order.created_at);
            const canEdit = isToday(orderDate) && (order.status === 'paid' || order.status === 'served');
            
            return (
              <div key={order.id} className="p-3 bg-muted/50 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-bold">{generateOrderId(order.order_number)}</span>
                    <div className="text-xs text-muted-foreground">
                      {format(orderDate, 'MMM d, yyyy HH:mm')}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                    <div className="font-medium mt-1">{formatKES(order.total_amount)}</div>
                  </div>
                </div>
                <div className="text-sm space-y-1">
                  {order.order_items?.map(item => (
                    <div key={item.id}>{item.quantity}x {item.item_name || item.menu_items?.name}</div>
                  ))}
                </div>
                {order.payment_method && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Payment: {order.payment_method}
                    {order.is_debt && order.debtor_name && ` • Debtor: ${order.debtor_name}`}
                  </div>
                )}
                {/* Edit Payment Button - Only for today's paid/served orders */}
                {canEdit && !readOnly && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => {
                      setRedistributionOrder(order);
                      setRedistributionDialogOpen(true);
                    }}
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Edit Payment
                  </Button>
                )}
              </div>
            );
          })}
          {historyOrders.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No order history yet</p>
          )}
        </div>
      </CollapsibleSection>

      {/* Payment Redistribution Dialog */}
      <PaymentRedistributionDialog
        order={redistributionOrder}
        isOpen={redistributionDialogOpen}
        onClose={() => {
          setRedistributionDialogOpen(false);
          setRedistributionOrder(null);
        }}
        onSuccess={() => {
          fetchPendingOrders();
          fetchDebtOrders();
          fetchHistory();
        }}
      />

      {/* Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Receipt</DialogTitle>
          </DialogHeader>
          {receiptOrders.length > 0 && (
            <div ref={receiptRef} className="space-y-4 p-4 bg-white text-black rounded-lg font-mono text-sm">
              <div className="text-center border-b pb-3">
                <img src={enaitotiLogo} alt="Enaitoti Hotel" className="w-16 h-16 mx-auto mb-2 rounded-full object-cover" />
                <h3 className="font-bold text-lg">ENAITOTI HOTEL</h3>
                <p className="text-xs text-gray-600">Official Receipt</p>
                <p className="text-xs text-gray-600">{format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
              </div>
              
              <div className="text-center font-bold">
                {receiptOrders.length === 1 ? (
                  <>Order: {generateOrderId(receiptOrders[0].order_number)}</>
                ) : (
                  <>Orders: {receiptOrders.map(o => generateOrderId(o.order_number)).join(' + ')}</>
                )}
              </div>
              
              <div className="border-t border-b py-2 space-y-1">
                {getAllReceiptItems().map(item => (
                  <div key={item.id} className="flex justify-between">
                    <span>{item.quantity}x {item.item_name || item.menu_items?.name}</span>
                    <span>{formatKES(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal (excl. VAT):</span>
                  <span>{formatKES(calculatePreVatAmount(getReceiptTotal()))}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>VAT (16%):</span>
                  <span>{formatKES(calculateVatFromInclusive(getReceiptTotal()))}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-1 border-t">
                  <span>TOTAL</span>
                  <span>{formatKES(getReceiptTotal())}</span>
                </div>
              </div>
              
              <div className="bg-gray-100 rounded p-2 text-center">
                <span className="text-xs text-gray-500">Paid via:</span>
                <div className="font-semibold text-sm mt-1">
                  {receiptOrders.map(o => o.payment_method).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).map(method => (
                    <span key={method} className="inline-block px-2 py-0.5 bg-green-100 text-green-700 rounded mx-0.5 uppercase">
                      {method}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="text-center text-xs text-gray-600 pt-2 border-t">
                <p>Thank you for dining with us!</p>
                <p className="mt-1 text-gray-400">Powered by 4on4 tech</p>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={() => window.print()} className="flex-1">
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button 
              onClick={() => downloadReceiptPdf(receiptOrders)} 
              variant="outline"
              className="flex-1"
            >
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
