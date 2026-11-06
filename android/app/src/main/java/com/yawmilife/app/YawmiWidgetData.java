package com.yawmilife.app;

import android.appwidget.AppWidgetManager;
import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Snapshot-only launcher bridge. No auth JWT, credentials, task titles, diary,
 * Quran notes, transactions or personally identifiable data leave the web app.
 * Linked devices hold only a revocable 256-bit read token in private storage.
 */
final class YawmiWidgetData {
    private static final String PREF = "yawmi_widget_private_v2";
    private static final String API = "https://afvezxyipdytcuatragm.supabase.co/functions/v1/yawmi-widget-read";
    private static final String TOKEN = "device_token";
    private static final String SNAPSHOT = "public_counts";
    static final String ACTION_REFRESH = "com.yawmilife.app.WIDGET_REFRESH";
    private static final ExecutorService POOL = Executors.newSingleThreadExecutor();
    private static final AtomicLong LAST_ATTEMPT = new AtomicLong(0);
    private YawmiWidgetData(){}

    private static SharedPreferences preferences(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREF,Context.MODE_PRIVATE);
    }
    static void link(Context c, String token) {
        if (!isToken(token)) return;
        preferences(c).edit().putString(TOKEN,token).remove(SNAPSHOT).apply();
        LAST_ATTEMPT.set(0);
        repaintAll(c);
        fetchAsync(c,null,true);
    }
    static void unlink(Context c) {
        preferences(c).edit().clear().apply();
        LAST_ATTEMPT.set(0);
        repaintAll(c);
    }
    static boolean linked(Context c){return isToken(preferences(c).getString(TOKEN,""));}
    static boolean isToken(String value){return value!=null&&value.matches("^[a-f0-9]{64}$");}
    static JSONObject snapshot(Context c) {
        try {return new JSONObject(preferences(c).getString(SNAPSHOT,"{}"));}
        catch(Exception ignored){return new JSONObject();}
    }
    static int integer(JSONObject value,String name,int upper) {
        return Math.min(upper,Math.max(0,value.optInt(name,0)));
    }

    static void repaintAll(Context c){
        AppWidgetManager manager=AppWidgetManager.getInstance(c);
        YawmiCategoryWidget[] providers={
            new YawmiCategoryWidget.Today(),new YawmiCategoryWidget.Productivity(),
            new YawmiCategoryWidget.Planning(),new YawmiCategoryWidget.Learning(),
            new YawmiCategoryWidget.Wellbeing(),new YawmiCategoryWidget.Life()
        };
        for(YawmiCategoryWidget provider:providers){
            ComponentName component=new ComponentName(c,provider.getClass());
            int[] ids=manager.getAppWidgetIds(component);
            if(ids!=null&&ids.length>0)provider.render(c,manager,ids);
        }
    }

    static void fetchAsync(Context context, PendingResultHolder ignored, boolean force) {
        fetchAsync(context,(android.content.BroadcastReceiver.PendingResult)null,force);
    }
    static void fetchAsync(Context context, android.content.BroadcastReceiver.PendingResult pending, boolean force) {
        Context app=context.getApplicationContext();
        if(!linked(app)){if(pending!=null)pending.finish();return;}
        long now=System.currentTimeMillis(),old=LAST_ATTEMPT.get();
        if(!force&&now-old<60000){if(pending!=null)pending.finish();return;}
        if(!LAST_ATTEMPT.compareAndSet(old,now)){if(pending!=null)pending.finish();return;}
        POOL.execute(()->{
            try{download(app);}
            catch(Exception ex){Log.w("YawmiWidget","Snapshot refresh unavailable");}
            finally{repaintAll(app);if(pending!=null)pending.finish();}
        });
    }
    private static void download(Context context)throws Exception {
        String token=preferences(context).getString(TOKEN,"");
        if(!isToken(token))return;
        HttpURLConnection connection=(HttpURLConnection)new URL(API).openConnection();
        try{
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(9000);
            connection.setReadTimeout(9000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type","application/json");
            connection.setRequestProperty("Accept","application/json");
            connection.setRequestProperty("Cache-Control","no-store");
            byte[] request=new JSONObject().put("token",token).toString().getBytes(StandardCharsets.UTF_8);
            try(OutputStream out=connection.getOutputStream()){out.write(request);}
            int status=connection.getResponseCode();
            if(status==404||status==401){
                unlink(context);return;
            }
            if(status!=200)return;
            ByteArrayOutputStream stream=new ByteArrayOutputStream();
            try(InputStream in=connection.getInputStream()){
                byte[] buf=new byte[1024];int n;
                while((n=in.read(buf))!=-1&&stream.size()<8192)stream.write(buf,0,n);
            }
            if(stream.size()>8192)return;
            JSONObject response=new JSONObject(stream.toString("UTF-8"));
            JSONObject values=response.optJSONObject("snapshot");
            if(values==null)return;
            String date=values.optString("day","");
            if(!date.matches("^\\d{4}-\\d{2}-\\d{2}$"))return;
            // Keep only the explicit aggregate fields, never arbitrary server content.
            JSONObject clean=new JSONObject().put("day",date);
            String[] fields={"progress","tasksDone","tasksTotal","habitsDone","habitsTotal",
                "xp","level","streak","goalsDone","goalsTotal","booksCount",
                "waterMl","waterGoalMl","readingPages"};
            for(String field:fields)clean.put(field,integer(values,field,100000000));
            clean.put("synced",response.optString("updated_at",""));
            // Prevent a pending response for an old account/device from replacing a new link.
            if(token.equals(preferences(context).getString(TOKEN,"")))
                preferences(context).edit().putString(SNAPSHOT,clean.toString()).apply();
        }finally{connection.disconnect();}
    }
    // No instantiable holder; prevents callers from passing untrusted callbacks.
    interface PendingResultHolder {}
}
