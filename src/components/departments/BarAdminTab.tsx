import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Beer, Plus, Package, TrendingUp, DollarSign, Download, CheckCircle, Clock, Wallet, BarChart3, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface BarInventory {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  cost_price: number;
  selling_price: number;
  supplier_name: string | null;
  created_at: string;
}

interface BarOrderItem {
  id: string;
  item_name: string;
  quantity: number;
  price: number;
  cost_price: number;
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
  staff_id: string | null;
  created_at: string;
  bar_order_items?: BarOrderItem[];
}

interface ItemPerformance {
  name: string;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
  currentStock: number;
}

type PeriodType = 'daily' | 'weekly' | 'monthly' | 'yearly';

const formatKES = (amount: number) => `KES ${amount.toLocaleString('en-KE')}`;
const generateOrderId = (orderNumber: number) => `BAR${orderNumber}`;

export default function BarAdminTab() {
  const [period, setPeriod] = useState<PeriodType>('daily');
  const [inventory, setInventory] = useState<BarInventory[]>([]);
  const [orders, setOrders] = useState<BarOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingPrices, setPendingPrices] = useState<Record<string, string>>({});
  
  const [newInventory, setNewInventory] = useState({ 
    name: '', 
    category: 'drinks', 
    quantity: '', 
    unit: 'pcs', 
    cost_price: '', 
    selling_price: '', 
    supplier_name: '' 
  });
  
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

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchInventory(), fetchOrders()]);
    setLoading(false);
  };

  const fetchInventory = async () => {
    const { data } = await supabase.from('bar_inventory').select('*').order('category').order('name');
    if (data) setInventory(data as BarInventory[]);
  };

  const fetchOrders = async () => {
    const { start, end } = getDateRange(period);
    const { data } = await supabase
      .from('bar_orders')
      .select(`*, bar_order_items (id, item_name, quantity, price, cost_price)`)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false });
    if (data) setOrders(data as BarOrder[]);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [period]);

  // Add new inventory item - locked in after creation
  const addInventoryItem = async () => {
    if (!newInventory.name || !newInventory.quantity || !newInventory.cost_price || !newInventory.selling_price) {
      toast({ title: 'Name, quantity, cost price and selling price required', variant: 'destructive' });
      return;
    }
    try {
      await supabase.from('bar_inventory').insert({
        name: newInventory.name,
        category: newInventory.category,
        quantity: parseInt(newInventory.quantity),
        unit: newInventory.unit,
        cost_price: parseFloat(newInventory.cost_price),
        selling_price: parseFloat(newInventory.selling_price),
        supplier_name: newInventory.supplier_name || null,
      });
      toast({ title: 'Stock item added!' });
      setNewInventory({ name: '', category: 'drinks', quantity: '', unit: 'pcs', cost_price: '', selling_price: '', supplier_name: '' });
      fetchInventory();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Only allow updating quantity and selling price - NOT cost price
  const updateInventoryQuantity = async (id: string, quantity: number) => {
    await supabase.from('bar_inventory').update({ quantity }).eq('id', id);
    fetchInventory();
  };

  const updateSellingPrice = async (id: string, selling_price: number) => {
    await supabase.from('bar_inventory').update({ selling_price }).eq('id', id);
    fetchInventory();
  };

  const clearPendingOrder = async (orderId: string) => {
    await supabase.from('bar_orders').update({ status: 'paid' }).eq('id', orderId);
    toast({ title: 'Order cleared as paid' });
    fetchOrders();
  };

  // Calculate metrics
  const paidOrders = orders.filter(o => o.status === 'paid');
  const pendingOrders = orders.filter(o => o.status === 'pending');
  const debtOrders = orders.filter(o => o.is_debt && o.status !== 'paid');
  
  const totalSales = paidOrders.reduce((sum, o) => sum + o.amount_paid, 0);
  const totalCost = paidOrders.reduce((sum, o) => {
    return sum + (o.bar_order_items?.reduce((s, i) => s + (i.cost_price * i.quantity), 0) || 0);
  }, 0);
  const totalProfit = totalSales - totalCost;

  // Payment breakdown
  const paymentBreakdown = { cash: 0, mpesa: 0, kcb: 0 };
  paidOrders.forEach(o => {
    if (o.payment_method) {
      const parts = o.payment_method.split(',');
      parts.forEach((part: string) => {
        const [method, amtStr] = part.split(':');
        const amt = parseFloat(amtStr) || 0;
        if (method === 'cash') paymentBreakdown.cash += amt;
        else if (method === 'mpesa') paymentBreakdown.mpesa += amt;
        else if (method === 'kcb') paymentBreakdown.kcb += amt;
      });
    }
  });

  // Items performance - sorted by quantity sold (best to worst)
  const itemsPerformance = new Map<string, ItemPerformance>();
  paidOrders.forEach(o => {
    o.bar_order_items?.forEach(item => {
      const existing = itemsPerformance.get(item.item_name);
      if (existing) {
        existing.quantity += item.quantity;
        existing.revenue += item.price * item.quantity;
        existing.cost += item.cost_price * item.quantity;
        existing.profit = existing.revenue - existing.cost;
      } else {
        const invItem = inventory.find(i => i.name === item.item_name);
        itemsPerformance.set(item.item_name, {
          name: item.item_name,
          quantity: item.quantity,
          revenue: item.price * item.quantity,
          cost: item.cost_price * item.quantity,
          profit: (item.price * item.quantity) - (item.cost_price * item.quantity),
          currentStock: invItem?.quantity || 0,
        });
      }
    });
  });

  // Update stock levels for items in performance map
  itemsPerformance.forEach((item, name) => {
    const invItem = inventory.find(i => i.name === name);
    item.currentStock = invItem?.quantity || 0;
  });

  // Sort by quantity sold (best sellers first)
  const sortedPerformance = Array.from(itemsPerformance.values()).sort((a, b) => b.quantity - a.quantity);

  const getPeriodLabel = () => {
    const { start, end } = getDateRange(period);
    switch (period) {
      case 'daily': return format(start, 'MMMM d, yyyy');
      case 'weekly': return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
      case 'monthly': return format(start, 'MMMM yyyy');
      case 'yearly': return format(start, 'yyyy');
    }
  };

  const downloadReport = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('ENAITOTI BAR RECORDS', 105, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Period: ${getPeriodLabel()}`, 105, 25, { align: 'center' });
    doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 105, 32, { align: 'center' });

    let y = 45;

    // Summary
    doc.setFontSize(14);
    doc.text('Financial Summary', 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(`Total Sales: ${formatKES(totalSales)}`, 14, y);
    y += 6;
    doc.text(`Total Cost: ${formatKES(totalCost)}`, 14, y);
    y += 6;
    doc.text(`Profit: ${formatKES(totalProfit)}`, 14, y);
    y += 10;

    // Payment breakdown
    doc.setFontSize(14);
    doc.text('Payment Breakdown', 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(`Cash: ${formatKES(paymentBreakdown.cash)}`, 14, y);
    y += 6;
    doc.text(`M-Pesa: ${formatKES(paymentBreakdown.mpesa)}`, 14, y);
    y += 6;
    doc.text(`KCB: ${formatKES(paymentBreakdown.kcb)}`, 14, y);
    y += 15;

    // Items performance
    doc.setFontSize(14);
    doc.text('Items Performance (Best to Worst)', 14, y);
    y += 5;

    const itemsData = sortedPerformance.map(item => [
      item.name,
      item.quantity.toString(),
      formatKES(item.revenue),
      formatKES(item.profit),
      item.currentStock.toString(),
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Item', 'Qty Sold', 'Revenue', 'Profit', 'Stock']],
      body: itemsData,
      theme: 'striped',
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text('4on4 tech', 105, 290, { align: 'center' });
    }

    doc.save(`bar-report-${period}-${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Beer className="w-5 h-5" />
              Bar Admin
            </CardTitle>
            <div className="flex gap-2">
              <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={downloadReport}>
                <Download className="w-4 h-4 mr-2" />
                Report
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{getPeriodLabel()}</p>
        </CardHeader>
      </Card>

      <Tabs defaultValue="performance" className="w-full">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="profit">Profit</TabsTrigger>
        </TabsList>

        {/* Performance Tab - Best to Worst Sellers */}
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Items Performance (Best to Worst Sellers)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sortedPerformance.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No sales data for this period</p>
                ) : (
                  sortedPerformance.map((item, idx) => (
                    <div 
                      key={item.name} 
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        idx === 0 ? 'bg-emerald-50 border-emerald-200' : 
                        idx === sortedPerformance.length - 1 ? 'bg-red-50 border-red-200' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-lg w-8">{idx + 1}</span>
                        <div>
                          <span className="font-medium">{item.name}</span>
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span>Sold: {item.quantity}</span>
                            <span>Stock: {item.currentStock}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatKES(item.revenue)}</div>
                        <div className="text-xs text-emerald-600">Profit: {formatKES(item.profit)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stock Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="w-4 h-4" />
                Current Stock Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {inventory.map(item => (
                  <div 
                    key={item.id} 
                    className={`p-3 rounded-lg border text-center ${
                      item.quantity === 0 ? 'bg-red-100 border-red-300' :
                      item.quantity < 10 ? 'bg-yellow-50 border-yellow-300' : 
                      'bg-muted/50'
                    }`}
                  >
                    <div className="font-medium text-sm truncate">{item.name}</div>
                    <div className={`text-2xl font-bold ${item.quantity === 0 ? 'text-red-600' : item.quantity < 10 ? 'text-yellow-600' : ''}`}>
                      {item.quantity}
                    </div>
                    <div className="text-xs text-muted-foreground">{item.unit}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sales Tab */}
        <TabsContent value="sales" className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-emerald-500/10">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-emerald-600">{formatKES(totalSales)}</div>
                <div className="text-xs text-muted-foreground">Total Sales</div>
              </CardContent>
            </Card>
            <Card className="bg-blue-500/10">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-blue-600">{paidOrders.length}</div>
                <div className="text-xs text-muted-foreground">Orders Paid</div>
              </CardContent>
            </Card>
            <Card className="bg-yellow-500/10">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-yellow-600">{pendingOrders.length}</div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </CardContent>
            </Card>
            <Card className="bg-primary/10">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-primary">{formatKES(totalProfit)}</div>
                <div className="text-xs text-muted-foreground">Profit</div>
              </CardContent>
            </Card>
          </div>

          {/* Payment Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                Payment Breakdown
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

          {/* Paid Orders List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                Paid Orders ({paidOrders.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
              {paidOrders.map(order => (
                <div key={order.id} className="p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold">{generateOrderId(order.order_number)}</span>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(order.created_at), 'HH:mm')}
                      </p>
                    </div>
                    <span className="font-medium">{formatKES(order.amount_paid)}</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {order.bar_order_items?.map(i => `${i.quantity}x ${i.item_name}`).join(', ')}
                  </div>
                </div>
              ))}
              {paidOrders.length === 0 && (
                <p className="text-muted-foreground text-center py-4">No paid orders this period</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pending Orders Tab */}
        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-600" />
                Pending Payment ({pendingOrders.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingOrders.map(order => (
                <div key={order.id} className="p-3 bg-yellow-500/5 rounded-lg border border-yellow-500/20 flex justify-between items-center">
                  <div>
                    <span className="font-bold">{generateOrderId(order.order_number)}</span>
                    <p className="text-xs text-muted-foreground">{format(new Date(order.created_at), 'HH:mm')}</p>
                    <div className="text-sm">{formatKES(order.total_amount)}</div>
                  </div>
                  <Button size="sm" onClick={() => clearPendingOrder(order.id)}>
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Mark Paid
                  </Button>
                </div>
              ))}
              {pendingOrders.length === 0 && (
                <p className="text-muted-foreground text-center py-4">No pending orders</p>
              )}
            </CardContent>
          </Card>

          {/* Debts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-red-600">
                <DollarSign className="w-4 h-4" />
                Unpaid Debts ({debtOrders.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {debtOrders.map(order => (
                <div key={order.id} className="p-3 bg-red-500/5 rounded-lg border border-red-500/20">
                  <div className="flex justify-between">
                    <div>
                      <span className="font-bold">{generateOrderId(order.order_number)}</span>
                      <p className="text-sm font-medium text-red-600">{order.debtor_name}</p>
                    </div>
                    <span className="font-medium">{formatKES(order.total_amount - order.amount_paid)}</span>
                  </div>
                </div>
              ))}
              {debtOrders.length === 0 && (
                <p className="text-muted-foreground text-center py-4">No unpaid debts</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventory Tab - Items are locked after creation */}
        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add New Stock Item
              </CardTitle>
              <p className="text-xs text-muted-foreground">Note: Once added, items are locked. Only quantity and selling price can be changed.</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <Input
                  placeholder="Item Name"
                  value={newInventory.name}
                  onChange={(e) => setNewInventory({ ...newInventory, name: e.target.value })}
                />
                <Select value={newInventory.category} onValueChange={(v) => setNewInventory({ ...newInventory, category: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="drinks">Drinks</SelectItem>
                    <SelectItem value="beers">Beers</SelectItem>
                    <SelectItem value="wines">Wines</SelectItem>
                    <SelectItem value="spirits">Spirits</SelectItem>
                    <SelectItem value="soft_drinks">Soft Drinks</SelectItem>
                    <SelectItem value="snacks">Snacks</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Quantity"
                  value={newInventory.quantity}
                  onChange={(e) => setNewInventory({ ...newInventory, quantity: e.target.value })}
                />
                <Input
                  placeholder="Unit (pcs, bottles)"
                  value={newInventory.unit}
                  onChange={(e) => setNewInventory({ ...newInventory, unit: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <Input
                  type="number"
                  placeholder="Cost/Buying Price"
                  value={newInventory.cost_price}
                  onChange={(e) => setNewInventory({ ...newInventory, cost_price: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Selling Price"
                  value={newInventory.selling_price}
                  onChange={(e) => setNewInventory({ ...newInventory, selling_price: e.target.value })}
                />
                <Input
                  placeholder="Supplier Name (optional)"
                  value={newInventory.supplier_name}
                  onChange={(e) => setNewInventory({ ...newInventory, supplier_name: e.target.value })}
                />
                <Button onClick={addInventoryItem}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Stock
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stock Items ({inventory.length})</CardTitle>
              <p className="text-xs text-muted-foreground">Items with 0 stock still show in menu but cannot be ordered</p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                {inventory.map(item => (
                  <div 
                    key={item.id} 
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      item.quantity === 0 ? 'border-red-300 bg-red-50' : 
                      item.quantity < 10 ? 'border-yellow-300 bg-yellow-50' : ''
                    }`}
                  >
                    <div>
                      <span className="font-medium">{item.name}</span>
                      <Badge variant="outline" className="ml-2 text-xs">{item.category}</Badge>
                      <p className="text-xs text-muted-foreground">
                        Cost: {formatKES(item.cost_price)} (locked) • {item.supplier_name || 'No supplier'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Stock:</span>
                          <Input
                            type="number"
                            className="w-20 h-8"
                            value={item.quantity}
                            onChange={(e) => updateInventoryQuantity(item.id, parseInt(e.target.value) || 0)}
                          />
                          <span className="text-sm text-muted-foreground">{item.unit}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Sell:</span>
                          <Input
                            type="number"
                            className="w-20 h-8"
                            value={pendingPrices[item.id] !== undefined ? pendingPrices[item.id] : item.selling_price}
                            onChange={(e) => setPendingPrices(prev => ({ ...prev, [item.id]: e.target.value }))}
                          />
                          <Button 
                            size="sm" 
                            className="h-8 px-2"
                            disabled={pendingPrices[item.id] === undefined || pendingPrices[item.id] === String(item.selling_price)}
                            onClick={async () => {
                              const newPrice = parseFloat(pendingPrices[item.id]) || 0;
                              await updateSellingPrice(item.id, newPrice);
                              setPendingPrices(prev => {
                                const updated = { ...prev };
                                delete updated[item.id];
                                return updated;
                              });
                              toast({ title: 'Price set!' });
                            }}
                          >
                            <Check className="w-3 h-3 mr-1" />
                            Set
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {inventory.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">No inventory items</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profit Tab */}
        <TabsContent value="profit" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-emerald-500/10">
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-emerald-600">{formatKES(totalSales)}</div>
                <div className="text-sm text-muted-foreground">Total Revenue</div>
              </CardContent>
            </Card>
            <Card className="bg-red-500/10">
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-red-600">{formatKES(totalCost)}</div>
                <div className="text-sm text-muted-foreground">Total Cost</div>
              </CardContent>
            </Card>
            <Card className="bg-primary/10">
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-primary">{formatKES(totalProfit)}</div>
                <div className="text-sm text-muted-foreground">Net Profit</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Profit by Item
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Item</th>
                      <th className="text-center py-2">Qty Sold</th>
                      <th className="text-right py-2">Revenue</th>
                      <th className="text-right py-2">Cost</th>
                      <th className="text-right py-2">Profit</th>
                      <th className="text-right py-2">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPerformance.map((item, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="py-2">{item.name}</td>
                        <td className="text-center py-2">{item.quantity}</td>
                        <td className="text-right py-2">{formatKES(item.revenue)}</td>
                        <td className="text-right py-2">{formatKES(item.cost)}</td>
                        <td className="text-right py-2 font-medium text-primary">
                          {formatKES(item.profit)}
                        </td>
                        <td className={`text-right py-2 ${item.currentStock === 0 ? 'text-red-600 font-bold' : ''}`}>
                          {item.currentStock}
                        </td>
                      </tr>
                    ))}
                    {sortedPerformance.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-4 text-muted-foreground">
                          No items sold this period
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="border-t-2">
                    <tr className="font-bold">
                      <td className="py-2">Total</td>
                      <td className="text-center py-2">
                        {sortedPerformance.reduce((s, i) => s + i.quantity, 0)}
                      </td>
                      <td className="text-right py-2">{formatKES(totalSales)}</td>
                      <td className="text-right py-2">{formatKES(totalCost)}</td>
                      <td className="text-right py-2 text-primary">{formatKES(totalProfit)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
