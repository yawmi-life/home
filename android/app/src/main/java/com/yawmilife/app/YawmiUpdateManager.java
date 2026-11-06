package com.yawmilife.app;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * In-place updater for the ORIGINAL YAWMI package.
 * Only stable official GitHub releases are considered.
 * Checks run automatically, while download and Android installation require
 * a real user opt-in. Android always retains its system install confirmation.
 */
final class YawmiUpdateManager {
    static final String API =
        "https://api.github.com/repos/yawmi-life/home/releases/latest";
    static final String REPO = "yawmi-life/home";
    private static final String PREFS = "yawmi_update_state";
    private static final String KEY_LAST_CHECK = "last_check";
    private static final String KEY_DOWNLOAD_ID = "download_id";
    private static final String KEY_DOWNLOAD_NAME = "download_name";
    private static final String KEY_SHA = "download_sha";
    private static final long AUTO_INTERVAL = 30L * 60 * 1000;
    static final long MAX_APK_SIZE = 60L * 1024 * 1024;
    private final Activity activity;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private DownloadManager downloads;
    private File verifiedApk;
    private volatile boolean checking, verifying, active;
    private BroadcastReceiver receiver;

    YawmiUpdateManager(Activity activity) {
        this.activity = activity;
        this.downloads = (DownloadManager) activity.getSystemService(Context.DOWNLOAD_SERVICE);
        receiver = new BroadcastReceiver() {
            @Override public void onReceive(Context context, Intent intent) {
                if (!DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())) return;
                long finished = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
                if (finished == state().getLong(KEY_DOWNLOAD_ID, -2L)) resumePendingInstall();
            }
        };
        IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= 33) {
            activity.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            activity.registerReceiver(receiver, filter);
        }
    }

    private SharedPreferences state() {
        return activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
    private void toast(String message) {
        activity.runOnUiThread(() -> {
            if (!activity.isFinishing() && !activity.isDestroyed())
                Toast.makeText(activity, message, Toast.LENGTH_LONG).show();
        });
    }

    void check(boolean manuallyRequested) {
        if (checking || active || verifiedApk != null) return;
        if (state().getLong(KEY_DOWNLOAD_ID, -1) >= 0) {
            resumePendingInstall();
            return;
        }
        // After Uptodown distribution is enabled, let its installed app
        // manage APK updates for devices installed through that store.
        if (isUptodownManaged()) return;
        long now = System.currentTimeMillis();
        long last = state().getLong(KEY_LAST_CHECK, 0L);
        if (!manuallyRequested && now - last < AUTO_INTERVAL && now >= last) return;
        checking = true;
        executor.execute(() -> {
            try {
                JSONObject release = requestJson(API);
                if (release.optBoolean("draft") || release.optBoolean("prerelease"))
                    throw new IllegalStateException("غير متاح إصدار مستقر");
                String tag = release.optString("tag_name", "");
                int[] newer = parseVersion(tag);
                String installedVersion = activity.getPackageManager().getPackageInfo(activity.getPackageName(),0).versionName;
                int[] installed = parseVersion("android-v" + installedVersion);
                if (newer == null || installed == null)
                    throw new IllegalStateException("صيغة الإصدار غير صالحة");
                state().edit().putLong(KEY_LAST_CHECK, System.currentTimeMillis()).apply();
                if (compare(newer, installed) <= 0) {
                    if (manuallyRequested) toast("لا يوجد تحديث رسمي أحدث من إصدارك الحالي.");
                    return;
                }
                JSONArray assets = release.getJSONArray("assets");
                String apk = "", checksumUrl = "", digest = "";
                for (int i = 0; i < assets.length(); i++) {
                    JSONObject asset = assets.getJSONObject(i);
                    String filename = asset.optString("name", "");
                    String url = asset.optString("browser_download_url", "");
                    if (filename.toLowerCase(Locale.ROOT).endsWith(".apk") &&
                        trustedDownload(url, tag) && asset.optLong("size", 0) > 0 &&
                        asset.optLong("size") <= MAX_APK_SIZE) {
                        apk = url;
                        String publishedDigest = asset.optString("digest", "");
                        if (publishedDigest.matches("(?i)^sha256:[a-f0-9]{64}$"))
                            digest = publishedDigest.substring(7).toLowerCase(Locale.ROOT);
                    } else if (filename.matches("(?i).*(?:sha256|checksum).*\\.txt") &&
                        trustedDownload(url, tag)) {
                        checksumUrl = url;
                    }
                }
                if (apk.isEmpty())
                    throw new IllegalStateException("ملف APK الرسمي غير متاح");
                if (digest.isEmpty() && !checksumUrl.isEmpty())
                    digest = checksum(checksumUrl);
                if (!digest.matches("^[a-f0-9]{64}$"))
                    throw new IllegalStateException("ملف التحديث يفتقد بصمة تحقق موثوقة");
                final String targetApk = apk, targetSha = digest, version = tag;
                // No in-app update dialog and no extra control: queue the
                // signed APK automatically, then let Android decide whether
                // it can apply a self-update without user intervention.
                activity.runOnUiThread(() -> {
                    if (!activity.isFinishing() && !activity.isDestroyed())
                        download(targetApk, targetSha, version);
                });
            } catch (Exception error) {
                if (manuallyRequested) toast("تعذّر فحص التحديثات. تحقق من الإنترنت أو إصدار GitHub الرسمي.");
            } finally { checking = false; }
        });
    }

    static boolean trustedDownload(String url, String tag) {
        try {
            Uri u = Uri.parse(url);
            return "https".equalsIgnoreCase(u.getScheme()) &&
                "github.com".equalsIgnoreCase(u.getHost()) &&
                u.getPath() != null && u.getPath().startsWith("/" + REPO + "/releases/download/" + tag + "/");
        } catch (Exception ignored) { return false; }
    }

    static int[] parseVersion(String tag) {
        if (!tag.matches("^android-v[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}$")) return null;
        String[] parts = tag.substring("android-v".length()).split("\\.");
        return new int[]{Integer.parseInt(parts[0]),Integer.parseInt(parts[1]),Integer.parseInt(parts[2])};
    }
    static int compare(int[] left, int[] right) {
        for (int i=0;i<3;i++) if (left[i]!=right[i]) return Integer.compare(left[i],right[i]);
        return 0;
    }

    private static HttpURLConnection connect(String url) throws Exception {
        HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();
        c.setConnectTimeout(10000);
        c.setReadTimeout(12000);
        c.setInstanceFollowRedirects(true);
        c.setRequestProperty("User-Agent","YAWMI-LifeOS-Android-Update");
        c.setRequestProperty("Accept","application/vnd.github+json, application/json, text/plain");
        if (c.getResponseCode()!=200) {
            c.disconnect();
            throw new IllegalStateException("HTTP update request unsuccessful");
        }
        return c;
    }
    private static String readLimited(String url, int maxBytes) throws Exception {
        HttpURLConnection c = connect(url);
        try (InputStream stream = c.getInputStream()) {
            byte[] buffer = new byte[4096];
            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            int n;
            while ((n=stream.read(buffer))!=-1) {
                if (out.size()+n>maxBytes) throw new IllegalArgumentException("Response too large");
                out.write(buffer,0,n);
            }
            return out.toString("UTF-8");
        } finally { c.disconnect(); }
    }
    static JSONObject requestJson(String url) throws Exception {
        return new JSONObject(readLimited(url,512*1024));
    }
    static String checksum(String url) throws Exception {
        String document=readLimited(url,2048).trim();
        java.util.regex.Matcher match =
            java.util.regex.Pattern.compile("(?i)(?:^|\\s)([a-f0-9]{64})(?:\\s|$)").matcher(document);
        return match.find()?match.group(1).toLowerCase(Locale.ROOT):"";
    }

    private void download(String url, String sha, String tag) {
        if (downloads == null || active) { toast("تعذّر بدء التنزيل أو هناك تحديث قيد التنزيل."); return; }
        try {
            File folder=activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (folder==null) throw new IllegalStateException("Unavailable app download directory");
            if (!folder.exists()&&!folder.mkdirs()) throw new IllegalStateException("Could not prepare directory");
            String filename="yawmi-"+tag+"-update.apk";
            File target=new File(folder,filename);
            if(target.exists()&&!target.delete())throw new IllegalStateException("Old download cannot be removed");
            DownloadManager.Request request=new DownloadManager.Request(Uri.parse(url));
            request.setMimeType("application/vnd.android.package-archive");
            request.setTitle("تحديث يومي "+tag.replace("android-v",""));
            request.setDescription("تحديث نفس تطبيق يومي مع الحفاظ على البيانات");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalFilesDir(activity,Environment.DIRECTORY_DOWNLOADS,filename);
            request.setAllowedOverMetered(true);
            request.setAllowedOverRoaming(false);
            long id=downloads.enqueue(request);
            state().edit().putLong(KEY_DOWNLOAD_ID,id).putString(KEY_DOWNLOAD_NAME,filename)
                .putString(KEY_SHA,sha).apply();
            active=true;
            // DownloadManager supplies a normal Android progress notification.
            // No in-app update screen or tap-to-download prompt.
        } catch (Exception error) {
            active=false;
            toast("تعذّر تنزيل التحديث من GitHub. جرّب مرة أخرى.");
        }
    }

    void resumePendingInstall() {
        long id=state().getLong(KEY_DOWNLOAD_ID,-1);
        if (id<0||downloads==null||verifying) return;
        try (android.database.Cursor cursor=downloads.query(new DownloadManager.Query().setFilterById(id))) {
            if(cursor==null||!cursor.moveToFirst())return;
            int status=cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            if(status==DownloadManager.STATUS_FAILED) {
                state().edit().remove(KEY_DOWNLOAD_ID).apply();
                active=false;
                toast("فشل تنزيل التحديث. حاول مرة أخرى.");
                return;
            }
            if(status!=DownloadManager.STATUS_SUCCESSFUL)return;
        } catch(Exception failure) {return;}
        String filename=state().getString(KEY_DOWNLOAD_NAME,"");
        String sha=state().getString(KEY_SHA,"");
        File folder=activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if(folder==null||!filename.matches("^yawmi-android-v[0-9.]+-update\\.apk$")||
            !sha.matches("^[a-f0-9]{64}$"))return;
        File apk=new File(folder,filename);
        verifying=true;
        executor.execute(() -> {
            try {
                if (!apk.isFile() || apk.length()<100000 || apk.length()>MAX_APK_SIZE)
                    throw new IllegalStateException("Invalid APK file size");
                if (!sha.equals(fileSha256(apk))) throw new SecurityException("APK checksum mismatch");
                if (!originalSignatureAndUpgrade(activity,apk))
                    throw new SecurityException("APK package or signer mismatch");
                state().edit().remove(KEY_DOWNLOAD_ID).putString("staged_apk_name",filename).apply();
                // On eligible Android 12+ self-updates this can be applied by
                // the OS without manual confirmation. Other devices receive
                // the official PackageInstaller approval screen.
                final boolean sessionCommitted = YawmiSelfUpdateSession.commit(activity,apk);
                activity.runOnUiThread(() -> {
                    active=false;
                    if (!sessionCommitted) {
                        verifiedApk=apk;
                        installWithSystemConfirmation();
                    }
                });
            } catch (Exception failure) {
                apk.delete();
                state().edit().remove(KEY_DOWNLOAD_ID).apply();
                toast("تم رفض التحديث لأنه لم يجتز فحص الأمان أو التوقيع.");
                active=false;
            } finally { verifying=false; }
        });
    }

    static String fileSha256(File file) throws Exception {
        MessageDigest sha=MessageDigest.getInstance("SHA-256");
        try(InputStream in=new FileInputStream(file)) {
            byte[] buf=new byte[16384];int n;
            while((n=in.read(buf))!=-1)sha.update(buf,0,n);
        }
        StringBuilder out=new StringBuilder(64);
        for(byte b:sha.digest())out.append(String.format(Locale.US,"%02x",b & 0xff));
        return out.toString();
    }
    @SuppressWarnings("deprecation")
    static boolean originalSignatureAndUpgrade(Context app, File apk) {
        try {
            PackageManager pm=app.getPackageManager();
            int flags=Build.VERSION.SDK_INT>=28?
                PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES;
            PackageInfo candidate=pm.getPackageArchiveInfo(apk.getAbsolutePath(),flags);
            PackageInfo installed=pm.getPackageInfo(app.getPackageName(),flags);
            if(candidate==null || !app.getPackageName().equals(candidate.packageName))return false;
            long theirs=Build.VERSION.SDK_INT>=28?candidate.getLongVersionCode():candidate.versionCode;
            long ours=Build.VERSION.SDK_INT>=28?installed.getLongVersionCode():installed.versionCode;
            if(theirs<=ours)return false;
            Signature[] c=Build.VERSION.SDK_INT>=28?
                candidate.signingInfo.getApkContentsSigners():candidate.signatures;
            Signature[] i=Build.VERSION.SDK_INT>=28?
                installed.signingInfo.getApkContentsSigners():installed.signatures;
            if(c==null||i==null||c.length!=i.length||c.length<1)return false;
            for(int k=0;k<c.length;k++)
                if(!Arrays.equals(c[k].toByteArray(),i[k].toByteArray()))return false;
            return true;
        }catch(Exception ignored){return false;}
    }

    void installWithSystemConfirmation() {
        File apk=verifiedApk;
        if(apk==null||!apk.exists())return;
        if(Build.VERSION.SDK_INT>=26&&!activity.getPackageManager().canRequestPackageInstalls()) {
            toast("اسمح ليومي بتثبيت التحديثات من إعدادات أندرويد، ثم ارجع للتطبيق.");
            Intent settings=new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:"+activity.getPackageName()));
            try {activity.startActivity(settings);}
            catch(Exception ignored){toast("يجب السماح بتثبيت تطبيقات من يومي في إعدادات الهاتف.");}
            return;
        }
        try {
            Uri content=FileProvider.getUriForFile(activity,
                activity.getPackageName()+".fileprovider",apk);
            Intent installer=new Intent(Intent.ACTION_VIEW);
            installer.setDataAndType(content,"application/vnd.android.package-archive");
            installer.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(installer);
            verifiedApk=null;
        } catch(Exception failure) {
            toast("تعذّر فتح مُثبّت Android. تأكد من سماح جهازك بتحديثات APK.");
        }
    }
    private boolean isUptodownManaged() {
        String installer = null;
        try {
            PackageManager pm = activity.getPackageManager();
            if (Build.VERSION.SDK_INT >= 30) {
                installer = pm.getInstallSourceInfo(activity.getPackageName())
                    .getInstallingPackageName();
            } else {
                installer = pm.getInstallerPackageName(activity.getPackageName());
            }
        } catch (Exception ignored) {}
        return installer != null && installer.toLowerCase(Locale.ROOT).contains("uptodown");
    }

    void onResume() {
        // Re-offer the OS install screen after Android blocks background
        // activity launching. The file is re-verified before fallback.
        if (state().getBoolean("os_update_confirmation_pending",false)) {
            state().edit().remove("os_update_confirmation_pending").apply();
            String name = state().getString("staged_apk_name","");
            String sha = state().getString(KEY_SHA,"");
            File folder = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (folder != null && name.matches("^yawmi-android-v[0-9.]+-update\\.apk$") &&
                sha.matches("^[a-f0-9]{64}$")) {
                File apk = new File(folder,name);
                executor.execute(() -> {
                    try {
                        if (apk.isFile() && apk.length() < MAX_APK_SIZE &&
                            sha.equals(fileSha256(apk)) && originalSignatureAndUpgrade(activity,apk)) {
                            activity.runOnUiThread(() -> {
                                if (!activity.isFinishing()) {
                                    verifiedApk = apk;
                                    installWithSystemConfirmation();
                                }
                            });
                        }
                    } catch (Exception ignored) {}
                });
            }
        }
        if(verifiedApk!=null)installWithSystemConfirmation();
        else resumePendingInstall();
        check(false);
    }
    void stop() {
        try {activity.unregisterReceiver(receiver);}catch(Exception ignored){}
        executor.shutdownNow();
    }
}
