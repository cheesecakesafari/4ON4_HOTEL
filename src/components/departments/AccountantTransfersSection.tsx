import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowRightLeft, Plus, Trash2, Banknote } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface CashTransfer {
  id: string;
  from_account: string;
  to_account: string;
  amount: number;
  description: string | null;
  created_at: string;
  staff: { name: string } | null;
}

interface Props {
  staffId: string;
}

const formatKES = (amount: number) => `KES ${amount.toLocaleString('en-KE')}`;

export default function AccountantTransfersSection({ staffId }: Props) {
  const [transfers, setTransfers] = useState<CashTransfer[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  // Form state
  const [fromAccount, setFromAccount] = useState<string>('cash');
  const [toAccount, setToAccount] = useState<string>('mpesa');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    fetchTransfers();
  }, []);

  const fetchTransfers = async () => {
    const { data } = await supabase
      .from('cash_transfers')
      .select('*, staff:staff_id(name)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setTransfers(data as CashTransfer[]);
  };

  const handleAddTransfer = async () => {
    if (!amount || fromAccount === toAccount) {
      toast({ title: 'Enter amount and select different accounts', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase.from('cash_transfers').insert({
        from_account: fromAccount,
        to_account: toAccount,
        amount: parseFloat(amount),
        description: description || null,
        staff_id: staffId,
      });

      if (error) throw error;

      toast({ title: 'Transfer recorded!' });
      setAmount('');
      setDescription('');
      setIsDialogOpen(false);
      fetchTransfers();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteTransfer = async (id: string) => {
    const { error } = await supabase.from('cash_transfers').delete().eq('id', id);
    if (!error) fetchTransfers();
  };

  // Calculate totals by type
  const cashToMpesa = transfers.filter(t => t.from_account === 'cash' && t.to_account === 'mpesa').reduce((sum, t) => sum + t.amount, 0);
  const cashToKcb = transfers.filter(t => t.from_account === 'cash' && t.to_account === 'kcb').reduce((sum, t) => sum + t.amount, 0);
  const mpesaToKcb = transfers.filter(t => t.from_account === 'mpesa' && t.to_account === 'kcb').reduce((sum, t) => sum + t.amount, 0);
  const mpesaToCash = transfers.filter(t => t.from_account === 'mpesa' && t.to_account === 'cash').reduce((sum, t) => sum + t.amount, 0);

  const getAccountLabel = (acc: string) => {
    if (acc === 'cash') return 'Cash';
    if (acc === 'mpesa') return 'M-Pesa';
    if (acc === 'kcb') return 'KCB';
    return acc;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5" />
          Cash Transfers
        </h3>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Record Transfer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Cash Transfer</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From Account</Label>
                  <Select value={fromAccount} onValueChange={setFromAccount}>
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
                  <Label>To Account</Label>
                  <Select value={toAccount} onValueChange={setToAccount}>
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
                <Label>Description</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Reason for transfer..."
                />
              </div>
              <Button onClick={handleAddTransfer} className="w-full">
                Record Transfer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-lg font-bold">{formatKES(cashToMpesa)}</div>
            <div className="text-xs text-muted-foreground">Cash → M-Pesa</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-lg font-bold">{formatKES(cashToKcb)}</div>
            <div className="text-xs text-muted-foreground">Cash → KCB</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-lg font-bold">{formatKES(mpesaToKcb)}</div>
            <div className="text-xs text-muted-foreground">M-Pesa → KCB</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-lg font-bold">{formatKES(mpesaToCash)}</div>
            <div className="text-xs text-muted-foreground">M-Pesa → Cash</div>
          </CardContent>
        </Card>
      </div>

      {/* Transfer List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="w-5 h-5" />
            Recent Transfers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {transfers.map(transfer => (
              <div key={transfer.id} className="p-3 bg-muted/50 rounded-lg flex justify-between items-center">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {getAccountLabel(transfer.from_account)}
                    <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
                    {getAccountLabel(transfer.to_account)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {transfer.description || 'No description'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(transfer.created_at), 'dd MMM yyyy HH:mm')}
                    {transfer.staff?.name && ` • By: ${transfer.staff.name}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{formatKES(transfer.amount)}</span>
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteTransfer(transfer.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
            {transfers.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No transfers recorded yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
