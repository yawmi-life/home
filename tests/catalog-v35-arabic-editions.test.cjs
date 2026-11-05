const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function catalog(){
 const w={},doc={readyState:'loading',getElementById:()=>null,addEventListener(){}};
 const ctx={window:w,document:doc,navigator:{onLine:false},console,URL,URLSearchParams,Intl,Date,Math,Number,String,Array,Set,Map,JSON,RegExp,Promise,AbortController,TextEncoder,setTimeout,clearTimeout};
 vm.runInNewContext(fs.readFileSync('yawmi-book-discovery-v31.js','utf8'),ctx);
 return w.YawmiBookCatalog;
}
test('catalog prefers a provider-verified Arabic edition title over English work title',()=>{
 const a=catalog(),book=a.normalize({key:'/works/OL123W',title:'Atomic Habits',language:['eng','ara'],
  editions:{docs:[{key:'/books/OL123M',title:'العادات الذرية',language:['ara'],cover_i:403212,number_of_pages:314}]},
  cover_i:391,ratings_average:4.6,ratings_count:180});
 assert.equal(book.title,'العادات الذرية');
 assert.equal(book.coverId,403212);
 assert.equal(book.pages,314);
 assert.equal(a.isRealArabic(book),true);
 assert.equal(book.key,'/works/OL123W');
});
test('catalog does not fabricate Arabic editions when only English titles exist',()=>{
 const a=catalog(),book=a.normalize({key:'/works/OL124W',title:'Atomic Habits',language:['eng','ara'],
  editions:{docs:[{title:'Atomic Habits',language:['eng']}]},ratings_average:4.6,ratings_count:180});
 assert.equal(book.title,'Atomic Habits');
 assert.equal(a.isRealArabic(book),false);
});
test('catalog skips Arabic-like titles without verified Arabic language metadata',()=>{
 const a=catalog(),book=a.normalize({key:'/works/OL125W',title:'العادات الذرية',language:['eng'],
  editions:{docs:[{title:'العادات الذرية',language:['eng']}]}});
 assert.equal(a.isRealArabic(book),false);
});
test('user Arabic aliases resolve without changing title metadata',()=>{
 const a=catalog();
 assert.equal(a.aliasOf('العادات الذرية'),'Atomic Habits');
 assert.equal(a.aliasOf('Atomic Habits'),'العادات الذرية');
});

test('ISBN parser handles numeric books without invented metadata',()=>{const a=catalog();assert.equal(a.isbnOf('978-1-7351717-0-1'),'9781735171701');assert.equal(a.isbnOf('٩٧٨١٧٣٥١٧١٧٠١'),'9781735171701');assert.equal(a.isbnOf('0306406152'),'0306406152');assert.equal(a.isbnOf('كتاب عربي'),'');});
