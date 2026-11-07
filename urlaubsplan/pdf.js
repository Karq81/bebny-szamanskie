const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage();
await p.goto('file://'+process.cwd()+'/urlaubsplan_2027_A0.html');
await p.pdf({path:'urlaubsplan_2027_A0.pdf',width:'1189mm',height:'841mm',printBackground:true,preferCSSPageSize:true});
await p.setViewportSize({width:4494,height:3179});await p.screenshot({path:'preview.png'});
const h=await p.evaluate(()=>document.body.scrollHeight);console.log('scrollH',h);await b.close()})();
