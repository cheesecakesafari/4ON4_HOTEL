import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CreditCard, DollarSign, Loader2, CheckCircle, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { downloadReceiptPdf } from '@/utils/receiptPdf';
import mpesaLogo from '@/assets/mpesa-logo.png';
import kcbLogo from '@/assets/kcb-logo.png';
import cashLogo from '@/assets/cash-logo.png';

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  item_name: string | null;
  item_type: string | null;
  menu_items: { name: string } | null;
}

interface DebtOrder {
  id: string;
  order_number: number;
  debtor_name: string | null;
  total_amount: number;
  amount_paid: number;
  created_at: string;
  waiter_id: string | null;
  payment_method: string | null;
  order_items?: OrderItem[];
}

interface PaymentSplit {
  method: 'cash' | 'mpesa' | 'kcb';
  amount: number;
}

const formatKES = (amount: number) => `KES ${amount.toLocaleString('en-KE')}`;
const generateOrderId = (orderNumber: number) => `EH${orderNumber}`;

interface PaymentMethodButtonProps {
  method: 'cash' | 'mpesa' | 'kcb';
  logo: string;
  label: string;
  isActive: boolean;
  amount: number;
  onToggle: () => void;
  onAmountChange: (value: number) => void;
  maxAmount: number;
}

const PaymentMethodButton = ({
  method,
  logo,
  label,
  isActive,
  amount,
  onToggle,
  onAmountChange,
  maxAmount,
}: PaymentMethodButtonProps) => (
  <div className="space-y-2">
    <Button
      type="button"
      variant={isActive ? 'default' : 'outline'}
      className={`flex-1 h-16 flex flex-col items-center gap-1 w-full ${isActive ? 'ring-2 ring-primary' : ''}`}
      onClick={onToggle}
    >
      <img src={logo} alt={label} className="w-6 h-6 object-contain" />
      <span className="text-xs">{label}</span>
    </Button>
    {isActive && (
      <Input
        type="number"
        min="0"
        max={maxAmount}
        value={amount || ''}
        onChange={(e) => onAmountChange(Math.min(parseFloat(e.target.value) || 0, maxAmount))}
        placeholder="Amount"
        className="text-center"
      />
    )}
  </div>
);

