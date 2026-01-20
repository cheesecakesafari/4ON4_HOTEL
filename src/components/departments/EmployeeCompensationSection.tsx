import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, Plus, Trash2, Wallet, Download, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import jsPDF from 'jspdf';

interface Employee {
  id: string;
  name: string;
  phone: string;
}

interface Compensation {
  id: string;
  employee_id: string | null;
  employee_name: string;
  amount: number;
  payment_method: string | null;
  description: string | null;
  payment_date: string;
  created_at: string;
  added_by: { name: string } | null;
}

interface Props {
  adminId: string;
}

const formatKES = (amount: number) => `KES ${amount.toLocaleString('en-KE')}`;

export default function EmployeeCompensationSection({ adminId }: Props) {
  const [compensations, setCompensations] = useState<Compensation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  // Form state
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [employeeName, setEmployeeName] = useState('');
  const [employeePhone, setEmployeePhone] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [description, setDescription] = useState('');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    fetchCompensations();
    fetchEmployees();
  }, []);

  const fetchCompensations = async () => {
    const { data } = await supabase
      .from('employee_compensations')
      .select('*, added_by:employees!employee_compensations_added_by_staff_id_fkey(name)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setCompensations(data as Compensation[]);
  };

  const fetchEmployees = async () => {
    const { data } = await supabase.from('employees').select('id, name, phone').order('name');
    if (data) setEmployees(data);
  };

  const handleAddCompensation = async () => {
    if (!employeeName || !amount) {
      toast({ title: 'Employee name and amount required', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase.from('employee_compensations').insert({
        employee_id: selectedEmployee || null,
        employee_name: employeeName,
        amount: parseFloat(amount),
        payment_method: paymentMethod,
        description: description || null,
        payment_date: paymentDate,
        added_by_staff_id: adminId,
      });

      if (error) throw error;

      toast({ title: 'Compensation recorded!' });
      resetForm();
      setIsDialogOpen(false);
      fetchCompensations();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setSelectedEmployee('');
    setEmployeeName('');
    setEmployeePhone('');
    setAmount('');
    setPaymentMethod('cash');
    setDescription('');
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const handleDeleteCompensation = async (id: string) => {
    const { error } = await supabase.from('employee_compensations').delete().eq('id', id);
    if (!error) fetchCompensations();
  };

  const handleEmployeeSelect = (empId: string) => {
    setSelectedEmployee(empId);
    const emp = employees.find(e => e.id === empId);
    if (emp) {
      setEmployeeName(emp.name);
      setEmployeePhone(emp.phone);
    }
  };

  // Monthly summary
  const thisMonthStart = startOfMonth(new Date());
  const thisMonthEnd = endOfMonth(new Date());
  const thisMonthCompensations = compensations.filter(c => {
    const date = new Date(c.payment_date);
    return date >= thisMonthStart && date <= thisMonthEnd;
  });
  const monthlyTotal = thisMonthCompensations.reduce((sum, c) => sum + c.amount, 0);
  const totalCompensations = compensations.reduce((sum, c) => sum + c.amount, 0);

  // Payment breakdown
  let cashPaid = 0, mpesaPaid = 0, kcbPaid = 0;
  compensations.forEach(c => {
    if (c.payment_method === 'cash') cashPaid += c.amount;
    else if (c.payment_method === 'mpesa') mpesaPaid += c.amount;
    else if (c.payment_method === 'kcb') kcbPaid += c.amount;
  });

  const downloadCompensationsReport = () => {
    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(16);
    doc.text('ENAITOTI HOTEL - EMPLOYEE COMPENSATIONS', 105, y, { align: 'center' });
    y += 10;
    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 105, y, { align: 'center' });
    y += 15;

    doc.setFontSize(12);
    doc.text('SUMMARY', 20, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(`Total Compensations: ${formatKES(totalCompensations)}`, 20, y);
    y += 6;
    doc.text(`This Month: ${formatKES(monthlyTotal)}`, 20, y);
    y += 6;
    doc.text(`Cash: ${formatKES(cashPaid)} | M-Pesa: ${formatKES(mpesaPaid)} | KCB: ${formatKES(kcbPaid)}`, 20, y);
    y += 15;

    doc.setFontSize(12);
    doc.text('COMPENSATION RECORDS', 20, y);
    y += 8;

    doc.setFontSize(8);
    compensations.forEach(c => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(`${c.employee_name}`, 20, y);
      doc.text(`${formatKES(c.amount)} (${c.payment_method})`, 140, y);
      y += 4;
      doc.setTextColor(100);
      doc.text(`${c.description || 'No description'} • ${format(new Date(c.payment_date), 'dd/MM/yyyy')}`, 25, y);
      doc.setTextColor(0);
      y += 7;
    });

    doc.setFontSize(7);
    doc.text('Powered by 4on4 tech', 105, 290, { align: 'center' });

    doc.save(`Compensations_Report_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Wallet className="w-5 h-5" />
          Employee Compensations
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadCompensationsReport}>
            <Download className="w-4 h-4 mr-1" />
            Report
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Add Compensation
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Employee Compensation</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Select Employee</Label>
                  <Select value={selectedEmployee} onValueChange={handleEmployeeSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name} ({emp.phone})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Employee Name *</Label>
                    <Input
                      value={employeeName}
                      onChange={(e) => setEmployeeName(e.target.value)}
                      placeholder="Enter name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input
                      value={employeePhone}
                      onChange={(e) => setEmployeePhone(e.target.value)}
                      placeholder="07xxxxxxxx"
                      readOnly={!!selectedEmployee}
                    />
                  </div>
                </div>
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
                  <Label>Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="mpesa">M-Pesa</SelectItem>
                      <SelectItem value="kcb">KCB</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Payment Date</Label>
                  <Input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Salary, bonus, allowance, etc."
                  />
                </div>
                <Button onClick={handleAddCompensation} className="w-full">
                  Save Compensation
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{formatKES(totalCompensations)}</div>
            <div className="text-xs text-muted-foreground">Total All Time</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{formatKES(monthlyTotal)}</div>
            <div className="text-xs text-muted-foreground">This Month</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{compensations.length}</div>
            <div className="text-xs text-muted-foreground">Total Records</div>
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

      {/* Employee List for Quick Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4" />
            Employees
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[200px] overflow-y-auto">
            {employees.map(emp => (
              <div 
                key={emp.id} 
                className="p-2 bg-muted/50 rounded-lg text-sm cursor-pointer hover:bg-muted transition-colors"
                onClick={() => {
                  handleEmployeeSelect(emp.id);
                  setIsDialogOpen(true);
                }}
              >
                <div className="font-medium truncate">{emp.name}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {emp.phone}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Compensation List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Recent Compensations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {compensations.map(comp => (
              <div key={comp.id} className="p-3 bg-muted/50 rounded-lg flex justify-between items-center">
                <div>
                  <div className="font-medium">{comp.employee_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {comp.description || 'No description'} • {comp.payment_method}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(comp.payment_date), 'dd MMM yyyy')}
                    {comp.added_by?.name && ` • Added by: ${comp.added_by.name}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-red-600">-{formatKES(comp.amount)}</span>
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteCompensation(comp.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
            {compensations.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No compensations recorded yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
