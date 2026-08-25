import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
for (const scheme of ['dark','light']) {
  const p = await b.newPage({ viewport:{width:1440,height:900}, colorScheme:scheme, deviceScaleFactor:3 });
  await p.goto('http://localhost:9999/',{waitUntil:'load',timeout:60000});
  await p.waitForTimeout(3500);
  await p.evaluate(()=>document.querySelectorAll('astro-dev-toolbar').forEach(e=>e.remove()));
  await p.hover('#header-ask-ai'); await p.waitForTimeout(600);
  console.log(scheme.toUpperCase(), JSON.stringify(await p.evaluate(()=>{
    const btn=document.querySelector('#header-ask-ai');
    const svg=btn.querySelector('svg'); const wrap=svg.closest('span');
    return {btnBg:getComputedStyle(btn).backgroundColor, btnText:getComputedStyle(btn).color,
            iconColor:getComputedStyle(wrap).color};
  })));
  const hdr=await p.$('header'); await hdr.screenshot({path:`${process.env.OUT}/hover-${scheme}.png`});
  await p.close();
}
await b.close();
