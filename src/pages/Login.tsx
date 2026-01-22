import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmployee } from '@/contexts/EmployeeContext';
import { useHotel } from '@/contexts/HotelContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogIn } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import enaitotiLogo from '@/assets/enaitoti-logo.jpg';
import { supabaseEnv } from '@/integrations/supabase/client';

export default function Login() {
  const [loginNumber, setLoginNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useEmployee();
  const { hotel, isHotelLoading } = useHotel();
  const navigate = useNavigate();
  const { toast } = useToast();

  const normalized = loginNumber.trim().toUpperCase();
  const isValid = /^[A-Z]{1,2}\d{2}$/.test(normalized);

  useEffect(() => {
    if (isHotelLoading || hotel) return;
    const hostname = window.location.hostname.toLowerCase();
    const isMainEntrance = hostname === '4on4.world' || hostname === 'www.4on4.world';
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost');
    if (isMainEntrance || isLocal) navigate('/hotel-register');
  }, [hotel, isHotelLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (supabaseEnv.isMisconfigured) {
      toast({
        title: 'Deployment misconfigured',
        description:
          supabaseEnv.misconfigurationReason ||
          'This site is pointed at the wrong database. Fix Netlify env vars and redeploy.',
        variant: 'destructive',
      });
      return;
    }

    if (!isValid) {
      toast({
        title: 'Invalid staff code',
        description: 'Enter a department code like K12 or AD07',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const result = await login(normalized);
    setIsLoading(false);

    if (result.success) {
      toast({
        title: 'Welcome back!',
        description: 'Login successful',
      });
      navigate('/dashboard');
    } else {
      toast({
        title: result.error === 'Hotel not selected' ? 'Hotel not found' : 'Incorrect staff code',
        description:
          result.error === 'Hotel not selected'
            ? 'This domain is not yet linked to a hotel. Register the hotel first on 4on4.world, then try again.'
            : 'Try another or register to get a code.',
        variant: 'destructive',
      });
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
              className="h-24 w-24 rounded-full object-cover"
            />
          </div>
          <CardTitle className="text-2xl font-semibold">Staff Login</CardTitle>
          <CardDescription>
            Enter your staff code (e.g., K12 or AD07)
          </CardDescription>
          {supabaseEnv.isMisconfigured ? (
            <CardDescription className="text-destructive">
              {supabaseEnv.misconfigurationReason}
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-center">
                <Input
                  type="text"
                  maxLength={4}
                  placeholder="AD07"
                  value={loginNumber}
                  onChange={(e) => setLoginNumber(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase())}
                  className="text-center text-3xl tracking-[0.2em] h-16 font-mono w-44"
                  autoFocus
                />
              </div>
            </div>
            <Button type="submit" className="w-full h-12" disabled={isLoading || !isValid}>
              <LogIn className="w-4 h-4 mr-2" />
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
          <div className="mt-4 text-center space-y-2">
            <Button variant="link" className="p-0 h-auto text-sm" onClick={() => navigate('/recover')}>
              Forgot your code?
            </Button>
            <p className="text-sm text-muted-foreground">
              New staff?{' '}
              <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/register')}>
                Register here
              </Button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
