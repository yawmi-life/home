-- Count unique task/habit IDs; friends-only board can show accepted friends who opt out of global ranking.
create or replace function public.yawmi_competitive_day_xp(p_doc jsonb,p_day date)
returns integer language plpgsql stable set search_path='' as $$
declare r jsonb:=coalesce(p_doc->'daily'->(p_day::text),'{}'::jsonb);
 t int:=0;h int:=0;f int:=0;
begin
 if jsonb_typeof(p_doc->'tasks')='array' and jsonb_typeof(r->'tasks')='object' then
  select least(8,count(distinct x->>'id'))::int into t
  from jsonb_array_elements(p_doc->'tasks') x
  where (r->'tasks'->>(x->>'id'))='true';
 end if;
 if jsonb_typeof(p_doc->'habits')='array' and jsonb_typeof(r->'habits')='object' then
  select least(8,count(distinct x->>'id'))::int into h
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
