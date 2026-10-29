alter table public.call_ledger enable row level security;
alter table public.budget enable row level security;
revoke all on public.call_ledger,public.budget from anon,authenticated;
revoke all on function public.reserve_call_budget(uuid,uuid,numeric,jsonb) from public,anon,authenticated;
revoke all on function public.settle_call(uuid,jsonb,numeric,text,integer) from public,anon,authenticated;
grant execute on function public.reserve_call_budget(uuid,uuid,numeric,jsonb) to service_role;
grant execute on function public.settle_call(uuid,jsonb,numeric,text,integer) to service_role;
-- No browser mutation or read policies; service_role is used only after verified user authorization.
