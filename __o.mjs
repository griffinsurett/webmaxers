import { chromium } from 'playwright-core';
const B = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const p = await B.newPage({ viewport:{width:1440,height:900} });
const errs=[]; p.on('pageerror', e=>errs.push(e.message.slice(0,110)));
await p.goto('http://localhost:9999/', {waitUntil:'networkidle'});
await p.waitForTimeout(2500);
await p.click('#cookie-consent-banner >> text=/accept all/i').catch(()=>{});
await p.waitForTimeout(2500);
const g = await p.evaluate(()=>{
  const sc=document.scrollingElement, el=document.querySelector('[data-logo-break]');
  if(!el) return null; const r=el.getBoundingClientRect();
  return { found:true, top:Math.round(r.top+sc.scrollTop), bottom:Math.round(r.bottom+sc.scrollTop),
           containsHero: !!el.querySelector('#hero'), containsAbout: !!el.querySelector('#about') };
});
console.log('break wrapper:', JSON.stringify(g));
// frame timing across the range
await p.evaluate(()=>{ window.__f=[]; let l=performance.now();
  const f=()=>{const n=performance.now(); window.__f.push(n-l); l=n; requestAnimationFrame(f);}; requestAnimationFrame(f); });
for (let y=0;y<=(g?g.bottom:2400);y+=120){ await p.evaluate(y=>window.scrollTo(0,y),y); await p.waitForTimeout(80); }
const f = await p.evaluate(()=>{const a=window.__f.slice(5).sort((x,y)=>x-y);
  return {median:+a[Math.floor(a.length/2)].toFixed(1), p95:+a[Math.floor(a.length*.95)].toFixed(1), over50:a.filter(v=>v>50).length};});
console.log('frames:', JSON.stringify(f));
console.log('canvases:', await p.evaluate(()=>document.querySelectorAll('canvas').length));
console.log('errors:', errs.length?errs.slice(0,3):'none');
await B.close();
