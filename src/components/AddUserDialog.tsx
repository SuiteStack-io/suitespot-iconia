import { useState } from 'react';

interface AddUserDialogProps {
  onUserAdded?: () => void;
}
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const AddUserDialog = ({ onUserAdded }: AddUserDialogProps = {}) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'front_desk' as 'admin' | 'manager' | 'front_desk' | 'housekeeping'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Store the current admin session before creating a new user
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (!currentSession) {
        throw new Error('You must be logged in to create users');
      }

      // Create user via Supabase Auth (this will auto-login as the new user)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      const newUserId = authData.user.id;

      // Immediately restore the admin session (sign out the new user, sign back in as admin)
      await supabase.auth.setSession({
        access_token: currentSession.access_token,
        refresh_token: currentSession.refresh_token,
      });

      // Now assign role to the new user (as admin)
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert([{
          user_id: newUserId,
          role: formData.role as 'admin' | 'manager' | 'front_desk' | 'housekeeping',
        }]);

      if (roleError) {
        console.error('Role assignment error:', roleError);
        throw roleError;
      }

      // Success! Show message and close dialog
      toast.success('User created successfully!', {
        description: `${formData.fullName} can now log in with their email.`
      });
      
      // Reset form and close dialog
      setFormData({ email: '', password: '', fullName: '', role: 'front_desk' as 'admin' | 'manager' | 'front_desk' | 'housekeeping' });
      setOpen(false);
    } catch (error: any) {
      console.error('Error creating user:', error);
      
      // Provide specific error messages based on error type
      if (error.message?.includes('violates row-level security') || error.code === '42501') {
        toast.error('Permission denied: Unable to assign role to user. Please make sure you have admin privileges.');
      } else if (error.message?.includes('already registered') || error.message?.includes('already exists')) {
        toast.error('This email is already registered in the system.');
      } else if (error.message?.includes('invalid email')) {
        toast.error('Please enter a valid email address.');
      } else if (error.message?.includes('password') && error.message?.includes('least')) {
        toast.error('Password must be at least 6 characters long.');
      } else if (error.message?.includes('User already registered')) {
        toast.error('A user with this email already exists.');
      } else {
        toast.error(error.message || 'Failed to create user. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              minLength={6}
            />
          </div>
          <div>
            <Label htmlFor="role">Role</Label>
            <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value as 'admin' | 'manager' | 'front_desk' | 'housekeeping' })}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="front_desk">Front Desk</SelectItem>
                <SelectItem value="housekeeping">Housekeeping</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Admin & Manager can create/edit reservations
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create User'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
