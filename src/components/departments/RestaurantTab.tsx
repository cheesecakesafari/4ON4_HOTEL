import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, ShoppingCart, User, Printer, Check, X, CreditCard, History, ChevronDown, ChevronRight, AlertCircle, ChefHat, DollarSign, UtensilsCrossed, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import mpesaLogo from '@/assets/mpesa-logo.png';
import kcbLogo from '@/assets/kcb-logo.png';
import cashLogo from '@/assets/cash-logo.png';
import enaitotiLogo from '@/assets/enaitoti-logo.jpg';
import { downloadReceiptPdf } from '@/utils/receiptPdf';

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  is_available: boolean;
  requires_kitchen: boolean;
}

interface MenuCombo {
  id: string;
  name: string;
  description: string | null;
  price: number;
  is_available: boolean;
}

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
}

const VAT_RATE = 0.16; // 16% VAT inclusive

const formatKES = (amount: number) => `KES ${amount.toLocaleString('en-KE')}`;
const generateOrderId = (orderNumber: number) => `EH${orderNumber}`;

// Calculate VAT from inclusive price: VAT = Total × (Rate / (1 + Rate))
const calculateVatFromInclusive = (total: number) => {
  return total * (VAT_RATE / (1 + VAT_RATE));
};

// Calculate pre-VAT amount: PreVAT = Total / (1 + Rate)
const calculatePreVatAmount = (total: number) => {
  return total / (1 + VAT_RATE);
};

