create table if not exists public.yawmi_friend_challenges(
 id uuid primary key default gen_random_uuid(),
 inviter uuid not null references auth.users(id) on delete cascade,
 invitee uuid not null references auth.users(id) on delete cascade,
 metric text not null check(metric in ('days','tasks','habits','focus')),
 target integer not null check(target between 1 and 150),
 duration_days integer not null check(duration_days in (7,14,21,28)),
 state text not null default 'pending' check(state in ('pending','active','declined','completed','expired')),
 created_at timestamptz not null default now(),
 started_at timestamptz,ends_at timestamptz,badge_awarded_at timestamptz,
 check(inviter<>invitee)
);
create index if not exists yawmi_challenge_inviter_idx on public.yawmi_friend_challenges(inviter,created_at desc);
create index if not exists yawmi_challenge_invitee_idx on public.yawmi_friend_challenges(invitee,created_at desc);
alter table public.yawmi_friend_challenges enable row level security;
revoke all on public.yawmi_friend_challenges from public,anon,authenticated;
do $$
declare src text; next_src text;
begin
 select pg_get_functiondef('public.yawmi_ranked_dashboard(text)'::regprocedure) into src;
 next_src:=replace(src,'jsonb_build_object(''name'',p.display_name)',
                    'jsonb_build_object(''name'',p.display_name,''friend_ref'',f.request_id)');
 if next_src=src then raise exception 'UNEXPECTED_FRIEND_LIST_FUNCTION';end if;
 execute next_src;
end $$;

create or replace function public.yawmi_challenge_metric(
 p_user uuid,p_metric text,p_from timestamptz,p_until timestamptz)
returns integer language sql stable set search_path='' as $$
 select coalesce(sum(case
  when p_metric='days' then case when points>0 then 1 else 0 end
  when p_metric='tasks' then tasks_count
  when p_metric='habits' then habits_count
  when p_metric='focus' then focus_minutes
  else 0 end),0)::integer
 from public.yawmi_verified_activity
 where user_id=p_user
 and activity_day >= (p_from at time zone 'Asia/Riyadh')::date
 and activity_day <= ((least(p_until,now())-interval '1 microsecond') at time zone 'Asia/Riyadh')::date;
$$;
create or replace function public.yawmi_challenge_create(
 p_friend_ref uuid,p_metric text,p_target integer,p_duration_days integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=(select auth.uid()); peer uuid; result uuid;
begin
 if u is null then raise exception 'AUTH_REQUIRED';end if;
 if p_metric not in ('days','tasks','habits','focus') or p_target not between 1 and 150
 or p_duration_days not in (7,14,21,28) then raise exception 'INVALID_CHALLENGE';end if;
 if p_metric='days' and p_target>p_duration_days then raise exception 'DAYS_EXCEED_DURATION';end if;
 select case when requester=u then recipient else requester end into peer
 from public.yawmi_friend_requests
 where request_id=p_friend_ref and status='accepted' and (requester=u or recipient=u);
 if peer is null then raise exception 'FRIENDSHIP_REQUIRED';end if;
 if (select count(*) from public.yawmi_friend_challenges
 where inviter=u and created_at>now()-interval '1 day')>=5
 then raise exception 'CHALLENGE_RATE_LIMIT';end if;
 if exists(select 1 from public.yawmi_friend_challenges c
 where c.state in ('pending','active') and c.metric=p_metric and c.target=p_target
 and ((c.inviter=u and c.invitee=peer) or(c.inviter=peer and c.invitee=u)))
 then raise exception 'CHALLENGE_ALREADY_EXISTS';end if;
 insert into public.yawmi_friend_challenges(inviter,invitee,metric,target,duration_days)
 values(u,peer,p_metric,p_target,p_duration_days) returning id into result;
 return result;
end $$;
create or replace function public.yawmi_challenge_respond(p_challenge_id uuid,p_accept boolean)
returns text language plpgsql security definer set search_path='' as $$
declare u uuid:=(select auth.uid()); result text;
begin
 if u is null then raise exception 'AUTH_REQUIRED';end if;
 update public.yawmi_friend_challenges
 set state=case when coalesce(p_accept,false) then 'active' else 'declined' end,
 started_at=case when p_accept then now() else null end,
 ends_at=case when p_accept then now()+(duration_days*interval '1 day') else null end
 where id=p_challenge_id and invitee=u and state='pending' returning state into result;
 if result is null then raise exception 'CHALLENGE_NOT_PENDING';end if;
 return result;
end $$;
create or replace function public.yawmi_challenges_dashboard()
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=(select auth.uid()); item record; me int;them int;badge bool;res jsonb:='[]'::jsonb;
begin
 if u is null then raise exception 'AUTH_REQUIRED';end if;
 for item in
 select c.*,case when c.inviter=u then c.invitee else c.inviter end peer_id,
 coalesce(p.display_name,'مستكشف') peer_name
 from public.yawmi_friend_challenges c
 left join public.yawmi_public_profiles p
 on p.user_id=case when c.inviter=u then c.invitee else c.inviter end
 where c.inviter=u or c.invitee=u order by c.created_at desc limit 30 loop
  me:=0;them:=0;badge:=item.badge_awarded_at is not null;
  if item.started_at is not null then
   me:=public.yawmi_challenge_metric(u,item.metric,item.started_at,item.ends_at);
   them:=public.yawmi_challenge_metric(item.peer_id,item.metric,item.started_at,item.ends_at);
   if item.state='active' and me>=item.target and them>=item.target then
    update public.yawmi_friend_challenges set state='completed',badge_awarded_at=now()
    where id=item.id and state='active';item.state:='completed';badge:=true;
   elsif item.state='active' and now()>item.ends_at then
    update public.yawmi_friend_challenges set state='expired'
    where id=item.id and state='active';item.state:='expired';
   end if;
  end if;
  res:=res||jsonb_build_array(jsonb_build_object(
   'id',item.id,'peer',item.peer_name,'metric',item.metric,'target',item.target,
   'duration',item.duration_days,'state',item.state,'created_at',item.created_at,
   'starts',item.started_at,'ends',item.ends_at,'mine',me,'theirs',them,
   'badge',badge,'incoming',item.invitee=u));
 end loop;
 return res;
end $$;
revoke all on function public.yawmi_challenge_metric(uuid,text,timestamptz,timestamptz)
 from public,anon,authenticated;
revoke all on function public.yawmi_challenge_create(uuid,text,integer,integer) from public,anon;
revoke all on function public.yawmi_challenge_respond(uuid,boolean) from public,anon;
revoke all on function public.yawmi_challenges_dashboard() from public,anon;
grant execute on function public.yawmi_challenge_create(uuid,text,integer,integer),
 public.yawmi_challenge_respond(uuid,boolean),public.yawmi_challenges_dashboard()
 to authenticated;
