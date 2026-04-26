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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PhoneInput } from '@/components/ui/phone-input';
import { toast } from 'sonner';
import { CheckCircle2, ArrowRight, ArrowLeft, Info } from 'lucide-react';

const PROPERTY_TYPES = ['Hotel', 'Serviced Apartment', 'Vacation Rental', 'Hostel', 'B&B', 'Resort', 'Other'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'EGP', 'AED', 'SAR'];
const TIMEZONES = [
  'UTC',
  'Africa/Cairo',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Istanbul',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'Australia/Sydney',
];
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

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const REGION_PRESETS: Record<string, { weekend_days: number[]; off_peak_days: number[] }> = {
    middle_east: { weekend_days: [4, 5], off_peak_days: [6] },
    western: { weekend_days: [5, 6], off_peak_days: [0] },
    custom: { weekend_days: [], off_peak_days: [] },
  };

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
    timezone: property?.timezone || 'UTC',
    currency: property?.currency || 'USD',
    default_checkin_time: property?.default_checkin_time || '15:00',
    default_checkout_time: property?.default_checkout_time || '11:00',
    weekend_days: (property as any)?.weekend_days ?? [4, 5],
    off_peak_days: (property as any)?.off_peak_days ?? [],
    // Email & Business Settings
    from_email_reservations: (property as any)?.from_email_reservations || '',
    from_email_frontdesk: (property as any)?.from_email_frontdesk || '',
    from_email_notifications: (property as any)?.from_email_notifications || '',
    from_email_housekeeping: (property as any)?.from_email_housekeeping || '',
    from_email_ai: (property as any)?.from_email_ai || '',
    from_name: (property as any)?.from_name || '',
    support_email: (property as any)?.support_email || '',
    support_phone: (property as any)?.support_phone || '',
    support_whatsapp: (property as any)?.support_whatsapp || '',
    wifi_network: (property as any)?.wifi_network || '',
    wifi_password: (property as any)?.wifi_password || '',
    vat_rate: (property as any)?.vat_rate?.toString() ?? '',
    default_commission_rate: (property as any)?.default_commission_rate?.toString() ?? '',
    revenue_recognition_method: ((property as any)?.revenue_recognition_method as string) || 'check_in',
    has_landlord: ((property as any)?.has_landlord ?? true) as boolean,
    landlord_share_percentage: ((property as any)?.landlord_share_percentage ?? 70) as number,
  });
  const [saving, setSaving] = useState(false);

  const update = (key: string, val: any) => setForm(prev => ({ ...prev, [key]: val }));

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
        weekend_days: form.weekend_days,
        off_peak_days: form.off_peak_days,
        from_email_reservations: form.from_email_reservations || null,
        from_email_frontdesk: form.from_email_frontdesk || null,
        from_email_notifications: form.from_email_notifications || null,
        from_email_housekeeping: form.from_email_housekeeping || null,
        from_email_ai: form.from_email_ai || null,
        from_name: form.from_name || null,
        support_email: form.support_email || null,
        support_phone: form.support_phone || null,
        support_whatsapp: form.support_whatsapp || null,
        wifi_network: form.wifi_network || null,
        wifi_password: form.wifi_password || null,
        vat_rate: form.vat_rate !== '' ? parseFloat(form.vat_rate) : null,
        default_commission_rate: form.default_commission_rate !== '' ? parseFloat(form.default_commission_rate) : null,
        revenue_recognition_method: form.revenue_recognition_method,
        has_landlord: form.has_landlord,
        landlord_share_percentage: form.landlord_share_percentage,
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
        setStep(5);
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

  const totalSteps = 4;

  return (
    <Dialog open={open} onOpenChange={() => { if (step !== 5) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {step === 5 ? 'Property Created!' : isEdit ? `Edit Property — Step ${step} of ${totalSteps}` : `Add Property — Step ${step} of ${totalSteps}`}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        {step < 5 && (
          <div className="flex items-center gap-2 mb-2">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map(s => (
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
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-2">
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

            {/* Pricing Rules */}
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Pricing Rules</h3>
                <Select
                  value="custom"
                  onValueChange={(preset) => {
                    const p = REGION_PRESETS[preset];
                    if (p) {
                      setForm(prev => ({ ...prev, weekend_days: p.weekend_days, off_peak_days: p.off_peak_days }));
                    }
                  }}
                >
                  <SelectTrigger className="w-[160px] h-8 text-xs">
                    <SelectValue placeholder="Region preset" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="middle_east">Middle East</SelectItem>
                    <SelectItem value="western">Western</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Weekend Days (Premium Rates)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {DAY_NAMES.map((name, idx) => {
                    const isSelected = form.weekend_days.includes(idx);
                    const isConflict = form.off_peak_days.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background border-input hover:bg-accent'
                        }`}
                        onClick={() => {
                          setForm(prev => ({
                            ...prev,
                            weekend_days: isSelected
                              ? prev.weekend_days.filter((d: number) => d !== idx)
                              : [...prev.weekend_days, idx],
                          }));
                        }}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Off-Peak Days (Discounted Rates)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {DAY_NAMES.map((name, idx) => {
                    const isSelected = form.off_peak_days.includes(idx);
                    const isConflict = form.weekend_days.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600'
                            : isConflict
                              ? 'bg-muted text-muted-foreground border-input cursor-not-allowed opacity-50'
                              : 'bg-background border-input hover:bg-accent'
                        }`}
                        disabled={isConflict}
                        onClick={() => {
                          if (isConflict) return;
                          setForm(prev => ({
                            ...prev,
                            off_peak_days: isSelected
                              ? prev.off_peak_days.filter((d: number) => d !== idx)
                              : [...prev.off_peak_days, idx],
                          }));
                        }}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
                {form.off_peak_days.some((d: number) => form.weekend_days.includes(d)) && (
                  <p className="text-xs text-destructive mt-1">Weekend and off-peak days cannot overlap.</p>
                )}
              </div>
            </div>

          </div>
        )}

        {/* STEP 3: Email & Business Settings */}
        {step === 3 && (
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-2">
            <p className="text-sm text-muted-foreground">
              Configure email senders, contact info, guest WiFi, and business defaults. All fields are optional.
            </p>

            {/* Email Addresses */}
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold">Email Addresses</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Reservations Email</Label>
                  <Input type="email" value={form.from_email_reservations} onChange={e => update('from_email_reservations', e.target.value)} placeholder="reservations@yourdomain.com" />
                </div>
                <div>
                  <Label>Front Desk Email</Label>
                  <Input type="email" value={form.from_email_frontdesk} onChange={e => update('from_email_frontdesk', e.target.value)} placeholder="frontdesk@yourdomain.com" />
                </div>
                <div>
                  <Label>Notifications Email</Label>
                  <Input type="email" value={form.from_email_notifications} onChange={e => update('from_email_notifications', e.target.value)} placeholder="notifications@yourdomain.com" />
                </div>
                <div>
                  <Label>Housekeeping Email</Label>
                  <Input type="email" value={form.from_email_housekeeping} onChange={e => update('from_email_housekeeping', e.target.value)} placeholder="housekeeping@yourdomain.com" />
                </div>
                <div>
                  <Label>AI Assistant Email</Label>
                  <Input type="email" value={form.from_email_ai} onChange={e => update('from_email_ai', e.target.value)} placeholder="ai-assistant@yourdomain.com" />
                </div>
                <div>
                  <Label>Display Name (From Name)</Label>
                  <Input value={form.from_name} onChange={e => update('from_name', e.target.value)} placeholder="Your Brand Name" />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold">Contact Information</h3>
              <div className="grid gap-3">
                <div>
                  <Label>Support Email</Label>
                  <Input type="email" value={form.support_email} onChange={e => update('support_email', e.target.value)} placeholder="info@yourdomain.com" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Support Phone</Label>
                    <PhoneInput value={form.support_phone} onChange={v => update('support_phone', v)} placeholder="Support phone" />
                  </div>
                  <div>
                    <Label>WhatsApp Number</Label>
                    <PhoneInput value={form.support_whatsapp} onChange={v => update('support_whatsapp', v)} placeholder="WhatsApp number" />
                  </div>
                </div>
              </div>
            </div>

            {/* Guest WiFi */}
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold">Guest WiFi</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>WiFi Network Name</Label>
                  <Input value={form.wifi_network} onChange={e => update('wifi_network', e.target.value)} placeholder="Guest_WiFi" />
                </div>
                <div>
                  <Label>WiFi Password</Label>
                  <Input value={form.wifi_password} onChange={e => update('wifi_password', e.target.value)} placeholder="••••••••" />
                </div>
              </div>
            </div>

            {/* Business Settings */}
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold">Business Settings</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>VAT Rate (%)</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      value={form.vat_rate}
                      onChange={e => update('vat_rate', e.target.value)}
                      placeholder="14"
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Egypt: 14, UAE: 5, UK: 20</p>
                </div>
                <div>
                  <Label>Default Commission Rate (%)</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      value={form.default_commission_rate}
                      onChange={e => update('default_commission_rate', e.target.value)}
                      placeholder="10"
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Used as the default for manual bookings</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Revenue Settings */}
        {step === 4 && (
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-2">
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold">Revenue Settings</h3>
              <div>
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="revenue-recognition-method">Revenue Recognition Method</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label="About revenue recognition methods"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 text-xs space-y-2">
                      <p>
                        <strong>Upon check-in</strong>: Revenue is recognized on the
                        guest&apos;s check-in date, regardless of check-out date. A guest
                        checking in April 30 and out May 15 books all revenue in April.
                      </p>
                      <p>
                        <strong>Upon check-out</strong>: Revenue is recognized on the
                        check-out date. A guest checking in April 15 and out May 2 books
                        all revenue in May.
                      </p>
                      <p>
                        <strong>Pro-rata nights</strong>: Revenue is split across months
                        based on nights stayed. A guest checking in April 30 and out May
                        3 books 1 night in April and 2 nights in May.
                      </p>
                    </PopoverContent>
                  </Popover>
                </div>
                <Select
                  value={form.revenue_recognition_method}
                  onValueChange={v => update('revenue_recognition_method', v)}
                >
                  <SelectTrigger id="revenue-recognition-method" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="check_in">Upon check-in</SelectItem>
                    <SelectItem value="check_out">Upon check-out</SelectItem>
                    <SelectItem value="prorata">Pro-rata nights</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Success */}
        {step === 5 && (
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
        {step < 5 && (
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
              {step === 1 && (
                <Button onClick={() => { if (validateStep1()) setStep(2); }}>
                  Next <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
              {step === 2 && (
                <Button onClick={() => setStep(3)}>
                  Next <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
              {step === 3 && (
                <Button onClick={() => setStep(4)}>
                  Next <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
              {step === 4 && (
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
