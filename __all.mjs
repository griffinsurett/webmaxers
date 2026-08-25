import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const p = await b.newPage({ viewport:{width:1440,height:900} });
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:9999/',{waitUntil:'load',timeout:60000});
await p.waitForTimeout(4000);
await p.evaluate(()=>document.querySelectorAll('astro-dev-toolbar').forEach(e=>e.remove()));
const snap=()=>p.evaluate(()=>({y:Math.round(scrollY),
  op:[...document.querySelectorAll('[data-scroll-fade-css]')].map(x=>+getComputedStyle(x).opacity.slice(0,4))}));
console.log('TOP ',JSON.stringify(await snap()));
await p.evaluate(()=>scrollTo(0,700)); await p.waitForTimeout(900);
console.log('DOWN',JSON.stringify(await snap()));
await p.evaluate(()=>scrollTo(0,0)); await p.waitForTimeout(900);
console.log('UP  ',JSON.stringify(await snap()));
await p.click('#header-ask-ai'); await p.waitForTimeout(1300);
console.log('MODAL',JSON.stringify(await p.evaluate(()=>{
  const d=[...document.querySelectorAll('[role="dialog"]')].find(x=>x.getAttribute('aria-label')==='Ask AI');
  return {open:!!d,opacity:d?getComputedStyle(d).opacity:null};})));
const m=await b.newPage({viewport:{width:390,height:844}});
await m.goto('http://localhost:9999/',{waitUntil:'load',timeout:60000}); await m.waitForTimeout(3500);
await m.evaluate(()=>document.querySelectorAll('astro-dev-toolbar').forEach(e=>e.remove()));
console.log('MOBILE',JSON.stringify(await m.evaluate(()=>{
  const btn=document.querySelector('#header-ask-ai'); const r=btn.getBoundingClientRect();
  const hdr=document.querySelector('header').getBoundingClientRect();
  return {w:Math.round(r.width),h:Math.round(r.height),hasIcon:!!btn.querySelector('svg'),fits:r.right<=hdr.right+1};})));
console.log('ERRORS',JSON.stringify(errs.slice(0,3)));
await b.close();
