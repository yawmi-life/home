package com.yawmilife.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.os.Build;

/**
 * Receives the OS result of a self-update session.
 * STATUS_PENDING_USER_ACTION is a normal valid fallback; no install UI bypass.
 */
public final class YawmiUpdateInstallResultReceiver extends BroadcastReceiver {
    static final String ACTION_RESULT = "com.yawmilife.app.ACTION_YAWMI_SELF_UPDATE_RESULT";
    private static final String CHANNEL = "yawmi_update_confirm";

    @Override public void onReceive(Context context, Intent result) {
        if (result == null || !ACTION_RESULT.equals(result.getAction())) return;
        int status = result.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        if (status == PackageInstaller.STATUS_SUCCESS) {
            context.getSharedPreferences("yawmi_update_state", Context.MODE_PRIVATE)
                .edit().remove("os_update_confirmation_pending").remove("staged_apk_name").apply();
            return;
        }
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            // A non-silent update is not a failure. Forward the confirmation
            // supplied by Android itself; never fake confirmation.
            context.getSharedPreferences("yawmi_update_state", Context.MODE_PRIVATE)
                .edit().putBoolean("os_update_confirmation_pending", true).apply();
            Intent confirmation;
            if (Build.VERSION.SDK_INT >= 33)
                confirmation = result.getParcelableExtra(Intent.EXTRA_INTENT, Intent.class);
            else
                confirmation = result.getParcelableExtra(Intent.EXTRA_INTENT);
            if (confirmation == null) return;
            try {
                confirmation.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(confirmation);
                context.getSharedPreferences("yawmi_update_state", Context.MODE_PRIVATE)
                    .edit().remove("os_update_confirmation_pending").apply();
            } catch (Exception notForeground) {
                // Background activity launch may be blocked. Provide a user
                // controlled system notification rather than trying to bypass it.
                try {
                    NotificationManager nm = (NotificationManager)
                        context.getSystemService(Context.NOTIFICATION_SERVICE);
                    if (nm == null) return;
                    if (Build.VERSION.SDK_INT >= 26) {
                        nm.createNotificationChannel(new NotificationChannel(
                            CHANNEL,"تحديث يومي",NotificationManager.IMPORTANCE_DEFAULT));
                    }
                    PendingIntent approval = PendingIntent.getActivity(
                        context, (int)(System.currentTimeMillis() % 100000),
                        confirmation, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                    Notification.Builder builder = Build.VERSION.SDK_INT >= 26
                        ? new Notification.Builder(context, CHANNEL)
                        : new Notification.Builder(context);
                    Notification notification = builder
                        .setSmallIcon(context.getApplicationInfo().icon)
                        .setContentTitle("تحديث يومي جاهز")
                        .setContentText("اضغط لإكمال تثبيت التحديث باستخدام أندرويد.")
                        .setContentIntent(approval)
                        .setAutoCancel(true)
                        .build();
                    nm.notify(61206, notification);
                } catch (Exception ignored) {
                    // App launch will retry the official confirmation path.
                }
            }
        }
    }
}
