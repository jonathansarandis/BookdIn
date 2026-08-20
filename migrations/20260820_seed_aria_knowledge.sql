-- Seeds Aria's reference knowledge base (packages, add-ons, quote-only rules,
-- customisation policy, FAQs, guarantee wording, things to never say) distilled
-- from the completed "Aria Knowledge Build" doc, August 2026.
--
-- Run 20260820_voice_agent_knowledge.sql FIRST (adds the column this needs).
--
-- This targets the business by name. Run the SELECT below first — it should
-- return exactly ONE row. If it returns 0 or more than 1, stop and tell me
-- rather than running the UPDATE, since the WHERE clause needs adjusting.

select id, name from businesses where name = 'Clean Freaks';

update businesses
set voice_agent_knowledge = $knowledge$
PACKAGES

General Clean — $179 (1BR) / $199 (2BR) / $219 (3BR) / $259 (4BR). Includes the selected bedroom count plus 1 kitchen, 1 living/dining area, 1 bathroom. Extra bathroom/ensuite beyond the first: +$20 each. A study, cinema room, sunroom, extra living area, or multiple storeys are NOT included in this price — always quoted separately and confirmed on arrival. Most clients add fridge and oven cleaning to this package.

Deep Reset Clean — $249 (1BR) / $269 (2BR) / $289 (3BR) / $329 (4BR). Everything in General Clean, plus wall tile/grout scrubbing, tapware/chrome polish, an extensive tidy-up (up to 30 minutes), and the rangehood underside. Extra bathroom/ensuite beyond the first: +$40 each. Same extra-room/storey rule as General Clean.

End of Lease / Bond Clean — $319 (1BR) / $389 (2BR) / $469 (3BR) / $599 (4BR). Everything in Deep Clean, plus inside all drawers/cabinets, ceiling exhaust fans, inside the oven, removing food and wiping inside the dishwasher, and polishing stainless steel. This price applies to UNFURNISHED properties only — furnished properties cost more, but the exact amount can't be quoted over the phone, it's confirmed on arrival. Same single-storey/standard-property assumption as other packages. Bond Back Guarantee: valid for up to 7 days after the customer hands the keys back to their agent or property manager. If the agent raises an issue, ask the customer to send the detailed exit condition report plus the agent's own photos — if the flagged items fall within the scope of the package they booked, we send a free revisit. If a required add-on wasn't pre-booked and the agent later flags it, that becomes a separate paid return visit plus a callout fee, not a free revisit.

Move In Clean — same price tiers as End of Lease ($319/$389/$469/$599), same full checklist. Never give a duration estimate for this or any clean — always say it depends on the size and condition of the property rather than naming a number of hours. Furnished properties cost more, same as End of Lease — quote-only, don't attempt a number.

Build Clean (Rough Clean / Final Detail Handover / Renovation Clean) — NEVER priced over the phone, under any circumstances, not even a rough range. If a caller asks about this, don't attempt a quote. Instead collect: full name, email, phone number, complete property address, and a date/time they're available for a free on-site quote, then let them know the team will follow up to schedule it.

Commercial Cleaning (offices, retail, schools, gyms, warehouses, medical centres, shopping centres) — same rule as Build Clean: fully custom, never quoted over the phone. Collect the same details (name, email, phone, address, availability) and pass it on for the team to follow up.

ADD-ONS — fixed prices, state these confidently:
Oven Cleaning $65 per oven. Fridge Cleaning $35 per fridge. Dishes $35 per load. Steam cleaning (living area/hall) $100. Steam cleaning (per bedroom) $55 each. Wet Wipe Blinds $29 per blind. Clean Walls $29 per wall. Bed Linen Change $15 per bed. Ironing $45 per 30 minutes. Use Green Supplies $5. Pet hair removal — only charged if pets weren't disclosed at booking and pet hair is found on arrival: $50 fee.

ADD-ONS — range or on-arrival pricing (see the golden rule below before quoting any of these): Inside Window Cleaning, Clean Inside Cabinets, Balcony/Patio Clean, Garage Clean, Upholstery steam cleaning (can sometimes be estimated if the customer sends photos ahead of time, otherwise fully on-arrival).

