import { chromium } from 'playwright-core';
const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
for(const [label,w,h] of [['mobile 390',390,844],['tablet 768',768,1024],['desktop 1440',1440,900]]){
  const ctx=await b.newContext({viewport:{width:w,height:h},isMobile:w<768,hasTouch:w<768});
  const p=await ctx.newPage();
  await p.goto('http://localhost:9999/',{waitUntil:'networkidle'});
  await p.waitForTimeout(600);
  const r=await p.evaluate(()=>{
    const cs=s=>getComputedStyle(document.querySelector(s));
    const bot=document.querySelector('.curtain__bottom');
    const kid=bot.firstElementChild;
    return {curtain:cs('.curtain').position,
      travelH:Math.round(document.querySelector('.curtain__travel').getBoundingClientRect().height),
      topPos:cs('.curtain__top').position,
      bottomPos:cs('.curtain__bottom').position,
      stageMT:cs('.curtain__bottom-stage').marginTop,
      slotH:Math.round(kid.getBoundingClientRect().height),
      slotShrink:getComputedStyle(kid).flexShrink};
  });
  console.log(label.padEnd(13),'->',JSON.stringify(r));
  await ctx.close();
}
await b.close();
