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
    private static final int VIOLET = Color.rgb(34, 28, 59);
    private LinearLayout shell;
    private FrameLayout content;
    private WebView web;
    private TextView status;
    private ProgressBar progress;
    private ValueCallback<Uri[]> files;
    private PermissionRequest audioRequest;
    private boolean closing;
    private boolean forceBundledFallback;
    private YawmiUpdateManager updates;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(VIOLET);
        getWindow().setNavigationBarColor(VIOLET);
        createShell();
        updates = new YawmiUpdateManager(this);
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
        header.setPadding(dp(14), dp(5), dp(10), dp(5));
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setBackgroundColor(VIOLET);
        TextView title = text("✦ يومي LifeOS", Color.WHITE, 15);
        title.setTypeface(null, 1);
        header.addView(title, new LinearLayout.LayoutParams(0, dp(39), 1f));
        Button update = button("التحديثات");
        update.setContentDescription("فحص تحديثات يومي الرسمية");
        header.addView(update, new LinearLayout.LayoutParams(dp(88), dp(39)));
        update.setOnClickListener(v -> {
            if (updates != null) updates.check(true);
        });
        Button browser = button("المتصفح");
        browser.setContentDescription("فتح يومي في متصفح الهاتف");
        header.addView(browser, new LinearLayout.LayoutParams(dp(86), dp(39)));
        browser.setOnClickListener(v -> openBrowser());
        Button retry = button("↻");
        retry.setContentDescription("إعادة تحميل يومي");
        header.addView(retry, new LinearLayout.LayoutParams(dp(49), dp(39)));
        retry.setOnClickListener(v -> reload());
        shell.addView(header);
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setIndeterminate(true);
        shell.addView(progress, new LinearLayout.LayoutParams(-1, dp(3)));
        content = new FrameLayout(this);
        shell.addView(content, new LinearLayout.LayoutParams(-1, 0, 1f));
        status = text("", Color.WHITE, 12);
        status.setPadding(dp(14), dp(7), dp(14), dp(7));
        status.setVisibility(View.GONE);
        shell.addView(status, new LinearLayout.LayoutParams(-1, -2));
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
                return route(request.getUrl());
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (progress != null) progress.setVisibility(View.GONE);
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
            url = uri.toString();
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
