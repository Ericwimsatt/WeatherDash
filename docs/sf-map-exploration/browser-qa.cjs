/* Optional browser verification. Uses an already installed Playwright; installs nothing.
 * PLAYWRIGHT_MODULE=/absolute/path/to/playwright node docs/sf-map-exploration/browser-qa.cjs
 */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {mkdir,writeFile}=require('node:fs/promises');
const {join,resolve}=require('node:path');
const {pathToFileURL}=require('node:url');
const assert=require('node:assert/strict');
const root=resolve(__dirname,'../../public/sf-map-lab');
const output=join(__dirname,'review');
const url=(file,query='')=>pathToFileURL(join(root,file)).href+query;
(async()=>{
 await mkdir(output,{recursive:true});
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,acceptDownloads:true});
 const page=await context.newPage();const errors=[],requests=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url())});
 const check=(name,condition)=>{assert.ok(condition,name);checks.push(name)};
 async function settle(){await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});}
 async function load(file,query=''){await page.goto(url(file,query));await settle();}
 async function screenshot(name,locator){await settle();if(locator)await locator.screenshot({path:join(output,name)});else await page.screenshot({path:join(output,name),fullPage:true});}
 const overflow=()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
 await load('index.html');
 check('Baseline includes ten existing SF forecast points',await page.locator('#map-preview .weather-regions .region-label').count()===10);
 check('Baseline includes four independently located beaches',await page.locator('#map-preview .beach-pin').count()===4);
 check('No desktop document overflow',await overflow());
 check('Long comparisons use the carousel',await page.locator('#options-deck').evaluate(e=>e.classList.contains('carousel')));
 await page.locator('[data-keep="parks"]').click();check('Keep persists a candidate',await page.locator('#decision-count').textContent()==='1');
 await page.locator('[data-minimize="parks"]').click();check('Minimize collapses map and explanation',await page.locator('[data-option="parks"]').evaluate(e=>e.classList.contains('is-minimized')));
 await page.locator('[data-hide="parks"]').click();check('Hide retains a restore control',await page.locator('[data-restore="parks"]').count()===1);
 await page.locator('[data-restore="parks"]').click();await page.locator('#restore-options').click();
 await page.locator('[data-apply="parks"]').click();await page.keyboard.press('l');
 check('h / l keyboard cycling works after a choice button',await page.locator('#map-preview .orientation-streets').count()===1);
 await page.locator('.chapter-heading h1').click();await page.keyboard.press('End');check('End reaches the last map system',await page.locator('#map-preview .orientation-hybrid').count()===1);
 await page.keyboard.press('Home');check('Home reaches the first map system',await page.locator('#map-preview .orientation-parks').count()===1);
 await page.locator('#map-preview .weather-regions [data-region="mission"]').click();
 check('Point selection updates the dock',await page.locator('#map-preview .forecast-detail h3').textContent()==='Mission');
 await page.locator('#map-preview .beach-ocean').click();check('Beach opens separate detail',await page.locator('#map-preview .beach-drawer').isVisible());
 check('Beach selection preserves weather selection',await page.locator('#map-preview .forecast-detail h3').textContent()==='Mission');
 await page.keyboard.press('Escape');check('Escape closes beach detail',await page.locator('#map-preview .beach-drawer').isHidden());
 await page.locator('#map-preview [data-locate]').click();check('Locate is simulation only',await page.locator('#map-preview .current-location').textContent()==='You · demo');
 await page.locator('#map-preview [data-time="later"]').click();check('Citywide time changes stamp and hourly panel',(await page.locator('#map-preview .sample-stamp').textContent()).includes('4 pm')&&(await page.locator('#map-preview .hour-row span').first().textContent()).includes('4 pm'));
 await page.locator('#map-preview [data-edge="Marin"]').click();check('Outside-SF navigation is an explicit scope preview',(await page.locator('#map-preview .map-message').textContent()).includes('outside this SF-only study'));await page.locator('#map-preview .map-message button').click();
 await page.locator('#show-worksheet').click();await page.locator('#decision-notes').fill('QA note: parks plus tickets.');await page.locator('#close-worksheet').click();
 await page.reload();await settle();check('Choice and note survive reload',await page.evaluate(()=>JSON.parse(localStorage.getItem('sf-map-study-v1')).notes==='QA note: parks plus tickets.'));
 const downloadPromise=page.waitForEvent('download');await page.locator('#export-decisions').click();const download=await downloadPromise;await download.saveAs(join(output,'sample-decisions.json'));check('Decision export downloads portable JSON',download.suggestedFilename()==='sf-map-decisions.json');
 const chapters=await page.evaluate(()=>SF_CHOICES.map(c=>({id:c.id,options:c.options.map(o=>({id:o.id,config:o.config}))})));
 let optionsTried=0;
 for(const chapter of chapters){await page.locator(`[data-chapter="${chapter.id}"]`).click();for(const option of chapter.options){await page.locator(`[data-apply="${option.id}"]`).click();await settle();check(`Option renders: ${option.id}`,await page.locator('#map-preview [data-map-root]').count()===1);optionsTried++;}check(`Chapter has no document overflow: ${chapter.id}`,await overflow());}
 check('All 46 alternatives tried on the SF map',optionsTried===46);
 await page.locator('#toggle-inspector').click();await page.locator('[data-config="pattern"]').selectOption('lens');await page.locator('[data-config="metric"]').selectOption('uv');
 check('UV lens has a persistent written metric label',(await page.locator('#map-preview .map-toolbar>span').textContent()).includes('UV index'));
 await page.locator('[data-config="unit"]').selectOption('c');check('Celsius is explicitly labeled',(await page.locator('#map-preview .sample-stamp').textContent()).includes('°C'));
 for(const scene of ['loading','error']){await page.locator('[data-config="scene"]').selectOption(scene);check(`${scene} does not invent selected numeric values`,(await page.locator('#map-preview .detail-values dd').allTextContents()).every(s=>s.includes('—')));}
 await page.locator('#map-preview [data-retry]').click();check('Retry demonstrates recovery in place',await page.locator('#map-preview .scene-marine').count()===1);
 await page.locator('[data-config="coverage"]').selectOption('expanded');check('Proposed coverage contains fourteen points',await page.locator('#map-preview .weather-regions .region-label').count()===14);
 await page.locator('[data-config="coverage"]').selectOption('existing');check('Returning to existing coverage removes proposed points',await page.locator('#map-preview .weather-regions .region-label').count()===10);
 await page.evaluate(()=>localStorage.clear());await load('index.html');await screenshot('desktop.png');
 await page.setViewportSize({width:390,height:844});await screenshot('mobile.png');check('No phone document overflow',await overflow());
 check('Phone has four or five representative / selected labels',await page.locator('#map-preview .region-label').evaluateAll(items=>{const n=items.filter(e=>getComputedStyle(e).display!=='none').length;return n>=4&&n<=5}));
 await page.locator('#map-preview [data-region-select]').selectOption('outerRichmond');check('Phone picker selects all existing locations',await page.locator('#map-preview .forecast-detail h3').textContent()==='Outer Richmond');
 await page.locator('#map-preview .beach-summary-row').first().click();check('Phone beach detail opens',await page.locator('#map-preview .beach-drawer').isVisible());await page.keyboard.press('Escape');
 for(const width of [320,768,1280,1600]){await page.setViewportSize({width,height:1000});check(`No document overflow at ${width}px`,await overflow());}
 await page.setViewportSize({width:1280,height:1000});
 for(const orientation of ['parks','streets','landmarks','hybrid']){await load(orientation+'.html');check(`Standalone renders: ${orientation}`,await page.locator(`.orientation-${orientation}`).count()===1);await screenshot(`map-${orientation}.png`);}
 for(const scene of ['rain','uv','partial','stale','night','loading','error']){await load('map.html','?scene='+scene);check(`Standalone state renders: ${scene}`,await page.locator(`.scene-${scene}`).count()===1);if(scene==='rain'){check('Rain beach map and list share caution states',await page.locator('.beach-summary-row.status-caution').count()===4&&await page.locator('.beach-pin.status-caution').count()===4);await page.locator('.beach-summary-row[data-beach="ocean"]').click();check('Rain beach detail shares the concern label',(await page.locator('.beach-state').textContent()).includes('Runoff concern'));await page.keyboard.press('Escape');}if(scene==='partial'){check('Partial Aquatic map and list share unknown state',await page.locator('.beach-pin.beach-aquatic.status-unknown').count()===1&&await page.locator('.beach-summary-row[data-beach="aquatic"].status-unknown').count()===1);await page.locator('.beach-summary-row[data-beach="aquatic"]').click();check('Partial Aquatic detail keeps missing evidence',(await page.locator('.beach-state').textContent()).includes('Data unavailable')&&(await page.locator('.beach-detail-values').textContent()).includes('Unavailable'));await page.keyboard.press('Escape');}if(['rain','partial','night'].includes(scene))await screenshot(`state-${scene}.png`);}
 await load('map.html','?overlay=chip');check('Both Sunset chip readings remain unobstructed',await page.evaluate(()=>{const a=document.querySelector('.weather-regions [data-region="outerSunset"] .label-body').getBoundingClientRect(),b=document.querySelector('.weather-regions [data-region="innerSunset"] .label-body').getBoundingClientRect();return a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top}));
 await page.setViewportSize({width:390,height:844});await load('map.html','?scene=partial&selected=outerRichmond');check('Selected phone label clears beach symbols',await page.evaluate(()=>{const a=document.querySelector('.region-label.is-selected .label-body').getBoundingClientRect();return [...document.querySelectorAll('.beach-symbol')].every(e=>{const b=e.getBoundingClientRect();return a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top})}));await screenshot('phone-partial.png');
 await page.setViewportSize({width:1440,height:1000});await load('report.html');check('Report renders eight orientation / overlay map comparisons',await page.locator('[data-map-config]').count()===8);await page.locator('.report-map-grid').first().scrollIntoViewIfNeeded();await settle();await screenshot('map-systems.png',page.locator('.report-map-grid').first());
 await page.locator('.report-map-grid').nth(1).scrollIntoViewIfNeeded();await settle();await screenshot('label-layouts.png',page.locator('.report-map-grid').nth(1));
 await load('atlas.html');check('Atlas includes all 46 map variants',await page.locator('[data-map-config]').count()===46);for(const id of ['pattern','scene','icons','other']){await page.locator(`#${id}`).scrollIntoViewIfNeeded();await settle();}
 await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));check('All atlas maps render for print',await page.locator('[data-rendered="true"]').count()===46);await screenshot('weather-states.png',page.locator('#scene'));await screenshot('information-patterns.png',page.locator('#pattern'));
 await page.setViewportSize({width:1040,height:1040});await load('icons.html');await screenshot('icons.png');
 await load('map.html','?orientation=%22%3E%3Cscript%3Ealert(1)%3C/script%3E&scene=invalid');check('Unrecognized query values fall back to safe defaults',await page.locator('.orientation-hybrid.scene-marine').count()===1);
 check('No external network dependencies were requested',requests.length===0);check('No uncaught browser errors',errors.length===0);
 await writeFile(join(output,'qa-results.json'),JSON.stringify({checkedAt:new Date().toISOString(),checks,errors,externalRequests:requests,viewports:[320,390,768,1280,1440,1600],optionsTried},null,2)+'\n');
 console.log(JSON.stringify({passed:checks.length,optionsTried,errors,externalRequests:requests,screenshots:output},null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
