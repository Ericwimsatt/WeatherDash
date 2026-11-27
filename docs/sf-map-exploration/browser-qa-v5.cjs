const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const {resolve,join}=require('node:path');
const {pathToFileURL}=require('node:url');
const fs=require('node:fs/promises');
(async()=>{
 const output=resolve(__dirname,'review-v5');await fs.mkdir(output,{recursive:true});
 const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1100},acceptDownloads:true});
 const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
 const check=(name,result)=>{assert.ok(result,name);checks.push(name)};
 const base=pathToFileURL(resolve(__dirname,'../../public/sf-map-lab/parks-study-v5.html')).href;
 const settle=()=>page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});
 await page.goto(base);await page.evaluate(()=>{localStorage.removeItem('sf-parks-study-v5');localStorage.setItem('sf-parks-study-v4',JSON.stringify({weatherStyle:'compact',swimmerStyle:'disc',density:'10'}));});await page.reload();await settle();
 check('Selected weather direction is the new default',await page.evaluate(()=>ParksStudy.getConfig().weatherStyle==='high-led'));
 check('Solid teal swimmer is the new default',await page.evaluate(()=>ParksStudy.getConfig().swimmerStyle==='filled'));
 check('Previous density choices cannot trim the new preview',await page.evaluate(()=>ParksStudy.getConfig().density==='22'&&ParksStudy.visiblePoints({density:'10'}).length===22));
 check('Locations control exposes all locations only',await page.locator('#density option').count()===1&&await page.locator('#density').inputValue()==='22');
 check('Teal button remains 44 px with a 34 px visible disc',await page.locator('#main-map .beach-marker').first().evaluate(e=>{const c=getComputedStyle(e,'::before');return e.getBoundingClientRect().width===44&&e.getBoundingClientRect().height===44&&c.backgroundColor==='rgb(7, 81, 107)'&&c.inset==='5px'}));
 const sizes=[];
 for(const width of [1440,768,390,320]){
   await page.setViewportSize({width,height:1000});await settle();
   check(`All 22 labels render at ${width}px`,await page.locator('#main-map .weather-label').evaluateAll(items=>items.length===22&&items.every(e=>getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility==='visible'&&e.getBoundingClientRect().width>0)));
   check(`No automatic collapse classes at ${width}px`,await page.locator('#main-map .density-collapsed,#main-map .is-obscured').count()===0);
   const size=await page.evaluate(()=>{const root=document.querySelector('#main-map');return {high:parseFloat(getComputedStyle(root.querySelector('.temp-high')).fontSize),low:parseFloat(getComputedStyle(root.querySelector('.temp-low')).fontSize),icon:root.querySelector('.beach-marker .study-icon').getBoundingClientRect().width}});sizes.push({width,...size});
   check(`High is 18 pt / 24 CSS px at ${width}px`,Math.abs(size.high-24)<.02);
   check(`Low is 14 pt / 18.667 CSS px at ${width}px`,Math.abs(size.low-56/3)<.02);
   check(`Swimmer glyph is half its prior 27 px size at ${width}px`,Math.abs(size.icon-13.5)<.02);
   check(`No document overflow at ${width}px`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   if(width===390)await page.locator('#main-map').screenshot({path:join(output,'phone-all-locations.png')});
 }
 await page.locator('#main-map [data-point-picker]').selectOption('glenPark');await settle();check('Selecting an added location keeps all 22 labels',await page.locator('#main-map .weather-label').evaluateAll(items=>items.length===22&&items.every(e=>getComputedStyle(e).display!=='none')));
 await page.setViewportSize({width:1440,height:1100});await page.locator('#main-map [data-point-picker]').selectOption('innerSunset');await settle();await page.locator('#main-map').screenshot({path:join(output,'main-map.png')});
 await page.locator('#main-map [data-beach="ocean"]').click();check('Smaller swimmer still opens beach details',await page.locator('#beach-content h2').textContent()==='Ocean Beach');await page.keyboard.press('Escape');
 check('All weather labels still have UV/rain second row',await page.locator('#main-map .weather-label').evaluateAll(items=>items.every(e=>e.querySelector('.secondary-row .uv-value')&&(!e.querySelector('.rain-value')||e.querySelector('.rain-value').parentElement.className==='secondary-row'))));
 const downloadPromise=page.waitForEvent('download');await page.locator('#save-recipe').click();const d=await downloadPromise;await d.saveAs(join(output,'selected-recipe.json'));check('Selected recipe still exports',d.suggestedFilename()==='sf-density-choices.json');
 await page.reload();await settle();check('Reload preserves selected direction and all locations',await page.evaluate(()=>ParksStudy.getConfig().weatherStyle==='high-led'&&ParksStudy.getConfig().swimmerStyle==='filled'&&ParksStudy.visiblePoints(ParksStudy.getConfig()).length===22));
 check('No uncaught browser errors',errors.length===0);await fs.writeFile(join(output,'qa-results.json'),JSON.stringify({checks,sizes,errors},null,2));console.log(JSON.stringify({passed:checks.length,sizes,errors},null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