export default function RestaurantTab({ employeeId, employeeName }: Props) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuCombos, setMenuCombos] = useState<MenuCombo[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [debtOrders, setDebtOrders] = useState<Order[]>([]);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  
  // Selected items for order creation
  const [selectedCombos, setSelectedCombos] = useState<Map<string, number>>(new Map());
  const [selectedItems, setSelectedItems] = useState<Map<string, number>>(new Map());
  
  // Payments
  const [payments, setPayments] = useState<PaymentSplit[]>([]);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Order | null>(null);
  const [debtorName, setDebtorName] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptOrders, setReceiptOrders] = useState<Order[]>([]); // Changed to array for combined receipts
  
  // Collapsible states
  const [createOrderOpen, setCreateOrderOpen] = useState(true);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [debtorsOpen, setDebtorsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  
  const receiptRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!employeeId) return;
    
    fetchMenuItems();
    fetchMenuCombos();
    fetchPendingOrders();
    fetchDebtOrders();
    fetchHistory();

    const channel = supabase
      .channel(`restaurant-orders-${employeeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchPendingOrders();
        fetchDebtOrders();
        fetchHistory();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [employeeId]);

  const fetchMenuItems = async () => {
    const { data } = await supabase
      .from('menu_items')
      .select('*')
      .eq('is_available', true)
      .order('category')
      .order('name');
    if (data) setMenuItems(data as MenuItem[]);
  };

  const fetchMenuCombos = async () => {
    const { data } = await supabase
      .from('menu_combos')
      .select('*')
      .eq('is_available', true)
      .order('name');
    if (data) setMenuCombos(data);
  };

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

  // Combo selection functions
  const toggleCombo = (comboId: string) => {
    setSelectedCombos(prev => {
      const newMap = new Map(prev);
      if (newMap.has(comboId)) {
        newMap.delete(comboId);
      } else {
        newMap.set(comboId, 1);
      }
      return newMap;
    });
  };

  const updateComboQuantity = (comboId: string, quantity: number) => {
    if (quantity <= 0) {
      setSelectedCombos(prev => {
        const newMap = new Map(prev);
        newMap.delete(comboId);
        return newMap;
      });
      return;
    }
    setSelectedCombos(prev => {
      const newMap = new Map(prev);
      newMap.set(comboId, quantity);
      return newMap;
    });
  };

  // Item selection functions
  const toggleItem = (itemId: string) => {
    setSelectedItems(prev => {
      const newMap = new Map(prev);
      if (newMap.has(itemId)) {
        newMap.delete(itemId);
      } else {
        newMap.set(itemId, 1);
      }
      return newMap;
    });
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      setSelectedItems(prev => {
        const newMap = new Map(prev);
        newMap.delete(itemId);
        return newMap;
      });
      return;
    }
    setSelectedItems(prev => {
      const newMap = new Map(prev);
      newMap.set(itemId, quantity);
      return newMap;
    });
  };

  // Get kitchen items (combos + items with requires_kitchen)
  const getKitchenItems = () => {
    const items: { item: MenuItem; quantity: number }[] = [];
    selectedItems.forEach((qty, itemId) => {
      const item = menuItems.find(m => m.id === itemId);
      if (item?.requires_kitchen) {
        items.push({ item, quantity: qty });
      }
    });
    return items;
  };

  // Get direct items (items without requires_kitchen)
  const getDirectItems = () => {
    const items: { item: MenuItem; quantity: number }[] = [];
    selectedItems.forEach((qty, itemId) => {
      const item = menuItems.find(m => m.id === itemId);
      if (item && !item.requires_kitchen) {
        items.push({ item, quantity: qty });
      }
    });
    return items;
  };

  // Calculate totals
  const getComboTotal = () => {
    let total = 0;
    selectedCombos.forEach((qty, comboId) => {
      const combo = menuCombos.find(c => c.id === comboId);
      if (combo) total += combo.price * qty;
    });
    return total;
  };

  const getKitchenItemsTotal = () => {
    return getKitchenItems().reduce((sum, { item, quantity }) => sum + item.price * quantity, 0);
  };

  const getDirectItemsTotal = () => {
    return getDirectItems().reduce((sum, { item, quantity }) => sum + item.price * quantity, 0);
  };

  const getKitchenTotal = () => getComboTotal() + getKitchenItemsTotal();
  const getCartTotal = () => getKitchenTotal() + getDirectItemsTotal();
  const getTotalSelections = () => selectedCombos.size + selectedItems.size;

  // Check if any selected item requires kitchen
  const hasKitchenItems = () => {
    if (selectedCombos.size > 0) return true;
    return getKitchenItems().length > 0;
  };

  const hasDirectItems = () => getDirectItems().length > 0;

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

  // MAIN ORDER FUNCTION: Handles split orders automatically
  const handlePlaceOrder = async () => {
    if (selectedCombos.size === 0 && selectedItems.size === 0) {
      toast({ title: 'No items selected', variant: 'destructive' });
      return;
    }

    const kitchenItems = getKitchenItems();
    const directItems = getDirectItems();
    const kitchenTotal = getKitchenTotal();
    const directTotal = getDirectItemsTotal();

    try {
      let kitchenOrderId: string | null = null;
      let directOrderId: string | null = null;

      // Create kitchen order if there are kitchen items (combos or kitchen-required items)
      if (hasKitchenItems()) {
        const { data: kitchenOrder, error: kitchenError } = await supabase
          .from('orders')
          .insert({
            waiter_id: employeeId,
            status: 'pending',
            total_amount: kitchenTotal,
            amount_paid: 0,
            is_debt: false,
            notes: selectedCombos.size > 0 ? `COMBOS: ${Array.from(selectedCombos.entries()).map(([id, qty]) => {
              const combo = menuCombos.find(c => c.id === id);
              return `${qty}x ${combo?.name}`;
            }).join(', ')}` : null,
          })
          .select()
          .single();

        if (kitchenError) throw kitchenError;
        kitchenOrderId = kitchenOrder.id;

        // Add kitchen order items
        const orderItems: { order_id: string; menu_item_id: string | null; quantity: number; price: number; item_name: string; item_type: string }[] = [];
        
        kitchenItems.forEach(({ item, quantity }) => {
          orderItems.push({
            order_id: kitchenOrder.id,
            menu_item_id: item.id,
            quantity,
            price: item.price,
            item_name: item.name,
            item_type: 'kitchen',
          });
        });

        // Add combos as items (no menu_item_id since combos are from menu_combos table)
        selectedCombos.forEach((qty, comboId) => {
          const combo = menuCombos.find(c => c.id === comboId);
          if (combo) {
            orderItems.push({
              order_id: kitchenOrder.id,
              menu_item_id: null, // Combos don't reference menu_items
              quantity: qty,
              price: combo.price,
              item_name: combo.name,
              item_type: 'combo',
            });
          }
        });

        if (orderItems.length > 0) {
          const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
          if (itemsError) throw itemsError;
        }
      }

      // Create direct order if there are direct items
      if (hasDirectItems()) {
        const { data: directOrder, error: directError } = await supabase
          .from('orders')
          .insert({
            waiter_id: employeeId,
            status: 'served', // Direct items are immediately "served"
            total_amount: directTotal,
            amount_paid: 0,
            is_debt: false,
            linked_order_id: kitchenOrderId, // Link to kitchen order if exists
          })
          .select()
          .single();

        if (directError) throw directError;
        directOrderId = directOrder.id;

        // Add direct order items
        const directOrderItems = directItems.map(({ item, quantity }) => ({
          order_id: directOrder.id,
          menu_item_id: item.id,
          quantity,
          price: item.price,
          item_name: item.name,
          item_type: 'direct',
        }));

        if (directOrderItems.length > 0) {
          const { error: itemsError } = await supabase.from('order_items').insert(directOrderItems);
          if (itemsError) throw itemsError;
        }

        // If there's a kitchen order, link it back to the direct order
        if (kitchenOrderId) {
          await supabase
            .from('orders')
            .update({ linked_order_id: directOrderId })
            .eq('id', kitchenOrderId);
        }
      }

      // Success message
      const messages: string[] = [];
      if (kitchenOrderId) messages.push('Kitchen order sent');
      if (directOrderId) messages.push('Direct items ready for payment');
      
      toast({ 
        title: 'Order placed!', 
        description: messages.join(' • ') 
      });

      setSelectedCombos(new Map());
      setSelectedItems(new Map());
      fetchPendingOrders();
    } catch (error: any) {
      toast({ title: 'Error creating order', description: error.message, variant: 'destructive' });
    }
  };

  // Direct payment dialog state
  const [directPayOpen, setDirectPayOpen] = useState(false);
  const [directPayments, setDirectPayments] = useState<PaymentSplit[]>([]);

  const handlePayOrder = async () => {
    if (!selectedOrderForPayment) return;

    const order = selectedOrderForPayment;
    const balance = order.total_amount - order.amount_paid;
    
    const cashPaid = payments.filter(p => p.method !== 'debt').reduce((sum, p) => sum + (p.amount || 0), 0);
    const debtAmount = payments.find(p => p.method === 'debt')?.amount || 0;
    const totalPayment = cashPaid + debtAmount;
    
    if (totalPayment === 0) {
      toast({ title: 'Enter payment amount', description: 'Please enter an amount for at least one payment method', variant: 'destructive' });
      return;
    }

    if (debtAmount > 0 && !debtorName.trim()) {
      toast({ title: 'Debtor name required', description: 'Please enter the debtor name', variant: 'destructive' });
      return;
    }

    if (totalPayment > balance) {
      toast({ title: 'Amount exceeds balance', description: `Maximum payable is ${formatKES(balance)}`, variant: 'destructive' });
      return;
    }

    const paymentMethodParts = payments
      .filter(p => p.amount > 0)
      .map(p => `${p.method}:${p.amount}`);

    const dbPaymentMethod = (() => {
      const methods = payments
        .filter(p => p.amount > 0 && p.method !== 'debt')
        .map(p => p.method as 'cash' | 'mpesa' | 'kcb');
      const unique = Array.from(new Set(methods));
      if (unique.length === 0) return null;
      if (unique.length === 1) {
        const m = unique[0];
        return m === 'cash' ? 'cash' : m === 'mpesa' ? 'mobile' : 'card';
      }
      return 'pending';
    })();

    const paymentLog = `PAYMENT ${new Date().toISOString()} | ${paymentMethodParts.join(',')}`;
    const nextNotes = [order.notes, paymentLog].filter(Boolean).join('\n');

    try {
      const newAmountPaid = order.amount_paid + cashPaid;
      const isFullyPaid = newAmountPaid >= order.total_amount && debtAmount === 0;
      const hasDebt = debtAmount > 0;
      const remainingBalance = balance - totalPayment;

      const { error } = await supabase
        .from('orders')
        .update({
          amount_paid: newAmountPaid,
          payment_method: dbPaymentMethod,
          notes: nextNotes || null,
          status: isFullyPaid ? 'paid' : order.status,
          is_debt: hasDebt,
          debtor_name: hasDebt ? debtorName.trim() : order.debtor_name,
        })
        .eq('id', order.id);

      if (error) throw error;

      if (isFullyPaid) {
        // Fetch the order and any linked orders for combined receipt
        const ordersToShow: Order[] = [];
        
        const { data: fullOrder } = await supabase
          .from('orders')
          .select(`*, order_items (id, quantity, price, item_name, item_type, menu_items (name))`)
          .eq('id', order.id)
          .single();
        
        if (fullOrder) {
          ordersToShow.push(fullOrder as Order);
          
          // Check for linked order
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
          
          // Also check if this order is linked FROM another order
          const { data: parentOrders } = await supabase
            .from('orders')
            .select(`*, order_items (id, quantity, price, item_name, item_type, menu_items (name))`)
            .eq('linked_order_id', order.id)
            .eq('status', 'paid');
          
          if (parentOrders) {
            ordersToShow.push(...(parentOrders as Order[]));
          }
        }
        
        setReceiptOrders(ordersToShow);
        setShowReceipt(true);
        toast({ title: 'Payment complete!', description: 'Receipt generated - Order fully paid' });
      } else if (hasDebt) {
        toast({ 
          title: 'Payment recorded with debt', 
          description: `Cash: ${formatKES(cashPaid)} | Debt: ${formatKES(debtAmount)} (${debtorName})${remainingBalance > 0 ? ` | Remaining: ${formatKES(remainingBalance)}` : ''}`
        });
      } else if (remainingBalance > 0) {
        toast({ 
          title: 'Partial payment recorded', 
          description: `Paid: ${formatKES(cashPaid)} | Remaining: ${formatKES(remainingBalance)}`
        });
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
      toast({ title: 'Error processing payment', description: error.message, variant: 'destructive' });
    }
  };

  const [selectedDebtOrder, setSelectedDebtOrder] = useState<Order | null>(null);
  const [debtPaymentAmount, setDebtPaymentAmount] = useState<number>(0);
  const [debtPaymentMethod, setDebtPaymentMethod] = useState<'cash' | 'mpesa' | 'kcb'>('cash');

  const handlePayDebt = async (order: Order, amount: number, method: 'cash' | 'mpesa' | 'kcb') => {
    const balance = order.total_amount - order.amount_paid;
    
    if (amount <= 0) {
      toast({ title: 'Enter amount', description: 'Please enter a valid payment amount', variant: 'destructive' });
      return;
    }

    if (amount > balance) {
      toast({ title: 'Amount exceeds debt', description: `Maximum is ${formatKES(balance)}`, variant: 'destructive' });
      return;
    }
    
    try {
      const newAmountPaid = order.amount_paid + amount;
      const isFullyPaid = newAmountPaid >= order.total_amount;
      const dbMethod = method === 'cash' ? 'cash' : method === 'mpesa' ? 'mobile' : 'card';
      const paymentLog = `DEBT_PAYMENT ${new Date().toISOString()} | ${method}:${amount}`;
      const nextNotes = [order.notes, paymentLog].filter(Boolean).join('\n');

      const { error } = await supabase
        .from('orders')
        .update({
          amount_paid: newAmountPaid,
          payment_method: dbMethod,
          notes: nextNotes || null,
          status: isFullyPaid ? 'paid' : order.status,
          is_debt: !isFullyPaid,
        })
        .eq('id', order.id);

      if (error) throw error;

      if (isFullyPaid) {
        toast({ title: 'Debt fully cleared!', description: `${formatKES(amount)} paid via ${method.toUpperCase()}` });
      } else {
        const remaining = balance - amount;
        toast({ title: 'Partial debt payment', description: `${formatKES(amount)} paid | Remaining: ${formatKES(remaining)}` });
      }
      
      setSelectedDebtOrder(null);
      setDebtPaymentAmount(0);
      fetchDebtOrders();
      fetchHistory();
    } catch (error: any) {
      toast({ title: 'Error clearing debt', description: error.message, variant: 'destructive' });
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

  // Combined receipt total and items
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
      </div>

      {/* 1. CREATE ORDER */}
      <CollapsibleSection 
        title="Create Order" 
        icon={Plus} 
        isOpen={createOrderOpen} 
        onToggle={() => setCreateOrderOpen(!createOrderOpen)}
        badge={getTotalSelections()}
      >
        <div className="space-y-6">
          {/* MENU COMBOS SECTION */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4" />
              Menu Combos
              <Badge variant="secondary" className="text-xs">Kitchen</Badge>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {menuCombos.map(combo => {
                const isSelected = selectedCombos.has(combo.id);
                const quantity = selectedCombos.get(combo.id) || 0;
                return (
                  <div
                    key={combo.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                      isSelected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <label className="flex items-center gap-2 cursor-pointer flex-1">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleCombo(combo.id)}
                      />
                      <div>
                        <div className="font-medium text-sm">{combo.name}</div>
                        {combo.description && <div className="text-xs text-muted-foreground">{combo.description}</div>}
                        <div className="text-xs font-semibold text-primary">{formatKES(combo.price)}</div>
                      </div>
                    </label>
                    {isSelected && (
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => updateComboQuantity(combo.id, quantity - 1)}>-</Button>
                        <span className="w-6 text-center text-sm">{quantity}</span>
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => updateComboQuantity(combo.id, quantity + 1)}>+</Button>
                      </div>
                    )}
                  </div>
                );
              })}
              {menuCombos.length === 0 && (
                <p className="text-muted-foreground text-sm py-2 col-span-full">No combos available</p>
              )}
            </div>
          </div>

          {/* ITEMS SECTION - by category */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">Items</h4>
            
            {(['drinks', 'snacks', 'others'] as const).map(category => {
              const categoryItems = menuItems.filter(item => item.category === category);
              if (categoryItems.length === 0) return null;
              
              return (
                <div key={category} className="space-y-2">
                  <h5 className="text-sm text-muted-foreground capitalize flex items-center gap-2">
                    {category}
                    <Badge variant="outline" className="text-xs">{categoryItems.length}</Badge>
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {categoryItems.map(item => {
                      const isSelected = selectedItems.has(item.id);
                      const quantity = selectedItems.get(item.id) || 0;
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                            isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <label className="flex items-center gap-2 cursor-pointer flex-1">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleItem(item.id)}
                            />
                            <div>
                              <div className="font-medium text-sm flex items-center gap-1">
                                {item.name}
                                {item.requires_kitchen && <ChefHat className="w-3 h-3 text-orange-500" />}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-2">
                                {formatKES(item.price)}
                                {!item.requires_kitchen && <Badge variant="outline" className="text-[10px] px-1">Direct</Badge>}
                              </div>
                            </div>
                          </label>
                          {isSelected && (
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => updateQuantity(item.id, quantity - 1)}>-</Button>
                              <span className="w-6 text-center text-sm">{quantity}</span>
                              <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => updateQuantity(item.id, quantity + 1)}>+</Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Order Summary & Actions */}
          {getTotalSelections() > 0 && (
            <div className="space-y-3 pt-4 border-t">
              <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                {/* Kitchen Items Summary */}
                {hasKitchenItems() && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-orange-600 flex items-center gap-1">
                      <ChefHat className="w-3 h-3" /> Kitchen Items
                    </div>
                    {Array.from(selectedCombos.entries()).map(([comboId, qty]) => {
                      const combo = menuCombos.find(c => c.id === comboId);
                      if (!combo) return null;
                      return (
                        <div key={comboId} className="flex justify-between text-sm pl-4">
                          <span>{qty}x {combo.name}</span>
                          <span>{formatKES(combo.price * qty)}</span>
                        </div>
                      );
                    })}
                    {getKitchenItems().map(({ item, quantity }) => (
                      <div key={item.id} className="flex justify-between text-sm pl-4">
                        <span>{quantity}x {item.name}</span>
                        <span>{formatKES(item.price * quantity)}</span>
                      </div>
                    ))}
                    <div className="text-sm font-medium text-right text-orange-600">
                      Kitchen Subtotal: {formatKES(getKitchenTotal())}
                    </div>
                  </div>
                )}
                
                {/* Direct Items Summary */}
                {hasDirectItems() && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-green-600 flex items-center gap-1">
                      <DollarSign className="w-3 h-3" /> Direct Items
                    </div>
                    {getDirectItems().map(({ item, quantity }) => (
                      <div key={item.id} className="flex justify-between text-sm pl-4">
                        <span>{quantity}x {item.name}</span>
                        <span>{formatKES(item.price * quantity)}</span>
                      </div>
                    ))}
                    <div className="text-sm font-medium text-right text-green-600">
                      Direct Subtotal: {formatKES(getDirectItemsTotal())}
                    </div>
                  </div>
                )}
                
                <div className="text-right font-bold text-lg pt-2 border-t">
                  Total: {formatKES(getCartTotal())}
                </div>
              </div>

              {/* Info about split orders */}
              {hasKitchenItems() && hasDirectItems() && (
                <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950 p-2 rounded flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
                  <span>This will create 2 linked orders: Kitchen items will be sent to kitchen, direct items will be ready for immediate payment.</span>
                </div>
              )}

              {/* Single Place Order Button */}
              <Button onClick={handlePlaceOrder} className="w-full" size="lg">
                <ShoppingCart className="w-4 h-4 mr-2" />
                Place Order ({formatKES(getCartTotal())})
              </Button>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* 2. PAYMENT */}
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
            <div className="space-y-3">
              {servedOrders.map(order => {
                const balance = order.total_amount - order.amount_paid;
                const isSelected = selectedOrderForPayment?.id === order.id;
                
                return (
                  <Card 
                    key={order.id} 
                    className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary' : 'hover:bg-muted/50'}`}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedOrderForPayment(null);
                        setPayments([]);
                      } else {
                        setSelectedOrderForPayment(order);
                        setPayments([]);
                      }
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-bold">{generateOrderId(order.order_number)}</span>
                          <Badge className={`ml-2 ${getStatusColor(order.status)}`}>SERVED</Badge>
                          {order.linked_order_id && (
                            <Badge variant="outline" className="ml-1 text-xs">Linked</Badge>
                          )}
                        </div>
                        <span className="font-bold text-lg">{formatKES(balance)}</span>
                      </div>
                      
                      <div className="text-sm space-y-1 bg-muted/30 p-2 rounded mt-2">
                        {order.order_items?.map(item => (
                          <div key={item.id}>{item.quantity}x {item.item_name || item.menu_items?.name || 'Unknown'}</div>
                        ))}
                        {(!order.order_items || order.order_items.length === 0) && (
                          <span className="text-muted-foreground">No items</span>
                        )}
                      </div>

                      {/* Payment Methods - Show when selected */}
                      {isSelected && (
                        <div className="mt-4 pt-4 border-t space-y-4" onClick={e => e.stopPropagation()}>
                          <Label>Select Payment Method(s)</Label>
                          <div className="grid grid-cols-4 gap-2">
                            <PaymentMethodButton method="cash" logo={cashLogo} label="Cash" />
                            <PaymentMethodButton method="mpesa" logo={mpesaLogo} label="M-Pesa" />
                            <PaymentMethodButton method="kcb" logo={kcbLogo} label="KCB" />
                            <button
                              onClick={() => addPayment('debt')}
                              className="flex flex-col items-center gap-2 p-3 rounded-xl border-2 border-border hover:border-orange-500/50 transition-all bg-card hover:bg-orange-50"
                            >
                              <AlertCircle className="w-10 h-10 text-orange-500" />
                              <span className="text-xs font-medium">Debt</span>
                            </button>
                          </div>

                          {/* Payment splits */}
                          {payments.length > 0 && (
                            <div className="space-y-3">
                              {payments.map((payment, idx) => (
                                <div key={`payment-${payment.method}-${idx}`} className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl border">
                                  {payment.method === 'debt' ? (
                                    <AlertCircle className="w-10 h-10 text-orange-500 flex-shrink-0" />
                                  ) : (
                                    <img 
                                      src={payment.method === 'cash' ? cashLogo : payment.method === 'mpesa' ? mpesaLogo : kcbLogo} 
                                      alt={payment.method} 
                                      className="w-10 h-10 object-contain flex-shrink-0" 
                                    />
                                  )}
                                  <div className="flex-1">
                                    <span className="capitalize font-medium text-sm">{payment.method}</span>
                                    <Input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      className="mt-1 text-lg font-bold h-12"
                                      placeholder="Enter amount"
                                      defaultValue={payment.amount > 0 ? payment.amount.toString() : ''}
                                      onBlur={(e) => updatePaymentAmount(idx, parseFloat(e.target.value) || 0)}
                                      onChange={(e) => {
                                        const val = e.target.value.replace(/[^0-9.]/g, '');
                                        e.target.value = val;
                                      }}
                                    />
                                  </div>
                                  <Button size="icon" variant="ghost" className="flex-shrink-0" onClick={() => removePayment(idx)}>
                                    <X className="w-5 h-5" />
                                  </Button>
                                </div>
                              ))}

                              {/* Debtor Name Input */}
                              {payments.some(p => p.method === 'debt') && (
                                <Input
                                  placeholder="Debtor name (required)"
                                  value={debtorName}
                                  onChange={(e) => setDebtorName(e.target.value)}
                                  className="mt-2"
                                />
                              )}

                              <div className="text-sm space-y-1 p-2 bg-muted rounded-lg">
                                <div className="flex justify-between">
                                  <span>Paid (Cash/M-Pesa/KCB):</span>
                                  <span className="font-medium text-green-600">{formatKES(getTotalPaid())}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>As Debt:</span>
                                  <span className="font-medium text-orange-600">{formatKES(getDebtAmount())}</span>
                                </div>
                                <div className="flex justify-between border-t pt-1">
                                  <span>Remaining:</span>
                                  <span className="font-medium">{formatKES(Math.max(0, balance - getTotalPaid() - getDebtAmount()))}</span>
                                </div>
                                <div className="flex justify-between font-bold">
                                  <span>Order Total:</span>
                                  <span>{formatKES(balance)}</span>
                                </div>
                              </div>

                              <Button 
                                onClick={handlePayOrder} 
                                className="w-full"
                                disabled={(getTotalPaid() === 0 && getDebtAmount() === 0) || (payments.some(p => p.method === 'debt' && p.amount > 0) && !debtorName.trim())}
                              >
                                <Check className="w-4 h-4 mr-2" />
                                Confirm Payment
                              </Button>
                            </div>
                          )}
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

      {/* 3. DEBTORS */}
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
              const isSelected = selectedDebtOrder?.id === order.id;
              return (
                <div 
                  key={order.id} 
                  className={`p-4 bg-orange-50 border rounded-lg cursor-pointer transition-all ${isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-orange-200 hover:border-orange-400'}`}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedDebtOrder(null);
                      setDebtPaymentAmount(0);
                    } else {
                      setSelectedDebtOrder(order);
                      setDebtPaymentAmount(balance);
                    }
                  }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-bold">{generateOrderId(order.order_number)}</span>
                      <div className="text-sm text-orange-700 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {order.debtor_name}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-orange-600">{formatKES(balance)}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(order.created_at), 'MMM d, yyyy')}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm space-y-1 bg-orange-100/50 p-2 rounded mb-3">
                    {order.order_items?.map(item => (
                      <div key={item.id}>{item.quantity}x {item.item_name || item.menu_items?.name || 'Unknown'}</div>
                    ))}
                    {(!order.order_items || order.order_items.length === 0) && (
                      <span className="text-muted-foreground">No items</span>
                    )}
                  </div>
                  
                  {/* Payment UI when selected */}
                  {isSelected && (
                    <div className="mt-3 pt-3 border-t border-orange-300 space-y-3" onClick={e => e.stopPropagation()}>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => setDebtPaymentMethod('cash')}
                          className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all ${debtPaymentMethod === 'cash' ? 'border-primary bg-primary/10' : 'border-border'}`}
                        >
                          <img src={cashLogo} alt="Cash" className="w-8 h-8 object-contain" />
                          <span className="text-xs">Cash</span>
                        </button>
                        <button
                          onClick={() => setDebtPaymentMethod('mpesa')}
                          className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all ${debtPaymentMethod === 'mpesa' ? 'border-primary bg-primary/10' : 'border-border'}`}
                        >
                          <img src={mpesaLogo} alt="M-Pesa" className="w-8 h-8 object-contain" />
                          <span className="text-xs">M-Pesa</span>
                        </button>
                        <button
                          onClick={() => setDebtPaymentMethod('kcb')}
                          className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all ${debtPaymentMethod === 'kcb' ? 'border-primary bg-primary/10' : 'border-border'}`}
                        >
                          <img src={kcbLogo} alt="KCB" className="w-8 h-8 object-contain" />
                          <span className="text-xs">KCB</span>
                        </button>
                      </div>
                      
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Amount"
                          value={debtPaymentAmount}
                          onChange={(e) => setDebtPaymentAmount(parseFloat(e.target.value) || 0)}
                          className="flex-1"
                        />
                        <Button 
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handlePayDebt(order, debtPaymentAmount, debtPaymentMethod)}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Pay
                        </Button>
                      </div>
                      
                      <div className="text-xs text-muted-foreground text-center">
                        Full: {formatKES(balance)} | Paying: {formatKES(debtPaymentAmount)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CollapsibleSection>

      {/* 4. MY HISTORY */}
      <CollapsibleSection 
        title="My History" 
        icon={History} 
        isOpen={historyOpen} 
        onToggle={() => setHistoryOpen(!historyOpen)}
      >
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {historyOrders.map(order => (
            <div key={order.id} className="p-3 bg-muted/50 rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="font-bold">{generateOrderId(order.order_number)}</span>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(order.created_at), 'MMM d, yyyy HH:mm')}
                  </div>
                </div>
                <div className="text-right">
                  <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                  <div className="font-medium mt-1">{formatKES(order.total_amount)}</div>
                </div>
              </div>
              <div className="text-sm space-y-1 bg-background/50 p-2 rounded mt-2">
                {order.order_items?.map(item => (
                  <div key={item.id}>{item.quantity}x {item.item_name || item.menu_items?.name || 'Unknown'}</div>
                ))}
              </div>
              {(order.status === 'paid' || order.amount_paid > 0) && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="mt-2 w-full"
                  onClick={() => downloadReceiptPdf([order])}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Receipt
                </Button>
              )}
            </div>
          ))}
          {historyOrders.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No order history yet</p>
          )}
        </div>
      </CollapsibleSection>

      {/* Receipt Dialog - Enhanced with VAT */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Receipt</DialogTitle>
          </DialogHeader>
          {receiptOrders.length > 0 && (
            <div ref={receiptRef} className="space-y-4 p-4 bg-white text-black rounded-lg font-mono text-sm">
              {/* Header with Logo */}
              <div className="text-center border-b pb-3">
                <img src={enaitotiLogo} alt="Enaitoti Hotel" className="w-16 h-16 mx-auto mb-2 rounded-full object-cover" />
                <h3 className="font-bold text-lg">ENAITOTI HOTEL</h3>
                <p className="text-xs text-gray-600">Official Receipt</p>
                <p className="text-xs text-gray-600">{format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
              </div>
              
              {/* Order Number(s) */}
              <div className="text-center font-bold">
                {receiptOrders.length === 1 ? (
                  <>Order: {generateOrderId(receiptOrders[0].order_number)}</>
                ) : (
                  <>Orders: {receiptOrders.map(o => generateOrderId(o.order_number)).join(' + ')}</>
                )}
              </div>
              
              {/* Items - No category labels, just names */}
              <div className="border-t border-b py-2 space-y-1">
                {getAllReceiptItems().map(item => (
                  <div key={item.id} className="flex justify-between">
                    <span>{item.quantity}x {item.item_name || item.menu_items?.name}</span>
                    <span>{formatKES(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              
              {/* Totals with VAT Breakdown */}
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
              
              {/* Payment Method */}
              <div className="bg-gray-100 rounded p-2 text-center">
                <span className="text-xs text-gray-500">Paid via:</span>
                <div className="font-semibold text-sm mt-1">
                  {receiptOrders.map(o => o.payment_method).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).map(method => (
                    <span key={method} className="inline-block px-2 py-0.5 bg-green-100 text-green-700 rounded mx-0.5 uppercase">
                      {method}
                    </span>
                  ))}
                  {!receiptOrders.some(o => o.payment_method) && <span className="text-gray-400">-</span>}
                </div>
              </div>
              
              {/* VAT Notice */}
              <div className="text-center text-xs text-gray-500 border-t pt-2">
                <p>*Prices inclusive of 16% VAT</p>
              </div>
              
              {/* Footer */}
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
