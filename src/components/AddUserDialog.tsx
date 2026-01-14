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
      // Call edge function to create user with admin API
      const { data, error } = await supabase.functions.invoke('create-admin-user', {
        body: {
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          role: formData.role
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Success! Show message and close dialog
      toast.success('User created successfully!', {
        description: `${formData.fullName} can now log in with their email.`
      });
      
      // Reset form and close dialog
      setFormData({ email: '', password: '', fullName: '', role: 'front_desk' as 'admin' | 'manager' | 'front_desk' | 'housekeeping' });
      setOpen(false);
      
      // Callback to refresh user list
      onUserAdded?.();
    } catch (error: any) {
      console.error('Error creating user:', error);
      
      // Provide specific error messages based on error type
      if (error.message?.includes('Only admins')) {
        toast.error('Permission denied: Only admins can create users.');
      } else if (error.message?.includes('already registered') || error.message?.includes('already exists')) {
        toast.error('This email is already registered in the system.');
      } else if (error.message?.includes('invalid email')) {
        toast.error('Please enter a valid email address.');
      } else if (error.message?.includes('password') && error.message?.includes('least')) {
        toast.error('Password must be at least 6 characters long.');
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
