import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Receipt } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  created_at: string;
}

interface Props {
  department: string;
  employeeId: string;
}

const CATEGORIES: Record<string, string[]> = {
  kitchen: ['Ingredients', 'Equipment', 'Gas/Fuel', 'Maintenance', 'Other'],
  rooms: ['Cleaning Supplies', 'Maintenance', 'Amenities', 'Equipment', 'Other'],
  laundry: ['Detergent', 'Equipment', 'Maintenance', 'Supplies', 'Other'],
};

export default function ExpensesSection({ department, employeeId }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const { toast } = useToast();

  const categories = CATEGORIES[department] || CATEGORIES.kitchen;

  useEffect(() => {
    fetchExpenses();
  }, [department]);

  const fetchExpenses = async () => {
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('department', department)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setExpenses(data);
  };

  const handleAddExpense = async () => {
    if (!description || !amount) {
      toast({ title: 'Please fill description and amount', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase.from('expenses').insert({
        department,
        description,
        amount: parseFloat(amount),
        category: category || 'Other',
        staff_id: employeeId,
      });

      if (error) throw error;

      toast({ title: 'Expense added!' });
      setDescription('');
      setAmount('');
      setCategory('');
      setIsDialogOpen(false);
      fetchExpenses();
    } catch (error: any) {
      toast({ title: 'Error adding expense', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteExpense = async (id: string) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (!error) fetchExpenses();
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const formatKES = (amount: number) => `KES ${amount.toLocaleString('en-KE')}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Expenses
          </h3>
          <p className="text-sm text-muted-foreground">Total: {formatKES(totalExpenses)}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
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
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
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

      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {expenses.map(expense => (
          <Card key={expense.id}>
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{expense.description}</div>
                <div className="text-xs text-muted-foreground">
                  {expense.category} • {new Date(expense.created_at).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-destructive">-{formatKES(expense.amount)}</span>
                <Button variant="ghost" size="icon" onClick={() => handleDeleteExpense(expense.id)}>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {expenses.length === 0 && (
          <p className="text-center text-muted-foreground py-4">No expenses recorded yet.</p>
        )}
      </div>
    </div>
  );
}
