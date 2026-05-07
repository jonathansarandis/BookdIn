// @ts-nocheck
// Auto-generated types for BookdIn database schema
// Run `npm run db:generate` to regenerate after schema changes

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type JobStatus =
  | 'pending' | 'confirmed' | 'assigned' | 'on_the_way'
  | 'in_progress' | 'completed' | 'cancelled' | 'rescheduled' | 'no_show'

export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired'
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void'
export type UserRole = 'owner' | 'admin' | 'staff' | 'provider' | 'customer'
export type PricingType = 'fixed' | 'hourly' | 'room_based' | 'sqft_based' | 'custom'
export type FrequencyType = 'one_time' | 'weekly' | 'fortnightly' | 'monthly' | 'custom'
export type PaymentMethod = 'charge_now' | 'hold_card' | 'deposit' | 'pay_later' | 'invoice'

export interface Database {
  public: {
    Tables: {
      businesses: {
        Row: {
          id: string
          created_at: string
          name: string
          slug: string
          logo_url: string | null
          brand_color: string
          industry: string
          timezone: string
          currency: string
          owner_id: string
          stripe_account_id: string | null
          stripe_onboarded: boolean
          resend_domain: string | null
          booking_url_slug: string
          service_area_description: string | null
          cancellation_policy: string | null
          default_payment_method: PaymentMethod
          tax_rate: number
          tax_name: string
          show_tax: boolean
          tax_mode: string
          contact_email: string | null
          plan: string
        }
        Insert: Omit<Database['public']['Tables']['businesses']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['businesses']['Insert']>
      }

      profiles: {
        Row: {
          id: string
          created_at: string
          email: string
          full_name: string
          phone: string | null
          avatar_url: string | null
          role: UserRole
          business_id: string | null
          onboarding_complete: boolean
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }

      customers: {
        Row: {
          id: string
          created_at: string
          business_id: string
          email: string
          full_name: string
          phone: string | null
          notes: string | null
          tags: string[]
          stripe_customer_id: string | null
          referral_code: string | null
          referred_by: string | null
          lifetime_value: number
          total_bookings: number
          last_booking_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at' | 'lifetime_value' | 'total_bookings'>
        Update: Partial<Database['public']['Tables']['customers']['Insert']>
      }

      addresses: {
        Row: {
          id: string
          customer_id: string
          business_id: string
          label: string | null
          line1: string
          line2: string | null
          city: string
          state: string
          postcode: string
          country: string
          notes: string | null
          is_default: boolean
        }
        Insert: Omit<Database['public']['Tables']['addresses']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['addresses']['Insert']>
      }

      services: {
        Row: {
          id: string
          created_at: string
          business_id: string
          name: string
          description: string | null
          pricing_type: PricingType
          base_price: number
          duration_minutes: number
          min_price: number | null
          travel_fee: number
          same_day_fee: number
          weekend_fee: number
          tax_included: boolean
          is_active: boolean
          sort_order: number
        }
        Insert: Omit<Database['public']['Tables']['services']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['services']['Insert']>
      }

      service_extras: {
        Row: {
          id: string
          service_id: string
          business_id: string
          name: string
          description: string | null
          price: number
          duration_minutes: number
          is_active: boolean
          sort_order: number
          is_popular: boolean
          is_quote_only: boolean
        }
        Insert: Omit<Database['public']['Tables']['service_extras']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['service_extras']['Insert']>
      }

      frequency_discounts: {
        Row: {
          id: string
          service_id: string
          frequency: FrequencyType
          discount_percent: number
        }
        Insert: Omit<Database['public']['Tables']['frequency_discounts']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['frequency_discounts']['Insert']>
      }

      providers: {
        Row: {
          id: string
          created_at: string
          business_id: string
          profile_id: string
          display_name: string
          email: string
          phone: string | null
          color: string
          is_active: boolean
          accept_jobs: boolean
          notes: string | null
        }
        Insert: Omit<Database['public']['Tables']['providers']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['providers']['Insert']>
      }

      jobs: {
        Row: {
          id: string
          created_at: string
          business_id: string
          customer_id: string
          address_id: string
          service_id: string
          provider_id: string | null
          status: JobStatus
          scheduled_at: string
          duration_minutes: number
          price: number
          tax_amount: number
          notes: string | null
          customer_notes: string | null
          booking_source: string
          frequency: FrequencyType
          recurring_schedule_id: string | null
          stripe_payment_intent_id: string | null
          invoice_id: string | null
          completed_at: string | null
          bedrooms: number | null
          bathrooms: number | null
          total_price: number
          payment_status: string | null
          payment_method: string | null
          paid_at: string | null
          confirmation_email_sent_at: string | null
          receipt_email_sent_at: string | null
          cancellation_email_sent_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['jobs']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['jobs']['Insert']>
      }

      job_extras: {
        Row: {
          id: string
          job_id: string
          extra_id: string
          name: string
          price: number
        }
        Insert: Omit<Database['public']['Tables']['job_extras']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['job_extras']['Insert']>
      }

      recurring_schedules: {
        Row: {
          id: string
          created_at: string
          business_id: string
          customer_id: string
          service_id: string
          address_id: string
          provider_id: string | null
          frequency: FrequencyType
          next_scheduled_at: string
          is_active: boolean
          paused_until: string | null
          price: number
          auto_charge: boolean
          notes: string | null
        }
        Insert: Omit<Database['public']['Tables']['recurring_schedules']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['recurring_schedules']['Insert']>
      }

      invoices: {
        Row: {
          id: string
          created_at: string
          business_id: string
          customer_id: string
          job_id: string | null
          status: InvoiceStatus
          subtotal: number
          tax_amount: number
          total: number
          due_date: string | null
          paid_at: string | null
          stripe_payment_intent_id: string | null
          notes: string | null
          sent_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['invoices']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['invoices']['Insert']>
      }

      quotes: {
        Row: {
          id: string
          created_at: string
          business_id: string
          customer_id: string
          status: QuoteStatus
          subtotal: number
          tax_amount: number
          total: number
          valid_until: string | null
          notes: string | null
          sent_at: string | null
          viewed_at: string | null
          accepted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['quotes']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['quotes']['Insert']>
      }

      discount_codes: {
        Row: {
          id: string
          created_at: string
          business_id: string
          code: string
          type: 'fixed' | 'percent'
          value: number
          min_order: number | null
          first_time_only: boolean
          max_uses: number | null
          uses_count: number
          expires_at: string | null
          service_id: string | null
          is_active: boolean
        }
        Insert: Omit<Database['public']['Tables']['discount_codes']['Row'], 'id' | 'created_at' | 'uses_count'>
        Update: Partial<Database['public']['Tables']['discount_codes']['Insert']>
      }

      activity_logs: {
        Row: {
          id: string
          created_at: string
          business_id: string
          actor_id: string | null
          actor_name: string | null
          event_type: string
          description: string
          metadata: Json | null
          entity_type: string | null
          entity_id: string | null
        }
        Insert: Omit<Database['public']['Tables']['activity_logs']['Row'], 'id' | 'created_at'>
        Update: never
      }
    }
  }
}

// Convenience types used throughout the app
export type Business = Database['public']['Tables']['businesses']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Customer = Database['public']['Tables']['customers']['Row']
export type Address = Database['public']['Tables']['addresses']['Row']
export type Service = Database['public']['Tables']['services']['Row']
export type ServiceExtra = Database['public']['Tables']['service_extras']['Row']
export type Provider = Database['public']['Tables']['providers']['Row']
export type Job = Database['public']['Tables']['jobs']['Row']
export type Invoice = Database['public']['Tables']['invoices']['Row']
export type Quote = Database['public']['Tables']['quotes']['Row']
export type DiscountCode = Database['public']['Tables']['discount_codes']['Row']
export type ActivityLog = Database['public']['Tables']['activity_logs']['Row']

// Extended types with joined data
export type JobWithDetails = Job & {
  customer: Customer
  address: Address
  service: Service
  provider: Provider | null
  extras: Array<Database['public']['Tables']['job_extras']['Row']>
}

export type CustomerWithStats = Customer & {
  addresses: Address[]
  recent_jobs: Job[]
}
