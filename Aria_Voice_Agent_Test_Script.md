# Aria Test Call Script

Purpose: put Aria through a spread of realistic and awkward calls so we can find where she still sounds robotic, gives wrong info, or drops the ball on a booking — before real customers hit those spots.

## How to run this

- Use a different phone each time if you can, and mix up who's calling (you, Reyan, someone she hasn't "heard" before) — voices and phrasing vary and that's part of the test.
- Run one scenario per call. Don't chain multiple tests into one call — makes it harder to isolate what broke.
- Actually let her finish the booking where the scenario calls for it (don't hang up early) so you can check the booking landed correctly in BookdIn afterwards — right date/time, right service, right price, right customer details.
- Note pass/fail plus anything that sounded off, even if it's not a hard fail (tone, pacing, word choice). Use the scorecard at the bottom.
- Re-run the exact scenario that failed last time first, to confirm each fix actually worked, before moving on to new ones.

---

## 1. Straightforward booking (baseline)

**Say:** Ask for a standard clean, give bedrooms/bathrooms/suburb when asked, agree to the first date/time offered.

**Check for:**
- One question at a time — no "how many bedrooms, bathrooms, and do you need carpets done?" all in one breath.
- Correct price quoted for that combination.
- Booking actually created with the right details.

## 2. Recurring customer (fortnightly/monthly)

**Say:** Ask for fortnightly or monthly cleaning instead of a one-off.

**Check for:**
- She catches the frequency and it's reflected correctly (not booked as a one-off).
- She still asks the same discovery questions (bedrooms, bathrooms, pets, etc.) rather than skipping them because it's recurring.

## 3. End of lease / bond clean

**Say:** "I'm moving out, need a bond clean."

**Check for:**
- She mentions the bond-back guarantee naturally, not bolted on.
- She asks about carpets, and anything lease-specific (oven, windows) if that's part of the EOL scope.
- Doesn't sound like she's reading off a card — should feel like reassurance, not a disclaimer.

## 4. Fully booked day (the big one to re-test)

**Say:** Ask for a date you know is already fully booked.

**Check for:**
- She must NOT say "fully booked" / "no availability."
- Correct phrasing: something like "we're quite full that day — would another day work? If not, I can check if we can move something around and get back to you."
- She still takes the booking for the preferred date/time if you push back and say you'd like to keep that date anyway.
- Confirm afterwards that the booking actually landed in BookdIn for follow-up, not silently dropped.

## 5. Price shopping / haggling

**Say:** "That sounds expensive, can you do it cheaper?" or "[Competitor] quoted me less."

**Check for:**
- She holds the price, doesn't invent a discount.
- She stays warm and doesn't get defensive or robotic ("I understand, our price reflects..." is fine — a flat refusal or over-apologizing is not).
- If she can't resolve it, does she offer to have the team call back / transfer, rather than getting stuck?

## 6. Vague / indecisive caller

**Say:** Answer her questions with "I'm not sure," "whatever's normal," "you tell me" a few times in a row.

**Check for:**
- She offers a sensible default or asks a simplifying follow-up, rather than stalling or looping the same question.
- Doesn't produce dead air or repeated filler while "figuring out" what to do.

## 7. Caller dumps all info at once, unprompted

**Say, all in one go:** "Hi, I need a 3 bed 2 bath clean in [suburb], no pets, no carpets, fortnightly, next Tuesday morning."

**Check for:**
- She doesn't rigidly re-ask for details she already has.
- She correctly extracts and confirms everything before quoting a price.

## 8. Rapid back-to-back questions

**Say:** "What's your availability this week?" → immediately → "How much would that cost?" → immediately → "Okay, book it in."

**Check for:**
- No repeated "one moment, just a sec" stacking up between each answer.
- She keeps context across the three questions without re-asking things you already told her.

## 9. Outside service area

**Say:** Give a suburb we don't cover (e.g., somewhere in Brisbane or regional).

**Check for:**
- She recognises it's outside Melbourne/Perth/Adelaide/Sydney coverage and says so clearly, rather than quoting a price or booking anyway.
- Offers a sensible next step (take details for the team, or politely decline) instead of going quiet or looping.

## 10. Wants a human immediately

**Say:** "Can I just speak to a real person?" right at the start.

**Check for:**
- She hands off cleanly (transfer_to_human) without arguing or trying to keep the whole call herself.
- If transfer isn't possible after hours, she says so plainly and offers a callback rather than pretending to transfer.

## 11. Complaint / existing booking issue

**Say:** "I need to change/cancel my booking from last week" or "I had an issue with my last clean."

**Check for:**
- She doesn't try to handle this herself with the wrong tools (she's built for new bookings, not managing existing ones/complaints).
- Escalates to a human / takes a message cleanly.

## 12. Talking over her / interruptions

**Say:** Cut her off mid-sentence a couple of times, e.g. start talking again before she finishes a question.

**Check for:**
- She handles the interruption gracefully — doesn't restart her sentence from scratch or ignore what you said.
- Doesn't sound like it broke her flow into repeating filler.

## 13. Silence / caller distracted

**Say:** Go quiet for 5-10 seconds mid-call (background noise is fine, just don't answer).

**Check for:**
- She checks in naturally ("still there?" / "take your time") instead of repeating the same line on a loop or hanging up abruptly.

## 14. Multi-service combo pricing

**Say:** Ask for a deep clean AND carpet cleaning AND balcony in the same call.

**Check for:**
- Price reflects all three correctly, not just one service.
- She still asks discovery questions relevant to each add-on rather than skipping them.

## 15. Background noise / hard to hear

**Say:** Call from somewhere noisier than usual, or mumble a detail.

**Check for:**
- She asks for clarification naturally rather than guessing wrong and barrelling ahead with incorrect details.

---

## Scorecard

| # | Scenario | Pass/Fail | Notes |
|---|----------|-----------|-------|
| 1 | Straightforward booking | | |
| 2 | Recurring customer | | |
| 3 | End of lease / bond clean | | |
| 4 | Fully booked day | | |
| 5 | Price shopping | | |
| 6 | Vague / indecisive caller | | |
| 7 | Info dump upfront | | |
| 8 | Rapid back-to-back questions | | |
| 9 | Outside service area | | |
| 10 | Wants a human immediately | | |
| 11 | Complaint / existing booking | | |
| 12 | Talking over her | | |
| 13 | Silence / distracted caller | | |
| 14 | Multi-service combo pricing | | |
| 15 | Background noise | | |

After each round, send me the notes on anything that failed or sounded off — I'll trace it back to the system prompt or the specific tool response and fix it before the next round.
