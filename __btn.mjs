import { chromium } from 'playwright-core';
const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
for (const theme of ['dark','light']) {
  const p=await b.newPage({viewport:{width:1400,height:900},colorScheme:theme});
  await p.goto('http://localhost:4399/',{waitUntil:'networkidle',timeout:90000});
  await p.evaluate(t=>{document.documentElement.setAttribute('data-theme',t);try{localStorage.setItem('theme',t);}catch{}},theme);
  await p.waitForTimeout(2200);
  const btn=p.locator('a:has-text("Book a Free Call"), button:has-text("Book a Free Call")').first();
  const rest=await btn.evaluate(el=>{const c=getComputedStyle(el);return {border:c.borderColor,bg:c.backgroundColor};});
  await btn.hover();
  await p.waitForTimeout(600);
  const hov=await btn.evaluate(el=>{const c=getComputedStyle(el);return {border:c.borderColor,bg:c.backgroundColor};});
  const tok=await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim());
  console.log(`\n${theme.toUpperCase()}  (--color-primary = ${tok})`);
  console.log('  rest :', JSON.stringify(rest));
  console.log('  hover:', JSON.stringify(hov));
  await p.close();
}
await b.close();
