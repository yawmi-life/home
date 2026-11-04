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
 select coalesce(sum(sd.points),0)::int,count(*) filter(where sd.points>0)::int
 into total,days from public.yawmi_season_days sd where sd.season_id=s.id and sd.user_id=u;
 insert into public.yawmi_season_standings(season_id,user_id,xp,activity_days)
 values(s.id,u,total,days)
 on conflict(season_id,user_id) do update set xp=excluded.xp,activity_days=excluded.activity_days,last_verified_at=now()
 where public.yawmi_season_standings.xp is distinct from excluded.xp
  or public.yawmi_season_standings.activity_days is distinct from excluded.activity_days;
 return jsonb_build_object('season',s.code,'xp',total,'rank',public.yawmi_season_rank(total),'activity_days',days);
end $$;
