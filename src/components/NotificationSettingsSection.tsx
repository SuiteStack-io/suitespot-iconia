import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Mail, BellOff, Bell } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface NotificationSettings {
  checkin_email: boolean;
  checkout_email: boolean;
  new_booking_email: boolean;
  cancelled_booking_email: boolean;
  room_shuffle_email: boolean;
  daily_summary_email: boolean;
}

const NOTIFICATION_LABELS: Record<keyof NotificationSettings, { label: string; description: string }> = {
  checkin_email: {
    label: 'Check-in Notifications',
    description: 'Receive an email when a guest checks in',
  },
  checkout_email: {
    label: 'Check-out Notifications',
    description: 'Receive an email when a guest checks out',
  },
  new_booking_email: {
    label: 'New Booking Notifications',
    description: 'Receive an email when a new booking is created',
  },
  cancelled_booking_email: {
    label: 'Cancelled Booking Notifications',
    description: 'Receive an email when a booking is cancelled',
  },
  room_shuffle_email: {
    label: 'Room Shuffle Notifications',
    description: 'Receive an email when rooms are auto-shuffled',
  },
  daily_summary_email: {
    label: 'Summary Reports (Daily, Weekly, Monthly)',
    description: 'Receive automated daily, weekly, and monthly summary reports by email',
  },
};

const DEFAULT_SETTINGS: NotificationSettings = {
  checkin_email: true,
  checkout_email: true,
  new_booking_email: true,
  cancelled_booking_email: true,
  room_shuffle_email: true,
  daily_summary_email: false,
};

interface NotificationSettingsSectionProps {
  userId: string;
  /** If true, saves are handled internally (auto-save mode for MyNotifications page) */
  standalone?: boolean;
  /** Expose settings to parent for combined save */
  onSettingsChange?: (settings: NotificationSettings) => void;
  /** Parent triggers save */
  triggerSave?: number;
  /** Use two-column grid layout for toggles on desktop */
  twoColumn?: boolean;
}

export function NotificationSettingsSection({
  userId,
  standalone = false,
  onSettingsChange,
  triggerSave,
  twoColumn = false,
}: NotificationSettingsSectionProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    fetchSettings();
  }, [userId]);

  useEffect(() => {
    onSettingsChange?.(settings);
  }, [settings]);

  useEffect(() => {
    if (triggerSave && triggerSave > 0) {
      saveSettings();
    }
  }, [triggerSave]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_notification_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSettings({
          checkin_email: data.checkin_email ?? true,
          checkout_email: data.checkout_email ?? true,
          new_booking_email: data.new_booking_email ?? true,
          cancelled_booking_email: data.cancelled_booking_email ?? true,
          room_shuffle_email: data.room_shuffle_email ?? true,
          daily_summary_email: data.daily_summary_email ?? false,
        });
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
    } catch (error) {
      console.error('Error fetching notification settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_notification_settings')
        .upsert({
          user_id: userId,
          ...settings,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) throw error;

      if (standalone) {
        toast({ title: 'Saved', description: 'Notification preferences updated' });
      }
    } catch (error) {
      console.error('Error saving notification settings:', error);
      toast({ title: 'Error', description: 'Failed to save notification settings', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key: keyof NotificationSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const allEnabled = Object.values(settings).every(Boolean);
  const allDisabled = Object.values(settings).every(v => !v);

  const handleEnableAll = () => setSettings(DEFAULT_SETTINGS);
  const handleDisableAll = () =>
    setSettings({
      checkin_email: false,
      checkout_email: false,
      new_booking_email: false,
      cancelled_booking_email: false,
      room_shuffle_email: false,
      daily_summary_email: false,
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Email Notifications</h3>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleEnableAll}
            disabled={allEnabled}
            className="h-7 text-xs"
          >
            <Bell className="h-3 w-3 mr-1" />
            Enable All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisableAll}
            disabled={allDisabled}
            className="h-7 text-xs"
          >
            <BellOff className="h-3 w-3 mr-1" />
            Disable All
          </Button>
        </div>
      </div>

      <div className={twoColumn ? "grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2" : "space-y-0"}>
        {(Object.keys(NOTIFICATION_LABELS) as Array<keyof NotificationSettings>).map((key) => (
          <div key={key} className="flex items-center justify-between py-2 border-b">
            <div className="space-y-0.5 pr-4">
              <Label htmlFor={`notif-${key}`} className="font-medium cursor-pointer text-sm">
                📩 {NOTIFICATION_LABELS[key].label}
              </Label>
              <p className="text-xs text-muted-foreground">
                {NOTIFICATION_LABELS[key].description}
              </p>
            </div>
            <Switch
              id={`notif-${key}`}
              checked={settings[key]}
              onCheckedChange={() => handleToggle(key)}
            />
          </div>
        ))}
      </div>

      {standalone && (
        <Button onClick={saveSettings} disabled={saving} className="w-full">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Notification Preferences'
          )}
        </Button>
      )}
    </div>
  );
}
