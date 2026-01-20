import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Clock, CheckCircle, Trash2, Download, TrendingUp, Wallet, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { downloadReceiptPdf } from '@/utils/receiptPdf';

interface OrderItem {
  id: string;
  menu_item_id: string;
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
  created_at: string;
  order_items: OrderItem[];
}

const formatKES = (amount: number) => `KES ${amount.toLocaleString('en-KE')}`;
const generateOrderId = (orderNumber: number) => `EH${orderNumber}`;

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-500/10 text-yellow-600';
    case 'preparing': return 'bg-blue-500/10 text-blue-600';
    case 'served': return 'bg-orange-500/10 text-orange-600';
    case 'paid': return 'bg-green-500/10 text-green-600';
    case 'cleared': return 'bg-emerald-500/10 text-emerald-600';
    default: return 'bg-gray-500/10 text-gray-600';
  }
};

type PeriodType = 'daily' | 'weekly' | 'monthly' | 'yearly';

export default function AdminOrdersSection() {
  const [period, setPeriod] = useState<PeriodType>('daily');
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const { toast } = useToast();

  const getDateRange = (periodType: PeriodType) => {
    const now = new Date();
    switch (periodType) {
      case 'daily':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'weekly':
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'monthly':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'yearly':
        return { start: startOfYear(now), end: endOfYear(now) };
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    const { start, end } = getDateRange(period);

    const { data, error } = await supabase
      .from('orders')
      .select(`*, order_items (id, menu_item_id, quantity, price, item_name, item_type, menu_items (name))`)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error fetching orders', variant: 'destructive' });
    } else {
      setOrders((data || []) as Order[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, [period]);

  const deleteOrder = async (orderId: string) => {
    try {
      // If the order is part of a split (linked_order_id), delete BOTH sides so nothing persists in other tabs.
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

      // Safety: do not allow admin "pending" cleanup to delete served/paid/cleared records.
      const { data: groupOrders, error: groupErr } = await supabase
        .from('orders')
        .select('id, status')
        .in('id', Array.from(ids));
      if (groupErr) throw groupErr;

      const hasNonPending = (groupOrders || []).some(
        (o) => !['pending', 'preparing'].includes(o.status)
      );
      if (hasNonPending) {
        toast({
          title: 'Cannot remove order',
          description: 'One part of this order has already progressed (served/paid).',
          variant: 'destructive',
        });
        return;
      }

      const groupIds = Array.from(ids);

      const { error: itemsError } = await supabase.from('order_items').delete().in('order_id', groupIds);
      if (itemsError) throw itemsError;

      const { error } = await supabase.from('orders').delete().in('id', groupIds);
      if (error) throw error;

      toast({ title: 'Pending order removed' });
      fetchOrders();
    } catch (error: any) {
      toast({ title: 'Error deleting order', description: error.message, variant: 'destructive' });
    }
  };

  const clearAllPendingOrders = async () => {
    setClearingAll(true);
    try {
      const pendingIds = pendingOrders.map(o => o.id);
      if (pendingIds.length === 0) {
        toast({ title: 'No pending orders to clear' });
        setClearingAll(false);
        return;
      }
      
      // Delete order items first
      for (const id of pendingIds) {
        await supabase.from('order_items').delete().eq('order_id', id);
      }
      
      // Delete orders
      const { error } = await supabase.from('orders').delete().in('id', pendingIds);
      if (error) throw error;
      
      toast({ title: `Cleared ${pendingIds.length} pending orders` });
      fetchOrders();
    } catch (error: any) {
      toast({ title: 'Error clearing orders', description: error.message, variant: 'destructive' });
    } finally {
      setClearingAll(false);
    }
  };

  const toggleOrderExpand = (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  const handleDownloadReceipt = (order: Order) => {
    downloadReceiptPdf([{
      id: order.id,
      order_number: order.order_number,
      total_amount: order.total_amount,
      amount_paid: order.amount_paid,
      payment_method: order.payment_method,
      created_at: order.created_at,
      order_items: order.order_items,
    }]);
  };

  // Categorize orders
  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'preparing');
  const servedOrders = orders.filter(o => o.status === 'served' && o.amount_paid < o.total_amount);
  const clearedOrders = orders.filter(o => o.status === 'paid' || o.status === 'cleared' || (o.status === 'served' && o.amount_paid >= o.total_amount));

  // Payment breakdown
  const paymentBreakdown = { cash: 0, mpesa: 0, kcb: 0 };
  clearedOrders.forEach(o => {
    if (o.payment_method) {
      const parts = o.payment_method.split(',');
      parts.forEach((part: string) => {
        const [method, amtStr] = part.split(':');
        const amt = parseFloat(amtStr) || 0;
        if (method === 'cash') paymentBreakdown.cash += amt;
        else if (method === 'mpesa') paymentBreakdown.mpesa += amt;
        else if (method === 'kcb') paymentBreakdown.kcb += amt;
        // Handle legacy single method labels
        if (!amtStr && o.amount_paid) {
          if (method === 'cash') paymentBreakdown.cash += o.amount_paid;
          else if (method === 'mobile') paymentBreakdown.mpesa += o.amount_paid;
          else if (method === 'card') paymentBreakdown.kcb += o.amount_paid;
        }
      });
    }
  });

  // Calculate totals
  const totalRevenue = clearedOrders.reduce((sum, o) => sum + o.amount_paid, 0);
  const pendingRevenue = servedOrders.reduce((sum, o) => sum + (o.total_amount - o.amount_paid), 0);

  const getPeriodLabel = () => {
    const { start, end } = getDateRange(period);
    switch (period) {
      case 'daily':
        return format(start, 'MMMM d, yyyy');
      case 'weekly':
        return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
      case 'monthly':
        return format(start, 'MMMM yyyy');
      case 'yearly':
        return format(start, 'yyyy');
    }
  };

  const renderOrderCard = (order: Order, colorClass: string, showDelete: boolean = false) => {
    const isExpanded = expandedOrders.has(order.id);
    const itemCount = order.order_items?.length || 0;
    
    return (
      <div 
        key={order.id} 
        className={`p-3 ${colorClass} rounded-lg border cursor-pointer hover:opacity-90 transition-all`}
        onClick={() => toggleOrderExpand(order.id)}
      >
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <span className="font-bold">{generateOrderId(order.order_number)}</span>
            <Badge variant="outline" className="text-xs">{itemCount} items</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
            <span className="text-xs text-muted-foreground">
              {format(new Date(order.created_at), 'MMM d, HH:mm')}
            </span>
          </div>
        </div>
        
        {/* Collapsed view */}
        {!isExpanded && itemCount > 0 && (
          <div className="text-sm text-muted-foreground">
            {order.order_items?.[0]?.quantity}x {order.order_items?.[0]?.item_name || order.order_items?.[0]?.menu_items?.name || 'Unknown'}
            {itemCount > 1 && <span className="text-primary"> +{itemCount - 1} more...</span>}
          </div>
        )}
        
        {/* Expanded view */}
        {isExpanded && (
          <div className="text-sm space-y-1 bg-background/50 p-2 rounded mt-2">
            {order.order_items?.map((item, idx) => (
              <div key={idx} className="flex justify-between">
                <span>{item.quantity}x {item.item_name || item.menu_items?.name || 'Unknown'}</span>
                <span className="text-muted-foreground">{formatKES(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
        )}
        
        <div className="flex justify-between items-center mt-2">
          <div>
            <span className="text-sm font-medium">{formatKES(order.total_amount)}</span>
            {order.amount_paid < order.total_amount && (
              <span className="text-xs text-orange-600 ml-2">
                (Paid: {formatKES(order.amount_paid)})
              </span>
            )}
          </div>
          <div className="flex gap-1">
            {(order.status === 'paid' || order.status === 'cleared') && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={(e) => { e.stopPropagation(); handleDownloadReceipt(order); }}
              >
                <Download className="w-3 h-3 mr-1" />
                Receipt
              </Button>
            )}
            {showDelete && (
              <Button 
                size="sm" 
                variant="destructive" 
                onClick={(e) => { e.stopPropagation(); deleteOrder(order.id); }}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Period Selector & Summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Orders Overview
            </CardTitle>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">{getPeriodLabel()}</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <div className="text-2xl font-bold">{orders.length}</div>
              <div className="text-xs text-muted-foreground">Total Orders</div>
            </div>
            <div className="p-3 bg-yellow-500/10 rounded-lg text-center">
              <div className="text-2xl font-bold text-yellow-600">{pendingOrders.length}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-lg text-center">
              <div className="text-2xl font-bold text-emerald-600">{formatKES(totalRevenue)}</div>
              <div className="text-xs text-muted-foreground">Revenue</div>
            </div>
            <div className="p-3 bg-orange-500/10 rounded-lg text-center">
              <div className="text-2xl font-bold text-orange-600">{formatKES(pendingRevenue)}</div>
              <div className="text-xs text-muted-foreground">Pending Payment</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="w-4 h-4" />
            Sales Payment Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 bg-green-500/10 rounded-lg text-center">
              <div className="font-bold text-green-600">{formatKES(paymentBreakdown.cash)}</div>
              <div className="text-xs text-muted-foreground">Cash</div>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-lg text-center">
              <div className="font-bold text-blue-600">{formatKES(paymentBreakdown.mpesa)}</div>
              <div className="text-xs text-muted-foreground">M-Pesa</div>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-lg text-center">
              <div className="font-bold text-purple-600">{formatKES(paymentBreakdown.kcb)}</div>
              <div className="text-xs text-muted-foreground">KCB</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading orders...</div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Pending Orders */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-yellow-600">
                  <Clock className="w-5 h-5" />
                  Pending ({pendingOrders.length})
                </CardTitle>
                {pendingOrders.length > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive">
                        Clear All
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Clear All Pending Orders?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete all {pendingOrders.length} pending orders. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={clearAllPendingOrders} disabled={clearingAll}>
                          {clearingAll ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                          Clear All
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
              {pendingOrders.map(order => renderOrderCard(order, 'bg-yellow-500/5 border-yellow-500/20', true))}
              {pendingOrders.length === 0 && (
                <p className="text-muted-foreground text-center py-4">No pending orders</p>
              )}
            </CardContent>
          </Card>

          {/* Served - Unpaid */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-orange-600">
                <Clock className="w-5 h-5" />
                Served - Unpaid ({servedOrders.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
              {servedOrders.map(order => renderOrderCard(order, 'bg-orange-500/5 border-orange-500/20', false))}
              {servedOrders.length === 0 && (
                <p className="text-muted-foreground text-center py-4">No unpaid served orders</p>
              )}
            </CardContent>
          </Card>

          {/* Cleared */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-emerald-600">
                <CheckCircle className="w-5 h-5" />
                Cleared ({clearedOrders.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
              {clearedOrders.map(order => renderOrderCard(order, 'bg-emerald-500/5 border-emerald-500/20', false))}
              {clearedOrders.length === 0 && (
                <p className="text-muted-foreground text-center py-4">No cleared orders</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
