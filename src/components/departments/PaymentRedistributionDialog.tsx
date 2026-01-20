import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Check, X, Plus, UserMinus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import mpesaLogo from '@/assets/mpesa-logo.png';
import kcbLogo from '@/assets/kcb-logo.png';
import cashLogo from '@/assets/cash-logo.png';

interface PaymentSplit {
  method: 'cash' | 'mpesa' | 'kcb';
  amount: number;
}

interface DebtorEntry {
  name: string;
  amount: number;
}

interface Order {
  id: string;
  order_number: number;
  status: string;
  total_amount: number;
  amount_paid: number;
  payment_method: string | null;
  is_debt: boolean;
  debtor_name: string | null;
  created_at: string;
}

interface PaymentRedistributionDialogProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const formatKES = (amount: number) => `KES ${amount.toLocaleString('en-KE')}`;

export default function PaymentRedistributionDialog({
  order,
  isOpen,
  onClose,
  onSuccess,
}: PaymentRedistributionDialogProps) {
  const [payments, setPayments] = useState<PaymentSplit[]>([]);
  const [debtors, setDebtors] = useState<DebtorEntry[]>([]);
  const [showDebtSection, setShowDebtSection] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (order && isOpen) {
      // Parse existing payment method and initialize
      const initialPayments: PaymentSplit[] = [];
      const initialDebtors: DebtorEntry[] = [];
      
      if (order.payment_method) {
        if (order.payment_method.includes(':')) {
          // New format: cash:500,mpesa:300
          const parts = order.payment_method.split(',');
          parts.forEach(part => {
            const [method, amtStr] = part.split(':');
            const amt = parseFloat(amtStr) || 0;
            if (method === 'cash' || method === 'mpesa' || method === 'kcb') {
              initialPayments.push({ method, amount: amt });
            }
          });
        } else {
          // Old format: cash, mobile, card
          const method = order.payment_method.toLowerCase();
          if (method === 'cash') {
            initialPayments.push({ method: 'cash', amount: order.amount_paid });
          } else if (method === 'mobile' || method === 'mpesa') {
            initialPayments.push({ method: 'mpesa', amount: order.amount_paid });
          } else if (method === 'card' || method === 'kcb') {
            initialPayments.push({ method: 'kcb', amount: order.amount_paid });
          }
        }
      }
      
      // Add debt if applicable - parse multiple debtors from debtor_name
      if (order.is_debt && order.debtor_name) {
        const debtAmount = order.total_amount - order.amount_paid;
        // Check if debtor_name contains multiple debtors (format: "Name1:amount1,Name2:amount2")
        if (order.debtor_name.includes(':')) {
          const debtorParts = order.debtor_name.split(',');
          debtorParts.forEach(part => {
            const [name, amtStr] = part.split(':');
            if (name && amtStr) {
              initialDebtors.push({ name: name.trim(), amount: parseFloat(amtStr) || 0 });
            }
          });
        } else {
          // Single debtor format
          if (debtAmount > 0) {
            initialDebtors.push({ name: order.debtor_name, amount: debtAmount });
          }
        }
      }
      
      // If no payments found, initialize with the amount paid
      if (initialPayments.length === 0 && order.amount_paid > 0) {
        initialPayments.push({ method: 'cash', amount: order.amount_paid });
      }
      
      setPayments(initialPayments);
      setDebtors(initialDebtors);
      setShowDebtSection(initialDebtors.length > 0);
    }
  }, [order, isOpen]);

  const togglePaymentMethod = (method: 'cash' | 'mpesa' | 'kcb') => {
    const existingIndex = payments.findIndex(p => p.method === method);
    if (existingIndex >= 0) {
      setPayments(prev => prev.filter((_, i) => i !== existingIndex));
    } else {
      setPayments(prev => [...prev, { method, amount: 0 }]);
    }
  };

  const updatePaymentAmount = (index: number, amount: number) => {
    const newPayments = [...payments];
    newPayments[index].amount = amount;
    setPayments(newPayments);
  };

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  // Debtor management
  const addDebtor = () => {
    setDebtors(prev => [...prev, { name: '', amount: 0 }]);
    setShowDebtSection(true);
  };

  const updateDebtor = (index: number, field: 'name' | 'amount', value: string | number) => {
    const newDebtors = [...debtors];
    if (field === 'name') {
      newDebtors[index].name = value as string;
    } else {
      newDebtors[index].amount = value as number;
    }
    setDebtors(newDebtors);
  };

  const removeDebtor = (index: number) => {
    const newDebtors = debtors.filter((_, i) => i !== index);
    setDebtors(newDebtors);
    if (newDebtors.length === 0) {
      setShowDebtSection(false);
    }
  };

  const getTotalPaid = () => payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const getTotalDebt = () => debtors.reduce((sum, d) => sum + (d.amount || 0), 0);

  const handleSubmit = async () => {
    if (!order) return;

    const cashPaid = getTotalPaid();
    const debtAmount = getTotalDebt();
    const totalAllocation = cashPaid + debtAmount;

    if (totalAllocation !== order.total_amount) {
      toast({ 
        title: 'Allocation mismatch', 
        description: `Total allocation (${formatKES(totalAllocation)}) must equal order total (${formatKES(order.total_amount)})`,
        variant: 'destructive' 
      });
      return;
    }

    // Validate debtors have names
    const invalidDebtors = debtors.filter(d => d.amount > 0 && !d.name.trim());
    if (invalidDebtors.length > 0) {
      toast({ title: 'All debtors must have names', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);

    try {
      // Build the new payment method string (new format)
      const paymentParts = payments
        .filter(p => p.amount > 0)
        .map(p => `${p.method}:${p.amount}`);
      
      const paymentMethodStr = paymentParts.length > 0 ? paymentParts.join(',') : null;

      // Build debtor string for multiple debtors: "Name1:amount1,Name2:amount2"
      const validDebtors = debtors.filter(d => d.amount > 0 && d.name.trim());
      let debtorNameStr: string | null = null;
      
      if (validDebtors.length === 1) {
        // Single debtor - use simple format for backwards compatibility
        debtorNameStr = validDebtors[0].name.trim();
      } else if (validDebtors.length > 1) {
        // Multiple debtors - use new format
        debtorNameStr = validDebtors.map(d => `${d.name.trim()}:${d.amount}`).join(',');
      }

      const { error } = await supabase
        .from('orders')
        .update({
          amount_paid: cashPaid,
          payment_method: paymentMethodStr,
          is_debt: debtAmount > 0,
          debtor_name: debtorNameStr,
          status: cashPaid >= order.total_amount ? 'paid' : order.status,
        })
        .eq('id', order.id);

      if (error) throw error;

      toast({ title: 'Payment redistributed successfully!' });
      onSuccess();
      onClose();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const PaymentMethodButton = ({ method, logo, label }: { method: 'cash' | 'mpesa' | 'kcb'; logo: string; label: string }) => {
    const isActive = payments.some(p => p.method === method);
    return (
      <button
        onClick={() => togglePaymentMethod(method)}
        className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
          isActive 
            ? 'border-primary bg-primary/10 ring-2 ring-primary/30' 
            : 'border-border hover:border-primary/50 bg-card hover:bg-muted/50'
        }`}
      >
        <img src={logo} alt={label} className="w-10 h-10 object-contain" />
        <span className="text-xs font-medium">{label}</span>
        {isActive && <Check className="w-4 h-4 text-primary" />}
      </button>
    );
  };

  if (!order) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Redistribute Payment - EH{order.order_number}</DialogTitle>
          <DialogDescription>
            Adjust how the payment was received. Total must equal {formatKES(order.total_amount)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order Summary */}
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Order Total:</span>
              <span className="font-bold">{formatKES(order.total_amount)}</span>
            </div>
          </div>

          {/* Payment Method Selection */}
          <div>
            <p className="text-sm font-medium mb-2">Payment Methods</p>
            <div className="grid grid-cols-3 gap-2">
              <PaymentMethodButton method="cash" logo={cashLogo} label="Cash" />
              <PaymentMethodButton method="mpesa" logo={mpesaLogo} label="M-Pesa" />
              <PaymentMethodButton method="kcb" logo={kcbLogo} label="KCB" />
            </div>
          </div>

          {/* Payment Amounts */}
          {payments.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Payment Amounts</p>
              {payments.map((payment, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize min-w-16 justify-center">
                    {payment.method}
                  </Badge>
                  <Input
                    type="number"
                    placeholder="Amount"
                    className="flex-1"
                    value={payment.amount || ''}
                    onChange={(e) => updatePaymentAmount(idx, parseFloat(e.target.value) || 0)}
                  />
                  <Button size="icon" variant="ghost" onClick={() => removePayment(idx)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Debtors Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Debtors</p>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={addDebtor}
                className="h-8 text-orange-600 border-orange-300 hover:bg-orange-50"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Debtor
              </Button>
            </div>
            
            {debtors.length > 0 && (
              <div className="space-y-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
                {debtors.map((debtor, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      placeholder="Debtor name"
                      className="flex-1 bg-background"
                      value={debtor.name}
                      onChange={(e) => updateDebtor(idx, 'name', e.target.value)}
                    />
                    <Input
                      type="number"
                      placeholder="Amount"
                      className="w-24 bg-background"
                      value={debtor.amount || ''}
                      onChange={(e) => updateDebtor(idx, 'amount', parseFloat(e.target.value) || 0)}
                    />
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={() => removeDebtor(idx)}
                      className="text-orange-600 hover:text-orange-700 hover:bg-orange-100"
                    >
                      <UserMinus className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="p-3 bg-muted/50 rounded-lg space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Paid Amount:</span>
              <span className="font-medium">{formatKES(getTotalPaid())}</span>
            </div>
            {getTotalDebt() > 0 && (
              <>
                <div className="flex justify-between text-orange-600">
                  <span>Total Debt ({debtors.filter(d => d.amount > 0).length} debtor{debtors.filter(d => d.amount > 0).length !== 1 ? 's' : ''}):</span>
                  <span className="font-medium">{formatKES(getTotalDebt())}</span>
                </div>
                {debtors.filter(d => d.amount > 0 && d.name.trim()).map((d, idx) => (
                  <div key={idx} className="flex justify-between text-orange-500 text-xs pl-2">
                    <span>• {d.name}:</span>
                    <span>{formatKES(d.amount)}</span>
                  </div>
                ))}
              </>
            )}
            <div className="flex justify-between font-bold pt-1 border-t">
              <span>Total Allocated:</span>
              <span className={getTotalPaid() + getTotalDebt() === order.total_amount ? 'text-green-600' : 'text-red-600'}>
                {formatKES(getTotalPaid() + getTotalDebt())}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              className="flex-1"
              disabled={isSubmitting || getTotalPaid() + getTotalDebt() !== order.total_amount}
            >
              <Check className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
