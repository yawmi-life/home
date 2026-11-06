package com.yawmilife.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

/** Native home-screen widgets: no private account data is stored in launcher surfaces. */
public abstract class YawmiCategoryWidget extends AppWidgetProvider {
    private static final String ROOT = "https://yawmi-life.github.io/home/index.html?source=widget&quick=";
    protected abstract String heading();
    protected abstract String subtitle();
    protected abstract String[] targets();
    protected abstract String[] labels();

    private PendingIntent open(Context context, String target, int code) {
        Intent intent = new Intent(context, com.google.androidbrowserhelper.trusted.LauncherActivity.class);
        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(Uri.parse(ROOT + Uri.encode(target)));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, code, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int widgetId : ids) {
            RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.yawmi_category_widget);
            v.setTextViewText(R.id.yw_title, heading());
            v.setTextViewText(R.id.yw_subtitle, subtitle());
            int[] buttons = {R.id.yw_button_1,R.id.yw_button_2,R.id.yw_button_3,R.id.yw_button_4};
            String[] labels = labels(), targets = targets();
            for(int i=0;i<buttons.length;i++){
                v.setTextViewText(buttons[i],labels[i]);
                v.setOnClickPendingIntent(buttons[i],open(context,targets[i],widgetId*100+i));
            }
            v.setOnClickPendingIntent(R.id.yw_title,open(context,"home",widgetId*100+10));
            manager.updateAppWidget(widgetId,v);
        }
    }
    public static final class Today extends YawmiCategoryWidget {
        protected String heading(){return "✦ يومي | لوحة اليوم";}
        protected String subtitle(){return "يوم جديد · تقدم حقيقي بخطوات صغيرة";}
        protected String[] labels(){return new String[]{"✓ مهامي","◉ عاداتي","⏱ التركيز","🏆 رحلتي"};}
        protected String[] targets(){return new String[]{"tasks","habits","home","journey"};}
    }
    public static final class Productivity extends YawmiCategoryWidget {
        protected String heading(){return "✓ الإنتاجية";}
        protected String subtitle(){return "مهام وعادات وتركيز وتقارير";}
        protected String[] labels(){return new String[]{"✓ المهام","◉ العادات","⏱ التركيز","▥ التقارير"};}
        protected String[] targets(){return new String[]{"tasks","habits","home","reports"};}
    }
    public static final class Planning extends YawmiCategoryWidget {
        protected String heading(){return "◎ التخطيط";}
        protected String subtitle(){return "أهدافك وخطة يومك في متناولك";}
        protected String[] labels(){return new String[]{"🎯 الأهداف","🗓 التقويم","✎ الملاحظات","◈ الخطة"};}
        protected String[] targets(){return new String[]{"goals","calendar","notes","planning"};}
    }
    public static final class Learning extends YawmiCategoryWidget {
        protected String heading(){return "📚 المعرفة والعبادات";}
        protected String subtitle(){return "قراءة وقرآن وتقدم مستمر";}
        protected String[] labels(){return new String[]{"📚 الكتب","☪ القرآن","🏆 XP","✦ المراجعة"};}
        protected String[] targets(){return new String[]{"books","quran","journey","coach"};}
    }
    public static final class Wellbeing extends YawmiCategoryWidget {
        protected String heading(){return "♡ أسلوب حياتي";}
        protected String subtitle(){return "تابع صحتك وروتينك وذكرياتك";}
        protected String[] labels(){return new String[]{"♡ الصحة","☀ الروتين","✍ يومياتي","◉ العادات"};}
        protected String[] targets(){return new String[]{"health","routines","diary","habits"};}
    }
    public static final class Life extends YawmiCategoryWidget {
        protected String heading(){return "◈ شؤون حياتي";}
        protected String subtitle(){return "مالك وملاحظاتك وخططك بأمان";}
        protected String[] labels(){return new String[]{"◈ ماليتي","✎ أفكاري","🗓 التقويم","✦ مساعدي"};}
        protected String[] targets(){return new String[]{"money","notes","calendar","coach"};}
    }
}
