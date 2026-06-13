export interface Service {
  id: string
  name: string
  description?: string | null
  pricing_type: 'flat' | 'room_based'
  base_price: number
  service_extras: ServiceExtra[]
}

export interface ServiceExtra {
  id: string
  name: string
  description?: string | null
  price: number
  is_active: boolean
  is_popular: boolean
  is_quote_only: boolean
  is_quantifiable: boolean
}

export interface Business {
  id: string
  name: string
  logo_url?: string | null
  brand_color?: string | null
  tax_rate?: number
  tax_name?: string
  show_tax?: boolean
  tax_mode?: 'inclusive' | 'exclusive'
  tnc_url?: string | null
}

export interface FrequencyDiscount {
  frequency: string
  discount_percent: number
  is_enabled: boolean
}

export interface RoomPricing {
  type: 'bedroom' | 'bathroom'
  count: number
  price: number
}

// Value types

export type ServicePickerValue = string | null

export interface RoomCountsValue {
  bedrooms: number | null
  bathrooms: number | null
}

export type ExtrasPickerValue = Record<string, number>  // extra_id → quantity; absent = unselected

export type FrequencyPickerValue = 'one_time' | 'weekly' | 'fortnightly' | 'monthly'

export interface DateTimeValue {
  scheduled_date: string
  scheduled_time: string
  is_flexible: boolean
}

export interface AddressValue {
  line1: string
  city: string
  state: string
  postcode: string
}

export interface ContactInfoValue {
  full_name: string
  email: string
  phone: string
  customer_notes: string
}

export type TncCheckboxValue = boolean

// Generic prop shape
export interface BuiltinFieldProps<TValue, TContext = Record<string, never>> {
  value: TValue
  onChange: (newValue: TValue) => void
  context: TContext
  disabled?: boolean
}

// Shared style constants
export const INPUT_CLASS =
  'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-color)] focus:border-transparent'
export const LABEL_CLASS = 'block text-xs font-medium text-gray-600 mb-1.5'

export const FREQUENCIES: { value: FrequencyPickerValue; label: string }[] = [
  { value: 'one_time', label: 'One-time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
]
