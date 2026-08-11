-- Provider invites create a new auth.users row via admin.generateLink({ type: 'invite',
-- options: { data: { provider_id, display_name, is_provider: true } } }) (see
-- /api/providers/invite). on_auth_user_created previously fired unconditionally for
-- every new auth user, spinning up a brand-new "My Business" + owner `profiles` row for
-- cleaners who were never meant to own a business — a provider's link to a business is
-- the `providers` table (providers.user_id / providers.business_id), not `profiles`.
-- This left orphaned phantom businesses, e.g. Shayne Marie's "My Business"
-- (9c670a77-9a85-4455-b1bf-0a1b5c864a48), cleaned up in this same migration.
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  biz_id uuid;
  biz_slug text;
  biz_name text;
begin
  if coalesce((new.raw_user_meta_data->>'is_provider')::boolean, false)
     or new.raw_user_meta_data->>'role' = 'provider' then
    return new;
  end if;

  biz_name := coalesce(new.raw_user_meta_data->>'business_name', 'My Business');
  biz_slug := lower(regexp_replace(biz_name, '[^a-zA-Z0-9]', '-', 'g')) || '-' || substring(new.id::text, 1, 6);

  insert into businesses (name, slug, booking_url_slug, owner_id, industry)
  values (
    biz_name,
    biz_slug,
    biz_slug,
    new.id,
    coalesce(new.raw_user_meta_data->>'industry', 'residential_cleaning')
  ) returning id into biz_id;

  insert into profiles (id, email, full_name, role, business_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'owner',
    biz_id
  );

  -- Seed default services for residential cleaning
  if (new.raw_user_meta_data->>'industry' = 'residential_cleaning' or new.raw_user_meta_data->>'industry' is null) then
    insert into services (business_id, name, description, pricing_type, base_price, duration_minutes, sort_order)
    values
      (biz_id, 'Standard Clean', 'Regular home cleaning service', 'room_based', 12000, 120, 0),
      (biz_id, 'Deep Clean', 'Thorough deep cleaning of entire home', 'room_based', 22000, 240, 1),
      (biz_id, 'Move-out Clean', 'End of lease / move-out clean', 'flat', 38000, 300, 2),
      (biz_id, 'Office Clean', 'Commercial / office cleaning', 'flat', 20000, 120, 3);
  end if;

  return new;
end;
$$;

-- ─── Cleanup: Shayne Marie's phantom business + profile ────────────────
-- Verified before running: 9c670a77-9a85-4455-b1bf-0a1b5c864a48 has 0 rows in
-- customers, jobs, providers, services, locations, invoices, quotes,
-- discount_codes, recurring_schedules, activity_logs, addresses.
-- Her real providers row (de86301a-f596-4674-8ee6-46ea8eb60188) already points
-- at Clean Freaks (9363c6d5-31c1-4d56-90f4-cf6715eda809) and is untouched.
delete from profiles where id = '3c7da05f-59a5-4bf3-a9f3-58fb0fb1098b';
delete from businesses where id = '9c670a77-9a85-4455-b1bf-0a1b5c864a48';
