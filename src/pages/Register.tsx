import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { UserPlus, ArrowLeft, CheckCircle, Loader2, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DepartmentRole } from '@/contexts/EmployeeContext';
import enaitotiLogo from '@/assets/enaitoti-logo.jpg';
import { useHotel } from '@/contexts/HotelContext';

const DEPARTMENTS: { value: DepartmentRole; label: string; icon: string }[] = [
  { value: 'restaurant', label: 'Restaurant', icon: '🍽️' },
  { value: 'kitchen', label: 'Kitchen', icon: '👨‍🍳' },
  { value: 'rooms', label: 'Rooms', icon: '🛏️' },
  { value: 'conference', label: 'Conference', icon: '📅' },
  { value: 'bar', label: 'Bar Staff', icon: '🍺' },
  { value: 'bar_admin', label: 'Bar Admin', icon: '🍻' },
  { value: 'accountant', label: 'Accountant', icon: '📊' },
  { value: 'admin', label: 'General Admin', icon: '⚙️' },
];

type RegistrationStep = 'details' | 'verification' | 'success';

export default function Register() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentRole | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [assignedStaffCode, setAssignedStaffCode] = useState('');
  const [adminSecretCode, setAdminSecretCode] = useState<string | null>(null);
  const [step, setStep] = useState<RegistrationStep>('details');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hotel } = useHotel();

  const toggleDepartment = (dept: DepartmentRole) => setSelectedDepartment(dept);

  const handleSubmitDetails = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    if (!phone.trim()) {
      toast({ title: 'Phone number required', variant: 'destructive' });
      return;
    }
    if (!hotel?.id) {
      toast({ title: 'Select a hotel first', description: 'Enter your hotel code to continue', variant: 'destructive' });
      navigate('/hotel-login');
      return;
    }
    if (!selectedDepartment) {
      toast({ title: 'Select a department', variant: 'destructive' });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-registration-code', {
        body: {
          name: name.trim(),
          phone: phone.trim(),
          department: selectedDepartment,
          hotelId: hotel.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Verification code sent!',
        description: 'Ask the admin for your verification code.',
      });
      setStep('verification');
    } catch (error: any) {
      toast({
        title: 'Failed to send verification code',
        description: error.message || 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (verificationCode.length !== 6) {
      toast({ title: 'Enter the 6-digit code', variant: 'destructive' });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('verify-registration', {
        body: { verificationCode },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setAssignedStaffCode(data.staffCode);
      setAdminSecretCode(data.adminSecretCode || null);
      setStep('success');
      toast({
        title: 'Registration complete!',
        description: `Your staff code is ${data.staffCode}`,
      });
    } catch (error: any) {
      toast({
        title: 'Verification failed',
        description: error.message || 'Invalid or expired code',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderDetailsStep = () => (
    <form onSubmit={handleSubmitDetails} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Full Name</Label>
        <Input
          id="name"
          type="text"
          placeholder="Enter your full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone Number</Label>
        <Input
          id="phone"
          type="tel"
          placeholder="Enter your phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Select Your Department(s)</Label>
        <div className="grid grid-cols-2 gap-2">
          {DEPARTMENTS.map((dept) => {
            const isSelected = selectedDepartment === dept.value;
            return (
              <label
                key={dept.value}
                className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-primary/60 bg-primary/5'
                    : 'border-border/50 hover:border-primary/30'
                }`}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleDepartment(dept.value)}
                  className="h-3.5 w-3.5"
                />
                <span className="text-sm">{dept.icon}</span>
                <span className="text-xs font-medium">{dept.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      <Button type="submit" className="w-full h-12" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Sending verification...
          </>
        ) : (
          <>
            <UserPlus className="w-4 h-4 mr-2" />
            Continue
          </>
        )}
      </Button>
    </form>
  );

  const renderVerificationStep = () => (
    <form onSubmit={handleVerify} className="space-y-6">
      <div className="text-center space-y-2">
        <p className="text-muted-foreground">
          A verification code has been sent to the admin.
        </p>
        <p className="text-sm text-muted-foreground">
          Ask the admin for your 6-digit code.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="verificationCode">Verification Code</Label>
        <Input
          id="verificationCode"
          type="text"
          maxLength={6}
          placeholder="000000"
          value={verificationCode}
          onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="text-center text-3xl tracking-[0.3em] h-16 font-mono"
          autoFocus
        />
      </div>

      <Button type="submit" className="w-full h-12" disabled={isLoading || verificationCode.length !== 6}>
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Verifying...
          </>
        ) : (
          'Verify & Complete Registration'
        )}
      </Button>

      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={() => setStep('details')}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Go Back
      </Button>
    </form>
  );

  const renderSuccessStep = () => (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xl font-semibold">Registration Complete!</h3>
        <p className="text-muted-foreground">Your login code is:</p>
      </div>

      <div className="bg-primary/10 rounded-xl p-6">
        <p className="text-4xl font-bold tracking-[0.3em] font-mono text-primary">
          {assignedStaffCode}
        </p>
      </div>

      <p className="text-sm text-muted-foreground">
        Remember this code - you'll use it to log in.
      </p>

      {/* Admin Secret Code Section */}
      {adminSecretCode && (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 text-orange-600">
            <ShieldAlert className="w-5 h-5" />
            <span className="font-semibold text-sm">Admin Secret Code</span>
          </div>
          <div className="bg-orange-100 dark:bg-orange-900/30 rounded-xl p-4 border-2 border-orange-300">
            <p className="text-3xl font-bold tracking-[0.3em] font-mono text-orange-600">
              {adminSecretCode}
            </p>
          </div>
          <p className="text-xs text-orange-600 font-medium">
            ⚠️ SAVE THIS SECRET CODE! It's required to reset hotel data.
          </p>
        </div>
      )}

      <Button onClick={() => navigate('/login')} className="w-full h-12">
        Go to Login
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img 
              src={enaitotiLogo} 
              alt="Enaitoti Hotel" 
              className="h-24 w-24 rounded-full object-cover"
            />
          </div>
          <CardTitle className="text-2xl font-semibold">
            {step === 'success' ? 'Welcome!' : 'Staff Registration'}
          </CardTitle>
          {step === 'details' && (
            <CardDescription>
              Fill in your details to register
            </CardDescription>
          )}
          {step === 'verification' && (
            <CardDescription>
              Enter the verification code
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {step === 'details' && renderDetailsStep()}
          {step === 'verification' && renderVerificationStep()}
          {step === 'success' && renderSuccessStep()}

          {step === 'details' && (
            <div className="mt-6 text-center">
              <Button variant="ghost" onClick={() => navigate('/login')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
