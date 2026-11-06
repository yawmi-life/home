package com.yawmilife.app;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.work.ExistingWorkPolicy;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;

/** Ask WorkManager to verify a finished official YAWMI APK immediately. */
public final class YawmiDownloadCompletedReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (intent == null ||
            !DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())) return;
        long completed = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
        long expected = context.getSharedPreferences("yawmi_update_state", Context.MODE_PRIVATE)
            .getLong("download_id", -2L);
        if (completed < 0 || completed != expected) return;
        try {
            OneTimeWorkRequest work = new OneTimeWorkRequest.Builder(
                YawmiUpdateWorker.class).build();
            WorkManager.getInstance(context.getApplicationContext())
                .enqueueUniqueWork("yawmi_verify_downloaded_update",
                    ExistingWorkPolicy.KEEP, work);
        } catch (Exception ignored) {
            // The next periodic/background check or app resume also verifies it.
        }
    }
}
