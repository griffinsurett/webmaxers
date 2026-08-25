import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:3 });
await p.goto('http://localhost:9999/',{waitUntil:'load',timeout:60000});
await p.waitForTimeout(3800);
await p.evaluate(()=>document.querySelectorAll('astro-dev-toolbar').forEach(e=>e.remove()));
console.log(JSON.stringify(await p.evaluate(()=>{
  const btn=document.querySelector('#header-ask-ai');
  const hdr=document.querySelector('header');
  const nav=btn.closest('nav');
  const r=btn.getBoundingClientRect(), h=hdr.getBoundingClientRect(), n=nav.getBoundingClientRect();
  return {vw:innerWidth, btnRight:Math.round(r.right), hdrRight:Math.round(h.right),
    navRight:Math.round(n.right), overflowPx:Math.round(r.right-h.right),
    docScrollW:document.documentElement.scrollWidth, bodyOverflowX:document.documentElement.scrollWidth>innerWidth};
}),null,2));
await (await p.$('header')).screenshot({path:process.env.OUT+'/mob-hdr.png'});
await b.close();
