-- Permanent record of the highest competitive rank reached, even after deleted achievements.
alter table public.yawmi_season_standings add column if not exists peak_xp integer not null default 0;
alter table public.yawmi_season_awards add column if not exists peak_rank text not null default 'برونز';
update public.yawmi_season_standings
 set peak_xp=greatest(peak_xp,xp)
 where peak_xp<xp;

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
 day0:=(s.starts_at at time zone 'Asia/Riyadh')::date;
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
 select coalesce(sum(sd.points),0)::int,count(*) filter(where sd.points>0)::int
 into total,days from public.yawmi_season_days sd where sd.season_id=s.id and sd.user_id=u;
 insert into public.yawmi_season_standings(season_id,user_id,xp,activity_days,peak_xp)
 values(s.id,u,total,days,total)
 on conflict(season_id,user_id) do update
 set xp=excluded.xp,activity_days=excluded.activity_days,
     peak_xp=greatest(public.yawmi_season_standings.peak_xp,excluded.xp),last_verified_at=now()
 where public.yawmi_season_standings.xp is distinct from excluded.xp
  or public.yawmi_season_standings.activity_days is distinct from excluded.activity_days
  or public.yawmi_season_standings.peak_xp<excluded.xp;
 return jsonb_build_object('season',s.code,'xp',total,'rank',public.yawmi_season_rank(total),'activity_days',days);
end $$;

create or replace function public.yawmi_season_finalize()
returns integer language plpgsql security definer set search_path='' as $$
declare
 s record; doc record; activity_date date; score int; score_sum int; active_days int;
 changed int:=0;
begin
 for s in select id,starts_at,ends_at from public.yawmi_seasons
  where finalized_at is null and ends_at<=now()
  order by id for update skip locked
 loop
  -- Reconstruct all days from the last saved account document, including accounts
  -- which were not opened recently. Only dates within the closing season qualify.
  for doc in select user_id,data from public.yawmi_documents loop
   for activity_date in
    select gs::date from generate_series(
      (s.starts_at at time zone 'Asia/Riyadh')::date,
      ((s.ends_at - interval '1 second') at time zone 'Asia/Riyadh')::date,
      interval '1 day') gs
   loop
    score:=public.yawmi_competitive_day_xp(doc.data,activity_date);
    insert into public.yawmi_season_days(season_id,user_id,activity_day,points)
     values(s.id,doc.user_id,activity_date,score)
    on conflict (season_id,user_id,activity_day)
    do update set points=excluded.points,verified_at=now()
    where public.yawmi_season_days.points is distinct from excluded.points;
   end loop;
   select coalesce(sum(sd.points),0)::int,
          count(*) filter(where sd.points>0)::int
   into score_sum,active_days
   from public.yawmi_season_days sd
   where sd.season_id=s.id and sd.user_id=doc.user_id;
   insert into public.yawmi_season_standings(season_id,user_id,xp,activity_days,peak_xp)
    values(s.id,doc.user_id,score_sum,active_days,score_sum)
   on conflict (season_id,user_id)
   do update set xp=excluded.xp,activity_days=excluded.activity_days,
        peak_xp=greatest(public.yawmi_season_standings.peak_xp,excluded.xp),last_verified_at=now()
   where public.yawmi_season_standings.xp is distinct from excluded.xp
      or public.yawmi_season_standings.activity_days is distinct from excluded.activity_days
      or public.yawmi_season_standings.peak_xp<excluded.xp;
  end loop;
  with ranked as (
   select st.user_id,
      row_number() over (order by st.xp desc,st.activity_days desc,
                         st.last_verified_at asc,st.user_id) as pos
   from public.yawmi_season_standings st
   join public.yawmi_public_profiles p on p.user_id=st.user_id
   where st.season_id=s.id and p.visible_on_board
  )
  insert into public.yawmi_season_awards
   (season_id,user_id,final_xp,final_rank,peak_rank,activity_days,final_position,medal)
  select s.id,st.user_id,st.xp,public.yawmi_season_rank(st.xp),
         public.yawmi_season_rank(greatest(st.peak_xp,st.xp)),st.activity_days,
         r.pos,case when r.pos=1 then 'gold'
                    when r.pos=2 then 'silver'
                    when r.pos=3 then 'bronze' else null end
  from public.yawmi_season_standings st
  left join ranked r on r.user_id=st.user_id
  where st.season_id=s.id
  on conflict(season_id,user_id) do nothing;
  update public.yawmi_seasons set finalized_at=now()
   where id=s.id and finalized_at is null;
  changed:=changed+1;
 end loop;
 return changed;
end $$;

revoke all on function public.yawmi_season_finalize() from public,anon,authenticated;

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
 where st.season_id=s.id and (
    (p_scope<>'friends' and p.visible_on_board)
    or (p_scope='friends' and (
      p.user_id=u or (p.friends_enabled and exists(
       select 1 from public.yawmi_friend_requests f
       where f.status='accepted' and
        ((f.requester=u and f.recipient=p.user_id)
        or (f.recipient=u and f.requester=p.user_id))
      ))
    ))
   )
 )
 select coalesce(jsonb_agg(jsonb_build_object('position',x.pos,'code',x.public_code,'name',x.display_name,
 'xp',x.xp,'rank',x.rank,'days',x.activity_days) order by x.pos),'[]'::jsonb) into entries
 from (select * from ordered where p_scope<>'friends' or user_id=u or exists (
   select 1 from public.yawmi_friend_requests f where f.status='accepted'
   and ((f.requester=u and f.recipient=ordered.user_id)
     or (f.recipient=u and f.requester=ordered.user_id))) order by pos limit 50) x;
 select coalesce(jsonb_agg(jsonb_build_object('season',se.code,'xp',a.final_xp,'rank',a.final_rank,
  'position',a.final_position,'medal',a.medal,'peak_rank',a.peak_rank,'days',a.activity_days,'ended',se.ends_at) order by se.id desc),'[]'::jsonb)
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
