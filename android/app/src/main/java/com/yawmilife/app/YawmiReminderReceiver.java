package com.yawmilife.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/** Android system notifications, independent of WebView, service workers and Chrome. */
public final class YawmiReminderReceiver extends android.content.BroadcastReceiver {
    private static final String CHANNEL = "yawmi_reminders";
    static void createChannel(Context c) {
        if(Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);
            if(nm == null) return;
            NotificationChannel ch=new NotificationChannel(CHANNEL,
                "تذكيرات يومي",NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("تنبيهات المهام والمواعيد والتذكيرات المحفوظة في يومي");
            nm.createNotificationChannel(ch);
        }
    }
    static void send(Context c, int id) {
        if(!YawmiReminderScheduler.enabled(c) || !YawmiReminderScheduler.permitted(c))return;
        createChannel(c);
        Intent launch=new Intent(c,YawmiMainActivity.class);
        launch.setAction(Intent.ACTION_VIEW);
        launch.setData(android.net.Uri.parse("https://yawmi-life.github.io/home/index.html?source=notification&quick=calendar"));
        launch.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent open=PendingIntent.getActivity(c,id,launch,
            PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b=Build.VERSION.SDK_INT>=26
            ?new Notification.Builder(c,CHANNEL):new Notification.Builder(c);
        b.setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle("يومي LifeOS")
            .setContentText("عندك موعد أو مهمة تستحق المراجعة في يومي.")
            .setAutoCancel(true)
            .setContentIntent(open)
            .setVisibility(Notification.VISIBILITY_PRIVATE);
        NotificationManager manager=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);
        try{if(manager!=null)manager.notify(id,b.build());}
        catch(SecurityException ignored){}
    }
    @Override public void onReceive(Context context,Intent intent) {
        if(intent==null||!YawmiReminderScheduler.ALARM_ACTION.equals(intent.getAction()))return;
        send(context, intent.getIntExtra("rid",42002));
    }
}
