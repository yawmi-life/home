package com.yawmilife.app;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.os.Build;

import java.io.File;
import java.io.FileInputStream;
import java.io.OutputStream;

/**
 * Self-update an already installed original-signed YAWMI APK.
 * Android 12+ may allow an app to update itself without confirmation when all
 * PackageInstaller eligibility conditions are met; it can always ask the user.
 * This method never bypasses package-manager policy or signature checks.
 */
final class YawmiSelfUpdateSession {
    private YawmiSelfUpdateSession() {}

    static boolean commit(Context context, File verifiedApk) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return false;
        if (verifiedApk == null || !verifiedApk.isFile()) return false;
        PackageInstaller installer = context.getPackageManager().getPackageInstaller();
        int sessionId = -1;
        try {
            PackageInstaller.SessionParams params =
                new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
            params.setAppPackageName(context.getPackageName());
            params.setSize(verifiedApk.length());
            params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
            sessionId = installer.createSession(params);
            try (PackageInstaller.Session session = installer.openSession(sessionId)) {
                try (FileInputStream input = new FileInputStream(verifiedApk);
                     OutputStream output = session.openWrite("base.apk", 0, verifiedApk.length())) {
                    byte[] chunk = new byte[32768];
                    int count;
                    while ((count = input.read(chunk)) > 0) {
                        output.write(chunk, 0, count);
                    }
                    session.fsync(output);
                }
                Intent callback = new Intent(context, YawmiUpdateInstallResultReceiver.class);
                callback.setAction(YawmiUpdateInstallResultReceiver.ACTION_RESULT);
                PendingIntent pending = PendingIntent.getBroadcast(
                    context, sessionId, callback,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
                session.commit(pending.getIntentSender());
            }
            return true;
        } catch (Exception failure) {
            if (sessionId >= 0) {
                try { installer.abandonSession(sessionId); } catch (Exception ignored) {}
            }
            return false;
        }
    }
}
