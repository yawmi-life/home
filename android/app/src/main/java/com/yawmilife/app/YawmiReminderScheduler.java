package com.yawmilife.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Device-local reminders. The website can send ONLY generic event identifiers
 * and times through a first-party, main-frame, custom-scheme navigation.
 * No JWTs, account details, titles or sensitive text are stored in Android alarms.
 * AlarmManager is inexact on modern devices; this is NOT a remote push service.
 */
public final class YawmiReminderScheduler {
    private static final String PREF = "yawmi_android_reminders_v1";
    private static final String DATA = "events";
    private static final String ENABLED = "enabled";
    static final String ALARM_ACTION = "com.yawmilife.app.YAWMI_REMINDER";
    private static final long WINDOW = 31L * 24 * 60 * 60 * 1000;
    private YawmiReminderScheduler() {}

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREF, Context.MODE_PRIVATE);
    }
    public static boolean enabled(Context c) {
        return prefs(c).getBoolean(ENABLED, false);
    }
    public static boolean permitted(Context c) {
        return Build.VERSION.SDK_INT < 33 ||
            c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }
    public static void enable(Context c) {
        prefs(c).edit().putBoolean(ENABLED, true).apply();
        YawmiReminderReceiver.createChannel(c);
        reschedule(c);
    }
    public static void disable(Context c) {
        cancelPrevious(c);
        prefs(c).edit().putBoolean(ENABLED, false).remove(DATA).apply();
    }
    private static int requestCode(String key) {
        return key.hashCode() & 0x7fffffff;
    }
    private static PendingIntent pending(Context c, String key) {
        Intent i = new Intent(c, YawmiReminderReceiver.class);
        i.setAction(ALARM_ACTION);
        i.putExtra("rid", requestCode(key));
        return PendingIntent.getBroadcast(c, requestCode(key), i,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    private static void cancelPrevious(Context c) {
        AlarmManager alarms = (AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;
        try {
            JSONArray previous = new JSONArray(prefs(c).getString(DATA, "[]"));
            for (int n=0; n<previous.length(); n++) {
                JSONObject o=previous.optJSONObject(n);
                if (o != null) alarms.cancel(pending(c,o.optString("id","")));
            }
        } catch (Exception ignored) {}
    }
    public static void sync(Context c, String raw) {
        if (!enabled(c) || raw == null || raw.length() > 22000) return;
        try {
            JSONArray data = new JSONArray(raw);
            if (data.length() > 64) return;
            JSONArray safe = new JSONArray();
            long now = System.currentTimeMillis();
            for (int n=0; n<data.length(); n++) {
                JSONObject item = data.optJSONObject(n);
                if(item == null) continue;
                String id = item.optString("id","");
                long at = item.optLong("at",0L);
                if(!id.matches("^[A-Za-z0-9:_\\-]{1,90}$") ||
                    at < now + 5000 || at > now + WINDOW) continue;
                safe.put(new JSONObject().put("id",id).put("at",at));
            }
            cancelPrevious(c);
            prefs(c).edit().putString(DATA,safe.toString()).apply();
            reschedule(c);
        } catch (Exception ignored) {
            // Malformed data must not delete previously scheduled reminders.
        }
    }
    public static int count(Context c) {
        if(!enabled(c))return 0;
        try{
            JSONArray a=new JSONArray(prefs(c).getString(DATA,"[]"));
            int n=0;long now=System.currentTimeMillis();
            for(int i=0;i<a.length();i++){
                JSONObject item=a.optJSONObject(i);
                if(item!=null&&item.optLong("at",0)>now)n++;
            }
            return n;
        }catch(Exception ignored){return 0;}
    }
    public static long nextAt(Context c){
        if(!enabled(c))return 0L;
        long earliest=Long.MAX_VALUE,now=System.currentTimeMillis();
        try{
            JSONArray items=new JSONArray(prefs(c).getString(DATA,"[]"));
            for(int i=0;i<items.length();i++){
                JSONObject item=items.optJSONObject(i);
                if(item==null)continue;
                long t=item.optLong("at",0);
                if(t>now&&t<earliest)earliest=t;
            }
        }catch(Exception ignored){}
        return earliest==Long.MAX_VALUE?0L:earliest;
    }
    public static void reschedule(Context c) {
        if (!enabled(c)) return;
        AlarmManager alarms = (AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;
        try {
            JSONArray items = new JSONArray(prefs(c).getString(DATA, "[]"));
            long now = System.currentTimeMillis();
            for (int n=0; n<items.length(); n++) {
                JSONObject item = items.optJSONObject(n);
                if(item == null) continue;
                String id=item.optString("id","");
                long at=item.optLong("at",0L);
                if (!id.matches("^[A-Za-z0-9:_\\-]{1,90}$") ||
                    at <= now || at > now + WINDOW) continue;
                // Inexact alarms work without restricted exact-alarm permission.
                alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending(c,id));
            }
        } catch (Exception ignored) {}
    }
}
