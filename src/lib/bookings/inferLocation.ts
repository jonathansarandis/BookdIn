// Best-effort fallback for booking requests that don't explicitly pass a
// location_id. Maps an Australian state abbreviation to the business's
// location of the matching name (e.g. VIC -> a location named "Melbourne").
// Returns null when no explicit mapping exists, or the business has no
// location with that name — callers should keep their existing
// "location is required" error in that case, not invent a default.
const STATE_TO_LOCATION_NAME: Record<string, string> = {
  VIC: 'Melbourne',
  WA: 'Perth',
  SA: 'Adelaide',
  NSW: 'Sydney',
}

export async function inferLocationIdFromState(
  supabase: any,
  businessId: string,
  state: string | null | undefined,
): Promise<string | null> {
  if (!state) return null
  const locationName = STATE_TO_LOCATION_NAME[state.toUpperCase()]
  if (!locationName) return null

  const { data: location } = await supabase
    .from('locations')
    .select('id')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .ilike('name', locationName)
    .maybeSingle()

  return location?.id ?? null
}
