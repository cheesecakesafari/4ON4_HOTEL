import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { DollarSign, TrendingUp, Bed, Package, CalendarIcon, Eye, History, Clock, ChevronDown, ChevronUp, Download, FileText } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays } from 'date-fns';
import { generateFullReport, generatePeriodReport, generateDebtsReport, generateInventoryReport, generateOccupancyReport, FullReportData } from '@/utils/pdfGenerator';
import { toast } from 'sonner';
import DebtClearingSection from './DebtClearingSection';
import SalesBreakdownSection from './SalesBreakdownSection';

interface DailySummary {
  totalRevenue: number;
  totalExpenses: number;
  totalDebt: number;
  orderCount: number;
  roomBookings: number;
  conferenceBookings: number;
  paymentBreakdown: { cash: number; kcb: number; mpesa: number; debt: number };
}

interface DebtOrder {
  id: string;
  order_number: number;
  debtor_name: string;
  total_amount: number;
  amount_paid: number;
  created_at: string;
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  min_quantity: number;
}

interface Order {
  id: string;
  order_number: number;
  total_amount: number;
  amount_paid: number;
  status: string;
  created_at: string;
  order_items: { quantity: number; price: number; item_name: string | null; menu_items: { name: string } | null }[];
}

interface RoomBooking {
  id: string;
  guest_name: string;
  price: number;
  amount_paid: number;
  check_in_date: string;
  checkout_date: string;
  rooms: { room_number: string } | null;
}

interface ConferenceBooking {
  id: string;
  guest_name: string;
  company_name: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  conference_rooms: { name: string } | null;
}

interface Expense {
  id: string;
  department: string;
  description: string;
  amount: number;
  category: string;
  created_at: string;
}

interface PeriodData {
  revenue: number;
  expenses: number;
  orderCount: number;
  roomBookings: number;
  conferenceBookings: number;
  paymentBreakdown: { cash: number; kcb: number; mpesa: number; debt: number };
}

const formatKES = (amount: number) => `KES ${amount.toLocaleString('en-KE')}`;
const generateOrderId = (orderNumber: number) => `EH${orderNumber}`;

