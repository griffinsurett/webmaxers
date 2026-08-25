import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
for (const w of [320,360,390]) {
  const p = await b.newPage({ viewport:{width:w,height:844} });
  await p.goto('http://localhost:4321/',{waitUntil:'load',timeout:60000});
  await p.waitForTimeout(2500);
  const r = await p.evaluate(()=>{
    const hdr=document.querySelector('header');
    const logoA=hdr.querySelector('a[href="/"]');
    // the actual painted text, not the anchor box
    const txt=logoA.querySelector('span[class*="text-"]');
    const rng=document.createRange(); rng.selectNodeContents(txt);
    const ink=rng.getBoundingClientRect();
    const gearWrap=hdr.querySelector('.justify-self-center');
    const g=gearWrap.getBoundingClientRect();
    const logoColClipped = logoA.closest('.overflow-hidden');
    const colR = logoColClipped?.getBoundingClientRect();
    return {
      textInkRight:Math.round(ink.right), gearLeft:Math.round(g.left),
      overlapsGear: ink.right > g.left,
      overlapPx: Math.round(ink.right-g.left),
      logoColRight: colR?Math.round(colR.right):null,
      textClippedByCol: colR? ink.right>colR.right+0.5 : null,
    };
  });
  console.log(String(w).padStart(4), JSON.stringify(r));
  await p.close();
}
await b.close();
