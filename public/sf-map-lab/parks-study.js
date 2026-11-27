(() => {
'use strict';
const $=s=>document.querySelector(s), F=SF_COMPARISON_FIXTURES, bounds=F.bounds, points=F.points, roads=F.roads, icons=ParksIcons;
const project=(lon,lat)=>[(lon-bounds.w)/(bounds.e-bounds.w)*1000,(bounds.n-lat)/(bounds.n-bounds.s)*900];
const position=(lon,lat)=>{const [x,y]=project(lon,lat);return `left:${x/10}%;top:${y/9}%`;};
const path=ps=>ps.map((p,i)=>`${i?'L':'M'}${project(...p).map(v=>v.toFixed(1)).join(',')}`).join('');
const polygon=polys=>polys.map(poly=>poly.map(r=>path(r)+'Z').join('')).join('');
  function bridge(start,end,kind) {
    const [x,y]=project(...start),[ex,ey]=project(...end);
    const length=Math.hypot(ex-x,ey-y), angle=Math.atan2(ey-y,ex-x)*180/Math.PI;
    const a=length*.27,b=length*.73;
    // Mirror the Golden Gate elevation across its deck, keeping its real road alignment.
    const flip=kind==='golden-gate'?'scale(1,-1)':'';
    return `<g class="${kind}" transform="translate(${x},${y}) rotate(${angle})"><path class="bridge-road" d="M0 0H${length}"/><path class="bridge-deck" d="M0 0H${length}"/><g class="bridge-structure" transform="${flip}"><path d="M${a} -17V7m-5-19h10M${b} -17V7m-5-19h10M0 0Q${a*.5} -2 ${a} -17Q${length*.5} 8 ${b} -17Q${length*.9} -2 ${length} 0"/>${Array.from({length:9},(_,i)=>{const at=length*(i+1)/10,height=5+10*Math.abs(Math.cos(at/length*Math.PI*2));return `<path d="M${at} 0v-${height}"/>`;}).join('')}</g></g>`;
  }
  // The elevation paths were generated in the previous, larger viewport.
  // Reproject the same data rather than stretching or inventing new terrain.
  const terrainTransform = `translate(${(-122.544-bounds.w)/(bounds.e-bounds.w)*1000},${(bounds.n-37.846)/(bounds.n-bounds.s)*900}) scale(${.196/(bounds.e-bounds.w)},${.139/(bounds.n-bounds.s)})`;
  const referenceBands = {brown:['#f0e0ca','#e8d2b4','#dfc19d','#d5b288'],green:['#d4e3c3','#c9dcb7','#bbd0a6','#adc698']};
  const blend = (color,base) => '#'+[1,3,5].map(i=>Math.round(parseInt(color.slice(i,i+2),16)*.7+parseInt(base.slice(i,i+2),16)*.3).toString(16).padStart(2,'0')).join('');
  const bandColors = {brown:referenceBands.brown.map(c=>blend(c,'#f0ede1')),green:referenceBands.green.map(c=>blend(c,'#dce7ce'))};
  function bands(clip,colors) {
    return `<g clip-path="url(#${clip})"><g transform="${terrainTransform}">${SF_TERRAIN.contours.filter(l=>[60,120,180,240].includes(l.m)).map((l,i)=>`<path data-elevation="${l.m}" d="${l.paths.map(p=>p+'Z').join('')}" fill="${colors[i]}" fill-rule="evenodd"/>`).join('')}</g></g>`;
  }
const terrain=[['flat','Flat land'],['bands','Elevation bands'],['relief','Shaded relief'],['contours','Sparse contours'],['topographic','Full topographic'],['texture','Hill texture']];
const parks=[['fill','Green fill'],['elevation','Green elevation'],['outline','Park outlines'],['trees','Repeating trees']];
const weather=[['readings','High / low readings'],['gradient','Daily-high gradient'],['hybrid','Gradient + 11 readings'],['sparse-hybrid','Gradient + sparse high / low']];
const options={terrain,parks,weather};
const g=SF_GEOGRAPHY,land=g.neighborhoods.map(n=>polygon(n.polygons)).join('');
const parkPath=g.neighborhoods.filter(n=>['Presidio','Lincoln Park'].includes(n.name)).map(n=>polygon(n.polygons)).join('')+g.parks.map(p=>polygon(p.polygons)).join('');
let serial=0;
function geography(s){
 const id=serial++,l=`land${id}`,p=`parks${id}`,tree=`trees${id}`;
 const raster=(file,opacity=1)=>`<g transform="${terrainTransform}"><image href="assets/${file}" width="1000" height="900" opacity="${opacity}"/></g>`;
 let hills='';
 if(s.terrain==='bands')hills=bands(l,bandColors.brown);
 if(s.terrain==='relief')hills=raster('sf-hillshade.png',.4);
 if(s.terrain==='texture')hills=raster('sf-hill-texture.png',.65);
 if(['contours','topographic'].includes(s.terrain))hills=`<g transform="${terrainTransform}" fill="none" stroke="#9b8063" stroke-width="${s.terrain==='topographic'?.8:1.2}" opacity=".55">${SF_TERRAIN.contours.filter(c=>s.terrain==='topographic'||c.m%80===0).map(c=>`<path d="${c.paths.join('')}"/>`).join('')}</g>`;
 const grad=s.weather!=='readings';
 const parkFill=s.parks==='outline'?'none':s.parks==='trees'?'#e1e9d4':'#dce7ce';
 return `<svg class="geography" viewBox="0 0 1000 900" aria-hidden="true"><defs><clipPath id="${l}"><path d="${land}"/></clipPath><clipPath id="${p}"><path d="${parkPath}"/></clipPath><pattern id="${tree}" width="31" height="34" patternUnits="userSpaceOnUse"><g fill="#5b7a50" opacity=".6"><path d="M8 4l-5 9h3l-5 7h6v5h2v-5h6l-5-7h3Z"/><path d="M24 17a4 4 0 0 1 3 7 4 4 0 0 1-7 0 4 4 0 0 1 4-7Z"/><path d="M23 23h2v7h-2Z"/></g></pattern></defs><rect width="1000" height="900" fill="#dceff5"/><path d="${land}" fill="#f0ede1"/><g clip-path="url(#${l})">${hills}${grad?'<image class="high-field" href="assets/sf-daily-high-gradient.png" width="1000" height="900"/>':''}</g><g class="park-treatment" ${grad?'opacity=".66"':''}><path d="${parkPath}" fill="${parkFill}" stroke="${s.parks==='outline'?'#608153':'#a9bf94'}" stroke-width="${s.parks==='outline'?2:1}"/>${s.parks==='elevation'?bands(p,bandColors.green):''}${s.parks==='trees'?`<path d="${parkPath}" fill="url(#${tree})"/>`:''}</g><path fill="#bcdfe6" d="${path([[-122.497,37.727],[-122.494,37.730],[-122.491,37.730],[-122.489,37.725],[-122.490,37.720],[-122.494,37.720],[-122.496,37.723]])}Z"/><g class="road-lines">${roads.map(r=>`<path data-road="${r.id}" class="${r.highway?'highway':''}" d="${path(r.points)}"/>`).join('')}</g>${bridge([-122.4758,37.8077],[-122.4786,37.8324],'golden-gate')}${bridge([-122.386,37.789],[-122.365,37.808],'bay-bridge')}</svg>`;
}
const wind=p=>p.wind>15?`<span class="wind-value"><svg viewBox="0 0 24 18" aria-hidden="true"><path d="M1 5h14c6 0 6-7 1-4M1 9h19M1 13h11c6 0 6 6 1 4"/></svg>${p.wind} mph</span>`:'';
function readings(s){
 const visible=points.filter(p=>s.density==='22'||F.overviewIds.includes(p.id));
 return visible.map(p=>{
  const only=s.weather==='gradient',sparse=s.weather==='sparse-hybrid',anchor=F.highLabelIds.includes(p.id);
  if((only||sparse)&&!anchor&&p.wind<=15)return '';
  const showReading=!only&&(!sparse||anchor);
  return `<button class="weather-label ${only?'high-only':''}" data-point="${p.id}" style="${position(p.lon,p.lat)}" aria-label="${p.name}: high ${p.high}, low ${p.low} degrees Fahrenheit, UV maximum ${p.uvMax}${p.precip>.05?`, rain ${p.precip.toFixed(2)} inches`:''}${p.wind>15?`, wind ${p.wind} miles per hour`:''}">${showReading?`<span class="temperature-row"><b class="temp-high">${p.high}°</b><span class="divider">/</span><span class="temp-low">${p.low}°</span></span><span class="secondary-row"><span class="uv-value">UV${p.uvMax}</span>${p.precip>.05?`<span class="rain-value">${p.precip.toFixed(2)}″</span>`:''}</span>`:only&&anchor?`<b class="temp-high">${p.high}°</b>`:''}${wind(p)}</button>`;
 }).join('');
}
function markup(s){return `<div class="map-canvas"><div class="map-model">${geography(s)}<div class="weather-layer">${readings(s)}</div>${F.beaches.map(b=>`<button class="beach-marker" data-beach="${b.id}" style="${position(b.lon,b.lat)}" aria-label="${b.name}: beach conditions">${icons.svg('freestyle')}</button>`).join('')}<span class="person-marker" role="img" aria-label="Simulated personal location" style="${position(-122.448,37.730)}">${icons.svg('person-pin')}</span><div class="region-exits"><button data-destination="Marin">${icons.svg('compass-solid')} Marin</button><button data-destination="East Bay">East Bay ${icons.svg('compass-solid')}</button></div></div></div>`;}
const key='sf-map-combinations-v6';
let state={cards:[],columns:2,next:1,preset:'curated'},stored;
try{stored=JSON.parse(localStorage.getItem(key));}catch{}
const recipe=(t,p,w)=>({terrain:t,parks:p,weather:w,density:'11'});
function recipes(mode){
 if(mode==='curated')return [recipe('bands','outline','sparse-hybrid'),recipe('bands','elevation','readings'),recipe('texture','trees','readings'),recipe('bands','outline','gradient'),recipe('relief','fill','hybrid'),recipe('flat','trees','gradient'),recipe('topographic','outline','readings'),recipe('contours','fill','gradient'),recipe('texture','elevation','hybrid'),recipe('relief','trees','gradient'),recipe('topographic','trees','hybrid'),recipe('contours','elevation','readings')];
 const result=[];for(const[t]of terrain)for(const[p]of mode==='weather'?[[$('#builder-parks').value]]:parks)for(const[w]of mode==='all'||mode==='weather'?weather:[[$('#builder-weather').value]])result.push(recipe(t,p,w));return result;
}
function select(name,value,cls=''){return `<label>${name==='terrain'?'Hills':name==='parks'?'Parks':'Weather'}<select class="${cls}" data-setting="${name}">${options[name].map(([id,label])=>`<option value="${id}" ${id===value?'selected':''}>${label}</option>`).join('')}</select></label>`;}
function save(){try{localStorage.setItem(key,JSON.stringify(state));$('#save-status').textContent='Choices saved on this browser';}catch{$('#save-status').textContent='Browser storage unavailable; export choices to save.';}}
const resizer=new ResizeObserver(entries=>entries.forEach(({target})=>{const model=target.querySelector('.map-model');if(model)model.style.transform=`scale(${target.clientWidth/1000})`;}));
const lazy=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){loadMap(e.target);lazy.unobserve(e.target);}}),{rootMargin:'700px'});
function loadMap(target){if(target.dataset.loaded)return;const card=state.cards.find(c=>c.id===target.dataset.map);if(!card)return;target.innerHTML=markup(card);target.dataset.loaded='true';resizer.observe(target.querySelector('.map-canvas'));}
const label=(name,id)=>options[name].find(o=>o[0]===id)?.[1]||id;
function render(){
 lazy.disconnect();resizer.disconnect();$('#preset').value=state.preset||'curated';$('#board').style.setProperty('--columns',state.columns);
 $('#board').innerHTML=state.cards.filter(c=>!c.hidden).map(c=>`<article class="choice-card ${c.kept?'kept':''} ${c.minimized?'minimized':''}" data-card="${c.id}"><header><h2>${label('terrain',c.terrain)} <span>× ${label('parks',c.parks)}</span></h2><button data-action="keep" aria-pressed="${!!c.kept}">${c.kept?'Kept':'Keep'}</button></header><div class="card-controls">${select('terrain',c.terrain)}${select('parks',c.parks)}${select('weather',c.weather)}</div><div class="map-slot" data-map="${c.id}"></div><div class="map-key">${c.weather==='readings'?'<span>High / low °F · UV max · rain in</span>':'<span class="gradient-key">60° <i></i> 74° · daily high</span>'}<span>${c.weather==='gradient'?'5 temperature labels':c.weather==='sparse-hybrid'?'5 high / low labels · 22 gradient samples':c.density+' forecast points'} · wind &gt;15 mph</span></div><footer><button data-action="inspect">Inspect larger</button><button data-action="minimize">${c.minimized?'Expand':'Minimize'}</button><button data-action="hide">Hide</button></footer></article>`).join('');
 document.querySelectorAll('.map-slot').forEach(el=>lazy.observe(el));
 $('#board-count').textContent=`${state.cards.filter(c=>!c.hidden).length} of ${state.cards.length} maps shown · ${state.cards.filter(c=>c.kept).length} kept`;
 $('#restore').disabled=!state.cards.some(c=>c.hidden||c.minimized);
 document.querySelectorAll('[data-columns]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.columns)===state.columns));save();
}
function preset(mode){state.preset=mode;state.cards=recipes(mode).map(r=>({...r,id:'c'+state.next++}));render();}
for(const name of Object.keys(options))$('#builder-'+name).innerHTML=options[name].map(([id,label])=>`<option value="${id}" ${id===({terrain:'bands',parks:'elevation',weather:'readings'}[name])?'selected':''}>${label}</option>`).join('');
if(stored&&Array.isArray(stored.cards)&&stored.cards.length&&stored.cards.length<=100&&stored.cards.every(c=>Object.keys(options).every(k=>options[k].some(o=>o[0]===c[k])))){state=stored;render();}else preset('curated');
// A shareable link reveals the new comparison without replacing saved choices.
if(new URLSearchParams(location.search).get('weather')==='sparse-hybrid'){
 const existing=state.cards.find(c=>c.weather==='sparse-hybrid');
 if(existing){existing.hidden=false;existing.minimized=false;state.cards=[existing,...state.cards.filter(c=>c!==existing)];}
 else state.cards.unshift({...recipe('bands','outline','sparse-hybrid'),id:'c'+state.next++});
 render();
}
$('#preset').onchange=e=>preset(e.target.value);
$('#add').onclick=()=>{const r=recipe(...['terrain','parks','weather'].map(k=>$('#builder-'+k).value));const existing=state.cards.find(c=>Object.keys(r).every(k=>c[k]===r[k]));if(existing){existing.hidden=false;existing.minimized=false;render();document.querySelector(`[data-card="${existing.id}"]`).scrollIntoView({block:'center'});}else{const card={...r,id:'c'+state.next++};state.cards.unshift(card);render();}};
$('#board').onchange=e=>{const el=e.target.closest('[data-card]');if(!el)return;const c=state.cards.find(c=>c.id===el.dataset.card);c[e.target.dataset.setting]=e.target.value;render();document.querySelector(`[data-card="${c.id}"] [data-setting="${e.target.dataset.setting}"]`)?.focus({preventScroll:true});};
function inspect(c){$('#inspect-title').textContent=`${label('terrain',c.terrain)} × ${label('parks',c.parks)} · ${label('weather',c.weather)}`;$('#inspect-map').innerHTML=markup(c);$('#inspector').showModal();resizer.observe($('#inspect-map .map-canvas'));$('#inspect-legend').hidden=c.weather==='readings';$('#inspect-message').textContent='Select a forecast or a beach to inspect its illustrative conditions.';}
$('#board').onclick=e=>{const b=e.target.closest('[data-action]');if(!b){const marker=e.target.closest('[data-point],[data-beach],[data-destination]');if(marker){const c=state.cards.find(c=>c.id===marker.closest('[data-card]').dataset.card);inspect(c);const attr=['data-point','data-beach','data-destination'].find(k=>marker.hasAttribute(k));$('#inspect-map').querySelector(`[${attr}="${marker.getAttribute(attr)}"]`)?.click();}return;}const c=state.cards.find(c=>c.id===b.closest('[data-card]').dataset.card);if(b.dataset.action==='inspect'){inspect(c);return;}if(b.dataset.action==='keep')c.kept=!c.kept;if(b.dataset.action==='minimize')c.minimized=!c.minimized;if(b.dataset.action==='hide')c.hidden=true;render();document.querySelector(`[data-card="${c.id}"] [data-action="${b.dataset.action}"]`)?.focus({preventScroll:true});if(b.dataset.action==='hide')$('#restore').focus({preventScroll:true});};
$('#restore').onclick=()=>{state.cards.forEach(c=>{c.hidden=false;c.minimized=false;});render();};
document.querySelectorAll('[data-columns]').forEach(b=>b.onclick=()=>{state.columns=Number(b.dataset.columns);render();});
$('#inspector').onclick=e=>{const p=e.target.closest('[data-point]'),b=e.target.closest('[data-beach]'),d=e.target.closest('[data-destination]');if(p){const v=points.find(x=>x.id===p.dataset.point);$('#inspect-message').textContent=`${v.name} · high ${v.high}° / low ${v.low}°F · UV max ${v.uvMax}${v.precip>.05?' · rain '+v.precip.toFixed(2)+'″':''}${v.wind>15?' · wind '+v.wind+' mph':''} · demo forecast`;}if(b){const v=F.beaches.find(x=>x.id===b.dataset.beach);$('#inspect-message').textContent=`${v.name} · water ${v.water}°F · surf ${v.surf} · wind ${v.wind} · ${v.quality} · illustrative beach conditions`;}if(d)$('#inspect-message').textContent=`${d.dataset.destination} would open its regional map. This study covers SF.`;};
$('#export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({version:7,...state,windRule:'strictly >15 mph',rainRule:'strictly >0.05 inches',gradient:'Synthetic interpolated daily highs; not live weather'},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='sf-map-combinations.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
const renderAll=()=>document.querySelectorAll('.map-slot').forEach(loadMap);window.addEventListener('beforeprint',renderAll);
window.MapStudy={options,points,getState:()=>structuredClone(state),renderAll,preset,renderMap:markup,overviewIds:F.overviewIds};
})();
