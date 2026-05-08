export interface BookingConfirmationSections {
  greeting: string
  details_intro: string
  extras_note_heading: string
  extras_note_body: string
  payment_heading: string
  payment_body: string
  payment_disclosure: string
  cancellation_heading: string
  cancellation_body: string
  walkthrough_heading: string
  walkthrough_body: string
  sign_off: string
}

export const DEFAULT_BOOKING_CONFIRMATION: BookingConfirmationSections = {
  greeting: "Hi {{customer_name}},\nGreat news! Your booking is confirmed and your team is reserved. We're looking forward to taking care of your property.\nPlease ensure all the details are correct, we will make contact with you prior to arrival",

  details_intro: "",

  extras_note_heading: "A NOTE ON EXTRAS",
  extras_note_body: "Your package covers everything listed above. On occasion properties need a little extra attention in specific areas, things like spot cleaning marked walls, glass window surfaces, balcony clean or wet wiping blinds. If anything like this applies to your property, we'll always let you know the cost before we start. No surprises.",

  payment_heading: "SECURING YOUR BOOKING",
  payment_body: "To lock in your booking date and team, please add your payment details via the secure link below. Your card will not be charged until your service is completed.",
  payment_disclosure: "A pre-authorisation will be processed one day before your appointment to reserve the funds, this is not a charge. Once your clean is complete, the final amount will be processed.",

  cancellation_heading: "CANCELLATION POLICY",
  cancellation_body: "We hold your spot and assign a dedicated team to every booking, so we ask that any cancellations or reschedules be made before {{cancellation_cutoff}} the day prior to your appointment. Cancellations after this time incur a {{cancellation_fee}} fee.",

  walkthrough_heading: "WALKTHROUGH AT COMPLETION",
  walkthrough_body: "{{business_name}} requires you to be present at the end of your service for a walkthrough of the property. On the rare occasion of minor missed spots, you will have the opportunity to have them rectified immediately. If you are unable to be present, you forfeit the right to a revisit, refund, or discount.\nBy accepting our services, you confirm that you have read, understood, and agree to abide by all the terms and conditions.",

  sign_off: "Thanks,\n{{business_name}} team",
}

export const AVAILABLE_VARIABLES = [
  { key: 'customer_name',       label: 'Customer name',             example: 'Jonathan Test' },
  { key: 'service_name',        label: 'Service name',              example: 'Move In Clean' },
  { key: 'date',                label: 'Booking date',              example: 'Friday, 15 May 2026' },
  { key: 'arrival_time',        label: 'Arrival time',              example: '9:00 AM' },
  { key: 'address',             label: 'Service address',           example: '220 Spencer St, Melbourne VIC 3000' },
  { key: 'subtotal',            label: 'Subtotal',                  example: '$179.00' },
  { key: 'gst',                 label: 'GST amount',                example: '$17.90' },
  { key: 'total',               label: 'Total',                     example: '$196.90' },
  { key: 'business_name',       label: 'Your business name',        example: 'Clean Freaks' },
  { key: 'cancellation_fee',    label: 'Cancellation fee',          example: '$50' },
  { key: 'cancellation_cutoff', label: 'Cancellation cutoff time',  example: '5 PM' },
]
