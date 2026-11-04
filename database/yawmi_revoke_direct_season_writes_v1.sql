-- Publicly exposed season tables: signed-in clients may only SELECT their own RLS rows.
-- All mutations run through authenticated, validated RPC functions, never table REST writes.
revoke insert,update,delete,truncate,references,trigger
on public.yawmi_seasons,public.yawmi_public_profiles,public.yawmi_season_days,
   public.yawmi_season_standings,public.yawmi_season_awards,
   public.yawmi_season_quest_awards,public.yawmi_friend_requests
from public,anon,authenticated;
grant select on public.yawmi_seasons,public.yawmi_public_profiles,
 public.yawmi_season_days,public.yawmi_season_standings,
 public.yawmi_season_awards,public.yawmi_season_quest_awards,
 public.yawmi_friend_requests to authenticated;
