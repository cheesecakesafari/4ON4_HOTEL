import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Phone, ShieldCheck, Loader2, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import enaitotiLogo from '@/assets/enaitoti-logo.jpg';

type Step = 'phone' | 'verify' | 'success';

export default function RecoverCode() {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [employeeName, setEmployeeName] = useState('');
  const [newStaffCode, setNewStaffCode] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSendRecovery = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phone || phone.length < 10) {
      toast({
        title: 'Invalid phone number',
        description: 'Please enter a valid phone number',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-recovery-code', {
        body: { phone },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: 'Error',
          description: data.error,
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      setEmployeeName(data.employeeName);
      toast({
        title: 'Recovery request sent',
        description: 'Admin will provide you with a verification code',
      });
      setStep('verify');
    } catch (error: any) {
      console.error('Recovery error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send recovery request',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (verificationCode.length !== 6) {
      toast({
        title: 'Invalid code',
        description: 'Please enter the 6-digit verification code',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('verify-recovery', {
        body: { verificationCode },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: 'Verification failed',
          description: data.error,
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      setNewStaffCode(data.staffCode);
      setEmployeeName(data.employeeName);
      toast({
        title: 'Code recovered!',
        description: 'Your new staff code is ready',
      });
      setStep('success');
    } catch (error: any) {
      console.error('Verification error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to verify code',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img 
              src={enaitotiLogo} 
              alt="Enaitoti Hotel" 
              className="h-20 w-20 rounded-full object-cover"
            />
          </div>
          <CardTitle className="text-xl font-semibold">
            {step === 'phone' && 'Recover Staff Code'}
            {step === 'verify' && 'Verify Recovery'}
            {step === 'success' && 'Code Recovered!'}
          </CardTitle>
          <CardDescription className="text-sm">
            {step === 'phone' && 'Enter your registered phone number'}
            {step === 'verify' && `Hi ${employeeName}, enter the verification code from admin`}
            {step === 'success' && `Welcome back, ${employeeName}!`}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {step === 'phone' && (
            <form onSubmit={handleSendRecovery} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="0712345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    className="pl-10"
                    maxLength={15}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading || phone.length < 10}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Recover'
                )}
              </Button>
            </form>
          )}

          {step === 'verify' && (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code" className="text-sm">Verification Code</Label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="code"
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="pl-10 text-center tracking-widest font-mono"
                    maxLength={6}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading || verificationCode.length !== 6}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify'
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep('phone');
                  setVerificationCode('');
                }}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </form>
          )}

          {step === 'success' && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-primary" />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Your new staff code is:</p>
                <div className="text-4xl font-mono font-bold tracking-[0.3em] text-primary">
                  {newStaffCode}
                </div>
                <p className="text-xs text-muted-foreground">
                  Remember this code for future logins
                </p>
              </div>

              <Button className="w-full" onClick={() => navigate('/login')}>
                Go to Login
              </Button>
            </div>
          )}

          {step !== 'success' && (
            <div className="mt-4 text-center">
              <Button variant="link" className="p-0 h-auto text-sm" onClick={() => navigate('/login')}>
                <ArrowLeft className="w-3 h-3 mr-1" />
                Back to Login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
