-- supabase-notify.sql
-- READ-ONLY checks for the "Email notifications" feature. Nothing here creates, changes or deletes anything.
--
-- The notification setup needs NO new tables, columns or policies, and supabase.sql is untouched.
-- The two Database Webhooks are created in the dashboard (Database > Webhooks); Supabase turns each one
-- into a trigger for you. Run these queries (SQL Editor > New query) only when you want to check it.

-- 1. Are the two webhooks installed? You should see one trigger on messages and one on requests.
select c.relname as table_name, t.tgname as trigger_name
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('requests', 'messages')
  and not t.tgisinternal
order by 1, 2;

-- 2. What did the webhooks send recently, and what came back? (Supabase keeps these for a short time.)
--    status_code 200 = the function accepted it. 401 = wrong x-webhook-secret. 500/502 = see the function logs.
--    timed_out = true means the webhook timeout is too short: set it to 5000 ms.
select id, status_code, timed_out, error_msg, left(content, 200) as response, created
from net._http_response
order by created desc
limit 10;
