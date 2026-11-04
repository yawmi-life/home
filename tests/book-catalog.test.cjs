const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function module(){
 const content=fs.readFileSync('yawmi-book-discovery-v31.js','utf8');
 const env={window:{},document:{readyState:'loading',addEventListener(){}},navigator:{onLine:true},setTimeout:()=>0,clearTimeout(){},localStorage:{getItem:()=>null,setItem(){}},URL,URLSearchParams,AbortController};
 vm.runInNewContext(content,env,{filename:'yawmi-book-discovery-v31.js'});
 return env.window.YawmiBookCatalog;
}
test('catalog normalizes reliable metadata and supports Arabic titles',()=>{
 const catalog=module();
 const a=catalog.normalize({key:'/works/OL30118866W',title:'أرض زيكولا',author_name:['عمرو عبدالحميد'],ratings_average:4.777,ratings_count:9});
 assert.equal(a.title,'أرض زيكولا');assert.equal(a.author,'عمرو عبدالحميد');
 assert.equal(a.rating,4.78);assert.equal(a.pages,0);
 assert.equal(catalog.categoryCount,31);
});
test('catalog refuses invented ratings/pages and unsafe identifiers',()=>{
 const catalog=module();
 const missing=catalog.normalize({key:'/works/OL123W',title:'Missing Rating',ratings_average:5,ratings_count:0,number_of_pages_median:-10});
 assert.equal(missing.rating,null);assert.equal(missing.pages,0);
 assert.equal(catalog.normalize({key:'javascript:alert(1)',title:'Injection'}),null);
 assert.equal(catalog.normalize({key:'/works/OL10W',title:'  '}),null);
});
test('popular sort respects reading intent signals',()=>{
 const catalog=module();const items=[
 {key:'/works/OL2W',index:1,wants:20000,read:1000,reviews:30,editions:15,rating:3.9},
 {key:'/works/OL1W',index:0,wants:10,read:2,reviews:2,editions:1,rating:5}
 ];
 const sorted=catalog.order(items);
 assert.equal(sorted[0].key,'/works/OL2W');
});
