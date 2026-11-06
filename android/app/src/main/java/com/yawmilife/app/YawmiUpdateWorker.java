package com.yawmilife.app;

import android.app.DownloadManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import androidx.work.WorkManager;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

/**
 * Background Android APK update check when YAWMI isn't open.
 * WorkManager schedules best-effort polling; Android can defer background
 * work due to battery/network constraints. Only original-signed releases may
 * be installed, with a normal OS confirmation fallback where required.
 */
public final class YawmiUpdateWorker extends Worker {
    private static final String UNIQUE = "yawmi_official_native_updates";
    private static final String PREFS = "yawmi_update_state";
    private static final long MAX_SIZE = 60L * 1024 * 1024;

    public YawmiUpdateWorker(@NonNull Context app, @NonNull WorkerParameters params) {
        super(app, params);
    }

    public static void schedule(Context context) {
        try {
            Constraints online = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();
            PeriodicWorkRequest work = new PeriodicWorkRequest.Builder(
                YawmiUpdateWorker.class, 30, TimeUnit.MINUTES)
                .setConstraints(online)
                .build();
            WorkManager.getInstance(context.getApplicationContext())
                .enqueueUniquePeriodicWork(UNIQUE, ExistingPeriodicWorkPolicy.KEEP, work);
        } catch (Exception ignored) {
            // The normal foreground launch check remains available.
        }
    }

    @NonNull @Override public Result doWork() {
        Context context = getApplicationContext();
        if (YawmiUpdateManager.isUptodownManaged(context)) return Result.success();
        SharedPreferences state = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        DownloadManager manager = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
        if (manager == null) return Result.success();
        try {
            long pending = state.getLong("download_id", -1);
            if (pending >= 0) {
                finishDownloadedIfReady(context, manager, state, pending);
                return Result.success();
            }
            // The user may have to approve the device's official install
            // screen. Never download another copy while approval is pending.
            if (state.getBoolean("os_update_confirmation_pending", false)) return Result.success();

            JSONObject latest = YawmiUpdateManager.requestJson(YawmiUpdateManager.API);
            if (latest.optBoolean("draft") || latest.optBoolean("prerelease"))
                return Result.success();
            String tag = latest.optString("tag_name", "");
            int[] newVersion = YawmiUpdateManager.parseVersion(tag);
            PackageInfo installed = context.getPackageManager()
                .getPackageInfo(context.getPackageName(), 0);
            int[] oldVersion = YawmiUpdateManager.parseVersion(
                "android-v" + installed.versionName);
            if (newVersion == null || oldVersion == null ||
                YawmiUpdateManager.compare(newVersion, oldVersion) <= 0)
                return Result.success();

            String downloadUrl = "", sha = "", shaUrl = "";
            JSONArray assets = latest.getJSONArray("assets");
            for (int i = 0; i < assets.length(); i++) {
                JSONObject asset = assets.getJSONObject(i);
                String filename = asset.optString("name", "");
                String url = asset.optString("browser_download_url", "");
                if (!YawmiUpdateManager.trustedDownload(url, tag)) continue;
                if (filename.endsWith(".apk") &&
                    asset.optLong("size", 0) > 100000 &&
                    asset.optLong("size", 0) <= MAX_SIZE) {
                    downloadUrl = url;
                    String officialDigest = asset.optString("digest", "");
                    if (officialDigest.matches("(?i)^sha256:[a-f0-9]{64}$"))
                        sha = officialDigest.substring(7).toLowerCase(Locale.ROOT);
                } else if (filename.matches("(?i).*(sha256|checksum).*\\.txt")) {
                    shaUrl = url;
                }
            }
            if (downloadUrl.isEmpty()) return Result.success();
            if (sha.isEmpty() && !shaUrl.isEmpty())
                sha = YawmiUpdateManager.checksum(shaUrl);
            if (!sha.matches("^[a-f0-9]{64}$")) return Result.success();

            // The worker and foreground updater share the same persistent
            // DownloadManager ID, so only one pending update can be tracked.
            synchronized (YawmiUpdateWorker.class) {
                if (state.getLong("download_id", -1) >= 0) return Result.success();
                File dir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (dir == null || (!dir.isDirectory() && !dir.mkdirs()))
                    return Result.success();
                String local = "yawmi-" + tag + "-update.apk";
                File file = new File(dir, local);
                if (file.exists() && !file.delete()) return Result.success();
                DownloadManager.Request request = new DownloadManager.Request(
                    Uri.parse(downloadUrl));
                request.setMimeType("application/vnd.android.package-archive");
                request.setTitle("تحديث يومي " + tag.substring("android-v".length()));
                request.setNotificationVisibility(
                    DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalFilesDir(
                    context, Environment.DIRECTORY_DOWNLOADS, local);
                request.setAllowedOverMetered(true);
                request.setAllowedOverRoaming(false);
                long id = manager.enqueue(request);
                state.edit().putLong("download_id", id)
                    .putString("download_name", local)
                    .putString("download_sha", sha)
                    .apply();
            }
        } catch (Exception ignored) {
            // No side effects on data or the old APK when network is flaky.
        }
        return Result.success();
    }

    private static void finishDownloadedIfReady(Context app, DownloadManager dm,
                                                 SharedPreferences state, long id) {
        try (android.database.Cursor row =
                 dm.query(new DownloadManager.Query().setFilterById(id))) {
            if (row == null || !row.moveToFirst()) return;
            int status = row.getInt(row.getColumnIndexOrThrow(
                DownloadManager.COLUMN_STATUS));
            if (status == DownloadManager.STATUS_FAILED) {
                state.edit().remove("download_id").apply();
                return;
            }
            if (status != DownloadManager.STATUS_SUCCESSFUL) return;
        } catch (Exception ignored) { return; }

        String name = state.getString("download_name", "");
        String expected = state.getString("download_sha", "");
        if (!name.matches("^yawmi-android-v[0-9.]+-update\\.apk$") ||
            !expected.matches("^[a-f0-9]{64}$")) return;
        File dir = app.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (dir == null) return;
        File apk = new File(dir, name);
        try {
            if (!apk.isFile() || apk.length() < 100000 || apk.length() > MAX_SIZE ||
                !expected.equals(YawmiUpdateManager.fileSha256(apk)) ||
                !YawmiUpdateManager.originalSignatureAndUpgrade(app, apk)) {
                apk.delete();
                state.edit().remove("download_id").apply();
                return;
            }
            state.edit()
                .putString("staged_apk_name", name)
                .remove("download_id")
                .apply();
            // Android < 12 requires the official user-confirmed install
            // when they next open YAWMI. On eligible newer devices the OS may
            // complete the self-update with no user action.
            if (!YawmiSelfUpdateSession.commit(app, apk))
                state.edit().putBoolean("os_update_confirmation_pending", true).apply();
        } catch (Exception ignored) {
            // Never mark an unverified APK as installable.
        }
    }
}
