import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Receipt, Download, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Employee {
  id: string;
  name: string;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  department: string;
  created_at: string;
  staff_id: string | null;
  staff?: { name: string } | null;
}

interface Props {
  adminId: string;
}

const EXPENSE_CATEGORIES = [
  'Finance and Accounting',
  'Kitchen',
  'Restaurant',
  'Rooms',
  'Laundry',
  'Security',
  'General',
];

const PERIODS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const PAYMENT_MODES = ['Cash', 'M-Pesa', 'KCB', 'Bank Transfer'];

export default function AdminExpensesSection({ adminId }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [period, setPeriod] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Form fields
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  
  const { toast } = useToast();

  useEffect(() => {
    fetchExpenses();
    fetchEmployees();
  }, [period, selectedDate]);

  const getDateRange = () => {
    const date = selectedDate;
    switch (period) {
      case 'daily':
        return { start: startOfDay(date), end: endOfDay(date) };
      case 'weekly':
        return { start: startOfWeek(date, { weekStartsOn: 1 }), end: endOfWeek(date, { weekStartsOn: 1 }) };
      case 'monthly':
        return { start: startOfMonth(date), end: endOfMonth(date) };
      case 'yearly':
        return { start: startOfYear(date), end: endOfYear(date) };
      default:
        return { start: startOfDay(date), end: endOfDay(date) };
    }
  };

  const fetchExpenses = async () => {
    const { start, end } = getDateRange();
    const { data } = await supabase
      .from('expenses')
      .select('*, staff:employees!expenses_staff_id_fkey(name)')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false });
    if (data) setExpenses(data as unknown as Expense[]);
  };

  const fetchEmployees = async () => {
    const { data } = await supabase.from('employees').select('id, name').order('name');
    if (data) setEmployees(data);
  };

  const handleAddExpense = async () => {
    if (!description || !amount || !category) {
      toast({ title: 'Please fill description, amount, and category', variant: 'destructive' });
      return;
    }

    try {
      // Build description with optional details
      let fullDescription = description;
      if (quantity) fullDescription += ` (Qty: ${quantity})`;
      if (paymentMode) fullDescription += ` [${paymentMode}]`;

      const { error } = await supabase.from('expenses').insert({
        department: 'admin',
        description: fullDescription,
        amount: parseFloat(amount),
        category,
        staff_id: paidBy || adminId,
      });

      if (error) throw error;

      toast({ title: 'Expense added!' });
      resetForm();
      setIsDialogOpen(false);
      fetchExpenses();
    } catch (error: any) {
      toast({ title: 'Error adding expense', description: error.message, variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setCategory('');
    setQuantity('');
    setPaidBy('');
    setPaymentMode('');
  };

  const handleDeleteExpense = async (id: string) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (!error) fetchExpenses();
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const formatKES = (amount: number) => `KES ${amount.toLocaleString('en-KE')}`;

  // Group by category
  const expensesByCategory = expenses.reduce((acc, expense) => {
    const cat = expense.category || 'General';
    if (!acc[cat]) acc[cat] = { total: 0, count: 0 };
    acc[cat].total += expense.amount;
    acc[cat].count += 1;
    return acc;
  }, {} as Record<string, { total: number; count: number }>);

  const getPeriodLabel = () => {
    const { start, end } = getDateRange();
    switch (period) {
      case 'daily':
        return format(start, 'MMMM d, yyyy');
      case 'weekly':
        return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
      case 'monthly':
        return format(start, 'MMMM yyyy');
      case 'yearly':
        return format(start, 'yyyy');
      default:
        return '';
    }
  };

  const downloadReport = () => {
    const doc = new jsPDF();
    const { start, end } = getDateRange();
    
    doc.setFontSize(18);
    doc.text('Expenses Report', 14, 20);
    doc.setFontSize(12);
    doc.text(`Period: ${getPeriodLabel()}`, 14, 30);
    doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy HH:mm')}`, 14, 38);

    // Summary by category
    doc.setFontSize(14);
    doc.text('Summary by Category', 14, 52);
    
    const categoryData = Object.entries(expensesByCategory).map(([cat, data]) => [
      cat,
      data.count.toString(),
      formatKES(data.total),
    ]);
    categoryData.push(['TOTAL', expenses.length.toString(), formatKES(totalExpenses)]);

    autoTable(doc, {
      startY: 56,
      head: [['Category', 'Count', 'Amount']],
      body: categoryData,
      theme: 'striped',
    });

    // Detailed list
    const detailY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.text('Detailed Expenses', 14, detailY);

    const detailData = expenses.map(e => [
      format(new Date(e.created_at), 'MMM d, HH:mm'),
      e.description,
      e.category,
      e.staff?.name || 'N/A',
      formatKES(e.amount),
    ]);

    autoTable(doc, {
      startY: detailY + 4,
      head: [['Date', 'Description', 'Category', 'Paid By', 'Amount']],
      body: detailData,
      theme: 'striped',
    });

    doc.save(`expenses-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast({ title: 'Report downloaded!' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Expenses Management
          </h3>
          <p className="text-sm text-muted-foreground">Track and manage all expenses</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadReport}>
            <Download className="w-4 h-4 mr-2" />
            Download Report
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Expense
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Expense</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Description *</Label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What was purchased?"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Amount *</Label>
                    <Input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Quantity (optional)</Label>
                    <Input
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="e.g., 5 kg"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border z-50">
                      {EXPENSE_CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Paid By</Label>
                  <Select value={paidBy} onValueChange={setPaidBy}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select staff member" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border z-50">
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Mode of Payment</Label>
                  <Select value={paymentMode} onValueChange={setPaymentMode}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment mode" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border z-50">
                      {PAYMENT_MODES.map(mode => (
                        <SelectItem key={mode} value={mode}>{mode}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddExpense} className="w-full">
                  Add Expense
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Period Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            View Period
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={period} onValueChange={setPeriod}>
            <TabsList className="grid grid-cols-4 w-full">
              {PERIODS.map(p => (
                <TabsTrigger key={p.value} value={p.value}>{p.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="mt-4 flex items-center gap-4">
            <Input
              type="date"
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="w-auto"
            />
            <span className="text-sm text-muted-foreground">
              Showing: <span className="font-medium">{getPeriodLabel()}</span>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-destructive">{formatKES(totalExpenses)}</div>
            <p className="text-sm text-muted-foreground">Total Expenses</p>
          </CardContent>
        </Card>
        {Object.entries(expensesByCategory).slice(0, 3).map(([cat, data]) => (
          <Card key={cat}>
            <CardContent className="pt-6">
              <div className="text-xl font-bold">{formatKES(data.total)}</div>
              <p className="text-sm text-muted-foreground">{cat} ({data.count})</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Category Breakdown */}
      {Object.keys(expensesByCategory).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Breakdown by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(expensesByCategory).map(([cat, data]) => (
                <div key={cat} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <div className="font-medium">{cat}</div>
                    <div className="text-xs text-muted-foreground">{data.count} items</div>
                  </div>
                  <div className="font-semibold text-destructive">{formatKES(data.total)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expenses List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Expense Records ({expenses.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {expenses.map(expense => (
              <div key={expense.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium">{expense.description}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span className="bg-primary/10 px-2 py-0.5 rounded">{expense.category}</span>
                    <span>•</span>
                    <span>{format(new Date(expense.created_at), 'MMM d, HH:mm')}</span>
                    {expense.staff?.name && (
                      <>
                        <span>•</span>
                        <span>Paid by: {expense.staff.name}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-destructive">{formatKES(expense.amount)}</span>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteExpense(expense.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
            {expenses.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No expenses recorded for this period.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
