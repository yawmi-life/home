package com.yawmilife.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

/**
 * A privacy-preserving launcher widget. No account state, finance values or
 * private reminders are copied out of the web app to the Android launcher.
 * Tapping a button opens an authenticated YAWMI page; completion still
 * requires the user to mark real progress inside the application.
 */
public final class YawmiShortcutWidget extends AppWidgetProvider {
    private static final String ROOT = "https://yawmi-life.github.io/home/";

    private static PendingIntent open(Context context, String target, int code) {
        Intent intent = new Intent(context, com.google.androidbrowserhelper.trusted.LauncherActivity.class);
        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(Uri.parse(ROOT + "01_ATLAS_Executive.html?quick=" + target));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(
            context, code, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.yawmi_shortcut_widget);
            views.setOnClickPendingIntent(R.id.yawmi_widget_tasks, open(context, "tasks", appWidgetId * 10 + 1));
            views.setOnClickPendingIntent(R.id.yawmi_widget_habits, open(context, "habits", appWidgetId * 10 + 2));
            views.setOnClickPendingIntent(R.id.yawmi_widget_calendar, open(context, "calendar", appWidgetId * 10 + 3));
            manager.updateAppWidget(appWidgetId, views);
        }
    }

    @Override
    public void onEnabled(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName receiver = new ComponentName(context, YawmiShortcutWidget.class);
        onUpdate(context, manager, manager.getAppWidgetIds(receiver));
    }
}
