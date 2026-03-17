import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Shield } from 'lucide-react';
import { PropertyAccessSection } from './PropertyAccessSection';
import { Separator } from '@/components/ui/separator';
import { NotificationSettingsSection } from './NotificationSettingsSection';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

interface UserPermissions {
  can_check_in: boolean;
  can_check_out: boolean;
  can_submit_forms: boolean;
  can_create_booking: boolean;
  can_change_rooms: boolean;
  can_block_dates: boolean;
  can_export_calendar: boolean;
  can_access_pms: boolean;
  can_access_front_desk: boolean;
}

const PERMISSION_LABELS: Record<keyof UserPermissions, { label: string; description: string }> = {
  can_check_in: { 
    label: 'Check In Guests', 
    description: 'Ability to check in guests on arrival' 
  },
  can_check_out: { 
    label: 'Check Out Guests', 
    description: 'Ability to check out guests on departure' 
  },
  can_submit_forms: { 
    label: 'Complete Guest Forms', 
    description: 'Ability to complete and submit guest check-in forms' 
  },
  can_create_booking: { 
    label: 'Create Manual Booking', 
    description: 'Ability to create manual reservations' 
  },
  can_change_rooms: { 
    label: 'Change Rooms', 
    description: 'Ability to swap or transfer rooms for existing bookings' 
  },
  can_block_dates: { 
    label: 'Block Calendar Dates', 
    description: 'Ability to block dates on the availability calendar' 
  },
  can_export_calendar: { 
    label: 'Export Calendar', 
    description: 'Ability to export calendar data to PDF or Excel' 
  },
  can_access_pms: { 
    label: 'Access PMS', 
    description: 'Access to Availability, Prices, and Restrictions pages' 
  },
  can_access_front_desk: { 
    label: 'Access Front Desk', 
    description: 'Access to Room Rates, Guests, and Guest Forms pages' 
  },
};

interface EditPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onSuccess?: () => void;
}

export function EditPermissionsDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: EditPermissionsDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notifSaveTrigger, setNotifSaveTrigger] = useState(0);
  const [permissions, setPermissions] = useState<UserPermissions>({
    can_check_in: false,
    can_check_out: false,
    can_submit_forms: false,
    can_create_booking: false,
    can_change_rooms: false,
    can_block_dates: false,
    can_export_calendar: false,
    can_access_pms: false,
    can_access_front_desk: false,
  });

  useEffect(() => {
    if (open && user) {
      fetchPermissions();
    }
  }, [open, user]);

  const fetchPermissions = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setPermissions({
          can_check_in: data.can_check_in ?? false,
          can_check_out: data.can_check_out ?? false,
          can_submit_forms: data.can_submit_forms ?? false,
          can_create_booking: data.can_create_booking ?? false,
          can_change_rooms: data.can_change_rooms ?? false,
          can_block_dates: data.can_block_dates ?? false,
          can_export_calendar: data.can_export_calendar ?? false,
          can_access_pms: data.can_access_pms ?? false,
          can_access_front_desk: data.can_access_front_desk ?? false,
        });
      } else {
        setPermissions({
          can_check_in: false,
          can_check_out: false,
          can_submit_forms: false,
          can_create_booking: false,
          can_change_rooms: false,
          can_block_dates: false,
          can_export_calendar: false,
          can_access_pms: false,
          can_access_front_desk: false,
        });
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch user permissions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      // Only upsert permissions for non-admin users
      if (!isAdmin) {
        const { error } = await supabase
          .from('user_permissions')
          .upsert({
            user_id: user.id,
            ...permissions,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id',
          });

        if (error) throw error;
      }

      // Trigger notification settings save for all users
      setNotifSaveTrigger(prev => prev + 1);
      toast({
        title: 'Success',
        description: `Settings updated for ${user.full_name || user.email}`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key: keyof UserPermissions) => {
    setPermissions(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const isAdmin = user?.role === 'admin';
  const allPermissionsEnabled = Object.values(permissions).every(Boolean);

  const handleToggleAll = () => {
    const newValue = !allPermissionsEnabled;
    setPermissions({
      can_check_in: newValue,
      can_check_out: newValue,
      can_submit_forms: newValue,
      can_create_booking: newValue,
      can_change_rooms: newValue,
      can_block_dates: newValue,
      can_export_calendar: newValue,
      can_access_pms: newValue,
      can_access_front_desk: newValue,
    });
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[100dvh] sm:max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Edit Permissions
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 flex-wrap">
            <span>{user.full_name || user.email}</span>
            <Badge variant="secondary" className="capitalize">
              {user.role}
            </Badge>
          </DialogDescription>
        </DialogHeader>

        {isAdmin ? (
          <div className="py-6 text-center text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-3 text-primary/50" />
            <p className="font-medium">Admin users have all permissions</p>
            <p className="text-sm mt-1">
              No individual permission settings needed for admin role.
            </p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                Permissions
              </h3>
              <div className="flex items-center gap-2">
                <Label htmlFor="select-all" className="text-xs text-muted-foreground cursor-pointer">
                  Select All
                </Label>
                <Switch
                  id="select-all"
                  checked={allPermissionsEnabled}
                  onCheckedChange={handleToggleAll}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
              {(Object.keys(PERMISSION_LABELS) as Array<keyof UserPermissions>).map((key) => (
                <div
                  key={key}
                  className="flex items-center justify-between py-2 border-b"
                >
                  <div className="space-y-0.5 pr-4">
                    <Label htmlFor={key} className="font-medium cursor-pointer text-sm">
                      {PERMISSION_LABELS[key].label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {PERMISSION_LABELS[key].description}
                    </p>
                  </div>
                  <Switch
                    id={key}
                    checked={permissions[key]}
                    onCheckedChange={() => handleToggle(key)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {user && (
          <>
            <Separator />
            <PropertyAccessSection userId={user.id} isAdmin={isAdmin} />
            <Separator />
            <NotificationSettingsSection userId={user.id} triggerSave={notifSaveTrigger} twoColumn />
          </>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}