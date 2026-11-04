-- Applied in Supabase on 2026-11-04 (project yawmi-lifeos).
-- Adds persistent quest badges and quarters through 2126.
insert into public.yawmi_seasons(code,starts_at,ends_at)
select 'S'||lpad((n+1)::text,2,'0'),
 ((timestamp '2026-10-01' + n*interval '3 months') at time zone 'Asia/Riyadh'),
 ((timestamp '2026-10-01' + (n+1)*interval '3 months') at time zone 'Asia/Riyadh')
from generate_series(40,399) n on conflict(code) do nothing;

create table if not exists public.yawmi_season_quest_awards(
 season_id integer not null references public.yawmi_seasons(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 quest_code text not null check(quest_code in ('starter','steady','legend')),
 awarded_at timestamptz not null default now(),
 primary key(season_id,user_id,quest_code));
alter table public.yawmi_season_quest_awards enable row level security;
create policy yawmi_quest_awards_own on public.yawmi_season_quest_awards for select to authenticated
 using(user_id=(select auth.uid()));
grant select on public.yawmi_season_quest_awards to authenticated;

create or replace function public.yawmi_grant_season_quests()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.activity_days>=5 then
  insert into public.yawmi_season_quest_awards(season_id,user_id,quest_code)
  values(new.season_id,new.user_id,'starter') on conflict do nothing;
 end if;
 if new.activity_days>=20 then
  insert into public.yawmi_season_quest_awards(season_id,user_id,quest_code)
  values(new.season_id,new.user_id,'steady') on conflict do nothing;
 end if;
 if new.activity_days>=60 then
  insert into public.yawmi_season_quest_awards(season_id,user_id,quest_code)
  values(new.season_id,new.user_id,'legend') on conflict do nothing;
 end if;
 return new;
end $$;
create trigger yawmi_grant_quests_after_standing
 after insert or update of activity_days on public.yawmi_season_standings
 for each row execute function public.yawmi_grant_season_quests();

create or replace function public.yawmi_quest_archive()
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('season',s.code,'quest',q.quest_code,'at',q.awarded_at) order by s.id desc,q.quest_code),'[]'::jsonb)
 from public.yawmi_season_quest_awards q
 join public.yawmi_seasons s on s.id=q.season_id
 where q.user_id=(select auth.uid()) $$;
revoke all on function public.yawmi_grant_season_quests() from public,anon,authenticated;
revoke all on function public.yawmi_quest_archive() from public,anon;
grant execute on function public.yawmi_quest_archive() to authenticated;
