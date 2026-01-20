import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEmployee } from '@/contexts/EmployeeContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Settings, Users, Plus, Trash2, UtensilsCrossed, Bed, CalendarIcon, Package, TrendingUp, Receipt, ClipboardList, CheckCircle, Clock, Eye, ChefHat, BarChart3, AlertTriangle, Loader2, CreditCard, Download, Wallet, Beer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import NewRestaurantTab from './NewRestaurantTab';
import NewKitchenTab from './NewKitchenTab';
import RoomsTab from './RoomsTab';
import ConferenceTab from './ConferenceTab';
import DebtClearingSection from './DebtClearingSection';
import EmployeeCompensationSection from './EmployeeCompensationSection';
import AdminExpensesSection from './AdminExpensesSection';
import AdminOrdersSection from './AdminOrdersSection';
import SalesBreakdownSection from './SalesBreakdownSection';
import { downloadReceiptPdf } from '@/utils/receiptPdf';

interface Employee {
  id: string;
  name: string;
  phone: string;
  login_number: string;
  departments: string[];
}

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

interface Room {
  id: string;
  room_number: string;
  room_type: string;
}

interface ConferenceRoom {
  id: string;
  name: string;
  capacity: number;
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  min_quantity: number;
}

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

interface Expense {
  id: string;
  department: string;
  description: string;
  amount: number;
  category: string;
  created_at: string;
}

interface SalesData {
  totalSales: number;
  totalExpenses: number;
  itemsSold: Map<string, { name: string; quantity: number; revenue: number; price: number }>;
  orders: Order[];
  expenses: Expense[];
}

interface EmployeePerformance {
  id: string;
  name: string;
  login_number: string;
  departments: string[];
  restaurant: {
    totalOrders: number;
    paidOrders: number;
    pendingOrders: number;
    totalRevenue: number;
    paymentBreakdown: { cash: number; mpesa: number; kcb: number };
    orders: { order_number: number; total_amount: number; amount_paid: number; payment_method: string | null; status: string; created_at: string }[];
  };
  kitchen: {
    ordersServed: number;
    orders: { order_number: number; total_amount: number; status: string; created_at: string }[];
  };
  rooms: {
    bookings: number;
    revenue: number;
    bookingsList: { guest_name: string; room_number: string; amount_paid: number; check_in_date: string }[];
  };
  conference: {
    bookings: number;
    bookingsList: { guest_name: string; room_name: string; booking_date: string; start_time: string; end_time: string }[];
  };
}

const formatKES = (amount: number) => `KES ${amount.toLocaleString('en-KE')}`;
const generateOrderId = (orderNumber: number) => `EH${orderNumber}`;

