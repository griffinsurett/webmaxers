import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:3 });
await p.goto('http://localhost:9999/',{waitUntil:'load',timeout:60000});
await p.waitForTimeout(3800);
await p.evaluate(()=>document.querySelectorAll('astro-dev-toolbar').forEach(e=>e.remove()));
console.log(JSON.stringify(await p.evaluate(()=>{
  const g=document.querySelector('header > div');
  const cs=getComputedStyle(g); const gr=g.getBoundingClientRect();
  const cols=[...g.children].map(c=>({cls:c.className.toString().slice(0,28), w:Math.round(c.getBoundingClientRect().width), right:Math.round(c.getBoundingClientRect().right)}));
  const ham=document.querySelector('header .header-navigation')||document.querySelector('header nav > :last-child');
  const hr=ham?.getBoundingClientRect();
  const logo=document.querySelector('header a[href="/"]').getBoundingClientRect();
  return {gridW:Math.round(gr.width), gridRight:Math.round(gr.right), padL:cs.paddingLeft, padR:cs.paddingRight,
    cols, logoW:Math.round(logo.width),
    hamburger: hr?{w:Math.round(hr.width),right:Math.round(hr.right),visible:hr.right<=innerWidth}:null};
}),null,2));
await b.close();
