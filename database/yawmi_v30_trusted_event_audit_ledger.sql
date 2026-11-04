-- YAWMI V30: server-owned append-only event audit and verified daily competitive snapshots.
-- The client can still self-report activity; the ledger cannot prove offline real-world work.
create table if not exists public.yawmi_verified_activity(
 season_id integer not null references public.yawmi_seasons(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 activity_day date not null,
 points integer not null default 0 check(points between 0 and 400),
 tasks_count integer not null default 0 check(tasks_count between 0 and 8),
 habits_count integer not null default 0 check(habits_count between 0 and 8),
 focus_minutes integer not null default 0 check(focus_minutes between 0 and 120),
 source_revision bigint not null default 0,
 verified_at timestamptz not null default now(),
 primary key(season_id,user_id,activity_day)
);
create index if not exists yawmi_verified_activity_user_day_idx on public.yawmi_verified_activity(user_id,activity_day);
create table if not exists public.yawmi_activity_audit(
 id bigint generated always as identity primary key,
 season_id integer not null references public.yawmi_seasons(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 activity_day date not null,
 source_revision bigint not null,
 before_points integer not null,
 after_points integer not null,
 delta integer not null,
 source text not null check(source in ('legacy_import','document_write')),
 created_at timestamptz not null default now(),
 unique(season_id,user_id,activity_day,source_revision)
);
create index if not exists yawmi_activity_audit_user_time on public.yawmi_activity_audit(user_id,created_at desc);
alter table public.yawmi_verified_activity enable row level security;
alter table public.yawmi_activity_audit enable row level security;
revoke all on public.yawmi_verified_activity,public.yawmi_activity_audit from public,anon,authenticated;

-- Derive a bounded metric tuple from one saved document. IDs are de-duplicated.
create or replace function public.yawmi_competitive_day_metrics(p_doc jsonb,p_day date)
returns jsonb language plpgsql stable set search_path='' as $$
declare
 r jsonb:=coalesce(p_doc->'daily'->(p_day::text),'{}'::jsonb);
 t int:=0;h int:=0;f int:=0;score int:=0;
begin
 if jsonb_typeof(p_doc->'tasks')='array' and jsonb_typeof(r->'tasks')='object' then
  select least(8,count(distinct x->>'id'))::int into t
  from jsonb_array_elements(p_doc->'tasks') x
  where nullif(x->>'id','') is not null and r->'tasks'->>(x->>'id')='true';
 end if;
 if jsonb_typeof(p_doc->'habits')='array' and jsonb_typeof(r->'habits')='object' then
  select least(8,count(distinct x->>'id'))::int into h
  from jsonb_array_elements(p_doc->'habits') x
  where nullif(x->>'id','') is not null
    and (x->>'active') is distinct from 'false'
    and (r->'habits'->>(x->>'id')) ~ '^[0-9]+(\.[0-9]+)?$'
    and case when length(coalesce(r->'habits'->>(x->>'id'),''))<15
    then (r->'habits'->>(x->>'id'))::numeric >=
      case when coalesce(x->>'target','')~'^[0-9]+(\.[0-9]+)?$'
       and length(x->>'target')<12 then greatest(1,(x->>'target')::numeric) else 1 end
    else false end;
 end if;
 if jsonb_typeof(p_doc->'focusSessions')='array' then
  select least(120,coalesce(sum((x->>'minutes')::int),0))::int into f
  from (select distinct on(x->>'id') x
   from jsonb_array_elements(p_doc->'focusSessions') x
   where (x->>'date')=p_day::text and (x->>'minutes')~'^([1-9]|[1-5][0-9]|60)$'
    and nullif(x->>'id','') is not null order by x->>'id',(x->>'at') nulls last) z;
 end if;
 score:=least(400,t*25+h*16+f);
 return jsonb_build_object('points',score,'tasks',t,'habits',h,'focus',f);
end $$;

-- Preserve all currently earned days as a one-time legacy baseline.
do $$
declare s record; d record; day0 date; m jsonb;
begin
 select id,starts_at into s from public.yawmi_seasons
 where starts_at<=now() and ends_at>now() limit 1;
 if s.id is null then raise exception 'SEASON_UNAVAILABLE';end if;
 for d in select user_id,data,revision from public.yawmi_documents loop
  for day0 in select gs::date from generate_series(
   (s.starts_at at time zone 'Asia/Riyadh')::date,
   (now() at time zone 'Asia/Riyadh')::date,interval '1 day') gs loop
   m:=public.yawmi_competitive_day_metrics(d.data,day0);
   insert into public.yawmi_verified_activity(
    season_id,user_id,activity_day,points,tasks_count,habits_count,focus_minutes,source_revision)
   values(s.id,d.user_id,day0,(m->>'points')::int,(m->>'tasks')::int,
      (m->>'habits')::int,(m->>'focus')::int,d.revision)
   on conflict(season_id,user_id,activity_day) do nothing;
   insert into public.yawmi_activity_audit(
    season_id,user_id,activity_day,source_revision,before_points,after_points,delta,source)
   values(s.id,d.user_id,day0,d.revision,0,(m->>'points')::int,(m->>'points')::int,'legacy_import')
   on conflict do nothing;
  end loop;
 end loop;
end $$;

-- Only the server's trusted document write path updates competition. Existing
-- past days can lose points after deletions; positive backfill is bounded to 7 days.
create or replace function public.yawmi_verify_document_activity()
returns trigger language plpgsql security definer set search_path='' as $$
declare
 s record; today_ksa date:=(now() at time zone 'Asia/Riyadh')::date;
 d date; m jsonb; oldrow record;
 pts int; t int;h int;f int; previous int; changed boolean;
begin
 if tg_op='UPDATE' and old.data=new.data then return new;end if;
 select id,starts_at into s from public.yawmi_seasons
 where starts_at<=now() and ends_at>now() limit 1;
 if s.id is null then return new;end if;
 for d in select gs::date from generate_series(
  (s.starts_at at time zone 'Asia/Riyadh')::date,today_ksa,interval '1 day') gs loop
  m:=public.yawmi_competitive_day_metrics(new.data,d);
  pts:=(m->>'points')::int;t:=(m->>'tasks')::int;
  h:=(m->>'habits')::int;f:=(m->>'focus')::int;
  select * into oldrow from public.yawmi_verified_activity
   where season_id=s.id and user_id=new.user_id and activity_day=d for update;
  previous:=case when found then oldrow.points else 0 end;
  if d<today_ksa-7 then
    if oldrow.user_id is null then continue;end if;
    pts:=least(oldrow.points,pts);
    t:=least(oldrow.tasks_count,t);
    h:=least(oldrow.habits_count,h);
    f:=least(oldrow.focus_minutes,f);
  end if;
  changed:=oldrow.user_id is null or
    (oldrow.points,oldrow.tasks_count,oldrow.habits_count,oldrow.focus_minutes)
    is distinct from (pts,t,h,f);
  if not changed then continue;end if;
  insert into public.yawmi_verified_activity(
   season_id,user_id,activity_day,points,tasks_count,habits_count,
   focus_minutes,source_revision,verified_at)
  values(s.id,new.user_id,d,pts,t,h,f,new.revision,now())
  on conflict(season_id,user_id,activity_day) do update
  set points=excluded.points,tasks_count=excluded.tasks_count,
      habits_count=excluded.habits_count,focus_minutes=excluded.focus_minutes,
      source_revision=excluded.source_revision,verified_at=now();
  insert into public.yawmi_activity_audit(
   season_id,user_id,activity_day,source_revision,before_points,after_points,delta,source)
  values(s.id,new.user_id,d,new.revision,previous,pts,pts-previous,'document_write')
  on conflict do nothing;
 end loop;
 return new;
end $$;
drop trigger if exists yawmi_verify_activity_after_write on public.yawmi_documents;
create trigger yawmi_verify_activity_after_write
 after insert or update of data on public.yawmi_documents
 for each row execute function public.yawmi_verify_document_activity();

-- Competitive sync now uses verified snapshots, not a fresh interpretation of
-- arbitrary backdated client data. It also mirrors the existing season_days table.
create or replace function public.yawmi_ranked_sync()
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=(select auth.uid()); s record; total int:=0; active_days int:=0;
begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='28000';end if;
 perform public.yawmi_season_finalize();
 insert into public.yawmi_public_profiles(user_id,public_code,visible_on_board,friends_enabled)
 values(u,'YM-'||upper(substr(md5(u::text),1,10)),true,true)
 on conflict(user_id) do nothing;
 select id,code into s from public.yawmi_seasons
 where starts_at<=now() and ends_at>now() limit 1;
 if s.id is null then raise exception 'SEASON_UNAVAILABLE';end if;
 insert into public.yawmi_season_days(season_id,user_id,activity_day,points)
 select season_id,user_id,activity_day,points from public.yawmi_verified_activity
 where season_id=s.id and user_id=u
 on conflict(season_id,user_id,activity_day) do update
 set points=excluded.points,verified_at=now()
 where public.yawmi_season_days.points is distinct from excluded.points;
 select coalesce(sum(points),0)::int,count(*) filter(where points>0)::int
 into total,active_days from public.yawmi_verified_activity
 where season_id=s.id and user_id=u;
 insert into public.yawmi_season_standings(season_id,user_id,xp,activity_days,peak_xp)
 values(s.id,u,total,active_days,total)
 on conflict(season_id,user_id) do update
 set xp=excluded.xp,activity_days=excluded.activity_days,
 peak_xp=greatest(public.yawmi_season_standings.peak_xp,excluded.xp),
 last_verified_at=now()
 where public.yawmi_season_standings.xp is distinct from excluded.xp
 or public.yawmi_season_standings.activity_days is distinct from excluded.activity_days
 or public.yawmi_season_standings.peak_xp<excluded.xp;
 return jsonb_build_object('season',s.code,'xp',total,
   'rank',public.yawmi_season_rank(total),'activity_days',active_days);
end $$;

-- Season closure must NEVER recalculate raw client documents.
create or replace function public.yawmi_season_finalize()
returns integer language plpgsql security definer set search_path='' as $$
declare s record; x record; total int; days int; changed int:=0;
begin
 for s in select id from public.yawmi_seasons where finalized_at is null
  and ends_at<=now() order by id for update skip locked loop
  for x in select distinct user_id from public.yawmi_verified_activity
    where season_id=s.id loop
   select coalesce(sum(points),0)::int,count(*) filter(where points>0)::int
   into total,days from public.yawmi_verified_activity
   where season_id=s.id and user_id=x.user_id;
   insert into public.yawmi_season_standings(season_id,user_id,xp,activity_days,peak_xp)
   values(s.id,x.user_id,total,days,total)
   on conflict(season_id,user_id) do update
   set xp=excluded.xp,activity_days=excluded.activity_days,
    peak_xp=greatest(public.yawmi_season_standings.peak_xp,excluded.xp),
    last_verified_at=now();
  end loop;
  with ranked as (
   select st.user_id,row_number() over(
    order by st.xp desc,st.activity_days desc,st.last_verified_at asc,st.user_id) pos
   from public.yawmi_season_standings st where st.season_id=s.id
  )
  insert into public.yawmi_season_awards(
   season_id,user_id,final_xp,final_rank,peak_rank,activity_days,final_position,medal)
  select s.id,st.user_id,st.xp,public.yawmi_season_rank(st.xp),
   public.yawmi_season_rank(greatest(st.peak_xp,st.xp)),st.activity_days,r.pos,
   case when r.pos=1 then 'gold' when r.pos=2 then 'silver'
        when r.pos=3 then 'bronze' else null end
  from public.yawmi_season_standings st
  left join ranked r on r.user_id=st.user_id
  where st.season_id=s.id on conflict(season_id,user_id) do nothing;
  update public.yawmi_seasons set finalized_at=now() where id=s.id;
  changed:=changed+1;
 end loop;
 return changed;
end $$;

-- Prevent direct REST manipulation of the documents or competitive tables.
-- yawmi_write retains the existing CAS business rules but runs with a trusted owner.
create or replace function public.yawmi_write(p_data jsonb,p_expected_revision bigint)
returns bigint language plpgsql security definer set search_path='' as $$
declare v_user uuid:=(select auth.uid()); v_revision bigint;
begin
 if v_user is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object'
 or (p_data->>'version') is distinct from '7'
 or jsonb_typeof(p_data->'tasks')<>'array'
 or jsonb_typeof(p_data->'habits')<>'array'
 or jsonb_typeof(p_data->'daily')<>'object'
 or jsonb_typeof(p_data->'rewards')<>'array'
 or octet_length(p_data::text)>1500000
 then raise exception 'INVALID_YAWMI_PAYLOAD' using errcode='22023';end if;
 if p_expected_revision=0 then
  insert into public.yawmi_documents(user_id,data,revision,updated_at)
  values(v_user,p_data,1,now()) on conflict(user_id) do nothing
  returning revision into v_revision;
 elsif p_expected_revision>0 then
  update public.yawmi_documents
  set data=p_data,revision=revision+1,updated_at=now()
  where user_id=v_user and revision=p_expected_revision returning revision into v_revision;
 end if;
 if v_revision is null then raise exception 'REVISION_CONFLICT' using errcode='40001';end if;
 return v_revision;
end $$;

revoke insert,update,delete on public.yawmi_documents from anon,authenticated;
revoke all on function public.yawmi_competitive_day_metrics(jsonb,date) from public,anon,authenticated;
revoke all on function public.yawmi_verify_document_activity() from public,anon,authenticated;
revoke all on function public.yawmi_season_finalize() from public,anon,authenticated;
revoke all on function public.yawmi_ranked_sync() from public,anon;
revoke all on function public.yawmi_write(jsonb,bigint) from public,anon;
grant execute on function public.yawmi_write(jsonb,bigint),public.yawmi_ranked_sync() to authenticated;
