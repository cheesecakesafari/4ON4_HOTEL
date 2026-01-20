import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function HotelRegister() {
  const [hotelName, setHotelName] = useState('');
  const [hotelCode, setHotelCode] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [takenCodes, setTakenCodes] = useState<string[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const fetchTakenCodes = async () => {
      const { data } = await supabase.from('hotels').select('hotel_code');
      if (data) {
        setTakenCodes(data.map(h => h.hotel_code));
      }
    };
    fetchTakenCodes();
  }, []);

  const isCodeAvailable = hotelCode.length === 2 && !takenCodes.includes(hotelCode);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hotelName.trim()) {
      toast({ title: 'Hotel name required', variant: 'destructive' });
      return;
    }
    if (hotelCode.length !== 2 || !/^\d{2}$/.test(hotelCode)) {
      toast({ title: 'Please enter a valid 2-digit hotel code', variant: 'destructive' });
      return;
    }
    if (takenCodes.includes(hotelCode)) {
      toast({ title: 'This hotel code is already taken', variant: 'destructive' });
      return;
    }

    setIsLoading(true);

    try {
      const { error: hotelError } = await supabase.from('hotels').insert({
        hotel_code: hotelCode,
        hotel_name: hotelName.trim(),
        phone: phone.trim() || null,
      });

      if (hotelError) throw hotelError;

      toast({
        title: 'Hotel registered!',
        description: `Your hotel code is ${hotelCode}`,
      });
      
      navigate('/');
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
              <Label htmlFor="hotelCode">Hotel Code (2 digits)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="hotelCode"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{2}"
                  maxLength={2}
                  placeholder="00"
                  value={hotelCode}
                  onChange={(e) => setHotelCode(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  className="text-center text-2xl tracking-[0.3em] h-12 font-mono w-24"
                />
                {hotelCode.length === 2 && (
                  <span className={`text-sm ${isCodeAvailable ? 'text-green-600' : 'text-red-600'}`}>
                    {isCodeAvailable ? '✓ Available' : '✗ Taken'}
                  </span>
                )}
              </div>
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

            <Button type="submit" className="w-full h-12" disabled={isLoading || !isCodeAvailable}>
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
