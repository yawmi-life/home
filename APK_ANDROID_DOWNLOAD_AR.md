# يومي LifeOS — تحميل التطبيق الرسمي للأندرويد مجانًا

**تنزيل مباشر، بدون Google Play:**
https://github.com/yawmi-life/home/releases/download/android-v1.0.0/app-release.apk

**صفحة النسخة الرسمية:**
https://github.com/yawmi-life/home/releases/tag/android-v1.0.0

**الاسم:** يومي LifeOS  
**Android Package ID:** `com.yawmilife.app`  
**الإصدار:** `1.0.0` / versionCode `1`  
**أقل إصدار Android:** Android 7 (API 24)  
**حجم APK:** نحو 3.8 ميغابايت  
**التكلفة:** مجاني للتنزيل والتوزيع

تم بناء APK بتقنية Android Trusted Web Activity وتوقيعه بتوقيع Android رسمي عبر GitHub Actions. فحص التوقيع `apksigner verify` نجح باستخدام APK Signature Scheme v2، وتم فحص اسم الحزمة والإصدار عبر `aapt`.

**البصمة SHA-256 لشهادة التوقيع**:
`C9:41:1A:EB:C3:83:EC:82:00:17:7D:6B:C2:AF:79:56:02:90:C4:F0:A1:03:5B:45:BA:AD:CC:F1:AF:B6:F3:D8`

## طريقة التثبيت
1. افتح رابط التحميل من هاتف Android.
2. اضغط على الملف المحمَّل `app-release.apk`.
3. إذا طلب Android إذن التثبيت من المتصفح/مدير الملفات، اسمح لهذا المصدر موضعيًا مع التحقق من أن المصدر هو صفحة GitHub الرسمية. لا توقف Play Protect.
4. افتح تطبيق **يومي LifeOS** واستخدم حسابك المعتاد.

## APKPure أو المتاجر البديلة
- صفحة استقبال ملفات APK في APKPure: https://apkpure.net/ar/submit-apk
- تقبل الموقع ملفات APK/XAPK، وتتطلب مراجعة قبل النشر. إرسال التطبيق إلى متجر طرف ثالث يجب أن يقوم به صاحب حساب المطوّر أو من يفوضه؛ **لم يقدَّم التطبيق إلى APKPure تلقائيًا**.
- يمكن كذلك التقدم إلى Uptodown (مجانًا حسب إرشاداتهم): https://support.uptodown.com/hc/en-us/articles/4424141383181-Basic-guide-to-register-and-publish-apps-on-Uptodown

## تنبيهات مهمة
- هذا تطبيق Web/Android يعتمد على الموقع الحي، وليس إعادة بناء مستقلة لجميع ميزات يومي. البيانات تُحفظ بنظام حسابات يومي المعتاد.
- **التوثيق الكامل لتجربة TWA بملء الشاشة يحتاج `assetlinks.json` في جذر النطاق** عند: `https://yawmi-life.github.io/.well-known/assetlinks.json`. يوجد الملف الدقيق في GitHub Release مع بصمة هذا الإصدار. المستودع الحالي `/home` هو GitHub Pages لمشروع، ولا يكفي نشره تحت `/home/.well-known/` للتحقق من الأصل. حتى تكتمل هذه الخطوة، قد يظهر شريط Chrome داخل التطبيق (Custom Tab fallback). **التنزيل والتثبيت لا يتوقفان على هذه الخطوة.**
- إشعارات Web Push تعتمد على دعم المتصفح/Android وإذن المستخدم، ويجب اختبارها على جهاز حقيقي بعد التثبيت.
- **لتحديث التطبيق لاحقًا بنفس الحزمة، لا بد من إعادة استخدام مفتاح التوقيع نفسه.** توجد نسخة احتياطية مشفّرة داخل [تشغيل البناء الأول](https://github.com/yawmi-life/home/actions/runs/42038925659)، وليست نسخة عامة غير مشفرة. يجب أن يحتفظ صاحب التطبيق بمفتاح فك التشفير الخاص ونسخة الأرتيفاكت المشفّرة. الإجراء يحتفظ بالأرتيفاكت لفترة محدودة (90 يومًا) فقط؛ خزّن نسخة في موقع آمن.
- لتوزيع تحديث Android جديد يجب زيادة versionCode وإعادة البناء بنفس مفتاح التوقيع، ولا يكفي تغيير ملف APK أو توقيعه بمفتاح جديد.

## الأدلة
- [نتيجة إنشاء APK وتوقيعه ونشره](https://github.com/yawmi-life/home/actions/runs/42038925659)
- [المصدر البرمجي لحزمة Android](https://github.com/yawmi-life/home/tree/main/android)
