/**
 * Shared utility to fetch per-property contact, branding, and business settings.
 * Used by Edge Functions that send emails or interact with Channex on behalf
 * of a specific property. Provides operator-neutral fallbacks so functions
 * never crash when a property is missing or incomplete.
 */

export interface PropertySettings {
  property_name: string;
  from_name: string;
  from_email_reservations: string;
  from_email_frontdesk: string;
  from_email_notifications: string;
  from_email_housekeeping: string;
  from_email_ai: string;
  support_email: string;
  support_phone: string;
  support_whatsapp: string;
  wifi_network: string;
  wifi_password: string;
  vat_rate: number;
  default_commission_rate: number;
  // Address / Channex fields
  address: string;
  city: string;
  zip_code: string;
  country: string;
  phone: string;
  email: string;
  timezone: string;
  currency: string;
  latitude: number | null;
  longitude: number | null;
}

const GENERIC_FROM_EMAIL = 'notifications@hostbase.io';

function buildFallback(name: string = 'Your Property'): PropertySettings {
  return {
    property_name: name,
    from_name: name,
    from_email_reservations: GENERIC_FROM_EMAIL,
    from_email_frontdesk: GENERIC_FROM_EMAIL,
    from_email_notifications: GENERIC_FROM_EMAIL,
    from_email_housekeeping: GENERIC_FROM_EMAIL,
    from_email_ai: GENERIC_FROM_EMAIL,
    support_email: '',
    support_phone: '',
    support_whatsapp: '',
    wifi_network: '',
    wifi_password: '',
    vat_rate: 0,
    default_commission_rate: 10,
    address: '',
    city: '',
    zip_code: '',
    country: 'EG',
    phone: '',
    email: '',
    timezone: 'UTC',
    currency: 'USD',
    latitude: null,
    longitude: null,
  };
}

export async function getPropertySettings(
  supabase: any,
  propertyId: string | null | undefined
): Promise<PropertySettings> {
  if (!propertyId) {
    return buildFallback();
  }

  try {
    const { data, error } = await supabase
      .from('properties')
      .select(
        'name, from_name, from_email_reservations, from_email_frontdesk, from_email_notifications, from_email_housekeeping, from_email_ai, support_email, support_phone, support_whatsapp, wifi_network, wifi_password, vat_rate, default_commission_rate, address, city, zip_code, country, phone, email, timezone, currency, latitude, longitude'
      )
      .eq('id', propertyId)
      .maybeSingle();

    if (error) {
      console.error('[getPropertySettings] Query error:', error.message);
      return buildFallback();
    }
    if (!data) {
      return buildFallback();
    }

    const name = data.name || 'Your Property';

    return {
      property_name: name,
      from_name: data.from_name || name,
      from_email_reservations: data.from_email_reservations || GENERIC_FROM_EMAIL,
      from_email_frontdesk: data.from_email_frontdesk || GENERIC_FROM_EMAIL,
      from_email_notifications: data.from_email_notifications || GENERIC_FROM_EMAIL,
      from_email_housekeeping: data.from_email_housekeeping || GENERIC_FROM_EMAIL,
      from_email_ai: data.from_email_ai || GENERIC_FROM_EMAIL,
      support_email: data.support_email || '',
      support_phone: data.support_phone || '',
      support_whatsapp: data.support_whatsapp || '',
      wifi_network: data.wifi_network || '',
      wifi_password: data.wifi_password || '',
      vat_rate: typeof data.vat_rate === 'number' ? data.vat_rate : 0,
      default_commission_rate:
        typeof data.default_commission_rate === 'number' ? data.default_commission_rate : 10,
      address: data.address || '',
      city: data.city || '',
      zip_code: data.zip_code || '',
      country: data.country || 'EG',
      phone: data.phone || '',
      email: data.email || '',
      timezone: data.timezone || 'UTC',
      currency: data.currency || 'USD',
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
    };
  } catch (err: any) {
    console.error('[getPropertySettings] Exception:', err?.message || err);
    return buildFallback();
  }
}
