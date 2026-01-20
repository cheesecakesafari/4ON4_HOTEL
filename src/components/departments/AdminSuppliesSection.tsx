import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Plus, Trash2, CreditCard, CheckCircle, Clock, Download, FileText, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import jsPDF from 'jspdf';

interface Employee {
  id: string;
  name: string;
}

interface Supply {
  id: string;
  delivery_number: number;
  description: string;
  supplier_name: string | null;
  quantity: number;
  unit: string;
  amount_to_pay: number;
  amount_paid: number;
  payment_method: string | null;
  paid_by_staff_id: string | null;
  cleared_by_staff_id: string | null;
  received_by_staff_id: string | null;
  payment_date: string | null;
  period: string;
  department: string;
  category: string;
  notes: string | null;
  created_at: string;
  paid_by: { name: string } | null;
  cleared_by: { name: string } | null;
  received_by: { name: string } | null;
}

interface Props {
  adminId: string;
  adminName: string;
}

const UNITS = ['pcs', 'kgs', 'litres', 'rolls', 'packs', 'boxes', 'bags', 'bottles'];
const CATEGORIES = ['Supplies', 'Token', 'Equipment', 'Ingredients', 'Cleaning', 'Maintenance', 'Other'];
const DEPARTMENTS = ['general', 'kitchen', 'rooms', 'restaurant', 'laundry'];

const formatKES = (amount: number) => `KES ${amount.toLocaleString('en-KE')}`;
const formatDeliveryNumber = (num: number) => `EN-S/${String(num).padStart(3, '0')}`;

