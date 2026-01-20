import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ChefHat, Clock, CheckCircle, Bell, History, ChevronDown, ChevronRight, HandMetal, X, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

import { notificationSounds } from '@/utils/notificationSounds';

interface OrderItem {
  id: string;
  quantity: number;
  notes: string | null;
  item_name: string | null;
  price: number;
  menu_items: {
    name: string;
    category: string;
  } | null;
}

interface Order {
  id: string;
  order_number: number;
  status: string;
  chef_id: string | null;
  created_at: string;
  total_amount: number;
  order_items: OrderItem[];
}

interface Props {
  employeeId: string;
  employeeName: string;
  readOnly?: boolean;
}

const formatKES = (amount: number) => `KES ${amount.toLocaleString('en-KE')}`;
const generateOrderId = (orderNumber: number) => `EH${orderNumber}`;

export default function NewKitchenTab({ employeeId, employeeName, readOnly = false }: Props) {
  const [newOrders, setNewOrders] = useState<Order[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [newOrderAlert, setNewOrderAlert] = useState(false);

  const [newOrdersOpen, setNewOrdersOpen] = useState(true);
  const [myOrdersOpen, setMyOrdersOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    if (!employeeId) return;
    
    fetchOrders();
    fetchHistory();

    const channel = supabase
      .channel(`kitchen-orders-${employeeId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          setNewOrderAlert(true);
          // Play notification sound for new orders
          notificationSounds.playNewOrderChime();
          toast({
            title: '🔔 New Order!',
            description: `Order ${generateOrderId(payload.new.order_number)} received`,
          });
          fetchOrders();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        () => {
          fetchOrders();
          fetchHistory();
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'orders' },
        () => {
          // Refetch orders when any order is deleted (e.g., by admin)
          fetchOrders();
          fetchHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [employeeId]);

  const fetchOrders = async () => {
    // Fetch new orders (pending, no chef assigned) - visible to ALL chefs
    const { data: pending } = await supabase
      .from('orders')
      .select(`*, order_items (id, quantity, notes, item_name, price, menu_items (name, category))`)
      .eq('status', 'pending')
      .is('chef_id', null)
      .order('created_at', { ascending: true });
    if (pending) setNewOrders(pending as Order[]);

    // Fetch MY orders (preparing, assigned to me)
    const { data: preparing } = await supabase
      .from('orders')
      .select(`*, order_items (id, quantity, notes, item_name, price, menu_items (name, category))`)
      .eq('status', 'preparing')
      .eq('chef_id', employeeId)
      .order('created_at', { ascending: true });
    if (preparing) setMyOrders(preparing as Order[]);
  };

  const fetchHistory = async () => {
    // Fetch ALL orders accepted by this chef (preparing + served)
    const { data } = await supabase
      .from('orders')
      .select(`*, order_items (id, quantity, notes, item_name, price, menu_items (name, category))`)
      .eq('chef_id', employeeId)
      .in('status', ['served', 'paid', 'cleared'])
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setHistoryOrders(data as Order[]);
  };

  const acceptOrder = async (orderId: string) => {
    if (readOnly) return;
    
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'preparing',
          chef_id: employeeId 
        })
        .eq('id', orderId)
        .is('chef_id', null);

      if (error) throw error;

      const order = newOrders.find(o => o.id === orderId);
      toast({ 
        title: 'Order Accepted!',
        description: order ? `You're now preparing ${generateOrderId(order.order_number)}` : undefined
      });
      setNewOrderAlert(false);
      fetchOrders();
    } catch (error: any) {
      toast({ title: 'Error accepting order', description: error.message, variant: 'destructive' });
    }
  };

  const declineOrder = async (orderId: string) => {
    if (readOnly) return;

    try {
      // If the order is part of a split (linked_order_id), delete BOTH sides so it disappears for the waiter too.
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

      // Only allow declining if the whole group is still pending (not accepted/served/paid)
      const { data: groupOrders, error: groupErr } = await supabase
        .from('orders')
        .select('id, status')
        .in('id', groupIds);
      if (groupErr) throw groupErr;

      const hasNonPending = (groupOrders || []).some((o) => o.status !== 'pending');
      if (hasNonPending) {
        toast({ title: 'Cannot decline', description: 'A linked part of this order is already in progress.', variant: 'destructive' });
        return;
      }

      await supabase.from('order_items').delete().in('order_id', groupIds);
      await supabase.from('orders').delete().in('id', groupIds);

      toast({ title: 'Order declined', description: 'The order has been removed' });
      fetchOrders();
    } catch (error: any) {
      toast({ title: 'Error declining order', description: error.message, variant: 'destructive' });
    }
  };

  const removeOrderItem = async (orderId: string, itemId: string) => {
    if (readOnly) return;
    
    try {
      const order = newOrders.find(o => o.id === orderId);
      if (!order) return;

      const item = order.order_items.find(i => i.id === itemId);
      if (!item) return;

      // Delete the item
      await supabase.from('order_items').delete().eq('id', itemId);
      
      // Update order total
      const newTotal = order.total_amount - (item.price * item.quantity);
      await supabase.from('orders').update({ total_amount: newTotal }).eq('id', orderId);

      // If no items left, delete the entire order group (including linked orders)
      if (order.order_items.length === 1) {
        // Get linked order IDs
        const ids = new Set<string>([orderId]);

        const { data: baseOrder } = await supabase
          .from('orders')
          .select('id, linked_order_id')
          .eq('id', orderId)
          .maybeSingle();

        if (baseOrder?.linked_order_id) ids.add(baseOrder.linked_order_id);

        const { data: reverseLinked } = await supabase
          .from('orders')
          .select('id')
          .eq('linked_order_id', orderId);
        reverseLinked?.forEach((o) => ids.add(o.id));

        const groupIds = Array.from(ids);

        // Delete all linked order items and orders
        await supabase.from('order_items').delete().in('order_id', groupIds);
        await supabase.from('orders').delete().in('id', groupIds);
      }

      toast({ title: 'Item removed from order' });
      fetchOrders();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const serveOrder = async (orderId: string) => {
    if (readOnly) return;
    
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'served' })
        .eq('id', orderId);

      if (error) throw error;

      const order = myOrders.find(o => o.id === orderId);
      toast({ 
        title: 'Order Served!',
        description: order ? `${generateOrderId(order.order_number)} delivered` : undefined
      });
      fetchOrders();
      fetchHistory();
    } catch (error: any) {
      toast({ title: 'Error serving order', description: error.message, variant: 'destructive' });
    }
  };

  const CollapsibleSection = ({ 
    title, 
    icon: Icon, 
    isOpen, 
    onToggle, 
    badge,
    badgeColor,
    children 
  }: { 
    title: string; 
    icon: React.ElementType; 
    isOpen: boolean; 
    onToggle: () => void;
    badge?: number;
    badgeColor?: string;
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
                  <Badge variant="secondary" className={badgeColor}>{badge}</Badge>
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <ChefHat className="w-6 h-6" />
            Kitchen
          </h2>
          <p className="text-muted-foreground">Chef: {employeeName}</p>
        </div>
        {newOrderAlert && (
          <Button variant="destructive" onClick={() => setNewOrderAlert(false)}>
            <Bell className="w-4 h-4 mr-2" />
            New Orders!
          </Button>
        )}
      </div>

      {/* NEW ORDERS */}
      <CollapsibleSection 
        title="New Orders" 
        icon={Bell} 
        isOpen={newOrdersOpen} 
        onToggle={() => setNewOrdersOpen(!newOrdersOpen)}
        badge={newOrders.length}
        badgeColor="bg-yellow-500 text-white"
      >
        {newOrders.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
            No new orders waiting
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {newOrders.map(order => (
              <Card key={order.id} className="overflow-hidden border-2 border-yellow-500/50 animate-pulse-slow">
                <CardHeader className="pb-3 bg-yellow-500/10">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{generateOrderId(order.order_number)}</CardTitle>
                    <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">NEW</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-3">
                  <div className="space-y-2">
                    {order.order_items.map(item => (
                      <div key={item.id} className="flex items-center justify-between bg-muted/50 p-2 rounded-lg">
                        <span className="font-medium">
                          {item.quantity}x {item.item_name || item.menu_items?.name || 'Unknown item'}
                        </span>
                        {!readOnly && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 w-6 p-0"
                            onClick={() => removeOrderItem(order.id, item.id)}
                          >
                            <X className="w-3 h-3 text-red-500" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {new Date(order.created_at).toLocaleTimeString()}
                  </div>

                  {!readOnly && (
                    <div className="flex gap-2">
                      <Button
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => acceptOrder(order.id)}
                      >
                        <HandMetal className="w-4 h-4 mr-2" />
                        Accept
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="icon">
                            <X className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Decline Order?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove the entire order. The waiter will need to create a new order.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => declineOrder(order.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Decline Order
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* MY ORDERS */}
      <CollapsibleSection 
        title="My Orders" 
        icon={ChefHat} 
        isOpen={myOrdersOpen} 
        onToggle={() => setMyOrdersOpen(!myOrdersOpen)}
        badge={myOrders.length}
        badgeColor="bg-blue-500 text-white"
      >
        {myOrders.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No orders being prepared</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {myOrders.map(order => (
              <Card key={order.id} className="overflow-hidden border-2 border-blue-500/50">
                <CardHeader className="pb-3 bg-blue-500/10">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{generateOrderId(order.order_number)}</CardTitle>
                    <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30">PREPARING</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-3">
                  <div className="space-y-2">
                    {order.order_items.map(item => (
                      <div key={item.id} className="flex items-center justify-between bg-muted/50 p-2 rounded-lg">
                        <span className="font-medium">
                          {item.quantity}x {item.item_name || item.menu_items?.name || 'Unknown item'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {new Date(order.created_at).toLocaleTimeString()}
                  </div>

                  {!readOnly && (
                    <Button
                      className="w-full bg-purple-600 hover:bg-purple-700"
                      onClick={() => serveOrder(order.id)}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Order Served
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* MY HISTORY */}
      <CollapsibleSection 
        title="My History" 
        icon={History} 
        isOpen={historyOpen} 
        onToggle={() => setHistoryOpen(!historyOpen)}
        badge={historyOrders.length}
      >
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {historyOrders.map(order => (
            <div key={order.id} className="p-3 bg-muted/50 rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="font-bold">{generateOrderId(order.order_number)}</span>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(new Date(order.created_at), 'MMM d, yyyy HH:mm')}
                  </div>
                </div>
                <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/30">
                  {order.status.toUpperCase()}
                </Badge>
              </div>
              <div className="text-sm space-y-1">
                {order.order_items.map(item => (
                  <div key={item.id}>{item.quantity}x {item.item_name || item.menu_items?.name || 'Unknown'}</div>
                ))}
              </div>
            </div>
          ))}
          {historyOrders.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No orders served yet</p>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}
