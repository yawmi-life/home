package com.yawmilife.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.pm.PackageInfo;
import android.os.Build;
import android.widget.Toast;

/**
 * A native, device-verifiable launcher widget picker.
 * This is available only when the real Android APK is installed:
 * browser shortcuts and PWAs cannot provide AppWidgetProvider receivers.
 */
public final class YawmiWidgetLauncher {
    private YawmiWidgetLauncher(){}

    private static final Class<?>[] PROVIDERS = {
        YawmiCategoryWidget.Today.class,
        YawmiCategoryWidget.Productivity.class,
        YawmiCategoryWidget.Planning.class,
        YawmiCategoryWidget.Learning.class,
        YawmiCategoryWidget.Wellbeing.class,
        YawmiCategoryWidget.Life.class,
        YawmiShortcutWidget.class
    };
    private static final String[] NAMES = {
        "لوحة اليوم", "الإنتاجية والمهام", "الأهداف والتخطيط",
        "القراءة والقرآن", "الصحة والروتين", "شؤون حياتي", "الاختصارات"
    };

    public static void show(Activity activity){
        AppWidgetManager manager = AppWidgetManager.getInstance(activity);
        int registered = 0;
        for (Class<?> widget : PROVIDERS) {
            ComponentName name = new ComponentName(activity, widget);
            for (android.appwidget.AppWidgetProviderInfo info : manager.getInstalledProviders()) {
                if (name.equals(info.provider)) {registered++;break;}
            }
        }
        String version = "?";
        try {
            PackageInfo app = activity.getPackageManager().getPackageInfo(activity.getPackageName(),0);
            version = app.versionName;
        } catch (Exception ignored) {}

        final int count = registered;
        final String installed = version;
        new AlertDialog.Builder(activity)
            // Android AlertDialog does not show setItems() when setMessage() is also set.
            // Keep provider count in title, so the actual seven choices are always visible.
            .setTitle("ويدجتس يومي — APK " + installed + " (" + count + " من " + PROVIDERS.length + ")")
            .setItems(NAMES, (dialog, which) -> pin(activity, manager, which))
            .setNeutralButton("طريقة الإضافة يدويًا", (d,w) ->
                new AlertDialog.Builder(activity)
                    .setTitle("إظهار ويدجتس يومي")
                    .setMessage("1. ارجع للشاشة الرئيسية للهاتف.\n" +
                        "2. اضغط مطولًا على مساحة فارغة.\n" +
                        "3. افتح الويدجتس أو الأدوات.\n" +
                        "4. ابحث عن «يومي LifeOS» وأضف الويدجت.\n\n" +
                        "لو ما لقيتش الاسم، افتح إعدادات التطبيق وتأكد أنه APK أصلي، " +
                        "مش اختصار موقع أُضيف للشاشة من المتصفح.")
                    .setPositiveButton("تمام", (dd,ww) -> {})
                    .show())
            .setNegativeButton("إغلاق", (d,w)->{})
            .show();
    }

    private static void pin(Activity activity,AppWidgetManager manager,int index){
        ComponentName provider = new ComponentName(activity, PROVIDERS[index]);
        if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.O && manager.isRequestPinAppWidgetSupported()){
            try{
                if(manager.requestPinAppWidget(provider,null,null)){
                    Toast.makeText(activity,"وافق على إضافة ويدجت يومي إلى الشاشة الرئيسية.",Toast.LENGTH_LONG).show();
                    return;
                }
            }catch(Exception ignored){}
        }
        Toast.makeText(activity,
            "واجهة هاتفك لا تدعم الإضافة المباشرة. اضغط مطولًا على الشاشة الرئيسية ثم ويدجتس ← يومي LifeOS.",
            Toast.LENGTH_LONG).show();
    }
}
