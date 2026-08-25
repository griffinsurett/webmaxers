import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
for (const scheme of ['dark','light']) {
  const p = await b.newPage({ viewport:{width:1440,height:900}, colorScheme:scheme, deviceScaleFactor:3 });
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('http://localhost:9999/',{waitUntil:'load',timeout:60000});
  await p.waitForTimeout(4000);
  await p.evaluate(()=>document.querySelectorAll('astro-dev-toolbar').forEach(e=>e.remove()));
  const r=await p.evaluate(()=>{
    const btn=document.querySelector('#header-ask-ai'); if(!btn) return {found:false};
    const svg=btn.querySelector('svg'); const wrap=svg?.closest('span');
    const br=btn.getBoundingClientRect(), sr=svg?.getBoundingClientRect();
    return {found:true, btnW:Math.round(br.width), btnH:Math.round(br.height),
      hasSvg:!!svg, svgW:sr?Math.round(sr.width):0, svgH:sr?Math.round(sr.height):0,
      iconColor: wrap?getComputedStyle(wrap).color:null,
      svgFill: svg?getComputedStyle(svg.querySelector('path')).fill:null,
      text: btn.textContent.trim()};
  });
  console.log(scheme.toUpperCase(), JSON.stringify(r));
  console.log('  primary token:', await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim()));
  if(errs.length) console.log('  ERR',errs.slice(0,2));
  const hdr=await p.$('header'); await hdr.screenshot({path:`${process.env.OUT}/icon-${scheme}.png`});
  await p.close();
}
await b.close();
