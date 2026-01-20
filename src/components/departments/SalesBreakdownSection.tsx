import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Download, TrendingUp, CalendarIcon, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { generateSalesBreakdownReport } from '@/utils/salesBreakdownPdf';
import { toast } from 'sonner';

interface ItemSale {
  name: string;
  quantity: number;
  revenue: number;
  price: number;
  category: string;
}

const formatKES = (amount: number) => `KES ${amount.toLocaleString('en-KE')}`;

export default function SalesBreakdownSection() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [periodType, setPeriodType] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [itemSales, setItemSales] = useState<ItemSale[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const getDateRange = () => {
    const date = selectedDate;
    switch (periodType) {
      case 'weekly':
        return { start: startOfWeek(date, { weekStartsOn: 1 }), end: endOfWeek(date, { weekStartsOn: 1 }) };
      case 'monthly':
        return { start: startOfMonth(date), end: endOfMonth(date) };
      case 'yearly':
        return { start: startOfYear(date), end: endOfYear(date) };
      default:
        return { start: date, end: date };
    }
  };

  const getPeriodLabel = () => {
    const { start, end } = getDateRange();
    switch (periodType) {
      case 'weekly':
        return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
      case 'monthly':
        return format(start, 'MMMM yyyy');
      case 'yearly':
        return format(start, 'yyyy');
      default:
        return format(selectedDate, 'EEEE, MMMM d, yyyy');
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchItemSales();
    }
  }, [selectedDate, periodType, isOpen]);

  const fetchItemSales = async () => {
    setIsLoading(true);
    try {
      const { start, end } = getDateRange();
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');

      // Fetch restaurant orders with items
      const { data: orders } = await supabase
        .from('orders')
        .select(`
          id,
          order_items (
            quantity,
            price,
            item_name,
            menu_items (name, category)
          )
        `)
        .gte('created_at', `${startStr}T00:00:00`)
        .lte('created_at', `${endStr}T23:59:59`)
        .in('status', ['paid', 'served', 'cleared']);

      // Fetch bar orders with items
      const { data: barOrders } = await supabase
        .from('bar_orders')
        .select(`
          id,
          bar_order_items (
            quantity,
            price,
            item_name,
            bar_menu_items (name, category)
          )
        `)
        .gte('created_at', `${startStr}T00:00:00`)
        .lte('created_at', `${endStr}T23:59:59`)
        .in('status', ['paid', 'served']);

      // Aggregate sales by item
      const salesMap = new Map<string, ItemSale>();

      // Process restaurant orders
      orders?.forEach(order => {
        order.order_items?.forEach((item: any) => {
          const itemName = item.item_name || item.menu_items?.name || 'Unknown';
          const category = item.menu_items?.category || 'Uncategorized';
          const key = itemName;
          
          const existing = salesMap.get(key);
          if (existing) {
            existing.quantity += item.quantity;
            existing.revenue += item.quantity * item.price;
          } else {
            salesMap.set(key, {
              name: itemName,
              quantity: item.quantity,
              revenue: item.quantity * item.price,
              price: item.price,
              category: category,
            });
          }
        });
      });

      // Process bar orders
      barOrders?.forEach(order => {
        order.bar_order_items?.forEach((item: any) => {
          const itemName = item.item_name || item.bar_menu_items?.name || 'Unknown';
          const category = item.bar_menu_items?.category || 'Bar';
          const key = `[Bar] ${itemName}`;
          
          const existing = salesMap.get(key);
          if (existing) {
            existing.quantity += item.quantity;
            existing.revenue += item.quantity * item.price;
          } else {
            salesMap.set(key, {
              name: key,
              quantity: item.quantity,
              revenue: item.quantity * item.price,
              price: item.price,
              category: category,
            });
          }
        });
      });

      // Convert to array and sort by quantity (top sellers first)
      const sortedSales = Array.from(salesMap.values())
        .sort((a, b) => b.quantity - a.quantity);

      setItemSales(sortedSales);
    } catch (error) {
      console.error('Error fetching item sales:', error);
      toast.error('Failed to fetch sales data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (itemSales.length === 0) {
      toast.error('No sales data to download');
      return;
    }
    
    try {
      generateSalesBreakdownReport(itemSales, getPeriodLabel(), periodType);
      toast.success('Report downloaded successfully!');
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    }
  };

  const totalRevenue = itemSales.reduce((sum, item) => sum + item.revenue, 0);
  const totalQuantity = itemSales.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Sales Per Item Breakdown
              </div>
              {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Period Selection */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <Tabs value={periodType} onValueChange={(v) => setPeriodType(v as any)}>
                <TabsList>
                  <TabsTrigger value="daily">Daily</TabsTrigger>
                  <TabsTrigger value="weekly">Weekly</TabsTrigger>
                  <TabsTrigger value="monthly">Monthly</TabsTrigger>
                  <TabsTrigger value="yearly">Yearly</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex gap-2">
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {format(selectedDate, 'MMM d, yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        if (date) {
                          setSelectedDate(date);
                          setCalendarOpen(false);
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Button onClick={handleDownload} size="sm" disabled={itemSales.length === 0}>
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </div>

            {/* Period Label */}
            <div className="text-center font-medium text-muted-foreground">
              {getPeriodLabel()}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-700">{formatKES(totalRevenue)}</div>
                  <div className="text-sm text-green-600">Total Revenue</div>
                </CardContent>
              </Card>
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-700">{totalQuantity}</div>
                  <div className="text-sm text-blue-600">Items Sold</div>
                </CardContent>
              </Card>
            </div>

            {/* Items List */}
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : itemSales.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No sales data for this period
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {itemSales.map((item, index) => (
                  <div 
                    key={item.name} 
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      index === 0 ? 'bg-yellow-50 border-yellow-300' :
                      index === 1 ? 'bg-gray-50 border-gray-300' :
                      index === 2 ? 'bg-orange-50 border-orange-300' :
                      'bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0 ? 'bg-yellow-500 text-white' :
                        index === 1 ? 'bg-gray-400 text-white' :
                        index === 2 ? 'bg-orange-500 text-white' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatKES(item.price)} each • {item.category}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{formatKES(item.revenue)}</div>
                      <Badge variant="secondary" className="text-xs">
                        {item.quantity} sold
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Top 3 Highlight */}
            {itemSales.length >= 3 && (
              <Card className="bg-gradient-to-r from-yellow-50 via-gray-50 to-orange-50 border-none">
                <CardContent className="p-4">
                  <div className="text-center mb-2 font-medium text-muted-foreground flex items-center justify-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Top 3 Best Sellers
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="text-yellow-600">
                      <div className="text-lg">🥇</div>
                      <div className="text-xs font-medium truncate">{itemSales[0]?.name}</div>
                      <div className="text-xs">{itemSales[0]?.quantity} sold</div>
                    </div>
                    <div className="text-gray-500">
                      <div className="text-lg">🥈</div>
                      <div className="text-xs font-medium truncate">{itemSales[1]?.name}</div>
                      <div className="text-xs">{itemSales[1]?.quantity} sold</div>
                    </div>
                    <div className="text-orange-600">
                      <div className="text-lg">🥉</div>
                      <div className="text-xs font-medium truncate">{itemSales[2]?.name}</div>
                      <div className="text-xs">{itemSales[2]?.quantity} sold</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