export default function AccountantTab() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [periodType, setPeriodType] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [summary, setSummary] = useState<DailySummary>({
    totalRevenue: 0,
    totalExpenses: 0,
    totalDebt: 0,
    orderCount: 0,
    roomBookings: 0,
    conferenceBookings: 0,
    paymentBreakdown: { cash: 0, kcb: 0, mpesa: 0, debt: 0 },
  });
  const [debtOrders, setDebtOrders] = useState<DebtOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailType, setDetailType] = useState<'orders' | 'rooms' | 'conference' | 'expenses'>('orders');
  const [detailOrders, setDetailOrders] = useState<Order[]>([]);
  const [detailRoomBookings, setDetailRoomBookings] = useState<RoomBooking[]>([]);
  const [detailConferenceBookings, setDetailConferenceBookings] = useState<ConferenceBooking[]>([]);
  const [detailExpenses, setDetailExpenses] = useState<Expense[]>([]);
  const [periodData, setPeriodData] = useState<PeriodData>({
    revenue: 0,
    expenses: 0,
    orderCount: 0,
    roomBookings: 0,
    conferenceBookings: 0,
    paymentBreakdown: { cash: 0, kcb: 0, mpesa: 0, debt: 0 },
  });
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [roomStats, setRoomStats] = useState({ total: 0, occupied: 0, available: 0, maintenance: 0 });
  const [conferenceStats, setConferenceStats] = useState({ todayBookings: 0, weekBookings: 0 });

  useEffect(() => {
    fetchDebtOrders();
    fetchInventory();
  }, []);

  useEffect(() => {
    fetchDailySummary();
    fetchPeriodData();
  }, [selectedDate, periodType]);

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

  const fetchDailySummary = async () => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    const { data: orders } = await supabase
      .from('orders')
      .select('total_amount, amount_paid, payment_method, is_debt')
      .gte('created_at', `${dateStr}T00:00:00`)
      .lte('created_at', `${dateStr}T23:59:59`);

    const { data: roomBookingsData } = await supabase
      .from('room_bookings')
      .select('amount_paid')
      .gte('created_at', `${dateStr}T00:00:00`)
      .lte('created_at', `${dateStr}T23:59:59`);

    const { count: roomCount } = await supabase
      .from('room_bookings')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${dateStr}T00:00:00`);

    const { count: confCount } = await supabase
      .from('conference_bookings')
      .select('*', { count: 'exact', head: true })
      .eq('booking_date', dateStr);

    const { data: expensesData } = await supabase
      .from('expenses')
      .select('amount')
      .gte('created_at', `${dateStr}T00:00:00`)
      .lte('created_at', `${dateStr}T23:59:59`);

    const totalExpenses = expensesData?.reduce((sum, e) => sum + e.amount, 0) || 0;
    const roomRevenue = roomBookingsData?.reduce((sum, b) => sum + b.amount_paid, 0) || 0;

    if (orders) {
      const orderRevenue = orders.reduce((sum, o) => sum + (o.amount_paid || 0), 0);
      const totalRevenue = orderRevenue + roomRevenue;
      const totalDebt = orders.filter(o => o.is_debt).reduce((sum, o) => sum + (o.total_amount - o.amount_paid), 0);
      
      // Parse payment methods - format is "method:amount,method:amount" or old format "method"
      let cash = 0, kcb = 0, mpesa = 0, debt = 0;
      orders.forEach(o => {
        // Calculate debt amount
        if (o.is_debt) {
          debt += o.total_amount - o.amount_paid;
        }
        
        if (o.payment_method) {
          // Check if it's the new format "method:amount,method:amount"
          if (o.payment_method.includes(':')) {
            const parts = o.payment_method.split(',');
            parts.forEach((part: string) => {
              const [method, amtStr] = part.split(':');
              const amt = parseFloat(amtStr) || 0;
              if (method === 'cash') cash += amt;
              else if (method === 'kcb' || method === 'card') kcb += amt;
              else if (method === 'mpesa' || method === 'mobile') mpesa += amt;
            });
          } else {
            // Old format - just the method name
            const method = o.payment_method.toLowerCase();
            if (method === 'cash') cash += o.amount_paid;
            else if (method === 'kcb' || method === 'card') kcb += o.amount_paid;
            else if (method === 'mpesa' || method === 'mobile') mpesa += o.amount_paid;
          }
        }
      });

      setSummary({
        totalRevenue,
        totalExpenses,
        totalDebt,
        orderCount: orders.length,
        roomBookings: roomCount || 0,
        conferenceBookings: confCount || 0,
        paymentBreakdown: { cash, kcb, mpesa, debt },
      });
    }
  };

  const fetchPeriodData = async () => {
    const { start, end } = getDateRange();
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');

    const { data: orders } = await supabase
      .from('orders')
      .select('amount_paid, payment_method, is_debt, total_amount')
      .gte('created_at', `${startStr}T00:00:00`)
      .lte('created_at', `${endStr}T23:59:59`);

    const { data: roomBookingsData } = await supabase
      .from('room_bookings')
      .select('amount_paid')
      .gte('created_at', `${startStr}T00:00:00`)
      .lte('created_at', `${endStr}T23:59:59`);

    const { count: orderCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${startStr}T00:00:00`)
      .lte('created_at', `${endStr}T23:59:59`);

    const { count: roomCount } = await supabase
      .from('room_bookings')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${startStr}T00:00:00`)
      .lte('created_at', `${endStr}T23:59:59`);

    const { count: confCount } = await supabase
      .from('conference_bookings')
      .select('*', { count: 'exact', head: true })
      .gte('booking_date', startStr)
      .lte('booking_date', endStr);

    const { data: expensesData } = await supabase
      .from('expenses')
      .select('amount')
      .gte('created_at', `${startStr}T00:00:00`)
      .lte('created_at', `${endStr}T23:59:59`);

    const orderRevenue = orders?.reduce((sum, o) => sum + o.amount_paid, 0) || 0;
    const roomRevenue = roomBookingsData?.reduce((sum, b) => sum + b.amount_paid, 0) || 0;
    const totalExpenses = expensesData?.reduce((sum, e) => sum + e.amount, 0) || 0;

    // Calculate payment breakdown for period
    let cash = 0, kcb = 0, mpesa = 0, debt = 0;
    orders?.forEach(o => {
      if (o.is_debt) {
        debt += o.total_amount - o.amount_paid;
      }
      if (o.payment_method) {
        // Check if it's the new format "method:amount,method:amount"
        if (o.payment_method.includes(':')) {
          const parts = o.payment_method.split(',');
          parts.forEach((part: string) => {
            const [method, amtStr] = part.split(':');
            const amt = parseFloat(amtStr) || 0;
            if (method === 'cash') cash += amt;
            else if (method === 'kcb' || method === 'card') kcb += amt;
            else if (method === 'mpesa' || method === 'mobile') mpesa += amt;
          });
        } else {
          // Old format - just the method name
          const method = o.payment_method.toLowerCase();
          if (method === 'cash') cash += o.amount_paid;
          else if (method === 'kcb' || method === 'card') kcb += o.amount_paid;
          else if (method === 'mpesa' || method === 'mobile') mpesa += o.amount_paid;
        }
      }
    });

    setPeriodData({
      revenue: orderRevenue + roomRevenue,
      expenses: totalExpenses,
      orderCount: orderCount || 0,
      roomBookings: roomCount || 0,
      conferenceBookings: confCount || 0,
      paymentBreakdown: { cash, kcb, mpesa, debt },
    });
  };

  const fetchDebtOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, debtor_name, total_amount, amount_paid, created_at')
      .eq('is_debt', true)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setDebtOrders(data as DebtOrder[]);
  };

  const fetchInventory = async () => {
    const { data } = await supabase.from('inventory').select('*').order('category').order('name');
    if (data) setInventory(data);
  };

  const openDetail = async (type: 'orders' | 'rooms' | 'conference' | 'expenses') => {
    setDetailType(type);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    if (type === 'orders') {
      const { data } = await supabase
        .from('orders')
        .select(`*, order_items (quantity, price, item_name, menu_items (name))`)
        .gte('created_at', `${dateStr}T00:00:00`)
        .lte('created_at', `${dateStr}T23:59:59`)
        .order('created_at', { ascending: false });
      setDetailOrders((data || []) as Order[]);
    } else if (type === 'rooms') {
      const { data } = await supabase
        .from('room_bookings')
        .select(`*, rooms (room_number)`)
        .gte('created_at', `${dateStr}T00:00:00`)
        .lte('created_at', `${dateStr}T23:59:59`)
        .order('created_at', { ascending: false });
      setDetailRoomBookings((data || []) as RoomBooking[]);
    } else if (type === 'conference') {
      const { data } = await supabase
        .from('conference_bookings')
        .select(`*, conference_rooms (name)`)
        .eq('booking_date', dateStr)
        .order('start_time');
      setDetailConferenceBookings((data || []) as ConferenceBooking[]);
    } else if (type === 'expenses') {
      const { data } = await supabase
        .from('expenses')
        .select('*')
        .gte('created_at', `${dateStr}T00:00:00`)
        .lte('created_at', `${dateStr}T23:59:59`)
        .order('created_at', { ascending: false });
      setDetailExpenses((data || []) as Expense[]);
    }

    setDetailDialogOpen(true);
  };

  const lowStockItems = inventory.filter(i => i.quantity <= i.min_quantity);
  const netProfit = summary.totalRevenue - summary.totalExpenses;

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

  const handleDownloadFullReport = async () => {
    try {
      toast.info('Generating report...', { duration: 2000 });
      
      const { start, end } = getDateRange();
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');
      
      // Fetch all orders for the period
      const { data: allOrders } = await supabase
        .from('orders')
        .select('id, order_number, total_amount, amount_paid, status, created_at, payment_method')
        .gte('created_at', `${startStr}T00:00:00`)
        .lte('created_at', `${endStr}T23:59:59`)
        .order('created_at', { ascending: false });
      
      // Fetch all room bookings
      const { data: allRoomBookings } = await supabase
        .from('room_bookings')
        .select('id, guest_name, price, amount_paid, check_in_date, checkout_date, rooms (room_number)')
        .gte('created_at', `${startStr}T00:00:00`)
        .lte('created_at', `${endStr}T23:59:59`)
        .order('created_at', { ascending: false });
      
      // Fetch all conference bookings
      const { data: allConferenceBookings } = await supabase
        .from('conference_bookings')
        .select('id, guest_name, company_name, booking_date, start_time, end_time, conference_rooms (name)')
        .gte('booking_date', startStr)
        .lte('booking_date', endStr)
        .order('booking_date', { ascending: false });
      
      // Fetch all expenses
      const { data: allExpenses } = await supabase
        .from('expenses')
        .select('id, department, description, amount, category, created_at')
        .gte('created_at', `${startStr}T00:00:00`)
        .lte('created_at', `${endStr}T23:59:59`)
        .order('created_at', { ascending: false });
      
      const reportData: FullReportData = {
        summary,
        periodData,
        debtOrders,
        inventory,
        orders: (allOrders || []) as any,
        roomBookings: (allRoomBookings || []) as any,
        conferenceBookings: (allConferenceBookings || []) as any,
        expenses: (allExpenses || []) as any,
      };
      
      generateFullReport(reportData, {
        title: `Financial Report - ${getPeriodLabel()}`,
        periodLabel: getPeriodLabel(),
      });
      
      toast.success('Report downloaded successfully!');
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    }
  };

  const handleDownloadDailyReport = async () => {
    try {
      toast.info('Generating daily report...', { duration: 2000 });
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      const { data: allOrders } = await supabase
        .from('orders')
        .select('id, order_number, total_amount, amount_paid, status, created_at, payment_method')
        .gte('created_at', `${dateStr}T00:00:00`)
        .lte('created_at', `${dateStr}T23:59:59`)
        .order('created_at', { ascending: false });
      
      const { data: allRoomBookings } = await supabase
        .from('room_bookings')
        .select('id, guest_name, price, amount_paid, check_in_date, checkout_date, rooms (room_number)')
        .gte('created_at', `${dateStr}T00:00:00`)
        .lte('created_at', `${dateStr}T23:59:59`);
      
      const { data: allConferenceBookings } = await supabase
        .from('conference_bookings')
        .select('id, guest_name, company_name, booking_date, start_time, end_time, conference_rooms (name)')
        .eq('booking_date', dateStr);
      
      const { data: allExpenses } = await supabase
        .from('expenses')
        .select('id, department, description, amount, category, created_at')
        .gte('created_at', `${dateStr}T00:00:00`)
        .lte('created_at', `${dateStr}T23:59:59`);
      
      generatePeriodReport({
        summary,
        periodData,
        orders: (allOrders || []) as any,
        roomBookings: (allRoomBookings || []) as any,
        conferenceBookings: (allConferenceBookings || []) as any,
        expenses: (allExpenses || []) as any,
      }, format(selectedDate, 'MMMM d, yyyy'), 'Daily');
      
      toast.success('Daily report downloaded!');
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    }
  };

  const handleDownloadPeriodReport = async () => {
    try {
      toast.info('Generating period report...', { duration: 2000 });
      const { start, end } = getDateRange();
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');
      
      const { data: allOrders } = await supabase
        .from('orders')
        .select('id, order_number, total_amount, amount_paid, status, created_at, payment_method')
        .gte('created_at', `${startStr}T00:00:00`)
        .lte('created_at', `${endStr}T23:59:59`)
        .order('created_at', { ascending: false });
      
      const { data: allRoomBookings } = await supabase
        .from('room_bookings')
        .select('id, guest_name, price, amount_paid, check_in_date, checkout_date, rooms (room_number)')
        .gte('created_at', `${startStr}T00:00:00`)
        .lte('created_at', `${endStr}T23:59:59`);
      
      const { data: allConferenceBookings } = await supabase
        .from('conference_bookings')
        .select('id, guest_name, company_name, booking_date, start_time, end_time, conference_rooms (name)')
        .gte('booking_date', startStr)
        .lte('booking_date', endStr);
      
      const { data: allExpenses } = await supabase
        .from('expenses')
        .select('id, department, description, amount, category, created_at')
        .gte('created_at', `${startStr}T00:00:00`)
        .lte('created_at', `${endStr}T23:59:59`);
      
      generatePeriodReport({
        summary,
        periodData,
        orders: (allOrders || []) as any,
        roomBookings: (allRoomBookings || []) as any,
        conferenceBookings: (allConferenceBookings || []) as any,
        expenses: (allExpenses || []) as any,
      }, getPeriodLabel(), periodType.charAt(0).toUpperCase() + periodType.slice(1));
      
      toast.success('Period report downloaded!');
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    }
  };

  const handleDownloadDebtsReport = () => {
    try {
      toast.info('Generating debts report...', { duration: 2000 });
      generateDebtsReport(debtOrders);
      toast.success('Debts report downloaded!');
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    }
  };

  const handleDownloadInventoryReport = () => {
    try {
      toast.info('Generating inventory report...', { duration: 2000 });
      generateInventoryReport(inventory);
      toast.success('Inventory report downloaded!');
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    }
  };

  const handleDownloadOccupancyReport = () => {
    try {
      toast.info('Generating occupancy report...', { duration: 2000 });
      generateOccupancyReport(roomStats, conferenceStats);
      toast.success('Occupancy report downloaded!');
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <DollarSign className="w-6 h-6" />
            Accountant Dashboard
          </h2>
          <p className="text-muted-foreground">View-only access to all financial data</p>
        </div>
        <Button 
          onClick={handleDownloadFullReport}
          className="flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          <FileText className="w-4 h-4" />
          Download Full Report (PDF)
        </Button>
      </div>

      <Tabs defaultValue="period" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="period">Period View</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="expenses-list">Expenses</TabsTrigger>
          <TabsTrigger value="debts">Outstanding Debts</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="occupancy">Occupancy</TabsTrigger>
        </TabsList>

        {/* Period View */}
        <TabsContent value="period" className="space-y-6 mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex flex-wrap gap-2">
              {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(type => (
                <Button
                  key={type}
                  variant={periodType === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPeriodType(type)}
                  className="capitalize"
                >
                  {type}
                </Button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadPeriodReport} className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Download {periodType.charAt(0).toUpperCase() + periodType.slice(1)} Report
            </Button>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5" />
                  Select {periodType === 'daily' ? 'Date' : periodType === 'weekly' ? 'Week' : periodType === 'monthly' ? 'Month' : 'Year'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  className="rounded-md border"
                />
              </CardContent>
            </Card>

            <div className="lg:col-span-2 space-y-4">
              <p className="text-lg font-medium">{getPeriodLabel()}</p>
              
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-muted-foreground mb-2">Total Revenue</div>
                    <div className="text-2xl font-bold text-green-600">{formatKES(periodData.revenue)}</div>
                    <div className="text-xs text-muted-foreground">{periodData.orderCount} orders</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-muted-foreground mb-2">Total Expenses</div>
                    <div className="text-2xl font-bold text-red-600">{formatKES(periodData.expenses)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-muted-foreground mb-2">Net Profit</div>
                    <div className={`text-2xl font-bold ${(periodData.revenue - periodData.expenses) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatKES(periodData.revenue - periodData.expenses)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-muted-foreground mb-2">Room Bookings</div>
                    <div className="text-2xl font-bold">{periodData.roomBookings}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-muted-foreground mb-2">Conference Bookings</div>
                    <div className="text-2xl font-bold">{periodData.conferenceBookings}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Payment Breakdown for Period */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Payment Methods Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-muted/50 rounded-xl">
                      <div className="text-2xl font-bold">{formatKES(periodData.paymentBreakdown.cash)}</div>
                      <div className="text-sm text-muted-foreground">Cash</div>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-xl">
                      <div className="text-2xl font-bold">{formatKES(periodData.paymentBreakdown.mpesa)}</div>
                      <div className="text-sm text-muted-foreground">M-Pesa</div>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-xl">
                      <div className="text-2xl font-bold">{formatKES(periodData.paymentBreakdown.kcb)}</div>
                      <div className="text-sm text-muted-foreground">KCB</div>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-xl">
                      <div className="text-2xl font-bold text-orange-600">{formatKES(periodData.paymentBreakdown.debt)}</div>
                      <div className="text-sm text-muted-foreground">Outstanding Debt</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Sales Tab - Periodic Sales List */}
        <TabsContent value="sales" className="mt-6 space-y-6">
          <SalesListSection />
        </TabsContent>

        {/* Expenses Tab - Periodic Expenses List */}
        <TabsContent value="expenses-list" className="mt-6 space-y-6">
          <ExpensesListSection />
        </TabsContent>

        <TabsContent value="debts" className="mt-6 space-y-6">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleDownloadDebtsReport} className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Download Debts PDF
            </Button>
          </div>
          <DebtClearingSection />
        </TabsContent>

        <TabsContent value="inventory" className="mt-6">
          <div className="flex justify-end mb-4">
            <Button variant="outline" size="sm" onClick={handleDownloadInventoryReport} className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Download Inventory PDF
            </Button>
          </div>
          <div className="space-y-6">
            {lowStockItems.length > 0 && (
              <Card className="border-orange-500/50">
                <CardHeader>
                  <CardTitle className="text-orange-600 flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Low Stock Alert
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {lowStockItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-orange-500/10 rounded-lg">
                        <div>
                          <div className="font-medium">{item.name}</div>
                          <div className="text-sm text-muted-foreground capitalize">{item.category}</div>
                        </div>
                        <Badge variant="destructive">
                          {item.quantity} {item.unit} left
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Inventory List (View Only)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {inventory.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-muted-foreground capitalize">{item.category}</div>
                      </div>
                      <Badge variant={item.quantity <= item.min_quantity ? 'destructive' : 'secondary'}>
                        {item.quantity} {item.unit}
                      </Badge>
                    </div>
                  ))}
                  {inventory.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No inventory items configured yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="occupancy" className="mt-6">
          <div className="flex justify-end mb-4">
            <Button variant="outline" size="sm" onClick={handleDownloadOccupancyReport} className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Download Occupancy PDF
            </Button>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bed className="w-5 h-5" />
                  Room Occupancy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RoomOccupancyStats onStatsChange={setRoomStats} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5" />
                  Conference Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ConferenceUsageStats onStatsChange={setConferenceStats} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              {detailType === 'orders' && 'Orders'} 
              {detailType === 'rooms' && 'Room Bookings'}
              {detailType === 'conference' && 'Conference Bookings'}
              {detailType === 'expenses' && 'Expenses'}
              {' '}on {format(selectedDate, 'MMM d, yyyy')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 mt-4">
            {detailType === 'orders' && detailOrders.map(order => (
              <div key={order.id} className="p-3 bg-muted/50 rounded-lg">
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                >
                  <div>
                    <div className="font-medium">{generateOrderId(order.order_number)}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(order.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="font-bold">{formatKES(order.total_amount)}</div>
                      <Badge variant={order.status === 'cleared' ? 'default' : 'secondary'} className="text-xs">
                        {order.status}
                      </Badge>
                    </div>
                    {expandedOrder === order.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
                {expandedOrder === order.id && order.order_items && (
                  <div className="mt-3 pt-3 border-t space-y-1">
                    {order.order_items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>{item.quantity}x {item.item_name || item.menu_items?.name || 'Unknown'}</span>
                        <span>{formatKES(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {detailType === 'rooms' && detailRoomBookings.map(booking => (
              <div key={booking.id} className="p-3 bg-muted/50 rounded-lg flex justify-between">
                <div>
                  <div className="font-medium">{booking.guest_name}</div>
                  <div className="text-sm text-muted-foreground">
                    Room {booking.rooms?.room_number} • {booking.check_in_date} to {booking.checkout_date}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">{formatKES(booking.price)}</div>
                  <div className="text-xs text-muted-foreground">Paid: {formatKES(booking.amount_paid)}</div>
                </div>
              </div>
            ))}

            {detailType === 'conference' && detailConferenceBookings.map(booking => (
              <div key={booking.id} className="p-3 bg-muted/50 rounded-lg flex justify-between">
                <div>
                  <div className="font-medium">{booking.guest_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {booking.company_name && `${booking.company_name} • `}
                    {booking.conference_rooms?.name}
                  </div>
                </div>
                <div className="text-sm">
                  {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
                </div>
              </div>
            ))}

            {detailType === 'expenses' && detailExpenses.map(expense => (
              <div key={expense.id} className="p-3 bg-muted/50 rounded-lg flex justify-between">
                <div>
                  <div className="font-medium">{expense.description}</div>
                  <div className="text-sm text-muted-foreground">
                    {expense.department} • {expense.category}
                  </div>
                </div>
                <span className="font-bold text-red-600">-{formatKES(expense.amount)}</span>
              </div>
            ))}

            {((detailType === 'orders' && detailOrders.length === 0) ||
              (detailType === 'rooms' && detailRoomBookings.length === 0) ||
              (detailType === 'conference' && detailConferenceBookings.length === 0) ||
              (detailType === 'expenses' && detailExpenses.length === 0)) && (
              <p className="text-center text-muted-foreground py-8">No data for this date</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface RoomOccupancyStatsProps {
  onStatsChange?: (stats: { total: number; occupied: number; available: number; maintenance: number }) => void;
}

function RoomOccupancyStats({ onStatsChange }: RoomOccupancyStatsProps) {
  const [stats, setStats] = useState({ total: 0, occupied: 0, available: 0, maintenance: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const { data } = await supabase.from('rooms').select('status');
      if (data) {
        const newStats = {
          total: data.length,
          occupied: data.filter(r => r.status === 'occupied').length,
          available: data.filter(r => r.status === 'available').length,
          maintenance: data.filter(r => r.status === 'maintenance').length,
        };
        setStats(newStats);
        onStatsChange?.(newStats);
      }
    };
    fetchStats();
  }, [onStatsChange]);

  const occupancyRate = stats.total > 0 ? ((stats.occupied / stats.total) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-4xl font-bold">{occupancyRate}%</div>
        <div className="text-sm text-muted-foreground">Occupancy Rate</div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 bg-green-500/10 rounded-lg">
          <div className="font-bold text-green-600">{stats.available}</div>
          <div className="text-xs text-muted-foreground">Available</div>
        </div>
        <div className="p-2 bg-red-500/10 rounded-lg">
          <div className="font-bold text-red-600">{stats.occupied}</div>
          <div className="text-xs text-muted-foreground">Occupied</div>
        </div>
        <div className="p-2 bg-orange-500/10 rounded-lg">
          <div className="font-bold text-orange-600">{stats.maintenance}</div>
          <div className="text-xs text-muted-foreground">Maintenance</div>
        </div>
      </div>
    </div>
  );
}

interface ConferenceUsageStatsProps {
  onStatsChange?: (stats: { todayBookings: number; weekBookings: number }) => void;
}

function ConferenceUsageStats({ onStatsChange }: ConferenceUsageStatsProps) {
  const [todayBookings, setTodayBookings] = useState(0);
  const [weekBookings, setWeekBookings] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const weekAgo = format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');

      const { count: todayCount } = await supabase
        .from('conference_bookings')
        .select('*', { count: 'exact', head: true })
        .eq('booking_date', today);

      const { count: weekCount } = await supabase
        .from('conference_bookings')
        .select('*', { count: 'exact', head: true })
        .gte('booking_date', weekAgo);

      const tBookings = todayCount || 0;
      const wBookings = weekCount || 0;
      setTodayBookings(tBookings);
      setWeekBookings(wBookings);
      onStatsChange?.({ todayBookings: tBookings, weekBookings: wBookings });
    };
    fetchStats();
  }, [onStatsChange]);

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-4xl font-bold">{todayBookings}</div>
        <div className="text-sm text-muted-foreground">Bookings Today</div>
      </div>
      <div className="p-3 bg-muted/50 rounded-lg text-center">
        <div className="font-bold">{weekBookings}</div>
        <div className="text-xs text-muted-foreground">This Week</div>
      </div>
    </div>
  );
}

// Sales List Section Component
interface SalesOrder {
  id: string;
  order_number: number;
  total_amount: number;
  amount_paid: number;
  status: string;
  payment_method: string | null;
  created_at: string;
  debtor_name: string | null;
  waiter: { name: string } | null;
  order_items: { quantity: number; price: number; item_name: string | null; menu_items: { name: string } | null }[];
}

function SalesListSection() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodType, setPeriodType] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

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
    fetchOrders();
  }, [selectedDate, periodType]);

  const fetchOrders = async () => {
    setLoading(true);
    const { start, end } = getDateRange();
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');

    const { data } = await supabase
      .from('orders')
      .select('id, order_number, total_amount, amount_paid, status, payment_method, created_at, debtor_name, waiter:employees!orders_waiter_id_fkey(name), order_items(quantity, price, item_name, menu_items(name))')
      .gte('created_at', `${startStr}T00:00:00`)
      .lte('created_at', `${endStr}T23:59:59`)
      .in('status', ['paid', 'served', 'cleared'])
      .order('created_at', { ascending: false });

    if (data) setOrders(data as SalesOrder[]);
    setLoading(false);
  };

  const handleDownloadSalesReport = async () => {
    const { start, end } = getDateRange();
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');

    const { data: allOrders } = await supabase
      .from('orders')
      .select('id, order_number, total_amount, amount_paid, status, created_at, payment_method')
      .gte('created_at', `${startStr}T00:00:00`)
      .lte('created_at', `${endStr}T23:59:59`)
      .in('status', ['paid', 'served', 'cleared'])
      .order('created_at', { ascending: false });

    generatePeriodReport({
      summary: { totalRevenue: 0, totalExpenses: 0, totalDebt: 0, orderCount: orders.length, roomBookings: 0, conferenceBookings: 0, paymentBreakdown: { cash: 0, kcb: 0, mpesa: 0, debt: 0 } },
      periodData: { revenue: orders.reduce((s, o) => s + o.amount_paid, 0), expenses: 0, orderCount: orders.length, roomBookings: 0, conferenceBookings: 0, paymentBreakdown: { cash: 0, kcb: 0, mpesa: 0, debt: 0 } },
      orders: (allOrders || []) as any,
      roomBookings: [],
      conferenceBookings: [],
      expenses: [],
    }, getPeriodLabel(), `Sales - ${periodType.charAt(0).toUpperCase() + periodType.slice(1)}`);
    toast.success('Sales report downloaded!');
  };

  const totalSales = orders.reduce((sum, o) => sum + o.amount_paid, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(type => (
            <Button
              key={type}
              variant={periodType === type ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriodType(type)}
              className="capitalize"
            >
              {type}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={handleDownloadSalesReport} className="flex items-center gap-2">
          <Download className="w-4 h-4" />
          Download Sales PDF
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              Select Period
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-lg font-medium">{getPeriodLabel()}</p>
            <Badge variant="secondary" className="text-lg px-4 py-2">
              Total: {formatKES(totalSales)}
            </Badge>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Sales ({orders.length} orders)
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[500px] overflow-y-auto">
              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : orders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No sales for this period</div>
              ) : (
                <div className="space-y-2">
                  {orders.map(order => (
                    <div key={order.id} className="p-3 bg-muted/50 rounded-lg">
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                      >
                        <div>
                          <div className="font-medium">{generateOrderId(order.order_number)}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(order.created_at), 'MMM d, HH:mm')}
                            {order.waiter && <span className="ml-2">• {order.waiter.name}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="font-bold text-green-600">{formatKES(order.amount_paid)}</div>
                            <Badge variant={order.status === 'paid' ? 'default' : 'secondary'} className="text-xs">
                              {order.status}
                            </Badge>
                          </div>
                          {expandedOrder === order.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                      {expandedOrder === order.id && order.order_items && (
                        <div className="mt-3 pt-3 border-t space-y-1">
                          {order.order_items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span>{item.quantity}x {item.item_name || item.menu_items?.name || 'Unknown'}</span>
                              <span>{formatKES(item.price * item.quantity)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Expenses List Section Component
interface ExpenseItem {
  id: string;
  department: string;
  description: string;
  amount: number;
  category: string;
  created_at: string;
  staff: { name: string } | null;
}

function ExpensesListSection() {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodType, setPeriodType] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

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
    fetchExpenses();
  }, [selectedDate, periodType]);

  const fetchExpenses = async () => {
    setLoading(true);
    const { start, end } = getDateRange();
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');

    const { data } = await supabase
      .from('expenses')
      .select('id, department, description, amount, category, created_at, staff:employees!expenses_staff_id_fkey(name)')
      .gte('created_at', `${startStr}T00:00:00`)
      .lte('created_at', `${endStr}T23:59:59`)
      .order('created_at', { ascending: false });

    if (data) setExpenses(data as ExpenseItem[]);
    setLoading(false);
  };

  const handleDownloadExpensesReport = async () => {
    const { start, end } = getDateRange();
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');

    const { data: allExpenses } = await supabase
      .from('expenses')
      .select('id, department, description, amount, category, created_at')
      .gte('created_at', `${startStr}T00:00:00`)
      .lte('created_at', `${endStr}T23:59:59`)
      .order('created_at', { ascending: false });

    generatePeriodReport({
      summary: { totalRevenue: 0, totalExpenses: totalExpenses, totalDebt: 0, orderCount: 0, roomBookings: 0, conferenceBookings: 0, paymentBreakdown: { cash: 0, kcb: 0, mpesa: 0, debt: 0 } },
      periodData: { revenue: 0, expenses: totalExpenses, orderCount: 0, roomBookings: 0, conferenceBookings: 0, paymentBreakdown: { cash: 0, kcb: 0, mpesa: 0, debt: 0 } },
      orders: [],
      roomBookings: [],
      conferenceBookings: [],
      expenses: (allExpenses || []) as any,
    }, getPeriodLabel(), `Expenses - ${periodType.charAt(0).toUpperCase() + periodType.slice(1)}`);
    toast.success('Expenses report downloaded!');
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Group by department
  const byDepartment = expenses.reduce((acc, e) => {
    if (!acc[e.department]) acc[e.department] = [];
    acc[e.department].push(e);
    return acc;
  }, {} as Record<string, ExpenseItem[]>);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(type => (
            <Button
              key={type}
              variant={periodType === type ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriodType(type)}
              className="capitalize"
            >
              {type}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={handleDownloadExpensesReport} className="flex items-center gap-2">
          <Download className="w-4 h-4" />
          Download Expenses PDF
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              Select Period
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-lg font-medium">{getPeriodLabel()}</p>
            <Badge variant="destructive" className="text-lg px-4 py-2">
              Total: {formatKES(totalExpenses)}
            </Badge>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Expenses ({expenses.length} items)
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[500px] overflow-y-auto">
              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : expenses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No expenses for this period</div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(byDepartment).map(([dept, items]) => (
                    <div key={dept}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium capitalize">{dept}</h4>
                        <span className="text-sm text-muted-foreground">
                          {formatKES(items.reduce((s, i) => s + i.amount, 0))}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {items.map(expense => (
                          <div key={expense.id} className="p-3 bg-muted/50 rounded-lg flex justify-between items-center">
                            <div>
                              <div className="font-medium">{expense.description}</div>
                              <div className="text-xs text-muted-foreground">
                                {expense.category} • {format(new Date(expense.created_at), 'MMM d, HH:mm')}
                                {expense.staff && <span className="ml-1">• {expense.staff.name}</span>}
                              </div>
                            </div>
                            <span className="font-bold text-red-600">-{formatKES(expense.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sales Per Item Breakdown */}
          <SalesBreakdownSection />
        </div>
      </div>
    </div>
  );
}
