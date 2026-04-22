import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserPlus, Pencil, ArrowLeft, Shield } from 'lucide-react';
import { AddUserDialog } from '@/components/AddUserDialog';
import { EditPermissionsDialog } from '@/components/EditPermissionsDialog';
import { SlideMenu } from '@/components/SlideMenu';
import { AdminBreadcrumb } from '@/components/AdminBreadcrumb';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

const Users = () => {
  const { userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', email: '', role: '' });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [permissionsDialogUser, setPermissionsDialogUser] = useState<User | null>(null);
  
  // Master account user ID (Youssef Noureldin)
  const MASTER_ACCOUNT_ID = 'd540b87e-f856-4ef1-9193-2fb077366ef9';

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (!loading && userRole !== 'admin' && userRole !== 'super_admin') {
      navigate('/admin');
    }
  }, [userRole, loading, navigate]);

  useEffect(() => {
    if (userRole === 'admin' || userRole === 'super_admin') {
      fetchUsers();
    }
  }, [userRole]);

  const fetchUsers = async () => {
    const { data, error } = await supabase.rpc('get_all_users_with_emails');
    
    if (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch users',
        variant: 'destructive',
      });
      return;
    }
    
    if (data) {
      const usersData = data.map((user: any) => ({
        id: user.user_id,
        email: user.email || '',
        full_name: user.full_name || '',
        role: user.role || 'No role',
      }));
      setUsers(usersData);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setEditForm({
      full_name: user.full_name,
      email: user.email,
      role: user.role,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingUser || currentUserId !== MASTER_ACCOUNT_ID) return;

    try {
      console.log('Updating user:', editingUser.id, 'with role:', editForm.role);
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(editForm.email)) {
        toast({
          title: 'Error',
          description: 'Please enter a valid email address',
          variant: 'destructive',
        });
        return;
      }

      // Update email if changed (using edge function)
      if (editForm.email !== editingUser.email) {
        const { data: emailData, error: emailError } = await supabase.functions.invoke(
          'update-user-email',
          {
            body: {
              userId: editingUser.id,
              newEmail: editForm.email,
            },
          }
        );

        if (emailError) {
          console.error('Email update error:', emailError);
          throw new Error('Failed to update email');
        }

        console.log('Email updated:', emailData);
      }
      
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: editForm.full_name })
        .eq('id', editingUser.id);

      if (profileError) {
        console.error('Profile update error:', profileError);
        throw profileError;
      }

      // Check current role first
      const { data: currentRole, error: checkError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', editingUser.id)
        .single();

      if (checkError) {
        console.error('Role check error:', checkError);
        throw checkError;
      }

      console.log('Current role in DB:', currentRole);

      // Update role - using the exact enum value
      const { data: updateData, error: roleError } = await supabase
        .from('user_roles')
        .update({ role: editForm.role as any })
        .eq('user_id', editingUser.id)
        .select();

      console.log('Role update result:', { updateData, roleError });

      if (roleError) {
        console.error('Role update error:', roleError);
        throw roleError;
      }

      toast({
        title: 'Success',
        description: 'User updated successfully',
      });

      setEditingUser(null);
      
      // Force refetch after a short delay to ensure DB has updated
      setTimeout(() => {
        fetchUsers();
      }, 300);
    } catch (error) {
      console.error('Update error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update user',
        variant: 'destructive',
      });
    }
  };

  if (loading || (userRole !== 'admin' && userRole !== 'super_admin')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <AdminBreadcrumb section="System" currentPage="Users" />
          <div className="flex items-center gap-4">
            <SlideMenu userRole={userRole} />
          
          {/* Mobile back button - icon only */}
          <Button 
            variant="ghost" 
            onClick={() => navigate('/admin')}
            className="md:hidden"
            size="icon"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          {/* Desktop back button with text */}
          <Button 
            variant="ghost" 
            onClick={() => navigate('/admin')}
            className="hidden md:flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          
          <h1 className="text-xl font-bold">User Management</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Users</CardTitle>
              <CardDescription>Manage user accounts, roles, and permissions</CardDescription>
            </div>
            {currentUserId === MASTER_ACCOUNT_ID && <AddUserDialog onUserAdded={fetchUsers} />}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell className="capitalize">{user.role}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Edit Permissions Button - always visible for admins */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPermissionsDialogUser(user)}
                          className="gap-1"
                        >
                          <Shield className="h-4 w-4" />
                          <span className="hidden sm:inline">Permissions</span>
                        </Button>
                        
                        {/* Edit User Button - only for master account */}
                        {currentUserId === MASTER_ACCOUNT_ID && (
                          <Dialog open={editingUser?.id === user.id} onOpenChange={(open) => !open && setEditingUser(null)}>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={() => handleEdit(user)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit User</DialogTitle>
                              <DialogDescription>Update user information</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="name">Full Name</Label>
                                <Input
                                  id="name"
                                  value={editForm.full_name}
                                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                  id="email"
                                  type="email"
                                  value={editForm.email}
                                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="role">Role</Label>
                                <Select value={editForm.role} onValueChange={(value) => setEditForm({ ...editForm, role: value })}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="manager">Manager</SelectItem>
                                    <SelectItem value="front_desk">Front Desk</SelectItem>
                                    <SelectItem value="housekeeping">Housekeeping</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setEditingUser(null)}>
                                  Cancel
                                </Button>
                                <Button onClick={handleSaveEdit}>
                                  Save Changes
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      {/* Edit Permissions Dialog */}
      <EditPermissionsDialog
        open={!!permissionsDialogUser}
        onOpenChange={(open) => !open && setPermissionsDialogUser(null)}
        user={permissionsDialogUser}
        onSuccess={fetchUsers}
      />
    </div>
  );
};

export default Users;
