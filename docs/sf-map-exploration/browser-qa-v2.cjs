const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const {resolve,join}=require('node:path');
const {pathToFileURL}=require('node:url');
const fs=require('node:fs/promises');
(async()=>{
 const output=resolve(__dirname,'review-v2');await fs.mkdir(output,{recursive:true});
 const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1100},acceptDownloads:true});
 const errors=[],external=[],checks=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url())});
 const check=(name,result)=>{assert.ok(result,name);checks.push(name)};
 const base=pathToFileURL(resolve(__dirname,'../../public/sf-map-lab/parks-study-v2.html')).href;
 async function settle(){await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});}
 async function load(query=''){await page.goto(base+query);await settle();}
 async function capture(name,selector='#main-map'){await settle();await page.locator(selector).screenshot({path:join(output,name)});}
 await load();
 check('Golden Gate and Bay Bridge both appear',await page.locator('#main-map .golden-gate').count()===1&&await page.locator('#main-map .bay-bridge').count()===1);
 check('I-80 passes through both bridge endpoints',await page.evaluate(()=>{const points=ParksStudy.roads.find(r=>r.id==='80').points;return [[-122.386,37.789],[-122.365,37.808]].every(p=>points.some(q=>q[0]===p[0]&&q[1]===p[1]));}));
 check('No north arrow, road labels or landmarks',await page.locator('#main-map .north-arrow,#main-map .north-label,#main-map .landmark,#main-map .road-label').count()===0);
 check('Ten weather points retained',await page.locator('#main-map .weather-label-v2').count()===10);
 check('Region names absent from weather labels',await page.locator('#main-map .weather-label-v2').evaluateAll(items=>items.every(e=>!e.textContent.match(/Richmond|Sunset|Mission|Marina|Market|Merced|Heights|Beach/))));
 check('No current weather or wind in labels',await page.locator('#main-map .weather-label-v2').evaluateAll(items=>items.every(e=>!e.textContent.match(/mph|wind|sunny|cloud|fog/))));
 check('WeatherDash body typography used',await page.locator('#main-map .daily-temps').first().evaluate(e=>getComputedStyle(e).fontFamily.includes('Atkinson Hyperlegible Next')));
 check('Exactly three precipitation totals exceed 0.05 inches',await page.locator('#main-map .daily-rain').count()===3);
 for(const id of ['pacHeights','lakeMerced'])check(`Exactly 0.05 inches is suppressed: ${id}`,await page.locator(`#main-map [data-point="${id}"] .daily-rain`).count()===0);
 check('Beach symbols have no map labels',await page.locator('#main-map .beach-v2').evaluateAll(items=>items.length===4&&items.every(e=>e.querySelectorAll('svg').length===1&&e.textContent.trim()==='')));
 check('Beach markers centered at their own coordinates',await page.locator('#main-map .beach-v2').evaluateAll(items=>items.every(e=>{const r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();return Math.abs(r.left+r.width/2-(p.left+parseFloat(e.style.left)/100*p.width))<1&&Math.abs(r.top+r.height/2-(p.top+parseFloat(e.style.top)/100*p.height))<1})));
 await page.locator('#main-map [data-beach-v2="ocean"]').click();check('Swimmer opens independent beach detail',(await page.locator('#beach-content h2').textContent())==='Ocean Beach');await page.keyboard.press('Escape');
 await page.locator('#sample-day').selectOption('dry');await settle();check('Dry fixture hides every precipitation line',await page.locator('#main-map .daily-rain').count()===0);await page.locator('#sample-day').selectOption('mixed');
 for(const terrain of ['shade','bands','sparse','topo','flat']){await page.locator(`[data-set="terrain:${terrain}"]`).click();await settle();check(`Terrain option renders: ${terrain}`,await page.locator(`#main-map .terrain-${terrain}`).count()===1);await capture(`terrain-${terrain}.png`);}
 check('Full topo has 20 m contour data',await page.evaluate(()=>SF_TERRAIN.intervalMeters===20&&SF_TERRAIN.contours.some(l=>l.m===100)&&SF_TERRAIN.contours.some(l=>l.m===200)));
 await page.locator('[data-set="terrain:shade"]').click();
 for(const label of ['ticket','ribbon','columns','type']){await page.locator(`[data-set="label:${label}"]`).click();await settle();check(`Daily label option renders: ${label}`,await page.locator(`#main-map .label-${label}`).count()===1);check(`Marina label clears beach swimmers: ${label}`,await page.evaluate(()=>{const a=document.querySelector('#main-map [data-point="marina"] .label-content').getBoundingClientRect();return [...document.querySelectorAll('#main-map .beach-v2')].every(e=>{const b=e.getBoundingClientRect();return a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top})}));await capture(`labels-${label}.png`);}
 await page.locator('[data-set="label:ticket"]').click();
 check('Swimmer list contains five options, including solid freestyle',await page.locator('.icon-section').nth(0).locator('.svg-row').count()===5&&await page.locator('[data-icon-choice="swim:freestyle"]').count()===1);
 check('Compass list contains five options',await page.locator('.icon-section').nth(1).locator('.svg-row').count()===5);
 check('Location list contains crosshair and five person images',await page.locator('.icon-section').nth(2).locator('.svg-row').count()===6);
 for(const group of await page.evaluate(()=>ParksIcons.groups.map(g=>({id:g.id,options:g.options.map(o=>o.id)})))){for(const icon of group.options){await page.locator(`[data-icon-choice="${group.id}:${icon}"]`).click();await settle();check(`SVG choice applies: ${icon}`,await page.evaluate(({key,value})=>ParksStudy.getConfig()[key]===value,{key:group.id,value:icon}));} }
 await page.locator('[data-icon-choice="swim:freestyle"]').click();await page.locator('[data-icon-choice="jump:compass-ring"]').click();await page.locator('[data-icon-choice="location:crosshair"]').click();await page.locator('#demo-location').click();
 await capture('swimmer-choices.png','.icon-section:nth-child(1)');await capture('compass-choices.png','.icon-section:nth-child(2)');await capture('location-choices.png','.icon-section:nth-child(3)');
 const svgDownload=page.waitForEvent('download');await page.locator('.svg-row a').first().click();const svg=await svgDownload;check('Individual SVG download works',svg.suggestedFilename()==='sf-freestyle.svg');
 const recipeDownload=page.waitForEvent('download');await page.locator('#save-recipe').click();const recipe=await recipeDownload;await recipe.saveAs(join(output,'sample-recipe.json'));check('Updated recipe exports',recipe.suggestedFilename()==='sf-parks-recipe.json');
 await page.locator('[data-hide="terrain:flat"]').click();check('Hidden terrain option can be restored',await page.locator('[data-restore="terrain:flat"]').count()===1);await page.locator('[data-restore="terrain:flat"]').click();
 await page.locator('[data-minimize="label:type"]').click();check('Label option minimizes reversibly',await page.locator('[data-card="label:type"]').evaluate(e=>e.classList.contains('minimized')));await page.locator('[data-reset="label"]').click();
 await load('?terrain=shade&label=ticket&located=false');await capture('main-map.png');await page.screenshot({path:join(output,'desktop.png'),fullPage:true});
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});await settle();await page.waitForTimeout(100);check(`No document overflow at ${width}px`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 await page.setViewportSize({width:390,height:844});await load('?terrain=shade&label=ticket&located=false');await capture('phone-map.png');
 check('Phone has representative labels and picker',await page.locator('#main-map .weather-label-v2').evaluateAll(items=>items.filter(e=>getComputedStyle(e).display!=='none').length>=3&&items.filter(e=>getComputedStyle(e).display!=='none').length<=4)&&await page.locator('#main-map [data-point-picker]').isVisible());
 await page.locator('#main-map [data-point-picker]').selectOption('outerRichmond');await settle();await capture('phone-richmond.png');check('Phone picker preserves ten locations',await page.locator('#main-map [data-point-picker] option').count()===10);
 await page.emulateMedia({reducedMotion:'reduce'});check('Reduced motion preference renders',await page.locator('#main-map .new-map').isVisible());
 check('No uncaught browser errors',errors.length===0);check('No external HTTP requests',external.length===0);
 await fs.writeFile(join(output,'qa-results.json'),JSON.stringify({checks,errors,external,viewports:[320,390,768,1440]},null,2));
 console.log(JSON.stringify({passed:checks.length,errors,external,output},null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
