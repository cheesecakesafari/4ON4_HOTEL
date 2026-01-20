import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChefHat, DollarSign, ShoppingCart, ChevronDown, ChevronRight, X, Send, CreditCard, Trash2, Plus, Minus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  is_available: boolean;
  requires_kitchen: boolean;
}

interface SelectedItem {
  item: MenuItem;
  quantity: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  onOrderPlaced: () => void;
}

const formatKES = (amount: number) => `KES ${amount.toLocaleString('en-KE')}`;

export default function FullPageMenu({ isOpen, onClose, employeeId, onOrderPlaced }: Props) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Map<string, number>>(new Map());
  const [kitchenOpen, setKitchenOpen] = useState(true);
  const [directOpen, setDirectOpen] = useState(true);
  const [orderPreviewOpen, setOrderPreviewOpen] = useState(false);
  const { toast } = useToast();

  const [itemOrderCounts, setItemOrderCounts] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (isOpen) {
      fetchMenuItems();
      fetchOrderFrequency();
    }
  }, [isOpen]);

  const fetchMenuItems = async () => {
    const { data } = await supabase
      .from('menu_items')
      .select('*')
      .eq('is_available', true)
      .order('name');
    if (data) setMenuItems(data as MenuItem[]);
  };

  // Fetch order frequency for each menu item
  const fetchOrderFrequency = async () => {
    const { data } = await supabase
      .from('order_items')
      .select('menu_item_id, quantity');
    
    if (data) {
      const counts = new Map<string, number>();
      data.forEach(item => {
        if (item.menu_item_id) {
          counts.set(item.menu_item_id, (counts.get(item.menu_item_id) || 0) + item.quantity);
        }
      });
      setItemOrderCounts(counts);
    }
  };

  // Sort items by order frequency (most ordered first)
  const sortByFrequency = (items: MenuItem[]) => {
    return [...items].sort((a, b) => {
      const countA = itemOrderCounts.get(a.id) || 0;
      const countB = itemOrderCounts.get(b.id) || 0;
      return countB - countA;
    });
  };

  const kitchenItems = sortByFrequency(menuItems.filter(item => item.requires_kitchen));
  const directItems = sortByFrequency(menuItems.filter(item => !item.requires_kitchen));

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

  const getSelectedKitchenItems = (): SelectedItem[] => {
    const items: SelectedItem[] = [];
    selectedItems.forEach((qty, itemId) => {
      const item = menuItems.find(m => m.id === itemId);
      if (item?.requires_kitchen) {
        items.push({ item, quantity: qty });
      }
    });
    return items;
  };

  const getSelectedDirectItems = (): SelectedItem[] => {
    const items: SelectedItem[] = [];
    selectedItems.forEach((qty, itemId) => {
      const item = menuItems.find(m => m.id === itemId);
      if (item && !item.requires_kitchen) {
        items.push({ item, quantity: qty });
      }
    });
    return items;
  };

  const getKitchenTotal = () => getSelectedKitchenItems().reduce((sum, { item, quantity }) => sum + item.price * quantity, 0);
  const getDirectTotal = () => getSelectedDirectItems().reduce((sum, { item, quantity }) => sum + item.price * quantity, 0);
  const getCartTotal = () => getKitchenTotal() + getDirectTotal();
  const getTotalItems = () => selectedItems.size;

  const hasKitchenItems = () => getSelectedKitchenItems().length > 0;
  const hasDirectItems = () => getSelectedDirectItems().length > 0;

  const handleSendToKitchen = async () => {
    const kitchenItemsList = getSelectedKitchenItems();
    if (kitchenItemsList.length === 0) {
      toast({ title: 'No kitchen items selected', variant: 'destructive' });
      return;
    }

    try {
      const kitchenTotal = getKitchenTotal();
      const { data: kitchenOrder, error: kitchenError } = await supabase
        .from('orders')
        .insert({
          waiter_id: employeeId,
          status: 'pending',
          total_amount: kitchenTotal,
          amount_paid: 0,
          is_debt: false,
        })
        .select()
        .single();

      if (kitchenError) throw kitchenError;

      const orderItems = kitchenItemsList.map(({ item, quantity }) => ({
        order_id: kitchenOrder.id,
        menu_item_id: item.id,
        quantity,
        price: item.price,
        item_name: item.name,
        item_type: 'kitchen',
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;

      // Clear only kitchen items from selection
      setSelectedItems(prev => {
        const newMap = new Map(prev);
        kitchenItemsList.forEach(({ item }) => newMap.delete(item.id));
        return newMap;
      });

      toast({ title: 'Order sent to kitchen!', description: `${kitchenItemsList.length} items sent` });
      onOrderPlaced();
    } catch (error: any) {
      toast({ title: 'Error sending order', description: error.message, variant: 'destructive' });
    }
  };

  const handleDirectPayment = async () => {
    const directItemsList = getSelectedDirectItems();
    if (directItemsList.length === 0) {
      toast({ title: 'No direct items selected', variant: 'destructive' });
      return;
    }

    try {
      const directTotal = getDirectTotal();
      const { data: directOrder, error: directError } = await supabase
        .from('orders')
        .insert({
          waiter_id: employeeId,
          status: 'served', // Direct items are immediately served
          total_amount: directTotal,
          amount_paid: 0,
          is_debt: false,
        })
        .select()
        .single();

      if (directError) throw directError;

      const orderItems = directItemsList.map(({ item, quantity }) => ({
        order_id: directOrder.id,
        menu_item_id: item.id,
        quantity,
        price: item.price,
        item_name: item.name,
        item_type: 'direct',
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;

      // Clear only direct items from selection
      setSelectedItems(prev => {
        const newMap = new Map(prev);
        directItemsList.forEach(({ item }) => newMap.delete(item.id));
        return newMap;
      });

      toast({ title: 'Direct order created!', description: 'Ready for payment' });
      onOrderPlaced();
    } catch (error: any) {
      toast({ title: 'Error creating order', description: error.message, variant: 'destructive' });
    }
  };

  const handlePlaceCombinedOrder = async () => {
    const kitchenItemsList = getSelectedKitchenItems();
    const directItemsList = getSelectedDirectItems();

    if (kitchenItemsList.length === 0 && directItemsList.length === 0) {
      toast({ title: 'No items selected', variant: 'destructive' });
      return;
    }

    try {
      let kitchenOrderId: string | null = null;
      let directOrderId: string | null = null;

      // Create kitchen order if there are kitchen items
      if (kitchenItemsList.length > 0) {
        const kitchenTotal = getKitchenTotal();
        const { data: kitchenOrder, error: kitchenError } = await supabase
          .from('orders')
          .insert({
            waiter_id: employeeId,
            status: 'pending',
            total_amount: kitchenTotal,
            amount_paid: 0,
            is_debt: false,
          })
          .select()
          .single();

        if (kitchenError) throw kitchenError;
        kitchenOrderId = kitchenOrder.id;

        const orderItems = kitchenItemsList.map(({ item, quantity }) => ({
          order_id: kitchenOrder.id,
          menu_item_id: item.id,
          quantity,
          price: item.price,
          item_name: item.name,
          item_type: 'kitchen',
        }));

        const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
        if (itemsError) throw itemsError;
      }

      // Create direct order if there are direct items
      if (directItemsList.length > 0) {
        const directTotal = getDirectTotal();
        const { data: directOrder, error: directError } = await supabase
          .from('orders')
          .insert({
            waiter_id: employeeId,
            status: 'served',
            total_amount: directTotal,
            amount_paid: 0,
            is_debt: false,
            linked_order_id: kitchenOrderId,
          })
          .select()
          .single();

        if (directError) throw directError;
        directOrderId = directOrder.id;

        const orderItems = directItemsList.map(({ item, quantity }) => ({
          order_id: directOrder.id,
          menu_item_id: item.id,
          quantity,
          price: item.price,
          item_name: item.name,
          item_type: 'direct',
        }));

        const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
        if (itemsError) throw itemsError;

        // Link kitchen order back to direct order
        if (kitchenOrderId) {
          await supabase
            .from('orders')
            .update({ linked_order_id: directOrderId })
            .eq('id', kitchenOrderId);
        }
      }

      setSelectedItems(new Map());
      setOrderPreviewOpen(false);

      const messages: string[] = [];
      if (kitchenOrderId) messages.push('Kitchen order sent');
      if (directOrderId) messages.push('Direct items ready for payment');

      toast({ title: 'Order placed!', description: messages.join(' • ') });
      onOrderPlaced();
      onClose();
    } catch (error: any) {
      toast({ title: 'Error creating order', description: error.message, variant: 'destructive' });
    }
  };

  const MenuItemCard = ({ item }: { item: MenuItem }) => {
    const isSelected = selectedItems.has(item.id);
    const quantity = selectedItems.get(item.id) || 0;

    return (
      <div
        className={`p-4 rounded-xl border-2 transition-all ${
          isSelected 
            ? 'border-primary bg-primary/5 shadow-md' 
            : 'border-border hover:border-primary/40 hover:shadow-sm'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <label className="flex items-start gap-3 cursor-pointer flex-1">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => toggleItem(item.id)}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="font-semibold text-base uppercase tracking-wide">
                {item.name}
              </div>
              <div className="text-muted-foreground text-sm mt-1">
                {item.requires_kitchen ? 'Prepared in kitchen' : 'Ready to serve'}
              </div>
            </div>
          </label>
          <div className="text-right">
            <div className="text-xl font-bold">{item.price}</div>
            <div className="text-xs text-muted-foreground">KES</div>
          </div>
        </div>
        
        {isSelected && (
          <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t">
            <Button 
              size="sm" 
              variant="outline" 
              className="h-8 w-8 p-0"
              onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, quantity - 1); }}
            >
              <Minus className="w-4 h-4" />
            </Button>
            <span className="w-8 text-center font-bold">{quantity}</span>
            <Button 
              size="sm" 
              variant="outline" 
              className="h-8 w-8 p-0"
              onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, quantity + 1); }}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    );
  };

  const SectionHeader = ({ 
    title, 
    icon: Icon, 
    isOpen, 
    onToggle, 
    count, 
    color 
  }: { 
    title: string; 
    icon: React.ElementType; 
    isOpen: boolean; 
    onToggle: () => void; 
    count: number;
    color: string;
  }) => (
    <div 
      onClick={onToggle}
      className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all ${color}`}
    >
      <div className="flex items-center gap-3">
        <Icon className="w-6 h-6" />
        <span className="font-bold text-lg uppercase tracking-wider">{title}</span>
        <Badge variant="secondary" className="ml-2">{count} items</Badge>
      </div>
      {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
    </div>
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl h-[90vh] p-0 gap-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Create Order
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-6">
              {/* KITCHEN ITEMS SECTION */}
              <Collapsible open={kitchenOpen} onOpenChange={setKitchenOpen}>
                <CollapsibleTrigger asChild>
                  <SectionHeader 
                    title="Menu to Kitchen" 
                    icon={ChefHat} 
                    isOpen={kitchenOpen} 
                    onToggle={() => setKitchenOpen(!kitchenOpen)}
                    count={kitchenItems.length}
                    color="bg-orange-500/10 text-orange-700 hover:bg-orange-500/20"
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid sm:grid-cols-2 gap-4 mt-4">
                    {kitchenItems.map(item => (
                      <MenuItemCard key={item.id} item={item} />
                    ))}
                  </div>
                  {kitchenItems.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No kitchen items available</p>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* DIRECT ITEMS SECTION */}
              <Collapsible open={directOpen} onOpenChange={setDirectOpen}>
                <CollapsibleTrigger asChild>
                  <SectionHeader 
                    title="Direct Menu" 
                    icon={DollarSign} 
                    isOpen={directOpen} 
                    onToggle={() => setDirectOpen(!directOpen)}
                    count={directItems.length}
                    color="bg-green-500/10 text-green-700 hover:bg-green-500/20"
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid sm:grid-cols-2 gap-4 mt-4">
                    {directItems.map(item => (
                      <MenuItemCard key={item.id} item={item} />
                    ))}
                  </div>
                  {directItems.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No direct items available</p>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          </ScrollArea>

          {/* Footer with actions */}
          {getTotalItems() > 0 && (
            <div className="border-t p-4 bg-muted/30">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-sm text-muted-foreground">Selected: </span>
                  <span className="font-bold">{getTotalItems()} items</span>
                </div>
                <div className="text-xl font-bold">{formatKES(getCartTotal())}</div>
              </div>
              <div className="flex gap-2">
                {hasKitchenItems() && (
                  <Button 
                    onClick={handleSendToKitchen} 
                    className="flex-1 bg-orange-600 hover:bg-orange-700"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Send to Kitchen ({formatKES(getKitchenTotal())})
                  </Button>
                )}
                {hasDirectItems() && (
                  <Button 
                    onClick={handleDirectPayment} 
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Direct Payment ({formatKES(getDirectTotal())})
                  </Button>
                )}
              </div>
              {hasKitchenItems() && hasDirectItems() && (
                <Button 
                  onClick={handlePlaceCombinedOrder} 
                  variant="outline"
                  className="w-full mt-2"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Place Combined Order
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Floating Order Button */}
      {getTotalItems() > 0 && !isOpen && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button 
            size="lg" 
            className="rounded-full h-16 w-16 shadow-lg"
            onClick={() => setOrderPreviewOpen(true)}
          >
            <ShoppingCart className="w-6 h-6" />
            <Badge 
              className="absolute -top-1 -right-1 h-6 w-6 flex items-center justify-center p-0"
              variant="destructive"
            >
              {getTotalItems()}
            </Badge>
          </Button>
        </div>
      )}

      {/* Order Preview Dialog */}
      <Dialog open={orderPreviewOpen} onOpenChange={setOrderPreviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Order Summary</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {hasKitchenItems() && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-orange-600 font-medium">
                  <ChefHat className="w-4 h-4" />
                  Kitchen Items
                </div>
                {getSelectedKitchenItems().map(({ item, quantity }) => (
                  <div key={item.id} className="flex justify-between items-center pl-6">
                    <span>{quantity}x {item.name}</span>
                    <div className="flex items-center gap-2">
                      <span>{formatKES(item.price * quantity)}</span>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-6 w-6 p-0"
                        onClick={() => updateQuantity(item.id, 0)}
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="text-right text-sm font-medium text-orange-600">
                  Subtotal: {formatKES(getKitchenTotal())}
                </div>
              </div>
            )}

            {hasDirectItems() && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-600 font-medium">
                  <DollarSign className="w-4 h-4" />
                  Direct Items
                </div>
                {getSelectedDirectItems().map(({ item, quantity }) => (
                  <div key={item.id} className="flex justify-between items-center pl-6">
                    <span>{quantity}x {item.name}</span>
                    <div className="flex items-center gap-2">
                      <span>{formatKES(item.price * quantity)}</span>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-6 w-6 p-0"
                        onClick={() => updateQuantity(item.id, 0)}
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="text-right text-sm font-medium text-green-600">
                  Subtotal: {formatKES(getDirectTotal())}
                </div>
              </div>
            )}

            <div className="border-t pt-3 flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>{formatKES(getCartTotal())}</span>
            </div>

            <div className="flex gap-2 pt-2">
              {hasKitchenItems() && (
                <Button 
                  onClick={() => { handleSendToKitchen(); setOrderPreviewOpen(false); }} 
                  className="flex-1 bg-orange-600 hover:bg-orange-700"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Kitchen
                </Button>
              )}
              {hasDirectItems() && (
                <Button 
                  onClick={() => { handleDirectPayment(); setOrderPreviewOpen(false); }} 
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Payment
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