export default function DebtClearingSection() {
  const [debtOrders, setDebtOrders] = useState<DebtOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDebt, setSelectedDebt] = useState<DebtOrder | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [payments, setPayments] = useState<PaymentSplit[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchDebtOrders();
  }, []);

  const fetchDebtOrders = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, debtor_name, total_amount, amount_paid, created_at, waiter_id, payment_method, order_items (id, quantity, price, item_name, item_type, menu_items (name))')
      .eq('is_debt', true)
      .order('created_at', { ascending: false });
    if (data) setDebtOrders(data as DebtOrder[]);
    setLoading(false);
  };

  const openPaymentDialog = (debt: DebtOrder) => {
    setSelectedDebt(debt);
    setPayments([]);
    setPaymentDialogOpen(true);
  };

  const togglePaymentMethod = (method: 'cash' | 'mpesa' | 'kcb') => {
    const existing = payments.find(p => p.method === method);
    if (existing) {
      setPayments(payments.filter(p => p.method !== method));
    } else {
      setPayments([...payments, { method, amount: 0 }]);
    }
  };

  const updatePaymentAmount = (method: 'cash' | 'mpesa' | 'kcb', amount: number) => {
    setPayments(payments.map(p => p.method === method ? { ...p, amount } : p));
  };

  const getTotalPaymentAmount = () => {
    return payments.reduce((sum, p) => sum + p.amount, 0);
  };

  const getDebtBalance = (debt: DebtOrder) => {
    return debt.total_amount - debt.amount_paid;
  };

  const handleClearDebt = async () => {
    if (!selectedDebt) return;

    const paymentAmount = getTotalPaymentAmount();
    const debtBalance = getDebtBalance(selectedDebt);

    if (paymentAmount <= 0) {
      toast({ title: 'Enter payment amount', variant: 'destructive' });
      return;
    }

    if (paymentAmount > debtBalance) {
      toast({ title: 'Payment exceeds debt balance', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);

    try {
      const newAmountPaid = selectedDebt.amount_paid + paymentAmount;
      const isFullyPaid = newAmountPaid >= selectedDebt.total_amount;

      // Build payment method string for this clearance
      const newPaymentParts = payments
        .filter(p => p.amount > 0)
        .map(p => `${p.method}:${p.amount}`);

      // Combine with existing payment methods (if any)
      let combinedPaymentMethod = selectedDebt.payment_method || '';
      if (combinedPaymentMethod && newPaymentParts.length > 0) {
        combinedPaymentMethod += ',' + newPaymentParts.join(',');
      } else if (newPaymentParts.length > 0) {
        combinedPaymentMethod = newPaymentParts.join(',');
      }

      // Update the order:
      // - status stays 'served' if partially paid (so it remains visible in staff history)
      // - status becomes 'paid' when fully cleared → moves to completed sales
      // - is_debt stays true while any balance remains
      const { error } = await supabase
        .from('orders')
        .update({
          amount_paid: newAmountPaid,
          is_debt: !isFullyPaid,
          status: isFullyPaid ? 'paid' : 'served',
          payment_method: combinedPaymentMethod,
        })
        .eq('id', selectedDebt.id);

      if (error) throw error;

      const remainingBalance = debtBalance - paymentAmount;

      toast({
        title: isFullyPaid ? 'Debt fully cleared!' : 'Partial payment recorded',
        description: isFullyPaid 
          ? `${selectedDebt.debtor_name || 'Debtor'} paid ${formatKES(paymentAmount)}. Order moved to completed sales.`
          : `${formatKES(paymentAmount)} collected. Remaining debt: ${formatKES(remainingBalance)}`,
      });

      setPaymentDialogOpen(false);
      setSelectedDebt(null);
      setPayments([]);
      fetchDebtOrders();
    } catch (error: any) {
      toast({ title: 'Error processing payment', description: error.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Clear Outstanding Debts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {debtOrders.map(debt => {
              const balance = getDebtBalance(debt);
              return (
                <div key={debt.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
                  <div className="flex-1">
                    <div className="font-medium text-lg">{debt.debtor_name || 'Unknown Debtor'}</div>
                    <div className="text-sm text-muted-foreground">
                      Order {generateOrderId(debt.order_number)} • {format(new Date(debt.created_at), 'MMM d, yyyy HH:mm')}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Total: {formatKES(debt.total_amount)} | Paid: {formatKES(debt.amount_paid)}
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <Badge variant="destructive" className="text-lg px-3 py-1">
                      {formatKES(balance)}
                    </Badge>
                    <div className="flex gap-2">
                      {debt.order_items && debt.order_items.length > 0 && (
                        <Button size="sm" variant="outline" onClick={() => downloadReceiptPdf([debt])}>
                          <Download className="w-4 h-4 mr-1" />
                          Receipt
                        </Button>
                      )}
                      <Button size="sm" onClick={() => openPaymentDialog(debt)}>
                        <DollarSign className="w-4 h-4 mr-1" />
                        Collect Payment
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            {debtOrders.length === 0 && (
              <div className="text-center py-12">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <p className="text-lg font-medium">No Outstanding Debts!</p>
                <p className="text-muted-foreground">All debts have been cleared.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Debt - {selectedDebt?.debtor_name || 'Unknown'}</DialogTitle>
          </DialogHeader>

          {selectedDebt && (
            <div className="space-y-6">
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-muted-foreground">Order:</span>
                  <span className="font-medium">{generateOrderId(selectedDebt.order_number)}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-muted-foreground">Total Amount:</span>
                  <span>{formatKES(selectedDebt.total_amount)}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-muted-foreground">Already Paid:</span>
                  <span className="text-green-600">{formatKES(selectedDebt.amount_paid)}</span>
                </div>
                <div className="flex justify-between items-center text-lg font-bold border-t pt-2">
                  <span>Outstanding Balance:</span>
                  <span className="text-orange-600">{formatKES(getDebtBalance(selectedDebt))}</span>
                </div>
              </div>

              <div>
                <Label className="mb-3 block">Select Payment Method(s)</Label>
                <div className="grid grid-cols-3 gap-3">
                  <PaymentMethodButton
                    method="cash"
                    logo={cashLogo}
                    label="Cash"
                    isActive={payments.some(p => p.method === 'cash')}
                    amount={payments.find(p => p.method === 'cash')?.amount || 0}
                    onToggle={() => togglePaymentMethod('cash')}
                    onAmountChange={(v) => updatePaymentAmount('cash', v)}
                    maxAmount={getDebtBalance(selectedDebt)}
                  />
                  <PaymentMethodButton
                    method="mpesa"
                    logo={mpesaLogo}
                    label="M-Pesa"
                    isActive={payments.some(p => p.method === 'mpesa')}
                    amount={payments.find(p => p.method === 'mpesa')?.amount || 0}
                    onToggle={() => togglePaymentMethod('mpesa')}
                    onAmountChange={(v) => updatePaymentAmount('mpesa', v)}
                    maxAmount={getDebtBalance(selectedDebt)}
                  />
                  <PaymentMethodButton
                    method="kcb"
                    logo={kcbLogo}
                    label="KCB"
                    isActive={payments.some(p => p.method === 'kcb')}
                    amount={payments.find(p => p.method === 'kcb')?.amount || 0}
                    onToggle={() => togglePaymentMethod('kcb')}
                    onAmountChange={(v) => updatePaymentAmount('kcb', v)}
                    maxAmount={getDebtBalance(selectedDebt)}
                  />
                </div>
              </div>

              {payments.length > 0 && (
                <div className="p-4 bg-primary/10 rounded-lg">
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>Payment Amount:</span>
                    <span className="text-primary">{formatKES(getTotalPaymentAmount())}</span>
                  </div>
                  {getTotalPaymentAmount() < getDebtBalance(selectedDebt) && (
                    <div className="text-sm text-muted-foreground mt-1">
                      Remaining after payment: {formatKES(getDebtBalance(selectedDebt) - getTotalPaymentAmount())}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleClearDebt}
              disabled={isProcessing || getTotalPaymentAmount() <= 0}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Record Payment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
