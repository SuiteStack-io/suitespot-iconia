import { usePropertySafe } from '@/lib/propertyContext';

/**
 * Hook that provides the active property ID for filtering queries.
 * Returns null if no property context is available (e.g., public pages).
 */
export function usePropertyId(): string | null {
  const ctx = usePropertySafe();
  return ctx?.activeProperty?.id ?? null;
}

/**
 * Helper to apply property_id filter to a Supabase query builder.
 * Uses type coercion since property_id columns are newly added and
 * auto-generated types may not include them yet.
 */
export function withPropertyFilter<T>(query: T, propertyId: string | null): T {
  if (!propertyId) return query;
  return (query as any).eq('property_id', propertyId) as T;
}
