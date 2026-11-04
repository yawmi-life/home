-- YAWMI seasonal social v1. Additive migration: never mutates existing documents.
create table if not exists public.yawmi_seasons(
 id integer generated always as identity primary key,
 code text not null unique, starts_at timestamptz not null, ends_at timestamptz not null,
 finalized_at timestamptz, check(ends_at>starts_at));
insert into public.yawmi_seasons(code,starts_at,ends_at)
select 'S'||lpad((n+1)::text,2,'0'),
 ((timestamp '2026-10-01' + n*interval '3 months') at time zone 'Asia/Riyadh'),
 ((timestamp '2026-10-01' + (n+1)*interval '3 months') at time zone 'Asia/Riyadh')
from generate_series(0,39) n
on conflict(code) do nothing;
create table if not exists public.yawmi_public_profiles(
 user_id uuid primary key references auth.users(id) on delete cascade,
 public_code text not null unique,
 display_name text not null default 'مستكشف',
 visible_on_board boolean not null default false,
 friends_enabled boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(char_length(display_name) between 2 and 32));
create table if not exists public.yawmi_season_days(
 season_id integer not null references public.yawmi_seasons(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 activity_day date not null, points integer not null default 0 check(points between 0 and 400),
 verified_at timestamptz not null default now(),
 primary key(season_id,user_id,activity_day));
create table if not exists public.yawmi_season_standings(
 season_id integer not null references public.yawmi_seasons(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 xp integer not null default 0 check(xp>=0),
 activity_days integer not null default 0 check(activity_days>=0),
 last_verified_at timestamptz not null default now(),
 primary key(season_id,user_id));
create index if not exists yawmi_standings_sort_idx on public.yawmi_season_standings(season_id,xp desc,activity_days desc,last_verified_at);
create table if not exists public.yawmi_season_awards(
 season_id integer not null references public.yawmi_seasons(id),
 user_id uuid not null references auth.users(id) on delete cascade,
 final_xp integer not null,
 final_rank text not null,
 activity_days integer not null,
 final_position integer,
 medal text,
 awarded_at timestamptz not null default now(),
 primary key(season_id,user_id));
create table if not exists public.yawmi_friend_requests(
 requester uuid not null references auth.users(id) on delete cascade,
 recipient uuid not null references auth.users(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted','declined')),
 created_at timestamptz not null default now(),
 responded_at timestamptz,
 primary key(requester,recipient),
 check(requester<>recipient));
create index if not exists yawmi_friends_recipient_idx on public.yawmi_friend_requests(recipient,status);

alter table public.yawmi_seasons enable row level security;
alter table public.yawmi_public_profiles enable row level security;
alter table public.yawmi_season_days enable row level security;
alter table public.yawmi_season_standings enable row level security;
alter table public.yawmi_season_awards enable row level security;
alter table public.yawmi_friend_requests enable row level security;
create policy yawmi_seasons_read on public.yawmi_seasons for select to authenticated using(true);
create policy yawmi_profiles_own on public.yawmi_public_profiles for select to authenticated using(user_id=(select auth.uid()));
create policy yawmi_days_own on public.yawmi_season_days for select to authenticated using(user_id=(select auth.uid()));
create policy yawmi_standings_own on public.yawmi_season_standings for select to authenticated using(user_id=(select auth.uid()));
create policy yawmi_awards_own on public.yawmi_season_awards for select to authenticated using(user_id=(select auth.uid()));
create policy yawmi_friendships_own on public.yawmi_friend_requests for select to authenticated using(requester=(select auth.uid()) or recipient=(select auth.uid()));
grant select on public.yawmi_seasons,public.yawmi_public_profiles,public.yawmi_season_days,public.yawmi_season_standings,public.yawmi_season_awards,public.yawmi_friend_requests to authenticated;

create or replace function public.yawmi_season_rank(p_xp integer)
returns text language sql immutable set search_path='' as $$
select case when p_xp>=12000 then 'كونكر' when p_xp>=8500 then 'آيس'
 when p_xp>=6000 then 'كراون' when p_xp>=4000 then 'دايموند'
 when p_xp>=2500 then 'بلاتينيوم' when p_xp>=1200 then 'جولد'
 when p_xp>=400 then 'سيلفر' else 'برونز' end $$;

-- Calculate competitive points from the user's saved document, never from a score sent by the browser.
create or replace function public.yawmi_competitive_day_xp(p_doc jsonb,p_day date)
returns integer language plpgsql stable set search_path='' as $$
declare r jsonb:=coalesce(p_doc->'daily'->(p_day::text),'{}'::jsonb);
 t int:=0;h int:=0;f int:=0;
begin
 if jsonb_typeof(p_doc->'tasks')='array' and jsonb_typeof(r->'tasks')='object' then
  select least(8,count(*))::int into t
  from jsonb_array_elements(p_doc->'tasks') x
  where (r->'tasks'->>(x->>'id'))='true';
 end if;
 if jsonb_typeof(p_doc->'habits')='array' and jsonb_typeof(r->'habits')='object' then
  select least(8,count(*))::int into h
  from jsonb_array_elements(p_doc->'habits') x
  where (x->>'active') is distinct from 'false'
    and (r->'habits'->>(x->>'id')) ~ '^[0-9]+(\.[0-9]+)?$'
    and case when length(coalesce(r->'habits'->>(x->>'id'),''))<15
      then (r->'habits'->>(x->>'id'))::numeric >=
       case when coalesce(x->>'target','')~'^[0-9]+(\.[0-9]+)?$' and length(x->>'target')<12 then greatest(1,(x->>'target')::numeric) else 1 end
      else false end;
 end if;
 if jsonb_typeof(p_doc->'focusSessions')='array' then
  select least(120,coalesce(sum((x->>'minutes')::int),0))::int into f
   from (select distinct on (x->>'id') x
    from jsonb_array_elements(p_doc->'focusSessions') x
    where (x->>'date')=p_day::text and (x->>'minutes') ~ '^([1-9]|[1-5][0-9]|60)$'
      and nullif(x->>'id','') is not null) z;
 end if;
 return least(400,t*25+h*16+f);
end $$;

create or replace function public.yawmi_season_finalize()
returns integer language plpgsql security definer set search_path='' as $$
declare s record; changed int:=0;
begin
 for s in select id,ends_at from public.yawmi_seasons where finalized_at is null
 and ends_at<=now() order by id for update skip locked loop
  with ranked as (
    select st.user_id, row_number() over(order by st.xp desc, st.activity_days desc,
      st.last_verified_at asc,st.user_id) as pos
    from public.yawmi_season_standings st
    join public.yawmi_public_profiles p on p.user_id=st.user_id
    where st.season_id=s.id and p.visible_on_board)
  insert into public.yawmi_season_awards(season_id,user_id,final_xp,final_rank,activity_days,final_position,medal)
  select s.id, st.user_id,st.xp,public.yawmi_season_rank(st.xp),st.activity_days,
    r.pos,case when r.pos=1 then 'gold' when r.pos=2 then 'silver' when r.pos=3 then 'bronze' else null end
  from public.yawmi_season_standings st left join ranked r on r.user_id=st.user_id
  where st.season_id=s.id on conflict(season_id,user_id) do nothing;
  update public.yawmi_seasons set finalized_at=now() where id=s.id and finalized_at is null;
  changed:=changed+1;
 end loop;
 return changed;
end $$;

create or replace function public.yawmi_ranked_sync()
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=(select auth.uid()); s record; d date; day0 date; doc jsonb;
 today_ksa date:=(now() at time zone 'Asia/Riyadh')::date;
 points int; total int; days int;
begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='28000';end if;
 perform public.yawmi_season_finalize();
 insert into public.yawmi_public_profiles(user_id,public_code)
 values(u,'YM-'||upper(substr(md5(u::text),1,10))) on conflict(user_id) do nothing;
 select id,starts_at,ends_at,code into s from public.yawmi_seasons
 where starts_at<=now() and ends_at>now() limit 1;
 if s.id is null then raise exception 'SEASON_UNAVAILABLE';end if;
 select data into doc from public.yawmi_documents where user_id=u;
 day0:=greatest((s.starts_at at time zone 'Asia/Riyadh')::date,today_ksa-14);
 if doc is not null then
  for d in
   select g.day::date from generate_series(day0,today_ksa,'1 day'::interval) g(day)
   union select activity_day from public.yawmi_season_days
    where season_id=s.id and user_id=u
  loop
   points:=public.yawmi_competitive_day_xp(doc,d);
   insert into public.yawmi_season_days(season_id,user_id,activity_day,points)
    values(s.id,u,d,points)
   on conflict(season_id,user_id,activity_day) do update
    set points=excluded.points,verified_at=now()
    where public.yawmi_season_days.points is distinct from excluded.points;
  end loop;
 end if;
 select coalesce(sum(points),0)::int,count(*) filter(where points>0)::int
 into total,days from public.yawmi_season_days where season_id=s.id and user_id=u;
 insert into public.yawmi_season_standings(season_id,user_id,xp,activity_days)
 values(s.id,u,total,days)
 on conflict(season_id,user_id) do update set xp=excluded.xp,activity_days=excluded.activity_days,last_verified_at=now()
 where public.yawmi_season_standings.xp is distinct from excluded.xp
  or public.yawmi_season_standings.activity_days is distinct from excluded.activity_days;
 return jsonb_build_object('season',s.code,'xp',total,'rank',public.yawmi_season_rank(total),'activity_days',days);
end $$;

create or replace function public.yawmi_profile_save(p_name text,p_visible boolean,p_friends boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=(select auth.uid()); nm text:=trim(regexp_replace(coalesce(p_name,''),'\s+',' ','g')); outrow record;
begin
 if u is null then raise exception 'AUTH_REQUIRED';end if;
 if char_length(nm) not between 2 and 32 then raise exception 'INVALID_NAME';end if;
 insert into public.yawmi_public_profiles(user_id,public_code,display_name,visible_on_board,friends_enabled)
 values(u,'YM-'||upper(substr(md5(u::text),1,10)),nm,coalesce(p_visible,false),coalesce(p_friends,false))
 on conflict(user_id) do update set display_name=excluded.display_name,visible_on_board=excluded.visible_on_board,
 friends_enabled=excluded.friends_enabled,updated_at=now();
 select public_code,display_name,visible_on_board,friends_enabled into outrow from public.yawmi_public_profiles where user_id=u;
 return to_jsonb(outrow);
end $$;

create or replace function public.yawmi_friend_request(p_code text)
returns text language plpgsql security definer set search_path='' as $$
declare u uuid:=(select auth.uid()); other uuid; other_opt boolean; own_opt boolean;
begin
 if u is null then raise exception 'AUTH_REQUIRED';end if;
 select friends_enabled into own_opt from public.yawmi_public_profiles where user_id=u;
 select user_id,friends_enabled into other,other_opt from public.yawmi_public_profiles where public_code=upper(trim(p_code));
 if not coalesce(own_opt,false) or not coalesce(other_opt,false) or other is null or other=u
 then raise exception 'FRIENDS_UNAVAILABLE';end if;
 if exists(select 1 from public.yawmi_friend_requests
  where status='accepted' and ((requester=u and recipient=other) or(requester=other and recipient=u)))
 then return 'already_friends';end if;
 if exists(select 1 from public.yawmi_friend_requests where requester=other and recipient=u and status='pending')
 then raise exception 'ACCEPT_INCOMING_REQUEST_FIRST';end if;
 insert into public.yawmi_friend_requests(requester,recipient,status)
 values(u,other,'pending')
 on conflict(requester,recipient) do update set status='pending',created_at=now(),responded_at=null
 where public.yawmi_friend_requests.status='declined';
 return 'pending';
end $$;
create or replace function public.yawmi_friend_respond(p_code text,p_accept boolean)
returns text language plpgsql security definer set search_path='' as $$
declare u uuid:=(select auth.uid()); who uuid;
begin
 if u is null then raise exception 'AUTH_REQUIRED';end if;
 select user_id into who from public.yawmi_public_profiles where public_code=upper(trim(p_code));
 if who is null then raise exception 'NOT_FOUND';end if;
 update public.yawmi_friend_requests set status=case when p_accept then 'accepted' else 'declined' end,responded_at=now()
 where requester=who and recipient=u and status='pending';
 if not found then raise exception 'REQUEST_NOT_FOUND';end if;
 return case when p_accept then 'accepted' else 'declined' end;
end $$;

create or replace function public.yawmi_ranked_dashboard(p_scope text default 'global')
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=(select auth.uid()); s record; own record;
 entries jsonb:='[]'::jsonb; awards jsonb:='[]'::jsonb; inbound jsonb:='[]'::jsonb; friends jsonb:='[]'::jsonb;
begin
 if u is null then raise exception 'AUTH_REQUIRED';end if;
 perform public.yawmi_season_finalize();
 select id,code,starts_at,ends_at into s from public.yawmi_seasons
 where starts_at<=now() and ends_at>now() limit 1;
 if s.id is null then raise exception 'SEASON_UNAVAILABLE';end if;
 select p.public_code,p.display_name,p.visible_on_board,p.friends_enabled,
 coalesce(st.xp,0) as xp,coalesce(st.activity_days,0) as days
 into own from public.yawmi_public_profiles p
 left join public.yawmi_season_standings st on st.user_id=p.user_id and st.season_id=s.id
 where p.user_id=u;
 with ordered as (
 select row_number() over(order by st.xp desc,st.activity_days desc,st.last_verified_at asc,st.user_id) as pos,
 p.user_id,p.public_code,p.display_name,st.xp,st.activity_days,
 public.yawmi_season_rank(st.xp) as rank
 from public.yawmi_season_standings st
 join public.yawmi_public_profiles p on p.user_id=st.user_id
 where st.season_id=s.id and p.visible_on_board
 )
 select coalesce(jsonb_agg(jsonb_build_object('position',x.pos,'code',x.public_code,'name',x.display_name,
 'xp',x.xp,'rank',x.rank,'days',x.activity_days) order by x.pos),'[]'::jsonb) into entries
 from (select * from ordered where p_scope<>'friends' or user_id=u or exists (
   select 1 from public.yawmi_friend_requests f where f.status='accepted'
   and ((f.requester=u and f.recipient=ordered.user_id)
     or (f.recipient=u and f.requester=ordered.user_id))) order by pos limit 50) x;
 select coalesce(jsonb_agg(jsonb_build_object('season',se.code,'xp',a.final_xp,'rank',a.final_rank,
  'position',a.final_position,'medal',a.medal,'days',a.activity_days,'ended',se.ends_at) order by se.id desc),'[]'::jsonb)
 into awards from public.yawmi_season_awards a join public.yawmi_seasons se on se.id=a.season_id
 where a.user_id=u;
 select coalesce(jsonb_agg(jsonb_build_object('code',p.public_code,'name',p.display_name,'at',f.created_at) order by f.created_at desc),'[]'::jsonb)
 into inbound from public.yawmi_friend_requests f join public.yawmi_public_profiles p on p.user_id=f.requester
 where f.recipient=u and f.status='pending';
 select coalesce(jsonb_agg(jsonb_build_object('code',p.public_code,'name',p.display_name) order by p.display_name),'[]'::jsonb)
 into friends from public.yawmi_friend_requests f
 join public.yawmi_public_profiles p on p.user_id=case when f.requester=u then f.recipient else f.requester end
 where (f.requester=u or f.recipient=u) and f.status='accepted';
 return jsonb_build_object('season',jsonb_build_object('code',s.code,'starts',s.starts_at,'ends',s.ends_at),
 'profile',jsonb_build_object('code',own.public_code,'name',own.display_name,'visible',coalesce(own.visible_on_board,false),
 'friends_enabled',coalesce(own.friends_enabled,false)),
 'mine',jsonb_build_object('xp',coalesce(own.xp,0),'rank',public.yawmi_season_rank(coalesce(own.xp,0)),
 'activity_days',coalesce(own.days,0)),
 'leaders',entries,'awards',awards,'requests',inbound,'friends',friends);
end $$;
revoke all on function public.yawmi_season_finalize() from public,anon,authenticated;
revoke all on function public.yawmi_competitive_day_xp(jsonb,date) from public,anon,authenticated;
revoke all on function public.yawmi_season_rank(integer) from public,anon,authenticated;
revoke all on function public.yawmi_ranked_sync() from public,anon;
revoke all on function public.yawmi_profile_save(text,boolean,boolean) from public,anon;
revoke all on function public.yawmi_friend_request(text) from public,anon;
revoke all on function public.yawmi_friend_respond(text,boolean) from public,anon;
revoke all on function public.yawmi_ranked_dashboard(text) from public,anon;
grant execute on function public.yawmi_ranked_sync(),public.yawmi_profile_save(text,boolean,boolean),
 public.yawmi_friend_request(text),public.yawmi_friend_respond(text,boolean),public.yawmi_ranked_dashboard(text)
 to authenticated;
