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
import org.json.JSONArray;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Six native Android launcher widgets; data comes from account-scoped aggregate snapshots. */
public abstract class YawmiCategoryWidget extends AppWidgetProvider {
    private static final String ROOT="https://yawmi-life.github.io/home/index.html";
    protected abstract String heading();
    protected abstract String subtitle();
    protected abstract String[] targets();
    protected abstract String[] labels();
    protected String[] visibleLabels(JSONObject s){return labels();}
    protected String[] visibleTargets(JSONObject s){return targets();}
    protected static JSONObject item(JSONObject s,String key,int index){
        JSONArray values=s.optJSONArray(key);
        return values==null?null:values.optJSONObject(index);
    }
    protected static String itemText(JSONObject s,String key,int index,String fallback){
        JSONObject value=item(s,key,index);
        return value==null?fallback:"☐ "+value.optString("title","");
    }
    protected static String itemLink(JSONObject s,String key,int index,String page,String action){
        JSONObject value=item(s,key,index);
        if(value==null)return page;
        String id=value.optString("id","");
        return id.matches("[A-Za-z0-9_-]{1,64}")?page+"|"+action+"|"+id:page;
    }
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
        String[] parts=target.split("\\|",3);
        Uri.Builder uri=Uri.parse(ROOT).buildUpon().appendQueryParameter("source","widget")
            .appendQueryParameter("quick",parts[0]);
        if(parts.length>1)uri.appendQueryParameter("widgetAction",parts[1]);
        if(parts.length>2)uri.appendQueryParameter("widgetItem",parts[2]);
        Intent i=new Intent(c,YawmiMainActivity.class);
        i.setAction(Intent.ACTION_VIEW);
        i.setData(uri.build());
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c,code,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }
    private PendingIntent connectFromLauncher(Context c,int code) {
        // The user deliberately taps the Android home-screen widget.
        // Pair the account only after YAWMI login is ready in the app.
        Intent i=new Intent(c,YawmiMainActivity.class);
        i.setAction(Intent.ACTION_VIEW);
        i.setData(Uri.parse(ROOT+"?source=widget&quick=home&widgetPair=1"));
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
            v.setOnClickPendingIntent(R.id.yw_refresh,linked?open(c,"home|refresh-widgets",widgetId*100+21):connect);
            int[] buttons={R.id.yw_button_1,R.id.yw_button_2,R.id.yw_button_3,R.id.yw_button_4};
            String[] titles=visibleLabels(snapshot),links=visibleTargets(snapshot);
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
        protected String[] labels(){return new String[]{"✓ مهام اليوم","◉ عادات اليوم","＋ مهمة","＋ مصروف"};}
        protected String[] targets(){return new String[]{"tasks","habits","tasks|add-task","money|add-expense"};}
        protected String metric(JSONObject s){return number(n(s,"progress"))+"% من يومك مكتمل";}
        protected String detail(JSONObject s){return ratio(s,"tasksDone","tasksTotal")+" مهام   •   "+ratio(s,"habitsDone","habitsTotal")+" عادات";}
    }
    public static final class Productivity extends YawmiCategoryWidget {
        protected String heading(){return "✓ الإنتاجية";}
        protected String subtitle(){return "إنجاز المهام والعادات";}
        protected String[] labels(){return new String[]{"＋ مهمة","＋ عادة","▥ تقريري","✓ مهام اليوم"};}
        protected String[] targets(){return new String[]{"tasks|add-task","habits|add-habit","reports","tasks"};}
        protected String metric(JSONObject s){return ratio(s,"tasksDone","tasksTotal")+" مهام منجزة";}
        protected String detail(JSONObject s){return ratio(s,"habitsDone","habitsTotal")+" عادات   •   "+n(s,"progress")+"% إجمالي اليوم";}
    }
    public static final class Planning extends YawmiCategoryWidget {
        protected String heading(){return "◎ التخطيط";}
        protected String subtitle(){return "التقدم نحو أهدافك";}
        protected String[] labels(){return new String[]{"🎯 الأهداف","＋ تذكير","✎ ملاحظات","◈ خطتي"};}
        protected String[] targets(){return new String[]{"goals","calendar|add-reminder","notes","planning"};}
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
        protected String[] labels(){return new String[]{"♡ الصحة","☀ الروتين","＋ عادة","◉ العادات"};}
        protected String[] targets(){return new String[]{"health","routines","habits|add-habit","habits"};}
        protected String metric(JSONObject s){return n(s,"waterMl")+" / "+n(s,"waterGoalMl")+" مل مياه";}
        protected String detail(JSONObject s){return n(s,"streak")+" أيام نشاط متتالية";}
    }
    public static final class Life extends YawmiCategoryWidget {
        protected String heading(){return "◈ شؤون حياتي";}
        protected String subtitle(){return "ابدأ من حيث توقفت";}
        protected String[] labels(){return new String[]{"− مصروف","＋ دخل","◈ ماليتي","▥ تقريري"};}
        protected String[] targets(){return new String[]{"money|add-expense","money|add-income","money","reports"};}
        protected String metric(JSONObject s){return "المستوى "+n(s,"level");}
        protected String detail(JSONObject s){return n(s,"xp")+" XP   •   "+n(s,"streak")+" أيام نشاط";}
    }

    public static final class Tasks extends YawmiCategoryWidget {
        protected String heading(){return "✓ مهام النهارده";}
        protected String subtitle(){return "أكمل مهامك من شاشة الموبايل";}
        protected String[] labels(){return new String[]{"☐ مهمة ١","☐ مهمة ٢","＋ مهمة","كل المهام"};}
        protected String[] targets(){return new String[]{"tasks","tasks","tasks|add-task","tasks"};}
        protected String[] visibleLabels(JSONObject s){return new String[]{
            itemText(s,"todayTasks",0,"☑ افتح مهام اليوم"),
            itemText(s,"todayTasks",1,"＋ أضف مهمة جديدة"),"＋ مهمة","عرض وتعديل"};}
        protected String[] visibleTargets(JSONObject s){return new String[]{
            itemLink(s,"todayTasks",0,"tasks","complete-task"),
            itemLink(s,"todayTasks",1,"tasks","complete-task"),"tasks|add-task","tasks"};}
        protected String metric(JSONObject s){return ratio(s,"tasksDone","tasksTotal")+" مهام منجزة";}
        protected String detail(JSONObject s){return Math.max(0,n(s,"tasksTotal")-n(s,"tasksDone"))+" مهمة متبقية اليوم";}
    }
    public static final class Habits extends YawmiCategoryWidget {
        protected String heading(){return "◉ عادات النهارده";}
        protected String subtitle(){return "متابعة عادات اليوم الحقيقية";}
        protected String[] labels(){return new String[]{"◉ عادة ١","◉ عادة ٢","＋ عادة","كل العادات"};}
        protected String[] targets(){return new String[]{"habits","habits","habits|add-habit","habits"};}
        protected String[] visibleLabels(JSONObject s){return new String[]{
            itemText(s,"todayHabits",0,"◉ افتح عادات اليوم"),
            itemText(s,"todayHabits",1,"＋ أضف عادة جديدة"),"＋ عادة","عرض وتعديل"};}
        protected String[] visibleTargets(JSONObject s){return new String[]{
            itemLink(s,"todayHabits",0,"habits","complete-habit"),
            itemLink(s,"todayHabits",1,"habits","complete-habit"),"habits|add-habit","habits"};}
        protected String metric(JSONObject s){return ratio(s,"habitsDone","habitsTotal")+" عادات منجزة";}
        protected String detail(JSONObject s){return "سجل إنجازك الحقيقي بدون احتساب وهمي";}
    }
    public static final class Finance extends YawmiCategoryWidget {
        protected String heading(){return "◈ ماليتي السريعة";}
        protected String subtitle(){return "سجل مصروفاتك ودخلك بسرعة";}
        protected String[] labels(){return new String[]{"− مصروف","＋ دخل","قائمة الحركات","تقرير مالي"};}
        protected String[] targets(){return new String[]{"money|add-expense","money|add-income","money","reports"};}
        protected String metric(JSONObject s){return n(s,"moneyHidden")>0?"🔒 أرقامك خاصة":
            (n(s,"moneyExpense")/100)+" "+s.optString("moneyCurrency","SAR")+" مصروف";}
        protected String detail(JSONObject s){return n(s,"moneyHidden")>0?"فتح المالية يتطلب تجاوز قفل الخصوصية":
            "دخل الشهر "+(n(s,"moneyIncome")/100)+" "+s.optString("moneyCurrency","SAR");}
    }
    public static final class Reports extends YawmiCategoryWidget {
        protected String heading(){return "▥ تقرير يومي";}
        protected String subtitle(){return "تقدمك الفعلي في شاشة واحدة";}
        protected String[] labels(){return new String[]{"تقرير اليوم","التحليلات","✓ المهام","◉ العادات"};}
        protected String[] targets(){return new String[]{"reports","reports","tasks","habits"};}
        protected String metric(JSONObject s){return n(s,"progress")+"% من يومك";}
        protected String detail(JSONObject s){return ratio(s,"tasksDone","tasksTotal")+" مهام • "+
            ratio(s,"habitsDone","habitsTotal")+" عادات";}
    }
}
