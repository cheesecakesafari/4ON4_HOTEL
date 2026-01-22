import { useState, useEffect } from 'react';
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

const DEPARTMENTS: { value: DepartmentRole; label: string }[] = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'rooms', label: 'Rooms' },
  { value: 'conference', label: 'Conference' },
  { value: 'bar', label: 'Bar Staff' },
  { value: 'bar_admin', label: 'Bar Admin' },
  { value: 'accountant', label: 'Accounts' },
  { value: 'admin', label: 'Admin' },
];

export default function HotelRegister() {
  const [hotelName, setHotelName] = useState('');
  const [domain, setDomain] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [enabledDepartments, setEnabledDepartments] = useState<DepartmentRole[]>(['restaurant']);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setHotel } = useHotel();

  const toggleDept = (dept: DepartmentRole) => {
    setEnabledDepartments((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hotelName.trim()) {
      toast({ title: 'Hotel name required', variant: 'destructive' });
      return;
    }
    if (!domain.trim()) {
      toast({ title: 'Domain required', description: 'Example: org1.com', variant: 'destructive' });
      return;
    }
    if (!adminEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim())) {
      toast({ title: 'Valid admin email required', variant: 'destructive' });
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
        description: `Domain linked. Hotel code: ${data.hotel.hotel_code}`,
      });
      
      navigate('/login');
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
          <CardTitle className="text-xl font-semibold">Register Hotel</CardTitle>
        </CardHeader>
        <CardContent>
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
                placeholder="org1.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminEmail">Admin Email (receives staff codes)</Label>
              <Input
                id="adminEmail"
                type="email"
                placeholder="admin@org1.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="Phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Enable Departments</Label>
              <div className="grid grid-cols-2 gap-2">
                {DEPARTMENTS.map((dept) => {
                  const isSelected = enabledDepartments.includes(dept.value);
                  return (
                    <label
                      key={dept.value}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                        isSelected ? 'border-primary/60 bg-primary/5' : 'border-border/50 hover:border-primary/30'
                      }`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleDept(dept.value)}
                        className="h-3.5 w-3.5"
                      />
                      <span className="text-xs font-medium">{dept.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <Button type="submit" className="w-full h-12" disabled={isLoading}>
              {isLoading ? 'Registering...' : 'Register'}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
