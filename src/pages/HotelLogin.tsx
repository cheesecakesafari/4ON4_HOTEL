import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useHotel } from '@/contexts/HotelContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function HotelLogin() {
  const [hotelCode, setHotelCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { setHotel } = useHotel();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (hotelCode.length !== 2 || !/^\d{2}$/.test(hotelCode)) {
      toast({
        title: 'Invalid hotel code',
        description: 'Please enter a 2-digit code',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data: hotel, error } = await supabase
        .from('hotels')
        .select('id, hotel_code, hotel_name')
        .eq('hotel_code', hotelCode)
        .maybeSingle();

      if (error) throw error;

      if (!hotel) {
        toast({
          title: 'Hotel not found',
          description: 'No hotel registered with this code',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      setHotel({
        id: hotel.id,
        hotel_code: hotel.hotel_code,
        hotel_name: hotel.hotel_name,
      });

      toast({
        title: `Welcome to ${hotel.hotel_name}`,
        description: 'Please enter your staff code',
      });

      navigate('/login');
    } catch (error: any) {
      toast({
        title: 'Error',
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
          <CardTitle className="text-xl font-semibold">Enter Hotel Code</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-center">
              <Input
                type="text"
                inputMode="numeric"
                pattern="\d{2}"
                maxLength={2}
                placeholder="--"
                value={hotelCode}
                onChange={(e) => setHotelCode(e.target.value.replace(/\D/g, '').slice(0, 2))}
                className="text-center text-4xl tracking-[0.5em] h-16 font-mono w-32"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full h-12" disabled={isLoading || hotelCode.length !== 2}>
              {isLoading ? 'Verifying...' : 'Continue'}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              New Hotel?{' '}
              <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/hotel-register')}>
                Register here
              </Button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
