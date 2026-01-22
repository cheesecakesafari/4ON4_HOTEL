import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useHotel } from '@/contexts/HotelContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';

type DepartmentRole =
  | 'restaurant'
  | 'kitchen'
  | 'rooms'
  | 'conference'
  | 'bar'
  | 'bar_admin'
  | 'accountant'
  | 'admin';

type Step = 'form' | 'success';

export default function HotelRegister() {
  const [step, setStep] = useState<Step>('form');
  const [hotelName, setHotelName] = useState('');
  const [domain, setDomain] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [createdHostname, setCreatedHostname] = useState<string | null>(null);

  const [useHotelManagement, setUseHotelManagement] = useState(true);
  const [useBarManagement, setUseBarManagement] = useState(false);

  // Hotel module options
  const [enableFood, setEnableFood] = useState(true); // Kitchen + Restaurant
  const [enableRooms, setEnableRooms] = useState(true); // Rooms (+Laundry)
  const [enableConference, setEnableConference] = useState(false);

  // Bar module options
  const [enableBarAdmin, setEnableBarAdmin] = useState(true);
  const [enableBarStaff, setEnableBarStaff] = useState(true);
  const [enableBarAccounting, setEnableBarAccounting] = useState(false); // maps to accountant

  const navigate = useNavigate();
  const { toast } = useToast();
  const { setHotel } = useHotel();

  const enabledDepartments = useMemo(() => {
    const departments = new Set<DepartmentRole>();

    if (useHotelManagement) {
      // Always include Admin + Accounts for hotel management
      departments.add('admin');
      departments.add('accountant');

      if (enableFood) {
        departments.add('kitchen');
        departments.add('restaurant');
      }
      if (enableRooms) {
        departments.add('rooms');
      }
      if (enableConference) {
        departments.add('conference');
      }
    }

    if (useBarManagement) {
      if (enableBarAdmin) departments.add('bar_admin');
      if (enableBarStaff) departments.add('bar');
      if (enableBarAccounting) departments.add('accountant');
    }

    return Array.from(departments);
  }, [
    useHotelManagement,
    useBarManagement,
    enableFood,
    enableRooms,
    enableConference,
    enableBarAdmin,
    enableBarStaff,
    enableBarAccounting,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hotelName.trim()) {
      toast({ title: 'Hotel name required', variant: 'destructive' });
      return;
    }
    if (!domain.trim()) {
      toast({ title: 'Domain required', description: 'Example: yourhotel.com', variant: 'destructive' });
      return;
    }
    if (!adminEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim())) {
      toast({ title: 'Valid admin email required', variant: 'destructive' });
      return;
    }
    if (!useHotelManagement && !useBarManagement) {
      toast({ title: 'Choose Hotel or Bar management', variant: 'destructive' });
      return;
    }
    if (enabledDepartments.length === 0) {
      toast({ title: 'Select at least one department', variant: 'destructive' });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-hotel', {
        body: {
          hotelName: hotelName.trim(),
          adminEmail: adminEmail.trim(),
          phone: phone.trim() || undefined,
          domain: domain.trim(),
          enabledDepartments,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.hotel?.id) throw new Error('Hotel created but response is missing hotel');

      setHotel({
        id: data.hotel.id,
        hotel_code: data.hotel.hotel_code,
        hotel_name: data.hotel.hotel_name,
      });

      toast({
        title: 'Hotel registered!',
        description: `Created successfully. Hotel code: ${data.hotel.hotel_code}`,
      });

      setCreatedHostname(data.hostname || domain.trim());
      setStep('success');
    } catch (error: any) {
      toast({
        title: 'Registration failed',
        description: error.message || 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl font-semibold">
            {step === 'form' ? 'Hotel Registration' : 'Hotel Created'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {step === 'form' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="hotelName">Hotel Name</Label>
                <Input
                  id="hotelName"
                  type="text"
                  placeholder="Enter hotel name"
                  value={hotelName}
                  onChange={(e) => setHotelName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="domain">Hotel Domain</Label>
                <Input
                  id="domain"
                  type="text"
                  placeholder="yourhotel.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminEmail">Email to send codes to</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  placeholder="admin@yourhotel.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Choose Management</Label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer">
                    <Checkbox
                      checked={useHotelManagement}
                      onCheckedChange={() => setUseHotelManagement((v) => !v)}
                      className="h-3.5 w-3.5"
                    />
                    <span className="text-sm font-medium">Hotel Management</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer">
                    <Checkbox
                      checked={useBarManagement}
                      onCheckedChange={() => setUseBarManagement((v) => !v)}
                      className="h-3.5 w-3.5"
                    />
                    <span className="text-sm font-medium">Bar Management</span>
                  </label>
                </div>
              </div>

              {useHotelManagement && (
                <div className="space-y-2">
                  <Label>Hotel Departments</Label>
                  <div className="text-xs text-muted-foreground">Admin + Accounts are included automatically.</div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer">
                      <Checkbox checked={enableFood} onCheckedChange={() => setEnableFood((v) => !v)} className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">Kitchen + Restaurant</span>
                    </label>
                    <label className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer">
                      <Checkbox checked={enableRooms} onCheckedChange={() => setEnableRooms((v) => !v)} className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">Rooms + Laundry</span>
                    </label>
                    <label className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer">
                      <Checkbox checked={enableConference} onCheckedChange={() => setEnableConference((v) => !v)} className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">Conference</span>
                    </label>
                  </div>
                </div>
              )}

              {useBarManagement && (
                <div className="space-y-2">
                  <Label>Bar Departments</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer">
                      <Checkbox checked={enableBarAdmin} onCheckedChange={() => setEnableBarAdmin((v) => !v)} className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">Bar Admin</span>
                    </label>
                    <label className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer">
                      <Checkbox checked={enableBarStaff} onCheckedChange={() => setEnableBarStaff((v) => !v)} className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">Bar Staff</span>
                    </label>
                    <label className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer">
                      <Checkbox checked={enableBarAccounting} onCheckedChange={() => setEnableBarAccounting((v) => !v)} className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">Bar Accounting</span>
                    </label>
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full h-12" disabled={isLoading}>
                {isLoading
                  ? 'Creating...'
                  : useHotelManagement && useBarManagement
                    ? 'Create Hotel + Bar'
                    : useHotelManagement
                      ? 'Create Hotel'
                      : 'Create Bar'}
              </Button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">Visit your domain to access your hotel</p>
              <div className="rounded-lg border p-3 font-mono text-sm">
                {createdHostname || domain}
              </div>
              <Button className="w-full" onClick={() => navigate('/login')}>
                Go to Staff Login
              </Button>
            </div>
          )}

          <div className="mt-4 text-center">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
