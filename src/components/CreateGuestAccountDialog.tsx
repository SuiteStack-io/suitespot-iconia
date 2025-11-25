import { useState, useEffect } from 'react';
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
  const [existingAccountsCount, setExistingAccountsCount] = useState(0);

  useEffect(() => {
    const fetchAccountsCount = async () => {
      const { count } = await supabase
        .from("guest_accounts")
        .select("*", { count: "exact", head: true })
        .eq("reservation_id", reservationId)
        .eq("is_active", true);
      setExistingAccountsCount(count || 0);
    };
    
    fetchAccountsCount();
  }, [reservationId, open]);

  const handleCreateAccount = async () => {
    setLoading(true);
    const generatedPassword = Math.random().toString(36).slice(-8);
    
    try {
      const { data, error } = await supabase.functions.invoke('create-guest-account', {
        body: { 
          reservationId,
          guestName 
        }
      });

      if (error) throw error;

      // Send credentials email
      try {
        const { data: reservationData } = await supabase
          .from("reservations")
          .select("check_in_date, check_out_date, contact_email, units(name)")
          .eq("id", reservationId)
          .single();

        if (reservationData?.contact_email) {
          await supabase.functions.invoke("send-guest-credentials", {
            body: {
              email: reservationData.contact_email,
              guestName: guestName,
              username: data.username,
              password: generatedPassword,
              checkInDate: reservationData.check_in_date,
              checkOutDate: reservationData.check_out_date,
              unitName: reservationData.units?.name || "Your Unit",
            },
          });
        }
      } catch (emailError) {
        console.error("Error sending credentials email:", emailError);
        toast.warning("Account created but email notification failed");
      }

      setCredentials({
        username: data.username,
        password: generatedPassword
      });
      
      toast.success('App account created and credentials sent!');
    } catch (error: any) {
      console.error('Error creating app account:', error);
      toast.error(error.message || 'Failed to create app account');
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
        <Button variant="outline" size="sm" disabled={existingAccountsCount >= 4}>
          <UserPlus className="h-4 w-4 mr-2" />
          Create App Account {existingAccountsCount > 0 && `(${existingAccountsCount}/4)`}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create App Account</DialogTitle>
          <DialogDescription>
            Generate login credentials for {guestName}. {existingAccountsCount} of 4 active accounts created for this reservation.
          </DialogDescription>
        </DialogHeader>

        {!credentials ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Guest Name</Label>
              <Input value={guestName} disabled />
            </div>
            
            <p className="text-sm text-muted-foreground">
              This will create an app account with automatically generated credentials.
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
