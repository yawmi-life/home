const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const english=[
 {key:'/works/OL17930368W',title:'Atomic Habits',author_name:['James Clear'],cover_i:12539702,
  number_of_pages_median:322,ratings_average:3.97,ratings_count:1482,
  want_to_read_count:58546,already_read_count:1752,edition_count:42,language:['eng','fre'],first_publish_year:2016},
 {key:'/works/OL30303030W',title:'Deep Work',author_name:['Cal Newport'],number_of_pages_median:304,
  ratings_average:4.6,ratings_count:100,want_to_read_count:2500,edition_count:22,language:['eng'],first_publish_year:2016},
 {key:'/works/OL77777777W',title:'Unknown Rated Book',author_name:['Unknown Author'],
  edition_count:1,language:['eng'],first_publish_year:1990}
];
const arabic=[
 {key:'/works/OL30118866W',title:'أرض زيكولا',author_name:['عمرو عبدالحميد'],cover_i:14841882,
  ratings_average:4.777777,ratings_count:9,edition_count:1,first_publish_year:2010,language:['ara']}
];
async function provider(page){
 await page.route('https://www.googleapis.com/books/v1/volumes/vFnHDwAAQBAJ',route=>
  route.fulfill({status:200,headers:{'access-control-allow-origin':'*','content-type':'application/json'},
   body:JSON.stringify({id:'ARATOMIC123456',volumeInfo:{title:'العادات الذرية',authors:['جيمس كلير'],language:'ar',
    description:'يتناول الكتاب كيف تساعد التغييرات الصغيرة في تطوير العادات، مع أفكار عملية لمتابعة السلوك.',
    publishedDate:'2020',pageCount:320}})}));
 await page.route('https://www.googleapis.com/books/v1/volumes?**',route=>{
  const u=new URL(route.request().url()),q=u.searchParams.get('q')||'';
  const volume={id:'ARATOMIC123456',volumeInfo:{title:'العادات الذرية',authors:['جيمس كلير'],language:'ar',
   description:'يتناول الكتاب كيف تساعد التغييرات الصغيرة في تطوير العادات، مع أفكار عملية لمتابعة السلوك.',
   publishedDate:'2020',pageCount:320,imageLinks:{thumbnail:'https://books.google.com/books/content?id=ARATOMIC123456'}}};
  const found=/العادات الذرية|Atomic Habits/i.test(q)?[volume]:[];
  return route.fulfill({status:200,headers:{'access-control-allow-origin':'*','content-type':'application/json'},body:JSON.stringify({totalItems:found.length,items:found})});
 });
 await page.route('https://openlibrary.org/search.json?**',route=>{
  const url=new URL(route.request().url()),q=url.searchParams.get('q')||'';
  const docs=/[\u0600-\u06ff]/.test(q)||q.includes('language:ara')?arabic:english;
  return route.fulfill({status:200,headers:{'access-control-allow-origin':'*','content-type':'application/json'},body:JSON.stringify({numFound:docs.length,docs})});
 });
 await page.route('https://openlibrary.org/works/*.json',route=>
  route.fulfill({status:200,headers:{'access-control-allow-origin':'*','content-type':'application/json'},
   body:JSON.stringify({description:{type:'/type/text',value:'كتاب يشرح كيف يمكن بناء العادات الصغيرة وتحسين الممارسات اليومية عبر خطوات متدرجة.'}})}));
 await page.goto('/tests/books.html');
 await expect(page.locator('.ym-catalog-card')).toHaveCount(3,{timeout:15000});
}

test('book discovery ranks verified popularity and rating, without invented metadata',async({page})=>{
 await provider(page);
 await expect(page.locator('.ym-catalog-card').first()).toContainText('Atomic Habits');
 await expect(page.getByRole('heading',{name:'اكتشف كتبًا من كل المجالات'})).toBeVisible();
 await expect(page.locator('#ymCatalogCategory option')).toHaveCount(31);
 await expect(page.locator('.ym-catalog-grid')).toContainText('James Clear');
 await expect(page.locator('.ym-catalog-grid')).toContainText('≈ ٣٢٢ صفحة');
 await expect(page.locator('.ym-catalog-grid')).toContainText('لا يوجد تقييم موثّق');
 await expect(page.locator('.ym-catalog-grid')).toContainText('عدد الصفحات غير متوفر');
 await page.locator('#ymCatalogSort').selectOption('rating');
 await expect(page.locator('.ym-catalog-card').first()).toContainText('Deep Work');
});