export default function AdminSuppliesSection({ adminId, adminName }: Props) {
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [selectedSupply, setSelectedSupply] = useState<Supply | null>(null);
  const [periodFilter, setPeriodFilter] = useState<'all' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('all');
  const { toast } = useToast();

  // Form state
  const [description, setDescription] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('pcs');
  const [amountToPay, setAmountToPay] = useState('');
  const [amountPaid, setAmountPaid] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<string>('pending');
  const [period, setPeriod] = useState<string>('daily');
  const [department, setDepartment] = useState<string>('general');
  const [category, setCategory] = useState<string>('Supplies');
  const [notes, setNotes] = useState('');
  const [receivedBy, setReceivedBy] = useState<string>('');

  // Clear payment state
  const [clearAmount, setClearAmount] = useState('');
  const [clearMethod, setClearMethod] = useState<string>('cash');

  useEffect(() => {
    fetchSupplies();
    fetchEmployees();
  }, [periodFilter]);

  const fetchEmployees = async () => {
    const { data } = await supabase.from('employees').select('id, name').order('name');
    if (data) setEmployees(data);
  };

  const fetchSupplies = async () => {
    let query = supabase
      .from('supplies')
      .select('*, paid_by:employees!supplies_paid_by_staff_id_fkey(name), cleared_by:employees!supplies_cleared_by_staff_id_fkey(name), received_by:employees!supplies_received_by_staff_id_fkey(name)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (periodFilter !== 'all') {
      const today = new Date();
      let start: Date, end: Date;
      
      if (periodFilter === 'daily') {
        start = new Date(today.setHours(0, 0, 0, 0));
        end = new Date(today.setHours(23, 59, 59, 999));
      } else if (periodFilter === 'weekly') {
        start = startOfWeek(today, { weekStartsOn: 1 });
        end = endOfWeek(today, { weekStartsOn: 1 });
      } else if (periodFilter === 'monthly') {
        start = startOfMonth(today);
        end = endOfMonth(today);
      } else {
        start = startOfYear(today);
        end = endOfYear(today);
      }
      
      query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString());
    }

    const { data } = await query;
    if (data) setSupplies(data as Supply[]);
  };

  const handleAddSupply = async () => {
    if (!description || !amountToPay) {
      toast({ title: 'Description and amount required', variant: 'destructive' });
      return;
    }

    const paid = parseFloat(amountPaid) || 0;
    const toPay = parseFloat(amountToPay) || 0;

    try {
      const { error } = await supabase.from('supplies').insert({
        description,
        supplier_name: supplierName || null,
        quantity: parseFloat(quantity) || 1,
        unit,
        amount_to_pay: toPay,
        amount_paid: paid,
        payment_method: paymentMethod === 'pending' ? null : `${paymentMethod}:${paid}`,
        paid_by_staff_id: paid > 0 ? adminId : null,
        received_by_staff_id: receivedBy || null,
        payment_date: paid > 0 ? format(new Date(), 'yyyy-MM-dd') : null,
        period,
        department,
        category,
        notes: notes || null,
      });

      if (error) throw error;

      toast({ title: 'Supply recorded!' });
      resetForm();
      setIsDialogOpen(false);
      fetchSupplies();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setDescription('');
    setSupplierName('');
    setQuantity('1');
    setUnit('pcs');
    setAmountToPay('');
    setAmountPaid('0');
    setPaymentMethod('pending');
    setPeriod('daily');
    setDepartment('general');
    setCategory('Supplies');
    setNotes('');
    setReceivedBy('');
  };

  const handleClearPayment = async () => {
    if (!selectedSupply) return;
    const amount = parseFloat(clearAmount) || 0;
    if (amount <= 0) {
      toast({ title: 'Enter valid amount', variant: 'destructive' });
      return;
    }

    const newPaid = selectedSupply.amount_paid + amount;
    let newPaymentMethod = selectedSupply.payment_method || '';
    const paymentPart = `${clearMethod}:${amount}`;
    newPaymentMethod = newPaymentMethod ? `${newPaymentMethod},${paymentPart}` : paymentPart;

    try {
      const { error } = await supabase
        .from('supplies')
        .update({
          amount_paid: newPaid,
          payment_method: newPaymentMethod,
          cleared_by_staff_id: adminId,
          payment_date: format(new Date(), 'yyyy-MM-dd'),
        })
        .eq('id', selectedSupply.id);

      if (error) throw error;

      toast({ title: 'Payment recorded!' });
      setClearDialogOpen(false);
      setSelectedSupply(null);
      setClearAmount('');
      fetchSupplies();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteSupply = async (id: string) => {
    const { error } = await supabase.from('supplies').delete().eq('id', id);
    if (!error) fetchSupplies();
  };

  const generateDeliveryNote = (supply: Supply) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a5',
    });

    const pageWidth = 148;
    let y = 15;

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('ENAITOTI HOTEL', pageWidth / 2, y, { align: 'center' });
    y += 7;

    doc.setFontSize(12);
    doc.text('DELIVERY NOTE', pageWidth / 2, y, { align: 'center' });
    y += 6;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDeliveryNumber(supply.delivery_number), pageWidth / 2, y, { align: 'center' });
    y += 8;

    doc.line(10, y, pageWidth - 10, y);
    y += 6;

    // Details
    doc.setFontSize(9);
    doc.text(`Date: ${format(new Date(supply.created_at), 'dd/MM/yyyy')}`, 10, y);
    y += 5;
    doc.text(`Supplier: ${supply.supplier_name || 'N/A'}`, 10, y);
    y += 5;
    doc.text(`Received By: ${supply.received_by?.name || 'N/A'}`, 10, y);
    y += 8;

    // Item details
    doc.setFont('helvetica', 'bold');
    doc.text('ITEM DETAILS', 10, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    
    doc.text(`Description: ${supply.description}`, 10, y);
    y += 5;
    doc.text(`Quantity: ${supply.quantity} ${supply.unit}`, 10, y);
    y += 5;
    doc.text(`Department: ${supply.department}`, 10, y);
    y += 5;
    doc.text(`Category: ${supply.category}`, 10, y);
    y += 5;
    doc.text(`Period: ${supply.period}`, 10, y);
    y += 8;

    // Financial
    doc.line(10, y, pageWidth - 10, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.text('PAYMENT DETAILS', 10, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    
    doc.text(`Amount Due: ${formatKES(supply.amount_to_pay)}`, 10, y);
    y += 5;
    doc.text(`Amount Paid: ${formatKES(supply.amount_paid)}`, 10, y);
    y += 5;
    
    const balance = supply.amount_to_pay - supply.amount_paid;
    if (balance > 0) {
      doc.setTextColor(200, 0, 0);
      doc.text(`Balance: ${formatKES(balance)}`, 10, y);
      doc.setTextColor(0, 0, 0);
    } else {
      doc.setTextColor(0, 150, 0);
      doc.text('Status: FULLY PAID', 10, y);
      doc.setTextColor(0, 0, 0);
    }
    y += 8;

    if (supply.notes) {
      doc.text(`Notes: ${supply.notes}`, 10, y);
      y += 8;
    }

    // Signatures
    y += 10;
    doc.line(10, y, 60, y);
    doc.line(88, y, 138, y);
    y += 4;
    doc.setFontSize(8);
    doc.text('Received By', 35, y, { align: 'center' });
    doc.text('Authorized By', 113, y, { align: 'center' });

    // Footer
    y = 200;
    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.text('Powered by 4on4 tech', pageWidth / 2, y, { align: 'center' });

    doc.save(`DeliveryNote_${formatDeliveryNumber(supply.delivery_number)}_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  const pendingSupplies = supplies.filter(s => s.amount_paid < s.amount_to_pay);
  const paidSupplies = supplies.filter(s => s.amount_paid >= s.amount_to_pay);
  const totalToPay = supplies.reduce((sum, s) => sum + s.amount_to_pay, 0);
  const totalPaid = supplies.reduce((sum, s) => sum + s.amount_paid, 0);
  const totalPending = totalToPay - totalPaid;

  // Calculate payment breakdown
  let cashPaid = 0, mpesaPaid = 0, kcbPaid = 0;
  supplies.forEach(s => {
    if (s.payment_method) {
      const parts = s.payment_method.split(',');
      parts.forEach(part => {
        if (part.includes(':')) {
          const [method, amt] = part.split(':');
          const amount = parseFloat(amt) || 0;
          if (method === 'cash') cashPaid += amount;
          else if (method === 'mpesa') mpesaPaid += amount;
          else if (method === 'kcb') kcbPaid += amount;
        }
      });
    }
  });

  const downloadSuppliesReport = () => {
    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(16);
    doc.text('ENAITOTI HOTEL - SUPPLIES REPORT', 105, y, { align: 'center' });
    y += 10;
    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 105, y, { align: 'center' });
    y += 10;
    doc.text(`Period: ${periodFilter === 'all' ? 'All Time' : periodFilter}`, 105, y, { align: 'center' });
    y += 15;

    // Summary
    doc.setFontSize(12);
    doc.text('SUMMARY', 20, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(`Total Supplies: ${formatKES(totalToPay)}`, 20, y);
    y += 6;
    doc.text(`Total Paid: ${formatKES(totalPaid)}`, 20, y);
    y += 6;
    doc.text(`Outstanding: ${formatKES(totalPending)}`, 20, y);
    y += 10;

    doc.text(`Cash: ${formatKES(cashPaid)} | M-Pesa: ${formatKES(mpesaPaid)} | KCB: ${formatKES(kcbPaid)}`, 20, y);
    y += 15;

    // List supplies
    doc.setFontSize(12);
    doc.text('SUPPLIES LIST', 20, y);
    y += 8;

    doc.setFontSize(8);
    supplies.forEach(s => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(`${formatDeliveryNumber(s.delivery_number)} - ${s.description} (${s.quantity} ${s.unit})`, 20, y);
      doc.text(`${formatKES(s.amount_to_pay)} | Paid: ${formatKES(s.amount_paid)}`, 140, y);
      y += 5;
      doc.setTextColor(100);
      doc.text(`${s.supplier_name || 'No supplier'} • ${s.department} • ${format(new Date(s.created_at), 'dd/MM/yyyy')}`, 25, y);
      doc.setTextColor(0);
      y += 7;
    });

    doc.setFontSize(7);
    doc.text('Powered by 4on4 tech', 105, 290, { align: 'center' });

    doc.save(`Supplies_Report_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Package className="w-5 h-5" />
          Supplies & Expenses
        </h3>
        <div className="flex gap-2 flex-wrap">
          <Select value={periodFilter} onValueChange={(v: any) => setPeriodFilter(v)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="daily">Today</SelectItem>
              <SelectItem value="weekly">This Week</SelectItem>
              <SelectItem value="monthly">This Month</SelectItem>
              <SelectItem value="yearly">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={downloadSuppliesReport}>
            <Download className="w-4 h-4 mr-1" />
            Report
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Add Supply
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Record Supply/Expense</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label>Description/Item *</Label>
                    <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was supplied?" />
                  </div>
                  <div className="space-y-2">
                    <Label>Supplier Name</Label>
                    <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Who supplied?" />
                  </div>
                  <div className="space-y-2">
                    <Label>Received By</Label>
                    <Select value={receivedBy} onValueChange={setReceivedBy}>
                      <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                      <SelectContent>
                        {employees.map(emp => (
                          <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Select value={unit} onValueChange={setUnit}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select value={department} onValueChange={setDepartment}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map(d => <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Amount to Pay *</Label>
                    <Input type="number" value={amountToPay} onChange={(e) => setAmountToPay(e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Amount Paid Now</Label>
                    <Input type="number" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Method</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending (Creditor)</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="mpesa">M-Pesa</SelectItem>
                        <SelectItem value="kcb">KCB</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Period</Label>
                    <Select value={period} onValueChange={setPeriod}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Notes</Label>
                    <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." />
                  </div>
                </div>
                <Button onClick={handleAddSupply} className="w-full">Record Supply</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{formatKES(totalToPay)}</div>
            <div className="text-xs text-muted-foreground">Total Supplies</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-green-600">{formatKES(totalPaid)}</div>
            <div className="text-xs text-muted-foreground">Total Paid (Expenses)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{formatKES(totalPending)}</div>
            <div className="text-xs text-muted-foreground">Outstanding (Creditors)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-xs space-y-1">
              <div>Cash: <span className="font-medium">{formatKES(cashPaid)}</span></div>
              <div>M-Pesa: <span className="font-medium">{formatKES(mpesaPaid)}</span></div>
              <div>KCB: <span className="font-medium">{formatKES(kcbPaid)}</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Creditors ({pendingSupplies.length})
          </TabsTrigger>
          <TabsTrigger value="paid" className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Paid ({paidSupplies.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {pendingSupplies.map(supply => {
              const balance = supply.amount_to_pay - supply.amount_paid;
              return (
                <Card key={supply.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{formatDeliveryNumber(supply.delivery_number)}</Badge>
                          {supply.description}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {supply.quantity} {supply.unit} • Supplier: {supply.supplier_name || 'N/A'} • {supply.department}
                        </div>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-xs">{supply.category}</Badge>
                          <Badge variant="outline" className="text-xs">{supply.period}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {format(new Date(supply.created_at), 'dd MMM yyyy')}
                          {supply.received_by?.name && ` • Received: ${supply.received_by.name}`}
                          {supply.paid_by?.name && ` • Paid by: ${supply.paid_by.name}`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm">Total: {formatKES(supply.amount_to_pay)}</div>
                        <div className="text-sm text-green-600">Paid: {formatKES(supply.amount_paid)}</div>
                        <div className="font-bold text-orange-600">Balance: {formatKES(balance)}</div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedSupply(supply);
                          setClearAmount(balance.toString());
                          setClearDialogOpen(true);
                        }}
                      >
                        <CreditCard className="w-3 h-3 mr-1" />
                        Clear Payment
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => generateDeliveryNote(supply)}>
                        <FileText className="w-3 h-3 mr-1" />
                        Delivery Note
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDeleteSupply(supply.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {pendingSupplies.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No pending supplies (creditors)</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="paid" className="mt-4">
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {paidSupplies.map(supply => (
              <Card key={supply.id}>
                <CardContent className="p-3 flex justify-between items-center">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{formatDeliveryNumber(supply.delivery_number)}</Badge>
                      {supply.description}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {supply.quantity} {supply.unit} • {supply.supplier_name || 'No supplier'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(supply.created_at), 'dd MMM yyyy')}
                      {supply.cleared_by?.name && ` • Cleared by: ${supply.cleared_by.name}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-green-600">{formatKES(supply.amount_paid)}</span>
                    <Button size="sm" variant="outline" onClick={() => generateDeliveryNote(supply)}>
                      <FileText className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDeleteSupply(supply.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {paidSupplies.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No paid supplies</p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Clear Payment Dialog */}
      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Supply Payment</DialogTitle>
          </DialogHeader>
          {selectedSupply && (
            <div className="space-y-4 mt-4">
              <div className="p-3 bg-muted rounded-lg">
                <div className="font-medium">{selectedSupply.description}</div>
                <div className="text-sm text-muted-foreground">
                  Supplier: {selectedSupply.supplier_name || 'N/A'} • Balance: {formatKES(selectedSupply.amount_to_pay - selectedSupply.amount_paid)}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Amount to Clear</Label>
                <Input type="number" value={clearAmount} onChange={(e) => setClearAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={clearMethod} onValueChange={setClearMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mpesa">M-Pesa</SelectItem>
                    <SelectItem value="kcb">KCB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleClearPayment} className="w-full">Clear Payment</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