export default function AdminTab() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuCombos, setMenuCombos] = useState<MenuCombo[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [conferenceRooms, setConferenceRooms] = useState<ConferenceRoom[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [salesData, setSalesData] = useState<SalesData>({
    totalSales: 0,
    totalExpenses: 0,
    itemsSold: new Map(),
    orders: [],
    expenses: [],
  });
  const [performanceData, setPerformanceData] = useState<EmployeePerformance[]>([]);
  const [selectedPerformanceEmployee, setSelectedPerformanceEmployee] = useState<string | null>(null);
  const { toast } = useToast();
  const { logout } = useEmployee();

  const [newMenuItem, setNewMenuItem] = useState({ name: '', category: 'drinks', price: '', requires_kitchen: false });
  const [newMenuCombo, setNewMenuCombo] = useState({ name: '', description: '', price: '' });
  const [newRoom, setNewRoom] = useState({ room_number: '', room_type: 'standard' });
  const [newConfRoom, setNewConfRoom] = useState({ name: '', capacity: '10' });
  const [newInventory, setNewInventory] = useState({ name: '', category: 'general', quantity: '0', unit: 'pcs', min_quantity: '0' });

  // Clear Everything states
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [secretCodeInput, setSecretCodeInput] = useState('');
  const [isClearingData, setIsClearingData] = useState(false);

  // Clear Orders Only states
  const [clearOrdersDialogOpen, setClearOrdersDialogOpen] = useState(false);
  const [isClearingOrders, setIsClearingOrders] = useState(false);

  // Clear Bar Data states
  const [clearBarDialogOpen, setClearBarDialogOpen] = useState(false);
  const [barSecretCodeInput, setBarSecretCodeInput] = useState('');
  const [isClearingBar, setIsClearingBar] = useState(false);

  useEffect(() => {
    fetchEmployees();
    fetchMenuItems();
    fetchMenuCombos();
    fetchRooms();
    fetchConferenceRooms();
    fetchInventory();
    fetchAllOrders();
    fetchPerformanceData();
  }, []);

  useEffect(() => {
    fetchSalesData(selectedDate);
  }, [selectedDate]);

  const fetchEmployees = async () => {
    const { data: empData } = await supabase.from('employees').select('*').order('name');
    if (empData) {
      const empsWithDepts = await Promise.all(
        empData.map(async (emp) => {
          const { data: depts } = await supabase
            .from('employee_departments')
            .select('department')
            .eq('employee_id', emp.id);
          return { ...emp, departments: depts?.map(d => d.department) || [] };
        })
      );
      setEmployees(empsWithDepts);
    }
  };

  const fetchMenuItems = async () => {
    const { data } = await supabase.from('menu_items').select('*').order('category').order('name');
    if (data) setMenuItems(data as MenuItem[]);
  };

  const fetchMenuCombos = async () => {
    const { data } = await supabase.from('menu_combos').select('*').order('name');
    if (data) setMenuCombos(data);
  };

  const fetchRooms = async () => {
    const { data } = await supabase.from('rooms').select('id, room_number, room_type').order('room_number');
    if (data) setRooms(data);
  };

  const fetchConferenceRooms = async () => {
    const { data } = await supabase.from('conference_rooms').select('id, name, capacity').order('name');
    if (data) setConferenceRooms(data);
  };

  const fetchInventory = async () => {
    const { data } = await supabase.from('inventory').select('*').order('category').order('name');
    if (data) setInventory(data);
  };

  const fetchAllOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select(`*, order_items (id, menu_item_id, quantity, price, item_name, item_type, menu_items (name))`)
      .order('created_at', { ascending: false })
      .limit(200);
    if (data) setAllOrders(data as Order[]);
  };

  const fetchSalesData = async (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const startOfDay = `${dateStr}T00:00:00`;
    const endOfDay = `${dateStr}T23:59:59`;

    const { data: ordersData } = await supabase
      .from('orders')
      .select(`*, order_items (id, menu_item_id, quantity, price, item_name, item_type, menu_items (name))`)
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay)
      .order('created_at', { ascending: false });

    const { data: expensesData } = await supabase
      .from('expenses')
      .select('*')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay)
      .order('created_at', { ascending: false });

    const orders = (ordersData || []) as Order[];
    const expenses = (expensesData || []) as Expense[];

    const itemsSold = new Map<string, { name: string; quantity: number; revenue: number; price: number }>();
    let totalSales = 0;

    orders.forEach(order => {
      totalSales += order.total_amount;
      order.order_items?.forEach(item => {
        const existing = itemsSold.get(item.menu_item_id);
        const itemName = item.item_name || item.menu_items?.name || 'Unknown';
        if (existing) {
          existing.quantity += item.quantity;
          existing.revenue += item.quantity * item.price;
        } else {
          itemsSold.set(item.menu_item_id, {
            name: itemName,
            quantity: item.quantity,
            revenue: item.quantity * item.price,
            price: item.price,
          });
        }
      });
    });

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    setSalesData({ totalSales, totalExpenses, itemsSold, orders, expenses });
  };

  const fetchPerformanceData = async () => {
    const { data: empData } = await supabase.from('employees').select('*').order('name');
    if (!empData) return;

    const performancePromises = empData.map(async (emp) => {
      // Fetch departments
      const { data: depts } = await supabase
        .from('employee_departments')
        .select('department')
        .eq('employee_id', emp.id);
      const departments = depts?.map(d => d.department) || [];

      // Restaurant - orders as waiter
      const { data: waiterOrders } = await supabase
        .from('orders')
        .select('order_number, total_amount, amount_paid, payment_method, status, created_at')
        .eq('waiter_id', emp.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      const orders = waiterOrders || [];
      let cash = 0, mpesa = 0, kcb = 0;
      orders.forEach(o => {
        if (o.payment_method) {
          const parts = o.payment_method.split(',');
          parts.forEach((part: string) => {
            const [method, amtStr] = part.split(':');
            const amt = parseFloat(amtStr) || 0;
            if (method === 'cash') cash += amt;
            else if (method === 'mpesa') mpesa += amt;
            else if (method === 'kcb') kcb += amt;
          });
        }
      });

      // Kitchen - orders as chef
      const { data: chefOrders } = await supabase
        .from('orders')
        .select('order_number, total_amount, status, created_at')
        .eq('chef_id', emp.id)
        .order('created_at', { ascending: false })
        .limit(50);

      // Rooms - bookings
      const { data: roomBookings } = await supabase
        .from('room_bookings')
        .select('guest_name, amount_paid, check_in_date, rooms (room_number)')
        .eq('staff_id', emp.id)
        .order('created_at', { ascending: false })
        .limit(50);

      // Conference - bookings
      const { data: confBookings } = await supabase
        .from('conference_bookings')
        .select('guest_name, booking_date, start_time, end_time, conference_rooms (name)')
        .eq('staff_id', emp.id)
        .order('booking_date', { ascending: false })
        .limit(50);

      return {
        id: emp.id,
        name: emp.name,
        login_number: emp.login_number,
        departments,
        restaurant: {
          totalOrders: orders.length,
          paidOrders: orders.filter(o => o.status === 'paid' || o.status === 'cleared').length,
          pendingOrders: orders.filter(o => o.status === 'pending' || o.status === 'preparing').length,
          totalRevenue: orders.reduce((sum, o) => sum + (o.amount_paid || 0), 0),
          paymentBreakdown: { cash, mpesa, kcb },
          orders,
        },
        kitchen: {
          ordersServed: (chefOrders || []).filter(o => o.status === 'served' || o.status === 'paid' || o.status === 'cleared').length,
          orders: chefOrders || [],
        },
        rooms: {
          bookings: (roomBookings || []).length,
          revenue: (roomBookings || []).reduce((sum, b) => sum + (b.amount_paid || 0), 0),
          bookingsList: (roomBookings || []).map((b: any) => ({
            guest_name: b.guest_name,
            room_number: b.rooms?.room_number || 'N/A',
            amount_paid: b.amount_paid,
            check_in_date: b.check_in_date,
          })),
        },
        conference: {
          bookings: (confBookings || []).length,
          bookingsList: (confBookings || []).map((b: any) => ({
            guest_name: b.guest_name,
            room_name: b.conference_rooms?.name || 'N/A',
            booking_date: b.booking_date,
            start_time: b.start_time,
            end_time: b.end_time,
          })),
        },
      } as EmployeePerformance;
    });

    const results = await Promise.all(performancePromises);
    setPerformanceData(results);
  };

  const addMenuItem = async () => {
    if (!newMenuItem.name || !newMenuItem.price) {
      toast({ title: 'Name and price required', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await supabase.from('menu_items').insert({
        name: newMenuItem.name,
        category: newMenuItem.category,
        price: parseFloat(newMenuItem.price),
        requires_kitchen: newMenuItem.requires_kitchen,
      });
      if (error) throw error;
      toast({ title: 'Item added!' });
      setNewMenuItem({ name: '', category: 'drinks', price: '', requires_kitchen: false });
      fetchMenuItems();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const addMenuCombo = async () => {
    if (!newMenuCombo.name || !newMenuCombo.price) {
      toast({ title: 'Name and price required', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await supabase.from('menu_combos').insert({
        name: newMenuCombo.name,
        description: newMenuCombo.description || null,
        price: parseFloat(newMenuCombo.price),
      });
      if (error) throw error;
      toast({ title: 'Menu combo added!' });
      setNewMenuCombo({ name: '', description: '', price: '' });
      fetchMenuCombos();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const deleteMenuItem = async (id: string) => {
    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (!error) fetchMenuItems();
  };

  const updateMenuItemPrice = async (id: string, price: number) => {
    const { error } = await supabase.from('menu_items').update({ price }).eq('id', id);
    if (!error) fetchMenuItems();
  };

  const toggleItemRequiresKitchen = async (id: string, requires_kitchen: boolean) => {
    const { error } = await supabase.from('menu_items').update({ requires_kitchen }).eq('id', id);
    if (!error) fetchMenuItems();
  };

  const deleteMenuCombo = async (id: string) => {
    const { error } = await supabase.from('menu_combos').delete().eq('id', id);
    if (!error) fetchMenuCombos();
  };

  const updateMenuComboPrice = async (id: string, price: number) => {
    const { error } = await supabase.from('menu_combos').update({ price }).eq('id', id);
    if (!error) fetchMenuCombos();
  };

  const addRoom = async () => {
    if (!newRoom.room_number) {
      toast({ title: 'Room number required', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await supabase.from('rooms').insert(newRoom);
      if (error) throw error;
      toast({ title: 'Room added!' });
      setNewRoom({ room_number: '', room_type: 'standard' });
      fetchRooms();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const deleteRoom = async (id: string) => {
    const { error } = await supabase.from('rooms').delete().eq('id', id);
    if (!error) fetchRooms();
  };

  const addConferenceRoom = async () => {
    if (!newConfRoom.name) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await supabase.from('conference_rooms').insert({
        name: newConfRoom.name,
        capacity: parseInt(newConfRoom.capacity) || 10,
      });
      if (error) throw error;
      toast({ title: 'Conference room added!' });
      setNewConfRoom({ name: '', capacity: '10' });
      fetchConferenceRooms();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const deleteConferenceRoom = async (id: string) => {
    const { error } = await supabase.from('conference_rooms').delete().eq('id', id);
    if (!error) fetchConferenceRooms();
  };

  const addInventoryItem = async () => {
    if (!newInventory.name) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await supabase.from('inventory').insert({
        name: newInventory.name,
        category: newInventory.category,
        quantity: parseInt(newInventory.quantity) || 0,
        unit: newInventory.unit,
        min_quantity: parseInt(newInventory.min_quantity) || 0,
      });
      if (error) throw error;
      toast({ title: 'Inventory item added!' });
      setNewInventory({ name: '', category: 'general', quantity: '0', unit: 'pcs', min_quantity: '0' });
      fetchInventory();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const updateInventoryQuantity = async (id: string, quantity: number) => {
    const { error } = await supabase.from('inventory').update({ quantity }).eq('id', id);
    if (!error) fetchInventory();
  };

  const deleteInventoryItem = async (id: string) => {
    const { error } = await supabase.from('inventory').delete().eq('id', id);
    if (!error) fetchInventory();
  };

  const deleteEmployee = async (id: string, name: string) => {
    try {
      // First delete from employee_departments (cascade should handle this, but be explicit)
      await supabase.from('employee_departments').delete().eq('employee_id', id);
      
      // Then delete the employee - foreign keys will SET NULL on related records
      const { error } = await supabase.from('employees').delete().eq('id', id);
      if (error) throw error;
      
      toast({ title: 'Staff removed', description: `${name} has been removed. Their history is preserved.` });
      fetchEmployees();
    } catch (error: any) {
      toast({ title: 'Error removing staff', description: error.message, variant: 'destructive' });
    }
  };

  const deleteOrder = async (orderId: string) => {
    try {
      // Delete full split-group (if any) so the kitchen/waiter tabs don't retain the other half.
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

      await supabase.from('order_items').delete().in('order_id', groupIds);
      const { error } = await supabase.from('orders').delete().in('id', groupIds);
      if (error) throw error;

      toast({ title: 'Order deleted' });
      fetchAllOrders();
    } catch (error: any) {
      toast({ title: 'Error deleting order', description: error.message, variant: 'destructive' });
    }
  };

  const clearOrder = async (orderId: string) => {
    const { error } = await supabase.from('orders').update({ status: 'cleared' }).eq('id', orderId);
    if (!error) {
      toast({ title: 'Order cleared' });
      fetchAllOrders();
    }
  };

  // Clear Everything Handler - Complete factory reset
  const handleClearEverything = async () => {
    if (!secretCodeInput.trim()) {
      toast({ title: 'Secret code required', variant: 'destructive' });
      return;
    }

    setIsClearingData(true);

    try {
      // Verify the secret code against any admin employee
      const { data: adminEmployee, error: verifyError } = await supabase
        .from('employees')
        .select('id, name, admin_secret_code')
        .eq('admin_secret_code', secretCodeInput.trim())
        .single();

      if (verifyError || !adminEmployee) {
        toast({ 
          title: 'Invalid secret code', 
          description: 'The secret code does not match any admin account.',
          variant: 'destructive' 
        });
        setIsClearingData(false);
        return;
      }

      // Clear ALL data in order (respecting foreign key constraints)
      // 1. Clear order_items first (references orders)
      await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // 2. Clear orders
      await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // 3. Clear room_bookings (references rooms)
      await supabase.from('room_bookings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // 4. Clear conference_bookings (references conference_rooms)
      await supabase.from('conference_bookings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // 5. Clear laundry_items (references rooms)
      await supabase.from('laundry_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // 6. Clear expenses
      await supabase.from('expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // 7. Clear inventory
      await supabase.from('inventory').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // 8. Clear menu_combos
      await supabase.from('menu_combos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // 9. Clear menu_items
      await supabase.from('menu_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // 10. Clear rooms
      await supabase.from('rooms').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // 11. Clear conference_rooms
      await supabase.from('conference_rooms').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // 12. Clear employee_departments (references employees)
      await supabase.from('employee_departments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // 13. Clear ALL employees including admin
      await supabase.from('employees').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      toast({ 
        title: 'Hotel completely reset!', 
        description: 'All data and staff accounts have been cleared. Logging out...',
      });

      setClearDialogOpen(false);
      setSecretCodeInput('');
      
      // Logout admin after clearing everything
      setTimeout(() => {
        logout();
      }, 1500);
    } catch (error: any) {
      toast({ 
        title: 'Error clearing data', 
        description: error.message || 'Something went wrong',
        variant: 'destructive' 
      });
    } finally {
      setIsClearingData(false);
    }
  };

  // Clear Orders Only Handler (preserves menu, staff, rooms, etc.)
  const handleClearOrders = async () => {
    setIsClearingOrders(true);

    try {
      // Clear order_items first (references orders)
      await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // Clear orders
      await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      toast({ 
        title: 'All orders cleared!', 
        description: 'Order history has been reset. Menu and staff preserved.',
      });

      setClearOrdersDialogOpen(false);
      fetchAllOrders();
      fetchSalesData(selectedDate);
      fetchPerformanceData();
    } catch (error: any) {
      toast({ 
        title: 'Error clearing orders', 
        description: error.message || 'Something went wrong',
        variant: 'destructive' 
      });
    } finally {
      setIsClearingOrders(false);
    }
  };

  // Clear Bar Data Handler - Resets bar department completely
  const handleClearBarData = async () => {
    if (!barSecretCodeInput.trim()) {
      toast({ title: 'Secret code required', variant: 'destructive' });
      return;
    }

    setIsClearingBar(true);

    try {
      // Verify the secret code against any admin employee
      const { data: adminEmployee, error: verifyError } = await supabase
        .from('employees')
        .select('id, name, admin_secret_code')
        .eq('admin_secret_code', barSecretCodeInput.trim())
        .single();

      if (verifyError || !adminEmployee) {
        toast({ 
          title: 'Invalid secret code', 
          description: 'The secret code does not match any admin account.',
          variant: 'destructive' 
        });
        setIsClearingBar(false);
        return;
      }

      // Clear bar data in order (respecting foreign key constraints)
      // 1. Clear bar_order_items first (references bar_orders)
      await supabase.from('bar_order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // 2. Clear bar_orders
      await supabase.from('bar_orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // 3. Clear bar_inventory (references bar_menu_items)
      await supabase.from('bar_inventory').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // 4. Clear bar_menu_items
      await supabase.from('bar_menu_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // 5. Get all employees with ONLY bar department
      const { data: barOnlyEmployees } = await supabase
        .from('employee_departments')
        .select('employee_id')
        .eq('department', 'bar');

      if (barOnlyEmployees && barOnlyEmployees.length > 0) {
        const barEmployeeIds = barOnlyEmployees.map(e => e.employee_id);
        
        // Check which of these employees have other departments
        const { data: multiDeptEmployees } = await supabase
          .from('employee_departments')
          .select('employee_id')
          .in('employee_id', barEmployeeIds)
          .neq('department', 'bar');

        const multiDeptIds = new Set((multiDeptEmployees || []).map(e => e.employee_id));
        
        // Get employees who ONLY have bar department
        const barOnlyIds = barEmployeeIds.filter(id => !multiDeptIds.has(id));

        if (barOnlyIds.length > 0) {
          // Delete bar department entries for bar-only employees
          await supabase.from('employee_departments').delete().in('employee_id', barOnlyIds);
          
          // Delete the employees themselves
          await supabase.from('employees').delete().in('id', barOnlyIds);
        }

        // For multi-department employees, just remove their bar department
        const multiDeptArray = Array.from(multiDeptIds);
        if (multiDeptArray.length > 0) {
          await supabase
            .from('employee_departments')
            .delete()
            .eq('department', 'bar')
            .in('employee_id', multiDeptArray);
        }
      }

      toast({ 
        title: 'Bar data cleared!', 
        description: 'All bar staff, orders, menu, and inventory have been deleted.',
      });

      setClearBarDialogOpen(false);
      setBarSecretCodeInput('');
      
      // Refresh employees list
      fetchEmployees();
    } catch (error: any) {
      toast({ 
        title: 'Error clearing bar data', 
        description: error.message || 'Something went wrong',
        variant: 'destructive' 
      });
    } finally {
      setIsClearingBar(false);
    }
  };

  const [selectedStaff, setSelectedStaff] = useState<Employee | null>(null);
  const [staffViewOpen, setStaffViewOpen] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const netProfit = salesData.totalSales - salesData.totalExpenses;

  // Order filtering
  // Pending: orders that haven't been served yet (pending or preparing)
  const pendingOrders = allOrders.filter(o => o.status === 'pending' || o.status === 'preparing');
  // Served: orders that are served but NOT fully paid
  const servedOrders = allOrders.filter(o => o.status === 'served' && o.amount_paid < o.total_amount);
  // Cleared: orders that are paid, cleared, OR served with full payment
  const clearedOrders = allOrders.filter(o => 
    o.status === 'cleared' || 
    o.status === 'paid' || 
    (o.status === 'served' && o.amount_paid >= o.total_amount)
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-600';
      case 'preparing': return 'bg-blue-500/10 text-blue-600';
      case 'served': return 'bg-purple-500/10 text-purple-600';
      case 'paid': return 'bg-green-500/10 text-green-600';
      case 'cleared': return 'bg-emerald-500/10 text-emerald-600';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Settings className="w-6 h-6" />
            Admin Panel
          </h2>
          <p className="text-muted-foreground">Manage employees, menu, rooms, inventory, and view sales</p>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          {/* Clear Orders Only Button */}
          <AlertDialog open={clearOrdersDialogOpen} onOpenChange={setClearOrdersDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-orange-600 border-orange-300 hover:bg-orange-50 hover:border-orange-500">
                <Trash2 className="w-4 h-4 mr-1" />
                Clear Orders
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
                  <Trash2 className="w-5 h-5" />
                  Clear All Orders
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will <span className="font-semibold text-orange-600">permanently delete</span> all orders and order items.
                  <p className="mt-2">Menu, staff, rooms, and other data will be preserved.</p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={handleClearOrders}
                  disabled={isClearingOrders}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {isClearingOrders ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Clearing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Clear All Orders
                    </>
                  )}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Clear Everything Button */}
          <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-red-600 border-red-300 hover:bg-red-50 hover:border-red-500">
                <AlertTriangle className="w-4 h-4 mr-1" />
                Reset Hotel
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                Clear All Hotel Data
              </DialogTitle>
              <DialogDescription className="pt-2">
                This will <span className="font-semibold text-red-600">permanently delete</span> all:
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                  <li>Orders and order history</li>
                  <li>Room bookings</li>
                  <li>Conference bookings</li>
                  <li>Expenses</li>
                  <li>Menu items and combos</li>
                  <li>Inventory</li>
                  <li>Rooms and conference rooms</li>
                </ul>
                <p className="mt-3 font-medium">Staff accounts will be preserved.</p>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="secretCode" className="text-sm font-medium">
                  Enter Admin Secret Code (3 digits)
                </Label>
                <Input
                  id="secretCode"
                  type="text"
                  maxLength={3}
                  placeholder="000"
                  value={secretCodeInput}
                  onChange={(e) => setSecretCodeInput(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  className="text-center text-2xl tracking-[0.3em] font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  This code was given during admin registration
                </p>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setClearDialogOpen(false);
                  setSecretCodeInput('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleClearEverything}
                disabled={secretCodeInput.length !== 3 || isClearingData}
              >
                {isClearingData ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear Everything
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

          {/* Reset Bar Button */}
          <Dialog open={clearBarDialogOpen} onOpenChange={setClearBarDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-orange-600 border-orange-300 hover:bg-orange-50 hover:border-orange-500">
                <Beer className="w-4 h-4 mr-1" />
                Reset Bar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-orange-600">
                  <Beer className="w-5 h-5" />
                  Reset Bar Department
                </DialogTitle>
                <DialogDescription className="pt-2">
                  This will <span className="font-semibold text-orange-600">permanently delete</span> all bar data:
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    <li>Bar staff accounts (bar-only employees)</li>
                    <li>Bar orders and sales history</li>
                    <li>Bar menu items</li>
                    <li>Bar inventory</li>
                  </ul>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Employees with multiple departments will keep their other roles.
                  </p>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="barSecretCode" className="text-sm font-medium">
                    Enter Admin Secret Code (3 digits)
                  </Label>
                  <Input
                    id="barSecretCode"
                    type="text"
                    maxLength={3}
                    placeholder="000"
                    value={barSecretCodeInput}
                    onChange={(e) => setBarSecretCodeInput(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    className="text-center text-2xl tracking-[0.3em] font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    This code was given during admin registration
                  </p>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setClearBarDialogOpen(false);
                    setBarSecretCodeInput('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleClearBarData}
                  disabled={barSecretCodeInput.length !== 3 || isClearingBar}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {isClearingBar ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Clearing Bar...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Reset Bar Data
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="staff-access" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="staff-access" className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Staff Access
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            Orders
          </TabsTrigger>
          <TabsTrigger value="sales" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Sales
          </TabsTrigger>
          <TabsTrigger value="employees" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Employees
          </TabsTrigger>
          <TabsTrigger value="menu" className="flex items-center gap-2">
            <UtensilsCrossed className="w-4 h-4" />
            Menu
          </TabsTrigger>
          <TabsTrigger value="rooms" className="flex items-center gap-2">
            <Bed className="w-4 h-4" />
            Rooms
          </TabsTrigger>
          <TabsTrigger value="conference" className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" />
            Conference
          </TabsTrigger>
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Inventory
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="debts" className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Debts
          </TabsTrigger>
          <TabsTrigger value="compensations" className="flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            Compensations
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            Expenses
          </TabsTrigger>
        </TabsList>

        {/* Staff Access Tab */}
        <TabsContent value="staff-access" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                View Staff Tabs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">Select a staff member to view their department tab</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {employees.map(emp => (
                  <Dialog key={emp.id}>
                    <DialogTrigger asChild>
                      <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <CardContent className="p-4">
                          <div className="font-medium flex items-center gap-2">
                            {emp.name}
                            <span className="font-mono text-sm text-muted-foreground">#{emp.login_number}</span>
                          </div>
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {emp.departments.map(d => (
                              <Badge key={d} variant="secondary" className="text-xs capitalize">{d}</Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </DialogTrigger>
                    <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          {emp.name}'s View
                          <span className="font-mono text-sm text-muted-foreground">#{emp.login_number}</span>
                        </DialogTitle>
                      </DialogHeader>
                      <Tabs defaultValue={emp.departments[0] || 'restaurant'} className="mt-4">
                        <TabsList className="flex-wrap h-auto">
                          {emp.departments.includes('restaurant') && (
                            <TabsTrigger value="restaurant" className="flex items-center gap-2">
                              <UtensilsCrossed className="w-4 h-4" />
                              Restaurant
                            </TabsTrigger>
                          )}
                          {emp.departments.includes('kitchen') && (
                            <TabsTrigger value="kitchen" className="flex items-center gap-2">
                              <ChefHat className="w-4 h-4" />
                              Kitchen
                            </TabsTrigger>
                          )}
                          {emp.departments.includes('rooms') && (
                            <TabsTrigger value="rooms" className="flex items-center gap-2">
                              <Bed className="w-4 h-4" />
                              Rooms
                            </TabsTrigger>
                          )}
                          {emp.departments.includes('conference') && (
                            <TabsTrigger value="conference" className="flex items-center gap-2">
                              <CalendarIcon className="w-4 h-4" />
                              Conference
                            </TabsTrigger>
                          )}
                        </TabsList>
                        {emp.departments.includes('restaurant') && (
                          <TabsContent value="restaurant">
                            <NewRestaurantTab employeeId={emp.id} employeeName={emp.name} />
                          </TabsContent>
                        )}
                        {emp.departments.includes('kitchen') && (
                          <TabsContent value="kitchen">
                            <NewKitchenTab employeeId={emp.id} employeeName={emp.name} />
                          </TabsContent>
                        )}
                        {emp.departments.includes('rooms') && (
                          <TabsContent value="rooms">
                            <RoomsTab employeeId={emp.id} employeeName={emp.name} />
                          </TabsContent>
                        )}
                        {emp.departments.includes('conference') && (
                          <TabsContent value="conference">
                            <ConferenceTab employeeId={emp.id} employeeName={emp.name} />
                          </TabsContent>
                        )}
                      </Tabs>
                    </DialogContent>
                  </Dialog>
                ))}
                {employees.length === 0 && (
                  <p className="text-muted-foreground col-span-full text-center py-4">No employees registered yet.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Delete Orders Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="w-5 h-5" />
                Delete Pending Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">Remove old or incorrect pending orders</p>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {pendingOrders.map(order => (
                  <div key={order.id} className="flex items-center justify-between p-3 bg-yellow-500/5 rounded-lg border border-yellow-500/20">
                    <div>
                      <span className="font-bold">{generateOrderId(order.order_number)}</span>
                      <Badge className={`ml-2 ${getStatusColor(order.status)}`}>{order.status}</Badge>
                      <div className="text-sm text-muted-foreground">
                        {order.order_items?.map((item, idx) => (
                          <span key={idx} className="mr-2">{item.quantity}x {item.item_name || item.menu_items?.name || 'Unknown'}</span>
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {format(new Date(order.created_at), 'MMM d, yyyy HH:mm')} | {formatKES(order.total_amount)}
                      </div>
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => deleteOrder(order.id)}>
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                ))}
                {pendingOrders.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">No pending orders to delete</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders" className="mt-6 space-y-6">
          <SalesBreakdownSection />
          <AdminOrdersSection />
        </TabsContent>

        {/* Sales Tab */}
        <TabsContent value="sales" className="mt-6 space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5" />
                  Select Date
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
              <div className="grid sm:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-muted-foreground mb-2">Total Sales</div>
                    <div className="text-2xl font-bold text-green-600">{formatKES(salesData.totalSales)}</div>
                    <div className="text-xs text-muted-foreground">{salesData.orders.length} orders</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-muted-foreground mb-2">Total Expenses</div>
                    <div className="text-2xl font-bold text-red-600">{formatKES(salesData.totalExpenses)}</div>
                    <div className="text-xs text-muted-foreground">{salesData.expenses.length} expenses</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-muted-foreground mb-2">Net Profit</div>
                    <div className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatKES(netProfit)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Items Sold - {format(selectedDate, 'MMM dd, yyyy')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {salesData.itemsSold.size > 0 ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-4 text-sm font-medium text-muted-foreground pb-2 border-b">
                        <span>Item</span>
                        <span className="text-right">Price</span>
                        <span className="text-right">Qty Sold</span>
                        <span className="text-right">Revenue</span>
                      </div>
                      {Array.from(salesData.itemsSold.entries()).map(([id, data]) => (
                        <div key={id} className="grid grid-cols-4 text-sm py-2 border-b last:border-0">
                          <span className="font-medium">{data.name}</span>
                          <span className="text-right text-muted-foreground">{formatKES(data.price)}</span>
                          <span className="text-right">{data.quantity}</span>
                          <span className="text-right font-medium">{formatKES(data.revenue)}</span>
                        </div>
                      ))}
                      <div className="grid grid-cols-4 text-sm font-bold pt-2 border-t">
                        <span>Total</span>
                        <span></span>
                        <span className="text-right">
                          {Array.from(salesData.itemsSold.values()).reduce((sum, i) => sum + i.quantity, 0)}
                        </span>
                        <span className="text-right">{formatKES(salesData.totalSales)}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">No sales for this date</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Expenses - {format(selectedDate, 'MMM dd, yyyy')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {salesData.expenses.length > 0 ? (
                    <div className="space-y-2">
                      {salesData.expenses.map(expense => (
                        <div key={expense.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div>
                            <span className="font-medium">{expense.description}</span>
                            <div className="text-xs text-muted-foreground">
                              {expense.department} • {expense.category}
                            </div>
                          </div>
                          <span className="font-medium text-red-600">-{formatKES(expense.amount)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">No expenses for this date</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Employees Tab */}
        <TabsContent value="employees" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Employees ({employees.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {employees.map(emp => (
                  <div key={emp.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {emp.name}
                        <span className="font-mono text-sm text-muted-foreground">#{emp.login_number}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">{emp.phone}</div>
                      <div className="flex gap-1 mt-1">
                        {emp.departments.map(d => (
                          <Badge key={d} variant="secondary" className="text-xs capitalize">{d}</Badge>
                        ))}
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Staff Member</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove <strong>{emp.name}</strong> (#{emp.login_number})? 
                            Their order history, bookings, and other records will be preserved but they will no longer be able to log in.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => deleteEmployee(emp.id, emp.name)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Remove Staff
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
                {employees.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">No employees registered yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Menu Tab - Simplified: Kitchen Items & Direct Items */}
        <TabsContent value="menu" className="mt-6 space-y-6">
          {/* Add Item Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Add Menu Item
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                <strong>Kitchen Items:</strong> Require chef acceptance and service. 
                <strong className="ml-2">Direct Items:</strong> Fulfilled immediately by restaurant staff.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Item Name</Label>
                  <Input
                    value={newMenuItem.name}
                    onChange={(e) => setNewMenuItem({ ...newMenuItem, name: e.target.value })}
                    placeholder="e.g., Chicken Soup, Soda, etc."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Price (KES)</Label>
                  <Input
                    type="number"
                    value={newMenuItem.price}
                    onChange={(e) => setNewMenuItem({ ...newMenuItem, price: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Item Type</Label>
                  <div className="flex items-center gap-4 h-10">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="itemType"
                        checked={newMenuItem.requires_kitchen}
                        onChange={() => setNewMenuItem({ ...newMenuItem, requires_kitchen: true })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium">Kitchen</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="itemType"
                        checked={!newMenuItem.requires_kitchen}
                        onChange={() => setNewMenuItem({ ...newMenuItem, requires_kitchen: false })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium">Direct</span>
                    </label>
                  </div>
                </div>
                <div className="flex items-end">
                  <Button onClick={addMenuItem} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Item
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Kitchen Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ChefHat className="w-5 h-5" />
                Kitchen Items
                <Badge variant="default">{menuItems.filter(i => i.requires_kitchen).length}</Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground">These items are sent to kitchen for preparation</p>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {menuItems.filter(i => i.requires_kitchen).map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex-1">
                      <div className="font-medium">{item.name}</div>
                      <Badge 
                        variant="outline" 
                        className="mt-1 text-xs cursor-pointer hover:bg-muted"
                        onClick={() => toggleItemRequiresKitchen(item.id, false)}
                      >
                        Click to make Direct →
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        className="w-24 h-8"
                        value={item.price}
                        onChange={(e) => updateMenuItemPrice(item.id, parseFloat(e.target.value) || 0)}
                      />
                      <Button variant="ghost" size="icon" onClick={() => deleteMenuItem(item.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
                {menuItems.filter(i => i.requires_kitchen).length === 0 && (
                  <p className="text-muted-foreground text-center py-4 col-span-full">No kitchen items added</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Direct Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UtensilsCrossed className="w-5 h-5" />
                Direct Items
                <Badge variant="secondary">{menuItems.filter(i => !i.requires_kitchen).length}</Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground">These items are fulfilled directly by restaurant staff (no kitchen)</p>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {menuItems.filter(i => !i.requires_kitchen).map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{item.name}</div>
                      <Badge 
                        variant="outline" 
                        className="mt-1 text-xs cursor-pointer hover:bg-primary/10"
                        onClick={() => toggleItemRequiresKitchen(item.id, true)}
                      >
                        Click to make Kitchen →
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        className="w-24 h-8"
                        value={item.price}
                        onChange={(e) => updateMenuItemPrice(item.id, parseFloat(e.target.value) || 0)}
                      />
                      <Button variant="ghost" size="icon" onClick={() => deleteMenuItem(item.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
                {menuItems.filter(i => !i.requires_kitchen).length === 0 && (
                  <p className="text-muted-foreground text-center py-4 col-span-full">No direct items added</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rooms Tab */}
        <TabsContent value="rooms" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add Room</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Room Number</Label>
                  <Input
                    value={newRoom.room_number}
                    onChange={(e) => setNewRoom({ ...newRoom, room_number: e.target.value })}
                    placeholder="101, 102, etc."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Room Type</Label>
                  <Input
                    value={newRoom.room_type}
                    onChange={(e) => setNewRoom({ ...newRoom, room_type: e.target.value })}
                    placeholder="standard, suite, etc."
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={addRoom} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rooms ({rooms.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {rooms.map(room => (
                  <div key={room.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <div className="font-bold">{room.room_number}</div>
                      <div className="text-xs text-muted-foreground">{room.room_type}</div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteRoom(room.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Conference Tab */}
        <TabsContent value="conference" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add Conference Room</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={newConfRoom.name}
                    onChange={(e) => setNewConfRoom({ ...newConfRoom, name: e.target.value })}
                    placeholder="Room A, Main Hall, etc."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Capacity</Label>
                  <Input
                    type="number"
                    value={newConfRoom.capacity}
                    onChange={(e) => setNewConfRoom({ ...newConfRoom, capacity: e.target.value })}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={addConferenceRoom} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Conference Rooms ({conferenceRooms.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {conferenceRooms.map(room => (
                  <div key={room.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <div className="font-medium">{room.name}</div>
                      <div className="text-sm text-muted-foreground">Capacity: {room.capacity}</div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteConferenceRoom(room.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventory Tab */}
        <TabsContent value="inventory" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add Inventory Item</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={newInventory.name}
                    onChange={(e) => setNewInventory({ ...newInventory, name: e.target.value })}
                    placeholder="Item name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input
                    value={newInventory.category}
                    onChange={(e) => setNewInventory({ ...newInventory, category: e.target.value })}
                    placeholder="Category"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    value={newInventory.quantity}
                    onChange={(e) => setNewInventory({ ...newInventory, quantity: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Input
                    value={newInventory.unit}
                    onChange={(e) => setNewInventory({ ...newInventory, unit: e.target.value })}
                    placeholder="pcs, kg, L, etc."
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={addInventoryItem} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inventory ({inventory.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {inventory.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium flex items-center gap-2">
                        {item.name}
                        {item.quantity <= item.min_quantity && (
                          <Badge variant="destructive" className="text-xs">Low Stock</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">{item.category}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateInventoryQuantity(item.id, Math.max(0, item.quantity - 1))}
                      >
                        -
                      </Button>
                      <span className="w-16 text-center font-medium">
                        {item.quantity} {item.unit}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateInventoryQuantity(item.id, item.quantity + 1)}
                      >
                        +
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteInventoryItem(item.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
                {inventory.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">No inventory items yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Employee Performance Report
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">Select an employee to view their detailed activity breakdown</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                {performanceData.map(emp => (
                  <Card 
                    key={emp.id} 
                    className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary ${selectedPerformanceEmployee === emp.id ? 'ring-2 ring-primary bg-primary/5' : ''}`}
                    onClick={() => setSelectedPerformanceEmployee(selectedPerformanceEmployee === emp.id ? null : emp.id)}
                  >
                    <CardContent className="p-4">
                      <div className="font-medium flex items-center gap-2">
                        {emp.name}
                        <span className="font-mono text-sm text-muted-foreground">#{emp.login_number}</span>
                      </div>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {emp.departments.map(d => (
                          <Badge key={d} variant="secondary" className="text-xs capitalize">{d}</Badge>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                        {emp.departments.includes('restaurant') && (
                          <div className="text-muted-foreground">
                            <span className="font-medium text-foreground">{emp.restaurant.paidOrders}/{emp.restaurant.totalOrders}</span> cleared
                            {emp.restaurant.totalOrders > 0 && (
                              <span className="ml-1 text-xs">
                                ({Math.round((emp.restaurant.paidOrders / emp.restaurant.totalOrders) * 100)}%)
                              </span>
                            )}
                          </div>
                        )}
                        {emp.departments.includes('kitchen') && (
                          <div className="text-muted-foreground">
                            <span className="font-medium text-foreground">{emp.kitchen.ordersServed}/{emp.kitchen.orders.length}</span> served
                            {emp.kitchen.orders.length > 0 && (
                              <span className="ml-1 text-xs">
                                ({Math.round((emp.kitchen.ordersServed / emp.kitchen.orders.length) * 100)}%)
                              </span>
                            )}
                          </div>
                        )}
                        {emp.departments.includes('rooms') && (
                          <div className="text-muted-foreground">
                            <span className="font-medium text-foreground">{emp.rooms.bookings}</span> bookings
                          </div>
                        )}
                        {emp.departments.includes('conference') && (
                          <div className="text-muted-foreground">
                            <span className="font-medium text-foreground">{emp.conference.bookings}</span> conf
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Detailed Performance View */}
              {selectedPerformanceEmployee && performanceData.find(e => e.id === selectedPerformanceEmployee) && (() => {
                const emp = performanceData.find(e => e.id === selectedPerformanceEmployee)!;
                return (
                  <div className="space-y-6 border-t pt-6">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      {emp.name} <span className="font-mono text-sm text-muted-foreground">#{emp.login_number}</span>
                    </h3>

                    {/* Restaurant Performance */}
                    {emp.departments.includes('restaurant') && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <UtensilsCrossed className="w-4 h-4" />
                            Restaurant Activity
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid sm:grid-cols-5 gap-4 mb-4">
                            <div className="p-3 bg-muted/50 rounded-lg text-center">
                              <div className="text-2xl font-bold">{emp.restaurant.totalOrders}</div>
                              <div className="text-xs text-muted-foreground">Total Orders</div>
                            </div>
                            <div className="p-3 bg-green-500/10 rounded-lg text-center">
                              <div className="text-2xl font-bold text-green-600">{emp.restaurant.paidOrders}</div>
                              <div className="text-xs text-muted-foreground">Cleared</div>
                            </div>
                            <div className="p-3 bg-yellow-500/10 rounded-lg text-center">
                              <div className="text-2xl font-bold text-yellow-600">{emp.restaurant.pendingOrders}</div>
                              <div className="text-xs text-muted-foreground">Pending</div>
                            </div>
                            <div className="p-3 bg-blue-500/10 rounded-lg text-center">
                              <div className="text-2xl font-bold text-blue-600">
                                {emp.restaurant.totalOrders > 0 
                                  ? Math.round((emp.restaurant.paidOrders / emp.restaurant.totalOrders) * 100) 
                                  : 0}%
                              </div>
                              <div className="text-xs text-muted-foreground">Fulfillment Rate</div>
                            </div>
                            <div className="p-3 bg-primary/10 rounded-lg text-center">
                              <div className="text-xl font-bold">{formatKES(emp.restaurant.totalRevenue)}</div>
                              <div className="text-xs text-muted-foreground">Revenue</div>
                            </div>
                          </div>
                          <div className="grid sm:grid-cols-3 gap-3 mb-4">
                            <div className="p-2 bg-muted/30 rounded text-center">
                              <div className="font-medium">{formatKES(emp.restaurant.paymentBreakdown.cash)}</div>
                              <div className="text-xs text-muted-foreground">Cash</div>
                            </div>
                            <div className="p-2 bg-muted/30 rounded text-center">
                              <div className="font-medium">{formatKES(emp.restaurant.paymentBreakdown.mpesa)}</div>
                              <div className="text-xs text-muted-foreground">M-Pesa</div>
                            </div>
                            <div className="p-2 bg-muted/30 rounded text-center">
                              <div className="font-medium">{formatKES(emp.restaurant.paymentBreakdown.kcb)}</div>
                              <div className="text-xs text-muted-foreground">KCB</div>
                            </div>
                          </div>
                          <div className="max-h-[200px] overflow-y-auto space-y-2">
                            {emp.restaurant.orders.slice(0, 10).map((order, idx) => (
                              <div key={idx} className="flex justify-between items-center p-2 bg-muted/20 rounded text-sm">
                                <div>
                                  <span className="font-medium">EH{order.order_number}</span>
                                  <Badge className={`ml-2 ${getStatusColor(order.status)}`}>{order.status}</Badge>
                                </div>
                                <div className="text-right">
                                  <div>{formatKES(order.amount_paid)} / {formatKES(order.total_amount)}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {format(new Date(order.created_at), 'MMM d, HH:mm')}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Kitchen Performance */}
                    {emp.departments.includes('kitchen') && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <ChefHat className="w-4 h-4" />
                            Kitchen Activity
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid sm:grid-cols-3 gap-4 mb-4">
                            <div className="p-3 bg-muted/50 rounded-lg text-center">
                              <div className="text-2xl font-bold">{emp.kitchen.orders.length}</div>
                              <div className="text-xs text-muted-foreground">Orders Accepted</div>
                            </div>
                            <div className="p-3 bg-green-500/10 rounded-lg text-center">
                              <div className="text-2xl font-bold text-green-600">{emp.kitchen.ordersServed}</div>
                              <div className="text-xs text-muted-foreground">Orders Served</div>
                            </div>
                            <div className="p-3 bg-blue-500/10 rounded-lg text-center">
                              <div className="text-2xl font-bold text-blue-600">
                                {emp.kitchen.orders.length > 0 
                                  ? Math.round((emp.kitchen.ordersServed / emp.kitchen.orders.length) * 100) 
                                  : 0}%
                              </div>
                              <div className="text-xs text-muted-foreground">Service Rate</div>
                            </div>
                          </div>
                          <div className="max-h-[200px] overflow-y-auto space-y-2">
                            {emp.kitchen.orders.slice(0, 10).map((order, idx) => (
                              <div key={idx} className="flex justify-between items-center p-2 bg-muted/20 rounded text-sm">
                                <div>
                                  <span className="font-medium">EH{order.order_number}</span>
                                  <Badge className={`ml-2 ${getStatusColor(order.status)}`}>{order.status}</Badge>
                                </div>
                                <div className="text-right">
                                  <div>{formatKES(order.total_amount)}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {format(new Date(order.created_at), 'MMM d, HH:mm')}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Rooms Performance */}
                    {emp.departments.includes('rooms') && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Bed className="w-4 h-4" />
                            Room Bookings
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid sm:grid-cols-2 gap-4 mb-4">
                            <div className="p-3 bg-muted/50 rounded-lg text-center">
                              <div className="text-2xl font-bold">{emp.rooms.bookings}</div>
                              <div className="text-xs text-muted-foreground">Total Bookings</div>
                            </div>
                            <div className="p-3 bg-green-500/10 rounded-lg text-center">
                              <div className="text-xl font-bold text-green-600">{formatKES(emp.rooms.revenue)}</div>
                              <div className="text-xs text-muted-foreground">Revenue Collected</div>
                            </div>
                          </div>
                          <div className="max-h-[200px] overflow-y-auto space-y-2">
                            {emp.rooms.bookingsList.map((booking, idx) => (
                              <div key={idx} className="flex justify-between items-center p-2 bg-muted/20 rounded text-sm">
                                <div>
                                  <span className="font-medium">{booking.guest_name}</span>
                                  <span className="ml-2 text-muted-foreground">Room {booking.room_number}</span>
                                </div>
                                <div className="text-right">
                                  <div>{formatKES(booking.amount_paid)}</div>
                                  <div className="text-xs text-muted-foreground">{booking.check_in_date}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Conference Performance */}
                    {emp.departments.includes('conference') && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4" />
                            Conference Bookings
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="p-3 bg-muted/50 rounded-lg text-center mb-4 w-fit">
                            <div className="text-2xl font-bold">{emp.conference.bookings}</div>
                            <div className="text-xs text-muted-foreground">Total Bookings</div>
                          </div>
                          <div className="max-h-[200px] overflow-y-auto space-y-2">
                            {emp.conference.bookingsList.map((booking, idx) => (
                              <div key={idx} className="flex justify-between items-center p-2 bg-muted/20 rounded text-sm">
                                <div>
                                  <span className="font-medium">{booking.guest_name}</span>
                                  <span className="ml-2 text-muted-foreground">{booking.room_name}</span>
                                </div>
                                <div className="text-right">
                                  <div>{booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}</div>
                                  <div className="text-xs text-muted-foreground">{booking.booking_date}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                );
              })()}

              {performanceData.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No employee data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Debts Tab */}
        <TabsContent value="debts" className="mt-6">
          <DebtClearingSection />
        </TabsContent>

        {/* Expenses Tab */}
        <TabsContent value="expenses" className="mt-6">
          <AdminExpensesSection adminId={employees.find(e => e.departments.includes('admin'))?.id || ''} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
