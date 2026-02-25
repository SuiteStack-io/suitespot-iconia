import { useState } from 'react';
import { Property } from '@/lib/propertyContext';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

const PROPERTY_TYPES = ['Hotel', 'Serviced Apartment', 'Vacation Rental', 'Hostel', 'B&B', 'Resort', 'Other'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'EGP', 'AED', 'SAR'];
const TIMEZONES = ['Africa/Cairo', 'Europe/London', 'America/New_York', 'Asia/Dubai', 'Asia/Riyadh', 'Europe/Paris'];
const COUNTRIES = [
  { code: 'EG', name: 'Egypt' }, { code: 'AE', name: 'UAE' }, { code: 'SA', name: 'Saudi Arabia' },
  { code: 'US', name: 'United States' }, { code: 'GB', name: 'United Kingdom' }, { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' }, { code: 'IT', name: 'Italy' }, { code: 'ES', name: 'Spain' },
  { code: 'JO', name: 'Jordan' }, { code: 'LB', name: 'Lebanon' }, { code: 'MA', name: 'Morocco' },
];

interface PropertyFormProps {
  property: Property | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function PropertyForm({ property, open, onClose, onSaved }: PropertyFormProps) {
  const { user } = useAuth();
  const isEdit = !!property;

  const [form, setForm] = useState({
    name: property?.name || '',
    legal_name: property?.legal_name || '',
    description: property?.description || '',
    property_type: property?.property_type || 'hotel',
    email: property?.email || '',
    phone: property?.phone || '',
    website: property?.website || '',
    address: property?.address || '',
    address_line_2: property?.address_line_2 || '',
    city: property?.city || '',
    state: property?.state || '',
    zip_code: property?.zip_code || '',
    country: property?.country || 'EG',
    latitude: property?.latitude?.toString() || '',
    longitude: property?.longitude?.toString() || '',
    timezone: property?.timezone || 'Africa/Cairo',
    currency: property?.currency || 'USD',
    default_checkin_time: property?.default_checkin_time || '15:00',
    default_checkout_time: property?.default_checkout_time || '11:00',
  });
  const [saving, setSaving] = useState(false);

  const update = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!form.name || !form.email || !form.address || !form.city) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        name: form.name,
        legal_name: form.legal_name || null,
        description: form.description || null,
        property_type: form.property_type,
        email: form.email,
        phone: form.phone || null,
        website: form.website || null,
        address: form.address,
        address_line_2: form.address_line_2 || null,
        city: form.city,
        state: form.state || null,
        zip_code: form.zip_code || null,
        country: form.country,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        timezone: form.timezone,
        currency: form.currency,
        default_checkin_time: form.default_checkin_time,
        default_checkout_time: form.default_checkout_time,
      };

      if (isEdit) {
        const { error } = await supabase
          .from('properties')
          .update(payload)
          .eq('id', property.id);
        if (error) throw error;
        toast.success('Property updated');
      } else {
        payload.created_by = user?.id;
        const { error } = await supabase
          .from('properties')
          .insert(payload);
        if (error) throw error;
        toast.success('Property created');
      }
      onSaved();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save property');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Property' : 'Add Property'}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6 py-2">
            {/* Property Details */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Property Details</h3>
              <div className="grid gap-3">
                <div>
                  <Label>Property Name *</Label>
                  <Input value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g., ICONIA Zamalek" />
                </div>
                <div>
                  <Label>Legal/Business Name</Label>
                  <Input value={form.legal_name} onChange={e => update('legal_name', e.target.value)} />
                </div>
                <div>
                  <Label>Property Type</Label>
                  <Select value={form.property_type} onValueChange={v => update('property_type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROPERTY_TYPES.map(t => <SelectItem key={t} value={t.toLowerCase().replace(/ /g, '_')}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={e => update('description', e.target.value)} rows={3} />
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Contact Information</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>Email *</Label><Input type="email" value={form.email} onChange={e => update('email', e.target.value)} /></div>
                <div><Label>Phone</Label><Input value={form.phone} onChange={e => update('phone', e.target.value)} /></div>
                <div className="sm:col-span-2"><Label>Website</Label><Input value={form.website} onChange={e => update('website', e.target.value)} /></div>
              </div>
            </div>

            {/* Address */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Address</h3>
              <div className="grid gap-3">
                <div><Label>Street Address *</Label><Input value={form.address} onChange={e => update('address', e.target.value)} /></div>
                <div><Label>Address Line 2</Label><Input value={form.address_line_2} onChange={e => update('address_line_2', e.target.value)} /></div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div><Label>City *</Label><Input value={form.city} onChange={e => update('city', e.target.value)} /></div>
                  <div><Label>State/Province</Label><Input value={form.state} onChange={e => update('state', e.target.value)} /></div>
                  <div><Label>ZIP Code</Label><Input value={form.zip_code} onChange={e => update('zip_code', e.target.value)} /></div>
                </div>
                <div>
                  <Label>Country *</Label>
                  <Select value={form.country} onValueChange={v => update('country', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Coordinates */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Location (Optional)</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>Latitude</Label><Input value={form.latitude} onChange={e => update('latitude', e.target.value)} placeholder="30.0444" /></div>
                <div><Label>Longitude</Label><Input value={form.longitude} onChange={e => update('longitude', e.target.value)} placeholder="31.2357" /></div>
              </div>
            </div>

            {/* Settings */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Settings</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Timezone *</Label>
                  <Select value={form.timezone} onValueChange={v => update('timezone', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TIMEZONES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Currency *</Label>
                  <Select value={form.currency} onValueChange={v => update('currency', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Check-in Time</Label><Input type="time" value={form.default_checkin_time} onChange={e => update('default_checkin_time', e.target.value)} /></div>
                <div><Label>Check-out Time</Label><Input type="time" value={form.default_checkout_time} onChange={e => update('default_checkout_time', e.target.value)} /></div>
              </div>
            </div>
          </div>
        </ScrollArea>
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Update Property' : 'Create Property'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
