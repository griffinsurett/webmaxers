import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
for (const w of [320,360,390,414]) {
  const p = await b.newPage({ viewport:{width:w,height:844} });
  await p.goto('http://localhost:4321/',{waitUntil:'load',timeout:60000});
  await p.waitForTimeout(2500);
  const r = await p.evaluate(()=>{
    const hdr=document.querySelector('header');
    const grid=hdr.querySelector(':scope > div');
    const cols=[...grid.children];
    const logoCol=cols[0], gearCol=cols[1], navCol=cols[2];
    const lr=logoCol.getBoundingClientRect(), gr=gearCol.getBoundingClientRect(), nr=navCol.getBoundingClientRect();
    const logoA=hdr.querySelector('a[href="/"]').getBoundingClientRect();
    const gridR=grid.getBoundingClientRect();
    return {
      gridW:Math.round(gridR.width),
      logoColW:Math.round(lr.width), logoInkW:Math.round(logoA.width),
      gearColW:Math.round(gr.width), navColW:Math.round(nr.width),
      // free space in the logo column = column width minus what the lockup uses
      slackInLogoCol: Math.round(lr.width-logoA.width),
      gapLogoToGear: Math.round(gr.left-logoA.right),
    };
  });
  console.log(String(w).padStart(4), JSON.stringify(r));
  await p.close();
}
await b.close();
