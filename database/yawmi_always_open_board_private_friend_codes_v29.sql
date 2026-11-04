-- YAWMI V29: leaderboard always includes users; keep friendship codes private.
-- Add request tokens (not identities) so incoming requests no longer disclose a friend's private code.
alter table public.yawmi_friend_requests
 add column if not exists request_id uuid not null default gen_random_uuid();
create unique index if not exists yawmi_friend_request_token_idx on public.yawmi_friend_requests(request_id);

alter table public.yawmi_public_profiles alter column visible_on_board set default true;
alter table public.yawmi_public_profiles alter column friends_enabled set default true;

-- Existing and future app accounts join global leaderboard automatically.
insert into public.yawmi_public_profiles(user_id,public_code,display_name,visible_on_board,friends_enabled)
select d.user_id,'YM-'||upper(substr(md5(d.user_id::text),1,10)),
 case when char_length(trim(coalesce(d.data->'profile'->>'name',''))) between 2 and 32
 then trim(d.data->'profile'->>'name') else 'مستكشف' end,
 true,true
from public.yawmi_documents d
on conflict(user_id) do update set visible_on_board=true, friends_enabled=true;

create or replace function public.yawmi_register_public_profile()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.yawmi_public_profiles(user_id,public_code,display_name,visible_on_board,friends_enabled)
 values(new.user_id,'YM-'||upper(substr(md5(new.user_id::text),1,10)),
   case when char_length(trim(coalesce(new.data->'profile'->>'name',''))) between 2 and 32
        then trim(new.data->'profile'->>'name') else 'مستكشف' end,
   true,true)
 on conflict(user_id) do update set visible_on_board=true;
 return new;
end $$;
drop trigger if exists yawmi_register_profile_after_document on public.yawmi_documents;
create trigger yawmi_register_profile_after_document
 after insert on public.yawmi_documents
 for each row execute function public.yawmi_register_public_profile();

