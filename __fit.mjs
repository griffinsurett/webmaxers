import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
for (const w of [320,390,430,640,768,1024,1440]) {
  const p = await b.newPage({ viewport:{width:w,height:844}, deviceScaleFactor:2 });
  await p.goto('http://localhost:9999/',{waitUntil:'load',timeout:60000});
  await p.waitForTimeout(3000);
  await p.evaluate(()=>document.querySelectorAll('astro-dev-toolbar').forEach(e=>e.remove()));
  const r=await p.evaluate(()=>{
    const grid=document.querySelector('header > div').getBoundingClientRect();
    const logo=document.querySelector('header a[href="/"]').getBoundingClientRect();
    const btn=document.querySelector('#header-ask-ai').getBoundingClientRect();
    const nav=document.querySelector('header nav').getBoundingClientRect();
    const gear=document.querySelector('header button[aria-label*="heme"],header [class*="theme"] button')?.getBoundingClientRect();
    const mark=document.querySelector('header a[href="/"] img, header a[href="/"] svg')?.getBoundingClientRect();
    return {logoRight:Math.round(logo.right), gearLeft:gear?Math.round(gear.left):null,
      logoOverlapsGear: gear? logo.right>gear.left : null,
      navRight:Math.round(nav.right), gridRight:Math.round(grid.right),
      navFits: nav.right<=grid.right+1, markW:mark?Math.round(mark.width):null,
      overflowX: document.documentElement.scrollWidth>innerWidth};
  });
  console.log(String(w).padStart(4), JSON.stringify(r));
  await p.close();
}
await b.close();
