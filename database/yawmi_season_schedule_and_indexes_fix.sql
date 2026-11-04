-- Keep S01-S99 stable; avoid lpad truncating S100 and above.
insert into public.yawmi_seasons(code,starts_at,ends_at)
select 'S'||case when n+1<10 then '0' else '' end||(n+1)::text,
 ((timestamp '2026-10-01' + n*interval '3 months') at time zone 'Asia/Riyadh'),
 ((timestamp '2026-10-01' + (n+1)*interval '3 months') at time zone 'Asia/Riyadh')
from generate_series(99,399) n on conflict(code) do nothing;
create index if not exists yawmi_season_days_user_idx on public.yawmi_season_days(user_id);
create index if not exists yawmi_standings_user_idx on public.yawmi_season_standings(user_id);
create index if not exists yawmi_awards_user_idx on public.yawmi_season_awards(user_id);
create index if not exists yawmi_quest_awards_user_idx on public.yawmi_season_quest_awards(user_id);
