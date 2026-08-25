import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
for (const w of [320,360,390,414]) {
  const p = await b.newPage({ viewport:{width:w,height:844} });
  await p.goto('http://localhost:4321/',{waitUntil:'load',timeout:60000});
  await p.waitForTimeout(2500);
  const r = await p.evaluate(()=>{
    const hdr=document.querySelector('header');
    const grid=hdr.querySelector(':scope > div');
    const gearCol=grid.children[1].getBoundingClientRect();
    const logoA=hdr.querySelector('a[href="/"]');
    const lr=logoA.getBoundingClientRect();
    const cs=getComputedStyle(grid);
    const gap=parseFloat(cs.columnGap)||0;
    // hard ceiling: lockup must stop before the centred gear's left edge (minus gap)
    const maxLockupW = Math.round(gearCol.left - lr.left - gap);
    return { lockupW:Math.round(lr.width), maxLockupW, headroomPx: maxLockupW-Math.round(lr.width),
             headroomPct: +(((maxLockupW/lr.width)-1)*100).toFixed(1), gap };
  });
  console.log(String(w).padStart(4), JSON.stringify(r));
  await p.close();
}
await b.close();
