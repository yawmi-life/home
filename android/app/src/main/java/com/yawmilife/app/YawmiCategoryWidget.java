package com.yawmilife.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Six native Android launcher widgets; data comes from account-scoped aggregate snapshots. */
public abstract class YawmiCategoryWidget extends AppWidgetProvider {
    private static final String ROOT="https://yawmi-life.github.io/home/index.html?source=widget&quick=";
    protected abstract String heading();
    protected abstract String subtitle();
    protected abstract String[] targets();
    protected abstract String[] labels();
    protected abstract String metric(JSONObject s);
    protected abstract String detail(JSONObject s);

    private static String number(int n){return String.valueOf(n);}
    static int n(JSONObject s,String field){return YawmiWidgetData.integer(s,field,100000000);}
    static String ratio(JSONObject s,String a,String b){return n(s,a)+" / "+n(s,b);}
    private boolean current(JSONObject s){
        String d=new SimpleDateFormat("yyyy-MM-dd",Locale.US).format(new Date());
        return d.equals(s.optString("day",""));
    }
    private PendingIntent open(Context c,String target,int code){
        Intent i=new Intent(c,YawmiMainActivity.class);
        i.setAction(Intent.ACTION_VIEW);
        i.setData(Uri.parse(ROOT+Uri.encode(target)));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(c,code,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }
    private PendingIntent connectFromLauncher(Context c,int code) {
        // The user deliberately taps the Android home-screen widget.
        // Pair the account only after YAWMI login is ready in the app.
        Intent i=new Intent(c,YawmiMainActivity.class);
        i.setAction(Intent.ACTION_VIEW);
        i.setData(Uri.parse(ROOT+"home&widgetPair=1"));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(c,code,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }
    private PendingIntent refresh(Context c,int code) {
        Intent i=new Intent(c,getClass());
        i.setAction(YawmiWidgetData.ACTION_REFRESH);
        return PendingIntent.getBroadcast(c,code,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }
    void render(Context c,AppWidgetManager manager,int[] ids){
        JSONObject snapshot=YawmiWidgetData.snapshot(c);
        boolean linked=YawmiWidgetData.linked(c);
        boolean fresh=linked&&current(snapshot);
        for(int widgetId:ids){
            RemoteViews v=new RemoteViews(c.getPackageName(),R.layout.yawmi_category_widget);
            v.setTextViewText(R.id.yw_title,heading());
            v.setTextViewText(R.id.yw_subtitle,subtitle());
            v.setTextViewText(R.id.yw_metric_primary,fresh?metric(snapshot):
                (linked?"البيانات تحتاج تحديثًا":"اضغط للاتصال بحسابك"));
            v.setTextViewText(R.id.yw_metric_secondary,fresh?detail(snapshot):
                (linked?"اضغط تحديث أو افتح يومي":"سيُفتح يومي لتسجيل الدخول، دون إعدادات داخله"));
            v.setProgressBar(R.id.yw_progress,100,fresh?Math.min(100,n(snapshot,"progress")):0,false);
            v.setViewVisibility(R.id.yw_progress,fresh?View.VISIBLE:View.GONE);
            v.setTextViewText(R.id.yw_updated,fresh?"● آخر مزامنة اليوم":"○ بانتظار مزامنة حسابك");
            PendingIntent connect=connectFromLauncher(c,widgetId*100+19);
            v.setOnClickPendingIntent(R.id.yw_title,linked?open(c,"home",widgetId*100+20):connect);
            v.setOnClickPendingIntent(R.id.yw_metric_primary,linked?open(c,"home",widgetId*100+22):connect);
            v.setOnClickPendingIntent(R.id.yw_metric_secondary,linked?open(c,"home",widgetId*100+23):connect);
            v.setOnClickPendingIntent(R.id.yw_refresh,linked?refresh(c,widgetId*100+21):connect);
            int[] buttons={R.id.yw_button_1,R.id.yw_button_2,R.id.yw_button_3,R.id.yw_button_4};
            String[] titles=labels(),links=targets();
            for(int i=0;i<4;i++){
                v.setTextViewText(buttons[i],titles[i]);
                v.setOnClickPendingIntent(buttons[i],open(c,links[i],widgetId*100+i));
            }
            manager.updateAppWidget(widgetId,v);
        }
    }
    @Override public void onUpdate(Context c,AppWidgetManager m,int[] widgetIds){
        render(c,m,widgetIds);
        YawmiWidgetData.fetchAsync(c,goAsync(),false);
    }
    @Override public void onReceive(Context c,Intent intent){
        if(YawmiWidgetData.ACTION_REFRESH.equals(intent.getAction())){
            YawmiWidgetData.fetchAsync(c,goAsync(),true);
            return;
        }
        super.onReceive(c,intent);
    }
    @Override public void onEnabled(Context c){
        AppWidgetManager manager=AppWidgetManager.getInstance(c);
        onUpdate(c,manager,manager.getAppWidgetIds(new ComponentName(c,getClass())));
    }

    public static final class Today extends YawmiCategoryWidget {
        protected String heading(){return "✦ يومي | لوحة اليوم";}
        protected String subtitle(){return "ملخص تقدمك الحقيقي";}
        protected String[] labels(){return new String[]{"✓ مهامي","◉ عاداتي","⏱ تركيز","🏆 رحلتي"};}
        protected String[] targets(){return new String[]{"tasks","habits","home","journey"};}
        protected String metric(JSONObject s){return number(n(s,"progress"))+"% من يومك مكتمل";}
        protected String detail(JSONObject s){return ratio(s,"tasksDone","tasksTotal")+" مهام   •   "+ratio(s,"habitsDone","habitsTotal")+" عادات";}
    }
    public static final class Productivity extends YawmiCategoryWidget {
        protected String heading(){return "✓ الإنتاجية";}
        protected String subtitle(){return "إنجاز المهام والعادات";}
        protected String[] labels(){return new String[]{"✓ المهام","◉ العادات","⏱ التركيز","▥ التقارير"};}
        protected String[] targets(){return new String[]{"tasks","habits","home","reports"};}
        protected String metric(JSONObject s){return ratio(s,"tasksDone","tasksTotal")+" مهام منجزة";}
        protected String detail(JSONObject s){return ratio(s,"habitsDone","habitsTotal")+" عادات   •   "+n(s,"progress")+"% إجمالي اليوم";}
    }
    public static final class Planning extends YawmiCategoryWidget {
        protected String heading(){return "◎ التخطيط";}
        protected String subtitle(){return "التقدم نحو أهدافك";}
        protected String[] labels(){return new String[]{"🎯 الأهداف","🗓 التقويم","✎ ملاحظات","◈ خطتي"};}
        protected String[] targets(){return new String[]{"goals","calendar","notes","planning"};}
        protected String metric(JSONObject s){return ratio(s,"goalsDone","goalsTotal")+" أهداف مكتملة";}
        protected String detail(JSONObject s){return "إنجاز اليوم "+n(s,"progress")+"%";}
    }
    public static final class Learning extends YawmiCategoryWidget {
        protected String heading(){return "📚 القراءة والقرآن";}
        protected String subtitle(){return "تعلم مستمر، خطوة بخطوة";}
        protected String[] labels(){return new String[]{"📚 مكتبتي","☪ القرآن","🏆 رحلتي","✦ المراجعة"};}
        protected String[] targets(){return new String[]{"books","quran","journey","coach"};}
        protected String metric(JSONObject s){return n(s,"booksCount")+" كتب في مكتبتك";}
        protected String detail(JSONObject s){return n(s,"readingPages")+" صفحة اليوم   •   "+n(s,"xp")+" XP إجمالي";}
    }
    public static final class Wellbeing extends YawmiCategoryWidget {
        protected String heading(){return "♡ الصحة والروتين";}
        protected String subtitle(){return "اعتنِ بصحتك كل يوم";}
        protected String[] labels(){return new String[]{"♡ الصحة","☀ الروتين","✍ يومياتي","◉ العادات"};}
        protected String[] targets(){return new String[]{"health","routines","diary","habits"};}
        protected String metric(JSONObject s){return n(s,"waterMl")+" / "+n(s,"waterGoalMl")+" مل مياه";}
        protected String detail(JSONObject s){return n(s,"streak")+" أيام نشاط متتالية";}
    }
    public static final class Life extends YawmiCategoryWidget {
        protected String heading(){return "◈ شؤون حياتي";}
        protected String subtitle(){return "ابدأ من حيث توقفت";}
        protected String[] labels(){return new String[]{"◈ ماليتي","✎ أفكاري","🗓 تقويم","✦ مساعدي"};}
        protected String[] targets(){return new String[]{"money","notes","calendar","coach"};}
        protected String metric(JSONObject s){return "المستوى "+n(s,"level");}
        protected String detail(JSONObject s){return n(s,"xp")+" XP   •   "+n(s,"streak")+" أيام نشاط";}
    }
}
