import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmployee } from '@/contexts/EmployeeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogIn } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import enaitotiLogo from '@/assets/enaitoti-logo.jpg';

export default function Login() {
  const [loginNumber, setLoginNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useEmployee();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loginNumber.length !== 3 || !/^[A-Za-z0-9]{3}$/.test(loginNumber)) {
      toast({
        title: 'Invalid staff code',
        description: 'Please enter a 3-character code (letters or numbers)',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const result = await login(loginNumber.toUpperCase());
    setIsLoading(false);

    if (result.success) {
      toast({
        title: 'Welcome back!',
        description: 'Login successful',
      });
      navigate('/dashboard');
    } else {
      toast({
        title: 'Incorrect staff code',
        description: 'Try another or register to get a code.',
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
            Enter your 3-character staff code
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-center">
                <Input
                  type="text"
                  maxLength={3}
                  placeholder="---"
                  value={loginNumber}
                  onChange={(e) => setLoginNumber(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase())}
                  className="text-center text-3xl tracking-[0.3em] h-16 font-mono w-36"
                  autoFocus
                />
              </div>
            </div>
            <Button type="submit" className="w-full h-12" disabled={isLoading || loginNumber.length !== 3}>
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
