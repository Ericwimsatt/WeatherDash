const{chromium}=require(process.env.PLAYWRIGHT_MODULE || '/Users/ericwimsatt/.npm/_npx/705bc6b22212b352/node_modules/playwright');const fs=require('node:fs');
const today=new Date(Date.now()-8*3600e3).toISOString().slice(0,10);const shift=(d,n)=>new Date(Date.parse(d+'T12:00:00Z')+n*864e5).toISOString().slice(0,10);
function bundle(lat,lon){const b={sources:[{id:'nws:KSFO',provider:'nws',dataset:'station_observations',station_id:'KSFO'},{id:'om:forecast:'+lat+':'+lon,provider:'open_meteo',dataset:'forecast',model:'best_match'}],hourly_weather:[],hourly_tides:[],daily_sun_times:[],daily_water_temperature:[]};for(let day=-8;day<12;day++){const date=shift(today,day);for(let h=0;h<24;h++)b.hourly_weather.push({latitude_e6:lat,longitude_e6:lon,source_id:day<0?'nws:KSFO':'om:forecast:'+lat+':'+lon,source_retrieved_at_pst:today+'T00:00:00-08:00',hour_pst:date+'T'+String(h).padStart(2,'0')+':00:00-08:00',data_kind:Date.parse(date+'T'+String(h).padStart(2,'0')+':00:00-08:00')+3600e3<=Date.now()?'observation':'forecast',temperature_f:Math.round(58+Math.sin(h/24*Math.PI*2)*7+(lon/1e6+122.5)*50),uv_index:Math.max(0,Math.round(5*Math.sin((h-6)/12*Math.PI))),wind_speed_mph:Math.round(12+(Math.abs(lon)%10)),rainfall_in:.004,rainfall_start_pst:date+'T'+String(h).padStart(2,'0')+':00:00-08:00',rainfall_end_pst:new Date(Date.parse(date+'T'+String(h).padStart(2,'0')+':00:00-08:00')+3600e3-8*3600e3).toISOString().slice(0,19)+'-08:00',weather_code:1});b.daily_sun_times.push({latitude_e6:lat,longitude_e6:lon,source_id:'nws:KSFO',source_retrieved_at_pst:today+'T00:00:00-08:00',date_pst:date,sunrise_pst:date+'T07:00:00-08:00',sunset_pst:date+'T17:00:00-08:00',data_kind:day<0?'observation':'forecast'});}return b;}
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch();const errors=[];let checks=0;
 const check=(condition,message)=>{assert(condition,message);checks++;};
 const context=await browser.newContext({viewport:{width:1440,height:1050},geolocation:{latitude:37.7489,longitude:-122.4335},permissions:['geolocation']});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 let unavailable=false;
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.pathname==='/api/weather'){
   if(unavailable)return route.fulfill({status:503,json:{error:'fixture unavailable'}});
   if(route.request().method()==='POST')return route.fulfill({json:{ok:true}});
   const payload=bundle(Number(u.searchParams.get('lat_e6')),Number(u.searchParams.get('lon_e6')));
   payload.hourly_weather.forEach(row=>{row.wind_speed_mph=row.longitude_e6===-122433500?18:15;});
   return route.fulfill({json:payload});
  }
  if(u.pathname.startsWith('/api/')||u.hostname!=='127.0.0.1')return route.fulfill({status:503,json:{error:'fixture unavailable'}});
  return route.continue();
 });
 await page.goto('http://127.0.0.1:5173/');
 await page.waitForFunction(()=>document.querySelector('.regional-map__legend')?.textContent.includes('22 forecast samples'));
 await page.waitForFunction(()=>document.querySelector('[data-map-reading="noeValley"]')?.classList.contains('is-near'));
 check(await page.locator('[data-map-reading]').count()===15,'15 readings');
 check(await page.locator('.regional-map__reading.is-near').count()===1,'one reserved nearby reading');
 check(await page.locator('.regional-map__person').count()===1,'real supplied location marked');
 check(await page.locator('.regional-map__wind').count()===1,'strict >15 wind boundary');
 check((await page.locator('.regional-map__wind').textContent()).includes('18'),'high wind displayed');
 check((await page.locator('.regional-map__field').getAttribute('href')).startsWith('data:image/png'),'live interpolation rendered');
 check(await page.locator('.regional-map svg.geography').getAttribute('viewBox')==='0 0 1000 875','southern crop reaches land');
 check(await page.evaluate(()=>document.querySelector('.regional-map').getBoundingClientRect().top<document.querySelector('.region-heading').getBoundingClientRect().top),'map above forecasts');
 await page.locator('.regional-map__point-picker select').selectOption('lakeMerced');
 check((await page.locator('.regional-map__details').textContent()).includes('Lake Merced'),'point selector');
 await page.locator('.regional-map__beach').first().click();
 check((await page.locator('.regional-map__details').textContent()).includes('Ocean Beach'),'independent beach conditions');
 await page.locator('.regional-map__point-picker select').selectOption('noeValley');
 await page.screenshot({path:'docs/sf-map-exploration/site-map-desktop.png'});
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:width<500?844:1050});await page.waitForTimeout(100);
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+' no page overflow');
  check(await page.locator('[data-map-reading]').count()===15,width+' no culling');
  check(await page.locator('[data-map-reading="noeValley"]').isVisible(),width+' nearby sample retained');
  if(width===390){await page.screenshot({path:'docs/sf-map-exploration/site-map-phone.png'});const mapHeight=await page.locator('.regional-map__viewport').evaluate(e=>e.clientHeight);await page.getByRole('button',{name:'Zoom in',exact:true}).click();await page.waitForTimeout(100);check(await page.locator('.regional-map__viewport').evaluate((e,h)=>e.clientHeight===h,mapHeight),'zoom retains map window height');check(await page.locator('.regional-map__person').evaluate(e=>{const p=e.getBoundingClientRect(),v=e.closest('.regional-map__viewport').getBoundingClientRect();return Math.abs((p.top+p.bottom)/2-(v.top+v.bottom)/2)<50;}),'zoom centers near user');check(await page.locator('.regional-map__viewport').evaluate(e=>e.scrollWidth>e.clientWidth),'zoom can pan');await page.screenshot({path:'docs/sf-map-exploration/site-map-phone-zoom.png'});await page.getByRole('button',{name:'Show all SF',exact:true}).click();}
 }
 const ticker=page.locator('.date-ruler-frame canvas').first();await ticker.focus();await ticker.press('ArrowRight');
 await page.waitForFunction(t=>document.querySelector('.regional-map__toolbar p').textContent.includes(t),shift(today,1));
 check(true,'shared date navigation');await ticker.press('Home');
 await page.getByRole('button',{name:'Marin',exact:true}).click();
 check(new URL(page.url()).pathname==='/millValley','adjacent navigation');check(await page.locator('.regional-map').count()===0,'regional destination retains its own forecast view');
 await page.goBack();await page.waitForSelector('.regional-map');
 await page.evaluate(()=>{navigator.geolocation.getCurrentPosition=(_success,error)=>error({code:1});});
 await page.getByRole('button',{name:'Use my location',exact:true}).click();
 check((await page.locator('.regional-map__details').textContent()).includes('Location access is off'),'denial state actionable');
 unavailable=true;await page.reload();await page.waitForFunction(()=>document.querySelector('.regional-map__legend')?.textContent.includes('Forecasts unavailable'));
 check(await page.locator('[data-map-reading]').count()===15,'unavailable locations retained');check(!(await page.locator('.regional-map__field').getAttribute('href')),'unavailable field not fabricated');
 await page.screenshot({path:'docs/sf-map-exploration/site-map-unavailable.png'});
 check(errors.length===0,'no uncaught browser errors');
 fs.writeFileSync('docs/sf-map-exploration/qa-site.json',JSON.stringify({checks,errors,viewports:[320,390,768,1440],weather:'Controlled schema-valid fixtures; external providers blocked',location:'Granted Noe Valley fixture; denied permission also exercised'},null,2));console.log(checks+' browser checks passed');await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
