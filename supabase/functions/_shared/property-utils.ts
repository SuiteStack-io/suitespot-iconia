/**
 * Shared utility to fetch the property name from the properties table.
 * Falls back to 'SuiteSpot' if property_id is null or not found.
 */
export async function getPropertyName(
  supabase: any,
  propertyId: string | null
): Promise<string> {
  if (!propertyId) return 'SuiteSpot';
  const { data } = await supabase
    .from('properties')
    .select('name')
    .eq('id', propertyId)
    .maybeSingle();
  return data?.name || 'SuiteSpot';
}
