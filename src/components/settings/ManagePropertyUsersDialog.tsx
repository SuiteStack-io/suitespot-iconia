import { useState, useEffect } from 'react';
import { Property, PropertyRole } from '@/lib/propertyContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

interface UserAccess {
  id: string;
  user_id: string;
  role: string;
  full_name: string | null;
  email: string | null;
}

const ROLES: PropertyRole[] = ['admin', 'manager', 'staff', 'viewer'];

interface ManagePropertyUsersDialogProps {
  property: Property;
  open: boolean;
  onClose: () => void;
}

export function ManagePropertyUsersDialog({ property, open, onClose }: ManagePropertyUsersDialogProps) {
  const [users, setUsers] = useState<UserAccess[]>([]);
  const [allUsers, setAllUsers] = useState<{ user_id: string; email: string; full_name: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [addUserId, setAddUserId] = useState('');
  const [addRole, setAddRole] = useState<PropertyRole>('staff');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: access } = await supabase
        .from('user_property_access')
        .select('id, user_id, role')
        .eq('property_id', property.id);

      if (!access || access.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }

      // Get profile details
      const userIds = access.map(a => a.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      // Get emails via RPC
      const { data: allUsersData } = await supabase.rpc('get_all_users_with_emails');

      const merged: UserAccess[] = access.map(a => {
        const profile = profiles?.find(p => p.id === a.user_id);
        const userData = allUsersData?.find((u: any) => u.user_id === a.user_id);
        return {
          ...a,
          full_name: profile?.full_name || null,
          email: userData?.email || null,
        };
      });

      setUsers(merged);
      
      // Set all users for the add dropdown
      if (allUsersData) {
        setAllUsers(allUsersData.map((u: any) => ({
          user_id: u.user_id,
          email: u.email,
          full_name: u.full_name,
        })));
      }
    } catch (err) {
      console.error('Error fetching property users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchUsers();
  }, [open, property.id]);

  const handleChangeRole = async (accessId: string, newRole: string) => {
    const { error } = await supabase
      .from('user_property_access')
      .update({ role: newRole })
      .eq('id', accessId);

    if (error) {
      toast.error('Failed to update role');
    } else {
      toast.success('Role updated');
      fetchUsers();
    }
  };

  const handleRemove = async (accessId: string) => {
    const { error } = await supabase
      .from('user_property_access')
      .delete()
      .eq('id', accessId);

    if (error) {
      toast.error('Failed to remove user');
    } else {
      toast.success('User removed');
      fetchUsers();
    }
  };

  const handleAddUser = async () => {
    if (!addUserId) return;

    const { error } = await supabase
      .from('user_property_access')
      .insert({
        user_id: addUserId,
        property_id: property.id,
        role: addRole,
      });

    if (error) {
      if (error.code === '23505') {
        toast.error('User already has access to this property');
      } else {
        toast.error('Failed to add user');
      }
    } else {
      toast.success('User added');
      setAddUserId('');
      fetchUsers();
    }
  };

  const existingUserIds = users.map(u => u.user_id);
  const availableUsers = allUsers.filter(u => !existingUserIds.includes(u.user_id));

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Users — {property.name}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Existing users */}
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.id} className="flex items-center justify-between gap-2 p-2 rounded-md border">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{u.full_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email || ''}</p>
                  </div>
                  <Select value={u.role} onValueChange={v => handleChangeRole(u.id, v)}>
                    <SelectTrigger className="w-28 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map(r => (
                        <SelectItem key={r} value={r}>
                          <Badge variant="outline" className="capitalize">{r}</Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleRemove(u.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {users.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No users assigned</p>
              )}
            </div>

            {/* Add user */}
            {availableUsers.length > 0 && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">Add User</p>
                <div className="flex gap-2">
                  <Select value={addUserId} onValueChange={setAddUserId}>
                    <SelectTrigger className="flex-1 h-8">
                      <SelectValue placeholder="Select user..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.map(u => (
                        <SelectItem key={u.user_id} value={u.user_id}>
                          {u.full_name || u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={addRole} onValueChange={v => setAddRole(v as PropertyRole)}>
                    <SelectTrigger className="w-24 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map(r => (
                        <SelectItem key={r} value={r}><span className="capitalize">{r}</span></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={handleAddUser} disabled={!addUserId}>
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
