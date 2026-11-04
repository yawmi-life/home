-- Supabase Cron runs UTC: 21:00 UTC is 00:00 Asia/Riyadh.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
select cron.schedule(
 'yawmi_finalize_seasons_daily',
 '0 21 * * *',
 'select public.yawmi_season_finalize();'
);
