import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGuestAuth } from '@/lib/guestAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import guestLoginBg from '@/assets/guest-login-bg.webp';

export default function GuestLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useGuestAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast.error('Please enter both username and password');
      return;
    }

    setLoading(true);
    
    const { error } = await login(username, password);
    
    if (error) {
      toast.error(error.message);
      setLoading(false);
    } else {
      toast.success('Welcome to your stay!');
      navigate('/guest/dashboard');
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url(${guestLoginBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <Card className="w-full max-w-md backdrop-blur-sm bg-background/95 shadow-2xl border-2">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="font-playfair text-6xl font-semibold tracking-tight" style={{ letterSpacing: '-0.02em' }}>
            Guest Portal
          </CardTitle>
          <CardDescription className="font-playfair text-xl font-medium">
            Welcome to SuiteSpot Iconia. Enter your credentials to access your guest portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="font-playfair text-base font-medium">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="firstname_lastname"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="font-playfair text-base font-medium">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full font-playfair text-base font-medium" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="font-playfair text-base text-muted-foreground">Need help? Contact the front desk.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
