create table public.budget (
 id smallint primary key check (id=1),
 cap_usd numeric not null default 0 check (cap_usd between 0 and 40),
 reserved_usd numeric not null default 0 check (reserved_usd >= 0),
 settled_usd numeric not null default 0 check (settled_usd >= 0),
 status text not null default 'disabled' check (status in ('disabled','active')),
 check (reserved_usd + settled_usd <= cap_usd)
);
insert into public.budget (id,cap_usd,status) values (1,0,'disabled');

create function public.reserve_call_budget(request_id uuid, operator_id uuid, max_usd numeric, metadata jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.budget%rowtype;
begin
 if max_usd::text in ('NaN','Infinity','-Infinity') or max_usd < 0 or max_usd > 40 then raise exception 'invalid_reservation'; end if;
 select * into b from public.budget where id=1 for update;
 if not found or b.status <> 'active' or b.cap_usd <= 0 or b.reserved_usd+b.settled_usd+max_usd>b.cap_usd then raise exception 'budget_refused'; end if;
 insert into public.call_ledger (id,run_id,request_id,operator_id,provider,model,prompt_sha256,input_turn_ids,input_units,reserved_usd,status)
 values ((metadata->>'id')::uuid,metadata->>'run_id',request_id,operator_id,metadata->>'provider',metadata->>'model',metadata->>'prompt_sha256',
 array(select jsonb_array_elements_text(metadata->'input_turn_ids')),(metadata->>'input_units')::integer,max_usd,'reserved');
 update public.budget set reserved_usd=reserved_usd+max_usd where id=1;
end $$;

create function public.settle_call(request_id uuid,usage_json jsonb,settled_usd numeric,final_status text,latency_ms integer)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.call_ledger%rowtype; charge numeric;
begin
 perform 1 from public.budget where id=1 for update;
 select * into r from public.call_ledger l where l.request_id=settle_call.request_id for update;
 if not found or r.status<>'reserved' then raise exception 'unknown_or_settled_request'; end if;
 charge:=case when usage_json is null or final_status in ('failed','timeout') then r.reserved_usd else settled_usd end;
 if final_status not in ('settled','failed','timeout') or charge is null or charge::text in ('NaN','Infinity','-Infinity') or charge<0 or charge>r.reserved_usd or latency_ms<0 then raise exception 'invalid_settlement'; end if;
 update public.call_ledger l set settled_usd=charge,usage_json=settle_call.usage_json,status=final_status,latency_ms=settle_call.latency_ms where l.request_id=settle_call.request_id;
 update public.budget set reserved_usd=reserved_usd-r.reserved_usd,settled_usd=budget.settled_usd+charge where id=1;
end $$;