test('book detail shows source summary, real metadata and one-click personal add',async({page})=>{
 await provider(page);
 await page.getByRole('button',{name:'تفاصيل كتاب Atomic Habits'}).click();
 await expect(page.locator('#ymCatalogDetail')).toBeVisible();
 await expect(page.locator('#ymCatalogDetail')).toContainText('James Clear');
 await expect(page.locator('#ymCatalogDetail')).toContainText('حوالي ٣٢٢');
 await expect(page.locator('.ym-catalog-description')).toContainText('بناء العادات الصغيرة');
 await expect(page.locator('#ymCatalogDetail a')).toHaveAttribute('href','https://openlibrary.org/works/OL17930368W');
 await page.locator('#ymCatalogDetail').getByRole('button',{name:'أضف لمكتبتي'}).click();
 const saved=await page.evaluate(()=>window.__savedBook);
 expect(saved).toMatchObject({title:'Atomic Habits',author:'James Clear',pages:322,
  key:'/works/OL17930368W',rating:3.97,reviews:1482});
 await expect(page.locator('#ymCatalogDetail')).not.toBeVisible();
});

test('Arabic search works, keeps missing page counts honest and avoids fake ratings',async({page})=>{
 await provider(page);
 await page.getByRole('searchbox',{name:'ابحث عن كتاب أو مؤلف'}).fill('أرض زيكولا');
 await page.getByRole('button',{name:'بحث'}).click();
 await expect(page.locator('.ym-catalog-card')).toHaveCount(1);
 await expect(page.locator('.ym-catalog-card')).toContainText('عمرو عبدالحميد');
 await expect(page.locator('.ym-catalog-card')).toContainText('عدد الصفحات غير متوفر');
 await expect(page.locator('.ym-catalog-card')).toContainText('4.8/5');
 await page.locator('#ymCatalogLanguage').selectOption('ar');
 await expect(page.locator('.ym-catalog-card')).toHaveCount(1);
});

test('book catalog works offline using previously cached public search metadata',async({page,context})=>{
 await provider(page);
 await context.setOffline(true);
 try{
  await page.evaluate(()=>window.YawmiBookCatalog.search());
  await expect(page.locator('.ym-catalog-card')).toHaveCount(3);
  await expect(page.locator('#ymBookCatalog')).toContainText('أوفلاين');
 }finally{await context.setOffline(false)}
});

test('book catalog has no serious WCAG issues in browser fixture',async({page})=>{
 await provider(page);
 const res=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();
 expect(res.violations.filter(v=>v.impact==='critical'||v.impact==='serious')).toEqual([]);
});

test('Arabic Atomic Habits search resolves a real Arabic-language edition and verified Arabic publisher synopsis',async({page})=>{
 await provider(page);
 await page.getByRole('searchbox',{name:'ابحث عن كتاب أو مؤلف'}).fill('العادات الذرية');
 await page.getByRole('button',{name:'بحث'}).click();
 await expect(page.locator('.ym-catalog-card').first()).toContainText('العادات الذرية',{timeout:18000});
 await expect(page.locator('.ym-catalog-card').first()).not.toContainText('Atomic Habits');
 await page.locator('#ymCatalogLanguage').selectOption('ar');
 await expect(page.locator('.ym-catalog-card').first()).toContainText('جيمس كلير',{timeout:15000});
 await page.locator('.ym-catalog-card').first().getByRole('button',{name:/تفاصيل كتاب/}).click();
 await expect(page.locator('.ym-catalog-description')).toContainText('التغييرات الصغيرة');
 await expect(page.locator('#ymCatalogDetail')).toContainText('Google Books');
 await expect(page.locator('#ymCatalogDetail a')).toHaveAttribute('href',/books.google.com\/books\?id=ARATOMIC123456/);
 await page.locator('#ymCatalogDetail [data-catalog-save]').click();
 expect(await page.evaluate(()=>window.__savedBook)).toMatchObject({key:'gb:ARATOMIC123456',source:'Google Books',
  title:'العادات الذرية',author:'جيمس كلير',pages:320});
});
test('Arabic filter refuses English work title merely flagged as having an Arabic edition',async({page})=>{
 await provider(page);
 await page.getByRole('searchbox',{name:'ابحث عن كتاب أو مؤلف'}).fill('Atomic Habits');
 await page.getByRole('button',{name:'بحث'}).click();
 await page.locator('#ymCatalogLanguage').selectOption('ar');
 await expect(page.locator('.ym-catalog-card').first()).toContainText('العادات الذرية',{timeout:18000});
 await expect(page.locator('.ym-catalog-card').first()).not.toContainText('Atomic Habits');
});
