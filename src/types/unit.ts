/**
 * Centralized Unit type definitions for the application.
 * This file provides consistent typing for unit/room data across all components.
 */

/**
 * Full Unit type with all fields from the database.
 * Use this when you need access to all unit properties.
 */
export interface Unit {
  id: string;
  name: string;
  unit_number: string | null;
  unit_type: string | null;
  unit_size: string | null;
  status: string;
  booking_com_id: string | null;
  booking_com_name: string | null;
  comments: string | null;
  beds: number | null;
  baths: number | null;
  max_guests: number | null;
  sofa_bed: boolean | null;
  price_per_night: number | null;
  weekend_rate: number | null;
  tax_percentage: number | null;
  photos: string[] | null;
  view: string | null;
  location: string | null;
  address: string | null;
  map_description: string | null;
  latitude: number | null;
  longitude: number | null;
  is_private: boolean | null;
  min_stay: number | null;
  estimated_cleaning_minutes: number | null;
  features: string[] | null;
  payment_terms: string | null;
  availability_date: string | null;
  created_at: string;
  updated_at: string;
  // Channex integration fields
  count_of_rooms: number;
  max_children: number;
  max_infants: number;
  default_occupancy: number;
  room_kind: string;
}

/**
 * Partial unit type for components that only need some fields.
 * Guarantees id and name are always present.
 */
export type PartialUnit = Partial<Unit> & Pick<Unit, 'id' | 'name'>;

/**
 * Channex-specific subset for sync operations.
 * Contains only the fields required for Channex room type creation.
 */
export interface ChannexUnit {
  id: string;
  name: string;
  count_of_rooms: number;
  max_guests: number;
  max_children: number;
  max_infants: number;
}

/**
 * Unit data for selection/inventory display.
 * Subset of fields commonly used in guest-facing selection modals.
 */
export interface SelectionUnit {
  id: string;
  name: string;
  booking_com_name: string | null;
  beds: number | null;
  baths: number | null;
  max_guests: number | null;
  photos: string[] | null;
  unit_size: string | null;
  view: string | null;
  address: string | null;
  features: string[] | null;
  min_stay: number | null;
  price_per_night: number | null;
  payment_terms: string | null;
}