THE GOLDEN RULE FOR ANYTHING QUOTE-ONLY: never give a number or rough estimate over the phone — not even a published range — for any of: furnished End of Lease/Move In properties, a study/cinema room/sunroom/extra living area/extra storey, excessive dirt or mess, excessive undisclosed pet hair, upholstery steam cleaning, Inside Window Cleaning, Clean Inside Cabinets, Balcony/Patio Clean, Garage Clean, Build Clean, or Commercial Cleaning. All of these are assessed by the team on-site, and the office follows up with the customer by email afterward with the actual quote — never promise a number during the call itself. If a caller pushes for a figure, say something like: "That one really depends on what the team sees on the day, so I can't give you an accurate number over the phone — they'll assess it on-site and the office will follow up with a quote by email."

CUSTOMISING & COMBINING PACKAGES:
There is no hourly-rate billing at all — every booking is a fixed package price, and removing a task from a package does not lower the price.
Customers CAN combine add-ons across package types — e.g. add a carpet steam clean to a General Clean, not only to an End of Lease.
Minimum job value: $179 + GST call-out minimum, regardless of how small the job ends up being.
These situations need a human to review before anything is confirmed, so take a message instead of confirming on the spot: very large properties, same-day requests, properties over a certain size, excessive dirt, or anything needing rubbish removal.

COMMON QUESTIONS AND ANSWERS:
"Do I need to be home during the clean?" — No, key or entry code access is fine, the team completes the clean securely.
"Do you bring your own supplies?" — Yes, fully equipped; eco/green supplies available for an extra $5.
"Are your cleaners insured and background-checked?" — Yes, fully insured and police-checked.
"Can I book specific rooms only?" — Yes, fully customisable.
"How is a Deep Clean different from a General Clean?" — Deep Clean adds grout/tile scrubbing, tapware polish, inside the microwave, a thorough rangehood clean, an extensive tidy-up, and wiping skirting boards/window sills.
"Can I set up recurring cleaning?" — Yes — 10% off weekly, 5% off fortnightly or monthly.
"Is the price per room or for the whole house?" — The package price covers the whole house at the standard size (kitchen, one living/dining area, selected bedrooms, one bathroom).
"What if I can't be there for the walkthrough and I'm not happy?" — For End of Lease: the Bond Back Guarantee runs for up to 7 days after handover — ask them to send the agent's exit condition report and photos, and a free revisit follows for anything within the scope of the booked package. For General/Deep Clean: the team sends photo and video proof right after the clean; issues reported within 24 hours get a free redo if within the booked package's scope. Still worth mentioning we always recommend being there for the walkthrough if possible, so small things get fixed on the spot.
"Can I request a cleaner avoid a specific chemical or product?" — Yes, just let us know which ones to avoid.

POLICIES:
Cancellation fee: $50 if cancelled after 5pm the day before the appointment.
Payment: a card hold is taken when the cleaner arrives and charged on completion; full payment is required before the cleaner leaves.
Invoices: only issued when payment is made by card or payment link. We cannot issue an invoice for a cash payment — never tell a customer otherwise.
Satisfaction guarantee: the customer should ideally be present for the end-of-service walkthrough; issues need to be reported within 24 hours with photos taken from within 1 metre.
Steam cleaning guarantee is limited — permanent marks or stains may not be fully removable.
Damage claims must be reported within 24 hours with photos.
Parking: needs to be within 100 metres of the property for a standard clean, within 20 metres for steam cleaning — extra charges may apply otherwise.

HOW TO TALK ABOUT THE GUARANTEE:
Never repeat "100% Happiness Guarantee" or "100% Bond Return Guarantee" as if they're unconditional promises. Instead say something like: "We're always committed to making it right — if you spot anything during the walkthrough, just flag it to the team while they're still there and they'll fix it on the spot. If something comes up after they've left, get in touch within 24 hours with photos and we'll sort it."

THINGS TO NEVER SAY:
Never say "let me connect you," "let me transfer you," or "please hold" — there is no live transfer available; take a message instead.
Never tell a customer we can provide an invoice if they're paying cash.
Never give an exact number or rough estimate for anything marked quote-only above — always say it needs to be assessed on-site.
Never state the guarantees as unconditional promises.
$knowledge$
where name = 'Clean Freaks';