-- Keep the signature for compatibility with old UI, but ignore its old visibility checkbox.
create or replace function public.yawmi_profile_save(p_name text,p_visible boolean,p_friends boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=(select auth.uid()); nm text:=trim(regexp_replace(coalesce(p_name,''),'\s+',' ','g')); outrow record;
begin
 if u is null then raise exception 'AUTH_REQUIRED';end if;
 if char_length(nm) not between 2 and 32 then raise exception 'INVALID_NAME';end if;
 insert into public.yawmi_public_profiles(user_id,public_code,display_name,visible_on_board,friends_enabled)
 values(u,'YM-'||upper(substr(md5(u::text),1,10)),nm,true,coalesce(p_friends,true))
 on conflict(user_id) do update
 set display_name=excluded.display_name,visible_on_board=true,
     friends_enabled=excluded.friends_enabled,updated_at=now();
 select public_code,display_name,friends_enabled into outrow
 from public.yawmi_public_profiles where user_id=u;
 return to_jsonb(outrow);
end $$;

-- A recipient can approve using an opaque request token, not the sender's private friend code.
create or replace function public.yawmi_friend_respond_by_request(p_request_id uuid,p_accept boolean)
returns text language plpgsql security definer set search_path='' as $$
declare u uuid:=(select auth.uid());
begin
 if u is null then raise exception 'AUTH_REQUIRED';end if;
 update public.yawmi_friend_requests
 set status=case when coalesce(p_accept,false) then 'accepted' else 'declined' end,
     responded_at=now()
 where request_id=p_request_id and recipient=u and status='pending';
 if not found then raise exception 'REQUEST_NOT_FOUND';end if;
 return case when coalesce(p_accept,false) then 'accepted' else 'declined' end;
end $$;

-- Remove friend table's raw SELECT access: it contains auth UUIDs.
revoke select on public.yawmi_friend_requests from anon,authenticated;
revoke all on function public.yawmi_register_public_profile() from public,anon,authenticated;
revoke all on function public.yawmi_friend_respond_by_request(uuid,boolean) from public,anon;
grant execute on function public.yawmi_friend_respond_by_request(uuid,boolean) to authenticated;

-- The only public rankings data returned are names, XP, rank, days, position and "me" marker.
-- No public_code/user_id/requester UUID in global board/friend roster.
create or replace function public.yawmi_ranked_dashboard(p_scope text default 'global')
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=(select auth.uid()); s record; own record;
 entries jsonb:='[]'::jsonb; awards jsonb:='[]'::jsonb;
 inbound jsonb:='[]'::jsonb; friends jsonb:='[]'::jsonb;
 global_pos bigint:=null;
begin
 if u is null then raise exception 'AUTH_REQUIRED';end if;
 if p_scope not in ('global','friends') then raise exception 'INVALID_SCOPE';end if;
 perform public.yawmi_season_finalize();
 select id,code,starts_at,ends_at into s from public.yawmi_seasons
 where starts_at<=now() and ends_at>now() limit 1;
 if s.id is null then raise exception 'SEASON_UNAVAILABLE';end if;
 select p.public_code,p.display_name,p.friends_enabled,
 coalesce(st.xp,0) as xp,coalesce(st.activity_days,0) as days
 into own from public.yawmi_public_profiles p
 left join public.yawmi_season_standings st on st.user_id=p.user_id and st.season_id=s.id
 where p.user_id=u;

 with ordered as (
  select row_number() over (
   order by coalesce(st.xp,0) desc,coalesce(st.activity_days,0) desc,
   coalesce(st.last_verified_at,'infinity'::timestamptz) asc,d.user_id
  ) as pos,d.user_id,coalesce(p.display_name,'مستكشف') as name,
  coalesce(st.xp,0) as xp,coalesce(st.activity_days,0) as days,
  public.yawmi_season_rank(coalesce(st.xp,0)) as rank,
  (d.user_id=u) as is_me
  from public.yawmi_documents d
  left join public.yawmi_public_profiles p on p.user_id=d.user_id
  left join public.yawmi_season_standings st on st.user_id=d.user_id and st.season_id=s.id
 ),
 permitted as (
  select o.*
  from ordered o
  where p_scope='global' or o.user_id=u or exists (
    select 1 from public.yawmi_friend_requests f
    where f.status='accepted'
     and ((f.requester=u and f.recipient=o.user_id)
       or (f.recipient=u and f.requester=o.user_id))
  )
 )
 select coalesce(jsonb_agg(jsonb_build_object(
  'position',x.pos,'name',x.name,'xp',x.xp,
  'rank',x.rank,'days',x.days,'is_me',x.is_me) order by x.pos),'[]'::jsonb)
 into entries
 from (select * from permitted order by pos limit 50) x;

 select sub.pos into global_pos from (
  select d.user_id,row_number() over(
   order by coalesce(st.xp,0) desc,coalesce(st.activity_days,0) desc,
   coalesce(st.last_verified_at,'infinity'::timestamptz),d.user_id) pos
  from public.yawmi_documents d
  left join public.yawmi_season_standings st on st.season_id=s.id and st.user_id=d.user_id
 ) sub where sub.user_id=u;

 select coalesce(jsonb_agg(jsonb_build_object(
  'season',se.code,'xp',a.final_xp,'rank',a.final_rank,'peak_rank',a.peak_rank,
  'position',a.final_position,'medal',a.medal,'days',a.activity_days,'ended',se.ends_at)
  order by se.id desc),'[]'::jsonb)
 into awards from public.yawmi_season_awards a
 join public.yawmi_seasons se on se.id=a.season_id where a.user_id=u;

 select coalesce(jsonb_agg(jsonb_build_object(
  'request_id',f.request_id,'name',p.display_name,'at',f.created_at)
  order by f.created_at desc),'[]'::jsonb)
 into inbound from public.yawmi_friend_requests f
 join public.yawmi_public_profiles p on p.user_id=f.requester
 where f.recipient=u and f.status='pending';

 select coalesce(jsonb_agg(jsonb_build_object('name',p.display_name)
  order by p.display_name),'[]'::jsonb)
 into friends from public.yawmi_friend_requests f
 join public.yawmi_public_profiles p
 on p.user_id=case when f.requester=u then f.recipient else f.requester end
 where (f.requester=u or f.recipient=u) and f.status='accepted';

 return jsonb_build_object(
  'season',jsonb_build_object('code',s.code,'starts',s.starts_at,'ends',s.ends_at),
  'profile',jsonb_build_object('code',own.public_code,'name',coalesce(own.display_name,'مستكشف'),
    'friends_enabled',coalesce(own.friends_enabled,true)),
  'mine',jsonb_build_object('xp',coalesce(own.xp,0),
    'rank',public.yawmi_season_rank(coalesce(own.xp,0)),
    'activity_days',coalesce(own.days,0),'position',global_pos),
  'leaders',entries,'awards',awards,'requests',inbound,'friends',friends);
end $$;

-- Final medals include everyone, regardless of legacy opt-in value.
create or replace function public.yawmi_season_finalize()
returns integer language plpgsql security definer set search_path='' as $$
declare s record; doc record; activity_date date; score int; score_sum int;
 active_days int; changed int:=0;
begin
 for s in select id,starts_at,ends_at from public.yawmi_seasons
  where finalized_at is null and ends_at<=now()
  order by id for update skip locked
 loop
  for doc in select user_id,data from public.yawmi_documents loop
   for activity_date in
    select gs::date from generate_series(
      (s.starts_at at time zone 'Asia/Riyadh')::date,
      ((s.ends_at-interval '1 second') at time zone 'Asia/Riyadh')::date,
      interval '1 day') gs
   loop
    score:=public.yawmi_competitive_day_xp(doc.data,activity_date);
    insert into public.yawmi_season_days(season_id,user_id,activity_day,points)
     values(s.id,doc.user_id,activity_date,score)
    on conflict(season_id,user_id,activity_day) do update
    set points=excluded.points,verified_at=now()
    where public.yawmi_season_days.points is distinct from excluded.points;
   end loop;
   select coalesce(sum(sd.points),0)::int,
          count(*) filter(where sd.points>0)::int
   into score_sum,active_days
   from public.yawmi_season_days sd where sd.season_id=s.id and sd.user_id=doc.user_id;
   insert into public.yawmi_season_standings(season_id,user_id,xp,activity_days,peak_xp)
    values(s.id,doc.user_id,score_sum,active_days,score_sum)
   on conflict(season_id,user_id) do update
    set xp=excluded.xp,activity_days=excluded.activity_days,
      peak_xp=greatest(public.yawmi_season_standings.peak_xp,excluded.xp),
      last_verified_at=now()
    where public.yawmi_season_standings.xp is distinct from excluded.xp
      or public.yawmi_season_standings.activity_days is distinct from excluded.activity_days
      or public.yawmi_season_standings.peak_xp<excluded.xp;
  end loop;
  with ranked as (
   select st.user_id,row_number() over (
      order by st.xp desc,st.activity_days desc,st.last_verified_at asc,st.user_id
    ) as pos
   from public.yawmi_season_standings st
   where st.season_id=s.id
  )
  insert into public.yawmi_season_awards(
   season_id,user_id,final_xp,final_rank,peak_rank,activity_days,final_position,medal)
  select s.id,st.user_id,st.xp,public.yawmi_season_rank(st.xp),
   public.yawmi_season_rank(greatest(st.peak_xp,st.xp)),
   st.activity_days,r.pos,
   case when r.pos=1 then 'gold' when r.pos=2 then 'silver'
        when r.pos=3 then 'bronze' else null end
  from public.yawmi_season_standings st
  left join ranked r on r.user_id=st.user_id
  where st.season_id=s.id on conflict(season_id,user_id) do nothing;
  update public.yawmi_seasons set finalized_at=now()
   where id=s.id and finalized_at is null;
  changed:=changed+1;
 end loop;
 return changed;
end $$;
revoke all on function public.yawmi_season_finalize() from public,anon,authenticated;
revoke all on function public.yawmi_ranked_dashboard(text) from public,anon;
revoke all on function public.yawmi_profile_save(text,boolean,boolean) from public,anon;
grant execute on function public.yawmi_ranked_dashboard(text),
 public.yawmi_profile_save(text,boolean,boolean) to authenticated;

