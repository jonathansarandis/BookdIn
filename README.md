# Cleanly — Setup Guide

## Step 1 — Install dependencies

Open your terminal, navigate to this folder, and run:

```bash
npm install
```

---

## Step 2 — Set up Supabase database

1. Go to https://supabase.com and sign in
2. Click **New Project** — name it "cleanly", choose a region close to you
3. Wait for it to start (~1 minute)
4. Go to **SQL Editor** (left sidebar)
5. Click **New query**
6. Open the file `src/lib/supabase/schema.sql` from this project
7. Copy the entire contents and paste into the SQL editor
8. Click **Run** — you should see "Success"

---

## Step 3 — Get your Supabase API keys

1. In Supabase, go to **Settings → API**
2. Copy:
   - **Project URL** → paste as `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → paste as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → paste as `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 4 — Set up Stripe

1. Go to https://dashboard.stripe.com
2. Create an account (free)
3. Go to **Developers → API keys**
4. Copy:
   - **Publishable key** → paste as `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - **Secret key** → paste as `STRIPE_SECRET_KEY`

> Leave `STRIPE_WEBHOOK_SECRET` blank for now — we'll set this up in Module 7

---

## Step 5 — Set up Resend (email)

1. Go to https://resend.com and create a free account
2. Go to **API Keys → Create API Key**
3. Copy the key → paste as `RESEND_API_KEY`
4. Set `RESEND_FROM_EMAIL` to any email for now (e.g. `bookings@yourdomain.com`)

---

## Step 6 — Fill in your .env.local

Open `.env.local` in this folder and replace the placeholder values with your real keys.

---

## Step 7 — Run the app

```bash
npm run dev
```

Then open http://localhost:3000 in your browser.

You should see the login page. Click "Start free" to create your account!

---

## What's built so far (Module 01)

- ✅ Full project structure
- ✅ Auth (login + signup with business setup)
- ✅ Onboarding wizard
- ✅ Dashboard layout (sidebar + topbar)
- ✅ Dashboard home (stats + today's jobs + live activity)
- ✅ Complete database schema (all tables, RLS, triggers)
- ✅ TypeScript types for everything

## Coming next (Module 02)

- Services & pricing management
- Booking form with live price calculator
- Customer creation
- Jobs list and job detail pages
