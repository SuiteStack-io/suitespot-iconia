import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, Copy, Loader2 } from 'lucide-react';

interface CreateGuestAccountDialogProps {
  reservationId: string;
  guestName: string;
}

export function CreateGuestAccountDialog({ reservationId, guestName }: CreateGuestAccountDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null);

  const handleCreateAccount = async () => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('create-guest-account', {
        body: { 
          reservationId,
          guestName 
        }
      });

      if (error) throw error;

      setCredentials({
        username: data.username,
        password: data.password
      });
      
      toast.success('Guest account created successfully!');
    } catch (error: any) {
      console.error('Error creating guest account:', error);
      toast.error(error.message || 'Failed to create guest account');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      setCredentials(null);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="h-4 w-4 mr-2" />
          Create Guest Account
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Guest Account</DialogTitle>
          <DialogDescription>
            Generate login credentials for {guestName}
          </DialogDescription>
        </DialogHeader>

        {!credentials ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Guest Name</Label>
              <Input value={guestName} disabled />
            </div>
            
            <p className="text-sm text-muted-foreground">
              This will create a guest portal account with automatically generated credentials.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <div className="flex gap-2">
                <Input value={credentials.username} readOnly />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(credentials.username, 'Username')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Password</Label>
              <div className="flex gap-2">
                <Input value={credentials.password} readOnly />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(credentials.password, 'Password')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="text-sm font-medium">Next Steps:</p>
              <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                <li>Copy these credentials</li>
                <li>Send them to the guest via WhatsApp or email</li>
                <li>Guest can log in at: {window.location.origin}/guest/login</li>
              </ol>
            </div>
          </div>
        )}

        <DialogFooter>
          {!credentials ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleCreateAccount} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Generate Credentials'
                )}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
