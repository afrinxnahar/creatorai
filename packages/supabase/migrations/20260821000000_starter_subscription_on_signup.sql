-- =====================================================================
-- Give every new user their Starter subscription row at signup.
-- ---------------------------------------------------------------------
-- Until now handle_new_user() created only the profile, and the Starter
-- subscriptions row was created lazily as a side effect of the first
-- GET /billing/info (billing.service.ts getBillingInfo). Everything that
-- resolves a user's plan reads `subscriptions` joined to `plans` -- dubbing's
-- canDub(), video generation, research limits -- so on a brand-new account any
-- of those can run BEFORE billing/info has been called and see no plan at all.
-- Dubbing then fails closed and shows an upgrade wall to a user whose plan
-- allows dubbing; a refresh "fixes" it, which is why it never reproduces.
--
-- Fixing it at the signup trigger closes it once for every reader instead of
-- teaching each feature to guess at the missing row. getBillingInfo's lazy
-- insert stays as-is: it is now a no-op for new users and still backfills any
-- old account this migration cannot see.
--
-- Starter = the free plan (price 0). Prefer price over name so a rename cannot
-- break signup (same rule downgrade_expired_subscriptions and
-- billing.service.getStarterPlan use).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  starter_id uuid;
begin
  insert into public.profiles (id, user_id, name, email, ai_trained)
  values (new.id, new.id, new.raw_user_meta_data->>'name', new.email, false);

  select id into starter_id
  from public.plans
  where price_monthly = 0
  order by credits_monthly desc
  limit 1;

  -- No free plan configured is a misconfiguration, not a reason to fail signup.
  if starter_id is null then
    raise log 'handle_new_user: no free/Starter plan found, skipping subscription for %', new.id;
    return new;
  end if;

  insert into public.subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
  values (new.id, starter_id, 'active', now(), null);

  return new;
end;
$function$;

-- Backfill: existing accounts that never loaded billing/info have no row either.
INSERT INTO public.subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
SELECT p.user_id, s.id, 'active', now(), null
FROM public.profiles p
CROSS JOIN LATERAL (
  SELECT id FROM public.plans WHERE price_monthly = 0 ORDER BY credits_monthly DESC LIMIT 1
) s
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscriptions sub
  WHERE sub.user_id = p.user_id
    AND sub.status IN ('active', 'on_trial', 'past_due')
);
