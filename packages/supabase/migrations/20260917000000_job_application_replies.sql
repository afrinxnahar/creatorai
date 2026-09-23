-- Admins reply to candidates from the Emails section, sent from the support
-- mailbox. Record when and by whom so the list shows who was already contacted
-- and nobody gets the same mail twice.

alter table public.job_applications
  add column if not exists replied_at timestamptz,
  add column if not exists replied_by uuid;
