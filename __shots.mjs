import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
for (const w of [320,390,768]) {
  const p = await b.newPage({ viewport:{width:w,height:844}, deviceScaleFactor:3 });
  await p.goto('http://localhost:9999/',{waitUntil:'load',timeout:60000});
  await p.waitForTimeout(3000);
  await p.evaluate(()=>document.querySelectorAll('astro-dev-toolbar').forEach(e=>e.remove()));
  await (await p.$('header')).screenshot({path:`${process.env.OUT}/fit-${w}.png`});
  await p.close();
}
await b.close(); console.log('ok');
