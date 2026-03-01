import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Property } from '@/lib/propertyContext';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { usePropertySafe } from '@/lib/propertyContext';
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
import { PhoneInput } from '@/components/ui/phone-input';
import { toast } from 'sonner';
import { CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';

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
  const propertyContext = usePropertySafe();
  const navigate = useNavigate();
  const isEdit = !!property;

  const [step, setStep] = useState(1);
  const [createdPropertyId, setCreatedPropertyId] = useState<string | null>(null);
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

  const validateStep1 = () => {
    if (!form.name || !form.address || !form.city) {
      toast.error('Please fill in Property Name, Address, and City');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        name: form.name,
        legal_name: form.legal_name || null,
        description: form.description || null,
        property_type: form.property_type,
        email: form.email || null,
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
        onSaved();
      } else {
        payload.created_by = user?.id;
        payload.is_active = true;
        const companyId = propertyContext?.company?.id || (propertyContext?.activeProperty as any)?.company_id;
        if (companyId) payload.company_id = companyId;
        const { data, error } = await supabase
          .from('properties')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        setCreatedPropertyId(data.id);
        setStep(3);
        // Refresh properties list so it appears in switcher
        propertyContext?.refreshProperties?.();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save property');
    } finally {
      setSaving(false);
    }
  };

  const handleSetUpRooms = () => {
    if (createdPropertyId && propertyContext) {
      const newProp = propertyContext.properties.find(p => p.id === createdPropertyId);
      if (newProp) propertyContext.setActiveProperty(newProp);
    }
    onSaved();
    navigate('/rooms');
  };

  const handleDoLater = () => {
    onSaved();
    navigate('/admin');
  };

  const totalSteps = isEdit ? 2 : 3;

  return (
    <Dialog open={open} onOpenChange={() => { if (step !== 3) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {step === 3 ? 'Property Created!' : isEdit ? 'Edit Property' : `Add Property — Step ${step} of ${totalSteps}`}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        {!isEdit && step < 3 && (
          <div className="flex items-center gap-2 mb-2">
            {[1, 2].map(s => (
              <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-muted'}`} />
            ))}
          </div>
        )}

        {/* STEP 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-2">
            <div className="grid gap-3">
              <div>
                <Label>Property Name *</Label>
                <Input value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g., ICONIA Zamalek" />
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
              {isEdit && (
                <div>
                  <Label>Legal/Business Name</Label>
                  <Input value={form.legal_name} onChange={e => update('legal_name', e.target.value)} />
                </div>
              )}
              <div>
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => update('description', e.target.value)} rows={2} />
              </div>
              <div>
                <Label>Street Address *</Label>
                <Input value={form.address} onChange={e => update('address', e.target.value)} />
              </div>
              {isEdit && (
                <div>
                  <Label>Address Line 2</Label>
                  <Input value={form.address_line_2} onChange={e => update('address_line_2', e.target.value)} />
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>City *</Label><Input value={form.city} onChange={e => update('city', e.target.value)} /></div>
                <div>
                  <Label>Country *</Label>
                  <Select value={form.country} onValueChange={v => update('country', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Timezone</Label>
                  <Select value={form.timezone} onValueChange={v => update('timezone', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TIMEZONES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Currency</Label>
                  <Select value={form.currency} onValueChange={v => update('currency', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {isEdit && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => update('email', e.target.value)} /></div>
                    <div><Label>Phone</Label><PhoneInput value={form.phone} onChange={v => update('phone', v)} /></div>
                  </div>
                  <div><Label>Website</Label><Input value={form.website} onChange={e => update('website', e.target.value)} /></div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label>Latitude</Label><Input value={form.latitude} onChange={e => update('latitude', e.target.value)} placeholder="30.0444" /></div>
                    <div><Label>Longitude</Label><Input value={form.longitude} onChange={e => update('longitude', e.target.value)} placeholder="31.2357" /></div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: Operations */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Configure operational defaults for this property.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Default Check-in Time</Label>
                <Input type="time" value={form.default_checkin_time} onChange={e => update('default_checkin_time', e.target.value)} />
              </div>
              <div>
                <Label>Default Check-out Time</Label>
                <Input type="time" value={form.default_checkout_time} onChange={e => update('default_checkout_time', e.target.value)} />
              </div>
            </div>
            {!isEdit && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="Optional" /></div>
                <div><Label>Phone</Label><PhoneInput value={form.phone} onChange={v => update('phone', v)} placeholder="Optional" /></div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">VAT rate is inherited from your company settings.</p>
          </div>
        )}

        {/* STEP 3: Success */}
        {step === 3 && (
          <div className="py-8 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
            <h3 className="text-lg font-semibold">Property Created Successfully!</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              Next steps: Add room types and rooms, then connect to OTAs.
            </p>
            <div className="flex justify-center gap-3 pt-4">
              <Button variant="outline" onClick={handleDoLater}>Do This Later</Button>
              <Button onClick={handleSetUpRooms}>
                Set Up Rooms <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        {step < 3 && (
          <div className="flex justify-between pt-4 border-t">
            <div>
              {step > 1 && (
                <Button variant="ghost" onClick={() => setStep(s => s - 1)}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              {step === 1 && !isEdit && (
                <Button onClick={() => validateStep1() && setStep(2)}>
                  Next <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
              {step === 1 && isEdit && (
                <Button onClick={() => { if (validateStep1()) setStep(2); }}>
                  Next <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
              {step === 2 && (
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : isEdit ? 'Update Property' : 'Create Property'}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
