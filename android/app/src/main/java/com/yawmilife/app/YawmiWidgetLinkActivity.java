package com.yawmilife.app;

import android.app.Activity;
import android.net.Uri;
import android.os.Bundle;
import android.widget.Toast;

/** Handles only explicit browser-initiated pairing, never accepts Supabase JWTs. */
public final class YawmiWidgetLinkActivity extends Activity {
    @Override protected void onCreate(Bundle savedInstanceState){
        super.onCreate(savedInstanceState);
        Uri data=getIntent()!=null?getIntent().getData():null;
        if(data!=null&&"yawmiwidget".equals(data.getScheme())){
            if("link".equals(data.getHost())){
                String token=data.getQueryParameter("token");
                if(YawmiWidgetData.isToken(token)){
                    YawmiWidgetData.link(this,token);
                    Toast.makeText(this,"تم ربط ويدجتس يومي. أضفها للشاشة الرئيسية.",Toast.LENGTH_LONG).show();
                }else{
                    Toast.makeText(this,"رمز تفعيل غير صالح",Toast.LENGTH_SHORT).show();
                }
            }else if("unlink".equals(data.getHost())){
                YawmiWidgetData.unlink(this);
                Toast.makeText(this,"تم إخفاء بيانات ويدجتس يومي",Toast.LENGTH_SHORT).show();
            }
        }
        finish();
    }
}
