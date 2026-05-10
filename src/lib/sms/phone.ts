/**
 * Normalize an Australian phone number to E.164 format (+61...).
 * Returns null if the number can't be confidently normalized.
 *
 * Accepts:
 *   "0421240111"      -> "+61421240111"
 *   "0421 240 111"    -> "+61421240111"
 *   "+61421240111"    -> "+61421240111"  (already E.164)
 *   "61421240111"     -> "+61421240111"
 *   "421240111"       -> "+61421240111"  (assume mobile if 9 digits starting with 4)
 *   "(02) 9876 5432"  -> "+61298765432"  (Sydney landline)
 *
 * Rejects:
 *   ""                -> null
 *   "12345"           -> null  (too short)
 *   "+1234567890"     -> null  (non-AU country code)
 *
 * Note: this is AU-only for now. When supporting other countries, we'll add
 * a country parameter and dispatch.
 */
export function normalizeAuPhone(input: string): string | null {
  if (!input) return null

  // Strip everything except digits and leading +
  const cleaned = input.trim().replace(/[^\d+]/g, '')
  if (!cleaned) return null

  // Already E.164 with AU country code
  if (cleaned.startsWith('+61')) {
    const digits = cleaned.slice(3)
    if (digits.length === 9) return `+61${digits}`
    return null
  }

  // E.164 with non-AU country code -- reject
  if (cleaned.startsWith('+')) return null

  // 61... (country code without +)
  if (cleaned.startsWith('61') && cleaned.length === 11) {
    return `+${cleaned}`
  }

  // 0... (Australian local trunk prefix)
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return `+61${cleaned.slice(1)}`
  }

  // 4... (9 digits, likely mobile without 0 prefix)
  if (cleaned.length === 9 && cleaned.startsWith('4')) {
    return `+61${cleaned}`
  }

  // 2,3,7,8 with 9 digits (landline area codes without 0 prefix)
  if (cleaned.length === 9 && /^[2378]/.test(cleaned)) {
    return `+61${cleaned}`
  }

  return null
}
