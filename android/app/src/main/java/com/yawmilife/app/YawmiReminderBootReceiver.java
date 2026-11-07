package com.yawmilife.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Recover the user's explicitly enabled, future local alarms after reboot/update. */
public final class YawmiReminderBootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if(intent == null) return;
        String action=intent.getAction();
        if(Intent.ACTION_BOOT_COMPLETED.equals(action) ||
           Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            YawmiReminderScheduler.reschedule(context);
        }
    }
}
