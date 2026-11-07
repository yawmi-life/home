package com.yawmilife.app;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.ConsoleMessage;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import java.io.InputStream;
import java.net.URLDecoder;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Reliable first-party YAWMI Android shell. The UI and every first-party static
 * asset ship inside the APK and are served at the existing HTTPS origin.
 * Supabase authentication and sync stay networked and subject to existing RLS.
 * No JavaScript bridge with arbitrary file or account access is exposed.
 */
public final class YawmiMainActivity extends Activity {
    private static final String HOST = "yawmi-life.github.io";
    private static final String ROOT = "https://yawmi-life.github.io/home/";
    private static final int SELECT_FILE = 1126;
    private static final int ASK_AUDIO = 1127;
    private static final int ASK_NOTIFICATIONS = 1128;
    private static final int VIOLET = Color.rgb(34, 28, 59);
    private LinearLayout shell;
    private LinearLayout emergencyHeader;
    private FrameLayout content;
    private WebView web;
    private TextView status;
    private ProgressBar progress;
    private ValueCallback<Uri[]> files;
    private PermissionRequest audioRequest;
    private boolean closing;
    private boolean forceBundledFallback;
    private YawmiUpdateManager updates;
    private boolean testNotificationAfterPermission;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(VIOLET);
        getWindow().setNavigationBarColor(VIOLET);
        createShell();
        // On Android 15+ the app is edge-to-edge. Reserve the real system bars
        // once in the native shell so web controls never overlap gesture areas.
        if(Build.VERSION.SDK_INT >= 35){
            shell.setOnApplyWindowInsetsListener((view,insets)->{
                android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars());
                shell.setPadding(0,bars.top,0,bars.bottom);
                return insets;
            });
            shell.requestApplyInsets();
        }
        updates = new YawmiUpdateManager(this);
        YawmiUpdateWorker.schedule(this);
        YawmiReminderReceiver.createChannel(this);
        YawmiReminderScheduler.reschedule(this);
        try {
            configureWebView();
            navigateFromIntent(getIntent());
        } catch (Exception error) {
            showError("تعذر بدء واجهة يومي. يمكنك إعادة المحاولة أو فتح النسخة على المتصفح.");
        }
    }

    private TextView text(String label, int color, float size) {
        TextView t = new TextView(this);
        t.setText(label);
        t.setTextColor(color);
        t.setTextSize(size);
        t.setGravity(Gravity.CENTER_VERTICAL);
        return t;
    }

    private Button button(String label) {
        Button b = new Button(this);
        b.setText(label);
        b.setAllCaps(false);
        b.setTextSize(12);
        b.setTextColor(Color.WHITE);
        b.setMinHeight(0);
        b.setMinimumHeight(0);
        b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(94, 74, 161)));
        return b;
    }

    private void createShell() {
        shell = new LinearLayout(this);
        shell.setBackgroundColor(VIOLET);
        shell.setOrientation(LinearLayout.VERTICAL);
        LinearLayout header = new LinearLayout(this);
        emergencyHeader = header;
        // Full-height YAWMI canvas: the native recovery toolbar is hidden unless
        // an actual Android/web rendering error occurs, never a browser URL bar.
        header.setVisibility(View.GONE);
        header.setOrientation(LinearLayout.VERTICAL);
        header.setPadding(dp(10), dp(5), dp(10), dp(5));
        header.setBackgroundColor(VIOLET);

        LinearLayout heading = new LinearLayout(this);
        heading.setGravity(Gravity.CENTER_VERTICAL);
        TextView title = text("✦ يومي LifeOS", Color.WHITE, 15);
        title.setTypeface(null, 1);
        heading.addView(title, new LinearLayout.LayoutParams(0, dp(30), 1f));
        String version = "";
        try {
            version = getPackageManager().getPackageInfo(getPackageName(),0).versionName;
        } catch(Exception ignored){}
        TextView versionLabel = text("APK " + version, Color.rgb(210,202,242), 11);
        versionLabel.setContentDescription("نسخة تطبيق يومي الأصلية: "+version);
        heading.addView(versionLabel, new LinearLayout.LayoutParams(-2, dp(30)));
        header.addView(heading);

        LinearLayout actions = new LinearLayout(this);
        actions.setGravity(Gravity.CENTER_VERTICAL);
        Button browser = button("ويب");
        browser.setContentDescription("فتح يومي من المتصفح");
        actions.addView(browser, new LinearLayout.LayoutParams(dp(54), dp(41)));
        browser.setOnClickListener(v -> openBrowser());

        Button retry = button("↻");
        retry.setContentDescription("إعادة تحميل واجهة يومي");
        actions.addView(retry, new LinearLayout.LayoutParams(dp(46), dp(41)));
        retry.setOnClickListener(v -> reload());

        Button alerts = button("🔔");
        alerts.setContentDescription("إدارة إشعارات الهاتف الأصلية");
        actions.addView(alerts, new LinearLayout.LayoutParams(dp(54), dp(41)));
        alerts.setOnClickListener(v -> notificationOptions());
        header.addView(actions);
        shell.addView(header);
        progress = new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);
        progress.setIndeterminate(true);
        shell.addView(progress, new LinearLayout.LayoutParams(-1, dp(3)));
        content = new FrameLayout(this);
        shell.addView(content, new LinearLayout.LayoutParams(-1, 0, 1f));
        status = text("", Color.WHITE, 12);
        status.setPadding(dp(14), dp(7), dp(14), dp(7));
        status.setVisibility(View.GONE);
        shell.addView(status,new LinearLayout.LayoutParams(-1,-2));
        setContentView(shell);
    }

    private int dp(float val) {
        return Math.round(val * getResources().getDisplayMetrics().density);
    }

    private void configureWebView() {
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(247, 246, 255));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setUserAgentString(settings.getUserAgentString() + " YawmiAndroid/1.6");
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= 26) settings.setSafeBrowsingEnabled(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        WebView.setWebContentsDebuggingEnabled(false);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                WebResourceResponse bundled = bundledAuthSdk(req.getUrl(), req.getMethod());
                if (bundled != null) return bundled;
                // Online: the verified HTTPS origin serves the latest app code.
                // Offline or unavailable host: load the complete packaged app.
                return !forceBundledFallback && validatedInternet()
                    ? null : localAsset(req.getUrl(), req.getMethod());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri target = request.getUrl();
                if (target != null && "yawminotify".equalsIgnoreCase(target.getScheme())) {
                    if (request.isForMainFrame() && trustedCurrentPage()) handleNotificationCommand(target);
                    return true;
                }
                if(target != null && "yawmiwidgetdata".equalsIgnoreCase(target.getScheme())){
                    if(request.isForMainFrame() && trustedCurrentPage()){
                        if("sync".equals(target.getHost()))
                            YawmiWidgetData.acceptLocal(YawmiMainActivity.this,target.getQueryParameter("items"));
                        else if("clear".equals(target.getHost()))
                            YawmiWidgetData.unlink(YawmiMainActivity.this);
                    }
                    return true;
                }
                return route(target);
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (progress != null) progress.setVisibility(View.GONE);
                sendNotificationState();
                if (emergencyHeader != null) emergencyHeader.setVisibility(View.GONE);
                if (status != null && status.getVisibility() == View.VISIBLE) status.setVisibility(View.GONE);
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                Uri failed = request.getUrl();
                if (failed != null && "https".equalsIgnoreCase(failed.getScheme()) &&
                    HOST.equalsIgnoreCase(failed.getHost()) &&
                    failed.getPath() != null && failed.getPath().startsWith("/home/") &&
                    !forceBundledFallback) {
                    // A broken site connection should never make the installed app unusable.
                    forceBundledFallback = true;
                    view.post(() -> {
                        if (web != null) web.reload();
                    });
                } else if (request.isForMainFrame()) {
                    showError("تعذر فتح يومي. اضغط إعادة المحاولة أو افتح النسخة بالمتصفح.");
                }
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame() && response != null &&
                    response.getStatusCode() >= 500 && !forceBundledFallback) {
                    forceBundledFallback = true;
                    view.post(() -> { if (web != null) web.reload(); });
                }
            }
            @Override public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail detail) {
                content.removeView(view);
                view.destroy();
                web = null;
                showError("توقفت واجهة العرض في أندرويد. اضغط إعادة المحاولة لإعادة تشغيلها.");
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onConsoleMessage(ConsoleMessage message) {
                return true;
            }
            @Override public void onProgressChanged(WebView view, int p) {
                if (progress != null) progress.setVisibility(p >= 100 ? View.GONE : View.VISIBLE);
            }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                                       FileChooserParams params) {
                if (files != null) files.onReceiveValue(null);
                files = callback;
                try {
                    startActivityForResult(params.createIntent(), SELECT_FILE);
                    return true;
                } catch (Exception failure) {
                    files = null;
                    callback.onReceiveValue(null);
                    Toast.makeText(YawmiMainActivity.this, "لا يوجد تطبيق لاختيار الملفات.", Toast.LENGTH_LONG).show();
                    return false;
                }
            }
            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> askForAudio(request));
            }
            @Override public void onPermissionRequestCanceled(PermissionRequest request) {
                if (audioRequest == request) audioRequest = null;
            }
        });
        // Attach only after all navigation/error hooks are installed.
        content.addView(web, new FrameLayout.LayoutParams(-1, -1));
        web.setDownloadListener((url, agent, disposition, mime, length) -> {
            Uri u = Uri.parse(url);
            if ("https".equalsIgnoreCase(u.getScheme()) && u.getHost() != null) {
                openExternal(u);
            } else {
                Toast.makeText(this, "لتنزيل النسخ الاحتياطية افتح يومي من زر «المتصفح».", Toast.LENGTH_LONG).show();
            }
        });
    }


    /** Only first-party top-level pages can send scheduling commands. */
    private boolean trustedCurrentPage() {
        if (web == null) return false;
        try {
            Uri current = Uri.parse(web.getUrl());
            return "https".equalsIgnoreCase(current.getScheme()) &&
                HOST.equalsIgnoreCase(current.getHost()) &&
                current.getPath() != null && current.getPath().startsWith("/home/");
        } catch(Exception ignored) {return false;}
    }

    private void sendNotificationState() {
        if (web == null) return;
        String javascript = "window.YawmiAndroidAlerts&&window.YawmiAndroidAlerts.nativeState("
            + YawmiReminderScheduler.enabled(this) + ","
            + YawmiReminderScheduler.permitted(this) + ","
            + YawmiReminderScheduler.count(this) + ","
            + YawmiReminderScheduler.nextAt(this) + ")";
        web.evaluateJavascript(javascript, null);
    }
    private void askToEnableNotifications() {
        if (android.os.Build.VERSION.SDK_INT >= 33 && !YawmiReminderScheduler.permitted(this)) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, ASK_NOTIFICATIONS);
        } else {
            YawmiReminderScheduler.enable(this);
            if(testNotificationAfterPermission)YawmiReminderReceiver.send(this,42002);
            testNotificationAfterPermission=false;
            sendNotificationState();
            Toast.makeText(this, "تم تفعيل تذكيرات أندرويد. ستُزامن المواعيد القادمة عند فتح يومي.", Toast.LENGTH_LONG).show();
        }
    }
    private void notificationOptions() {
        final String[] actions = {
            "تفعيل إشعارات المواعيد والمهام", "إرسال إشعار تجريبي", "إيقاف إشعارات هذا الهاتف"
        };
        new android.app.AlertDialog.Builder(this)
            .setTitle("إشعارات يومي على أندرويد")
            .setItems(actions, (dialog, which) -> {
                if (which == 0) askToEnableNotifications();
                if (which == 1) {
                    if (!YawmiReminderScheduler.enabled(this) || !YawmiReminderScheduler.permitted(this)) {
                        testNotificationAfterPermission=true;
                        askToEnableNotifications();
                    }else YawmiReminderReceiver.send(this,42002);
                }
                if (which == 2) {
                    YawmiReminderScheduler.disable(this);
                    sendNotificationState();
                    Toast.makeText(this, "تم إيقاف تذكيرات هذا الهاتف.", Toast.LENGTH_SHORT).show();
                }
            }).setNegativeButton("إغلاق", null).show();
    }
    private void handleNotificationCommand(Uri uri) {
        String op = uri.getHost();
        if (op == null) return;
        switch(op) {
            case "enable":
                askToEnableNotifications();
                break;
            case "disable":
                YawmiReminderScheduler.disable(this);
                sendNotificationState();
                break;
            case "test":
                if(YawmiReminderScheduler.enabled(this) && YawmiReminderScheduler.permitted(this))
                    YawmiReminderReceiver.send(this,42002);
                else{
                    testNotificationAfterPermission=true;
                    askToEnableNotifications();
                }
                break;
            case "sync":
                if (YawmiReminderScheduler.enabled(this)) {
                    String items=uri.getQueryParameter("items");
                    YawmiReminderScheduler.sync(this,items);
                    sendNotificationState();
                }
                break;
            case "status":
                sendNotificationState();
                break;
            default:
                break;
        }
    }

    private boolean validatedInternet() {
        try {
            ConnectivityManager cm =
                (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return false;
            Network network = cm.getActiveNetwork();
            NetworkCapabilities c = network == null ? null : cm.getNetworkCapabilities(network);
            return c != null && c.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                && c.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
        } catch (Exception ignored) {
            return false;
        }
    }

    private WebResourceResponse bundledAuthSdk(Uri uri, String method) {
        if (uri == null || !"GET".equalsIgnoreCase(method) ||
            !"https".equalsIgnoreCase(uri.getScheme()) ||
            !"cdn.jsdelivr.net".equalsIgnoreCase(uri.getHost()) ||
            !"/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.min.js".equals(uri.getPath())) return null;
        try {
            InputStream in = getAssets().open("vendor/supabase.min.js");
            return new WebResourceResponse("text/javascript", "UTF-8", in);
        } catch (Exception notBundled) {
            return null;
        }
    }

    private WebResourceResponse localAsset(Uri uri, String method) {
        if (uri == null || !"GET".equalsIgnoreCase(method) ||
            !"https".equalsIgnoreCase(uri.getScheme()) || !HOST.equalsIgnoreCase(uri.getHost())) return null;
        String path = uri.getPath();
        if (path == null || !path.startsWith("/home/")) return null;
        String name = path.substring("/home/".length());
        if (name.isEmpty()) name = "index.html";
        // Paths are ASCII first-party static assets. No traversal, secrets or arbitrary files.
        if (!name.matches("^[A-Za-z0-9_.-]+\\.(html|js|css|png|jpg|jpeg|svg|webmanifest|json|ico)$")
           || name.contains("..")) return null;
        String mime = "application/octet-stream";
        if (name.endsWith(".html")) mime = "text/html";
        else if (name.endsWith(".js")) mime = "text/javascript";
        else if (name.endsWith(".css")) mime = "text/css";
        else if (name.endsWith(".json") || name.endsWith(".webmanifest")) mime = "application/json";
        else if (name.endsWith(".png")) mime = "image/png";
        else if (name.endsWith(".jpg") || name.endsWith(".jpeg")) mime = "image/jpeg";
        else if (name.endsWith(".svg")) mime = "image/svg+xml";
        else if (name.endsWith(".ico")) mime = "image/x-icon";
        try {
            InputStream content = getAssets().open("www/" + name);
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-store");
            headers.put("X-Content-Type-Options", "nosniff");
            return new WebResourceResponse(mime, "UTF-8", 200, "OK", headers, content);
        } catch (Exception missingAsset) {
            return null;
        }
    }

    private boolean route(Uri uri) {
        if (uri == null) return true;
        String scheme = uri.getScheme();
        if ("https".equalsIgnoreCase(scheme) && HOST.equalsIgnoreCase(uri.getHost()) &&
            uri.getPath() != null && uri.getPath().startsWith("/home/")) return false;
        if ("intent".equalsIgnoreCase(scheme)) {
            // The YAWMI browser pairing button uses a Chrome intent: dispatch it locally.
            try {
                Intent i = Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME);
                Uri data = i.getData();
                if (getPackageName().equals(i.getPackage()) && data != null &&
                    "yawmiwidget".equals(data.getScheme()) &&
                    ("link".equals(data.getHost()) || "unlink".equals(data.getHost()))) {
                    Intent target = new Intent(this, YawmiWidgetLinkActivity.class);
                    target.setData(data);
                    startActivity(target);
                }
            } catch (Exception ignored) { }
            return true;
        }
        if ("https".equalsIgnoreCase(scheme) || "mailto".equalsIgnoreCase(scheme) ||
            "tel".equalsIgnoreCase(scheme) || "sms".equalsIgnoreCase(scheme) ||
            "whatsapp".equalsIgnoreCase(scheme)) {
            openExternal(uri);
        }
        return true;
    }

    private void navigateFromIntent(Intent launch) {
        Uri uri = launch != null ? launch.getData() : null;
        String url = ROOT + "index.html?source=apk";
        if (uri != null && "https".equalsIgnoreCase(uri.getScheme()) &&
            HOST.equalsIgnoreCase(uri.getHost()) &&
            uri.getPath() != null && uri.getPath().startsWith("/home/")) {
            // External links may open normal YAWMI sections, but may NOT
            // impersonate the signed app's launcher widgets to perform writes.
            Uri safe=uri;
            if(uri.getQueryParameter("widgetAction")!=null){
                String nonce=launch.getStringExtra("yawmi_widget_nonce");
                if(nonce==null || !nonce.equals(YawmiWidgetData.launcherNonce(this))){
                    Uri.Builder filtered=uri.buildUpon().clearQuery();
                    for(String key:uri.getQueryParameterNames()){
                        if("widgetAction".equals(key)||"widgetItem".equals(key))continue;
                        for(String value:uri.getQueryParameters(key))
                            filtered.appendQueryParameter(key,value);
                    }
                    safe=filtered.build();
                }
            }
            url = safe.toString();
        }
        forceBundledFallback = !validatedInternet();
        web.loadUrl(url);
    }

    private void askForAudio(PermissionRequest request) {
        if (request == null || request.getOrigin() == null ||
            !HOST.equalsIgnoreCase(request.getOrigin().getHost())) {
            if (request != null) request.deny();
            return;
        }
        boolean microphone = false;
        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) microphone = true;
            else { request.deny(); return; }
        }
        if (!microphone) { request.deny(); return; }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
        } else {
            audioRequest = request;
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, ASK_AUDIO);
        }
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] p, int[] results) {
        super.onRequestPermissionsResult(requestCode, p, results);
        if (requestCode == ASK_NOTIFICATIONS) {
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED){
                YawmiReminderScheduler.enable(this);
                if(testNotificationAfterPermission)YawmiReminderReceiver.send(this,42002);
            }else Toast.makeText(this, "اسمح بإشعارات يومي من إعدادات الهاتف لتفعيل التنبيهات.", Toast.LENGTH_LONG).show();
            testNotificationAfterPermission=false;
            sendNotificationState();
        }
        if (requestCode == ASK_AUDIO && audioRequest != null) {
            PermissionRequest pending = audioRequest;
            audioRequest = null;
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED)
                pending.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
            else pending.deny();
        }
    }

    @Override protected void onActivityResult(int req, int result, Intent data) {
        super.onActivityResult(req, result, data);
        if (req == SELECT_FILE && files != null) {
            ValueCallback<Uri[]> callback = files;
            files = null;
            callback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
        }
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (web != null) navigateFromIntent(intent);
    }

    private void reload() {
        if (progress != null) progress.setVisibility(View.VISIBLE);
        if (web == null) {
            try {
                configureWebView();
                navigateFromIntent(getIntent());
            } catch (Exception exception) {
                showError("تعذر بدء محرك العرض. جرّب فتح يومي بالمتصفح.");
            }
        } else {
            forceBundledFallback = !validatedInternet();
            web.reload();
        }
    }

    private void showError(String text) {
        if (emergencyHeader != null) emergencyHeader.setVisibility(View.VISIBLE);
        if (progress != null) progress.setVisibility(View.GONE);
        if (status != null) {
            status.setText(text);
            status.setVisibility(View.VISIBLE);
        }
        Toast.makeText(this, "يومي: " + text, Toast.LENGTH_LONG).show();
    }

    private void openExternal(Uri uri) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            startActivity(intent);
        } catch (ActivityNotFoundException error) {
            Toast.makeText(this, "لا يوجد تطبيق لفتح هذا الرابط.", Toast.LENGTH_SHORT).show();
        }
    }

    private void openBrowser() {
        Uri current = web != null ? Uri.parse(web.getUrl() == null ? ROOT : web.getUrl()) : Uri.parse(ROOT);
        if (!"https".equalsIgnoreCase(current.getScheme()) || !HOST.equalsIgnoreCase(current.getHost()))
            current = Uri.parse(ROOT);
        openExternal(current);
    }

    @Override public void onBackPressed() {
        if (web == null) { super.onBackPressed(); return; }
        web.evaluateJavascript("(function(){var p=document.querySelector('.page.on');if(p&&p.id!=='page-home'&&window.YawmiExtraAPI){window.YawmiExtraAPI.goHome();return true}return false})()", result -> {
            if ("true".equals(result)) return;
            if (web != null && web.canGoBack()) web.goBack();
            else YawmiMainActivity.super.onBackPressed();
        });
    }

    @Override protected void onPause() {
        if (web != null) web.onPause();
        super.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
        if (updates != null) updates.onResume();
        sendNotificationState();
    }
    @Override protected void onDestroy() {
        if (updates != null) {
            updates.stop();
            updates = null;
        }
        if (files != null) { files.onReceiveValue(null); files = null; }
        if (audioRequest != null) { audioRequest.deny(); audioRequest = null; }
        if (web != null) {
            content.removeView(web);
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
