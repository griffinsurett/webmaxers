import { chromium } from "playwright-core";
import fs from "fs"; fs.mkdirSync("./_shots",{recursive:true});
const CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const b=await chromium.launch({executablePath:CHROME,headless:true});
const d=await b.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
await d.goto("http://localhost:9123/",{waitUntil:"networkidle"});
await d.waitForTimeout(1500);
await d.evaluate(()=>document.documentElement.setAttribute("data-theme","dark"));
try{await d.getByText("Accept All").click({timeout:2000});}catch{}
await d.waitForTimeout(600);
const r=await d.evaluate(()=>{
  const hero=document.querySelector("#hero h1");
  const fh=document.querySelector(".footer-top__heading");
  const foot=document.querySelector('footer[role="contentinfo"]');
  return {
    heroFS:hero?getComputedStyle(hero).fontSize:null,
    footFS:fh?getComputedStyle(fh).fontSize:null,
    footBorderTop:getComputedStyle(foot).borderTopWidth+" "+getComputedStyle(foot).borderTopColor,
  };
});
console.log(JSON.stringify(r));
const el=await d.$('footer[role="contentinfo"]');
await el.scrollIntoViewIfNeeded(); await d.waitForTimeout(500);
await el.screenshot({path:"./_shots/footer.png"});
await b.close();
