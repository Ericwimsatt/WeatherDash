(() => {
  const $ = selector => document.querySelector(selector), icons = ParksIcons, choices = DENSITY_CHOICES;
  const bounds = { w: -122.522, e: -122.351, n: 37.820, s: 37.706 };
  const project = (lon, lat) => [(lon - bounds.w) / (bounds.e - bounds.w) * 1000, (bounds.n - lat) / (bounds.n - bounds.s) * 900];
  const position = (lon, lat) => { const [x,y] = project(lon,lat); return `left:${x/10}%;top:${y/9}%`; };
  const path = points => points.map((p,i) => `${i ? 'L' : 'M'}${project(...p).map(v => v.toFixed(1)).join(',')}`).join('');
  const polygon = polygons => polygons.map(poly => poly.map(r => path(r) + 'Z').join('')).join('');
  const original = SFMap.locations.filter(p => !p.proposed).map((p,i) => ({...p,high:[61,65,60,66,70,67,64,73,68,62][i],low:[51,53,50,52,55,54,53,56,54,49][i],uvMax:[3,4,3,4,5,4,4,5,5,4][i],precip:[.12,.06,.09,.03,0,.05,.04,0,0,.05][i]}));
  // Additional coordinates and values are illustrative study proposals, not new provider integrations.
  const additions = [
    ['presidio','Presidio',-122.468,37.795,61,50,4,.08],
    ['haight','Haight-Ashbury',-122.447,37.770,66,52,4,.06],
    ['castro','Castro',-122.435,37.761,69,53,5,.03],
    ['noeValley','Noe Valley',-122.4335,37.7489,70,54,5,0],
    ['glenPark','Glen Park',-122.433,37.736,67,52,4,.04],
    ['bernal','Bernal Heights',-122.416,37.741,70,54,5,0],
    ['potreroHill','Potrero Hill',-122.398,37.7572,71,55,5,0],
    ['missionBay','Mission Bay',-122.392,37.773,70,55,5,.02],
    ['bayview','Bayview',-122.3895,37.7347,69,53,5,.06],
    ['excelsior','Excelsior',-122.429,37.722,65,51,4,.05],
    ['westPortal','West Portal',-122.465,37.741,63,50,3,.08],
    ['ingleside','Ingleside',-122.458,37.721,62,49,3,.06],
  ].map(([id,name,lon,lat,high,low,uvMax,precip])=>({id,name,lon,lat,high,low,uvMax,precip,added:true}));
  const points = [...original,...additions];
  const pinned = {terrain:'bands',swim:'freestyle',jump:'compass-solid',location:'person-pin'};
  const defaults = {...pinned,weatherStyle:'high-led',swimmerStyle:'filled',density:'22',sample:'mixed',selected:'innerSunset',located:true};
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem('sf-parks-study-v5') || '{}') || {}; } catch {}
  const query = Object.fromEntries(new URLSearchParams(location.search));
  const config = {...defaults};
  for (const [key,values] of Object.entries({weatherStyle:choices.weather.map(o=>o.id),swimmerStyle:choices.swimmer.map(o=>o.id),density:['22'],sample:['mixed','dry'],selected:points.map(p=>p.id)})) {
    const value = query[key] ?? stored[key]; if (values.includes(value)) config[key] = value;
  }
  config.located = query.located !== undefined ? query.located === 'true' : stored.located !== undefined ? stored.located === true : true;
  let kept = Array.isArray(stored.kept)?stored.kept:[], hidden={weather:[],swimmer:[]}, minimized=[], activeFamily='weather';
  function visiblePoints() { return points; }
  function normalizeSelection(){if(!visiblePoints(config).some(p=>p.id===config.selected))config.selected='innerSunset';}
  const roads=[
    {id:'101-north',highway:true,points:[[-122.4786,37.8324],[-122.4758,37.8077],[-122.473,37.800],[-122.460,37.7987],[-122.447,37.8003],[-122.424,37.799]]},
    {id:'van-ness-connection',points:[[-122.424,37.799],[-122.420,37.775],[-122.417,37.769],[-122.407,37.769]]},
    {id:'101-south',highway:true,points:[[-122.406,37.707],[-122.408,37.735],[-122.407,37.751],[-122.405,37.765],[-122.407,37.769]]},
    {id:'80',highway:true,points:[[-122.407,37.769],[-122.400,37.774],[-122.391,37.784],[-122.386,37.789],[-122.365,37.808],[-122.348,37.815]]},
    {id:'280',highway:true,points:[[-122.459,37.707],[-122.438,37.727],[-122.424,37.731],[-122.408,37.735],[-122.395,37.759],[-122.392,37.771]]},
    {id:'19th-park-presidio',points:[[-122.477,37.707],[-122.476,37.742],[-122.477,37.764],[-122.477,37.773],[-122.472,37.787],[-122.473,37.800]]},
    {id:'geary',points:[[-122.510,37.780],[-122.482,37.780],[-122.454,37.781],[-122.429,37.785],[-122.405,37.787]]},
    {id:'market',points:[[-122.443,37.759],[-122.420,37.775],[-122.394,37.794]]},
    {id:'sunset',points:[[-122.496,37.733],[-122.495,37.765]]},
    {id:'waterfront',points:[[-122.419,37.808],[-122.407,37.809],[-122.397,37.802],[-122.394,37.794],[-122.388,37.785],[-122.391,37.784]]},
  ];
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
  let geographySerial=0;
  function geography() {
    const id=geographySerial++,landId=`sf-land-${id}`,parkId=`sf-parks-${id}`;
    const g=SF_GEOGRAPHY;
    const land=g.neighborhoods.map(n=>polygon(n.polygons)).join('');
    const parks=g.neighborhoods.filter(n=>['Presidio','Lincoln Park'].includes(n.name)).map(n=>polygon(n.polygons)).join('')+g.parks.map(p=>polygon(p.polygons)).join('');
    return `<svg class="geography-v3" viewBox="0 0 1000 900" aria-hidden="true"><defs><clipPath id="${landId}"><path d="${land}"/></clipPath><clipPath id="${parkId}"><path d="${parks}"/></clipPath></defs><rect width="1000" height="900" class="map-sea"/><path class="map-land" d="${land}"/>${bands(landId,bandColors.brown)}<path class="map-parks" d="${parks}"/>${bands(parkId,bandColors.green)}<path class="lake-water" d="${path([[-122.497,37.727],[-122.494,37.730],[-122.491,37.730],[-122.489,37.725],[-122.490,37.720],[-122.494,37.720],[-122.496,37.723]])}Z"/><g class="road-lines">${roads.map(r=>`<path data-road="${r.id}" class="${r.highway?'highway':''}" d="${path(r.points)}"/>`).join('')}</g>${bridge([-122.4758,37.8077],[-122.4786,37.8324],'golden-gate')}${bridge([-122.386,37.789],[-122.365,37.808],'bay-bridge')}</svg>`;
  }
  function weatherLabel(p,state) {
    const rain=state.sample==='dry'?0:p.precip;
    return `<button type="button" class="weather-label ${p.id===state.selected?'is-selected':''}" data-point="${p.id}" style="${position(p.lon,p.lat)}" title="${p.name}${p.added?' · added demo point':''}" aria-pressed="${p.id===state.selected}" aria-label="${p.name}: daily high ${p.high}, low ${p.low} degrees Fahrenheit, UV maximum ${p.uvMax}${rain>.05?`, precipitation ${rain.toFixed(2)} inches`:''}"><span class="weather-body"><span class="temperature-row"><span class="temp-high">${p.high}°</span><span class="temp-divider">/</span><span class="temp-low">${p.low}°</span></span><span class="secondary-row"><span class="uv-value">UV${p.uvMax}</span>${rain>.05?`<span class="rain-value">${rain.toFixed(2)}″</span>`:''}</span></span></button>`;
  }
  function markup(state=config) {
    const selected=points.find(p=>p.id===state.selected)||original[3],visible=visiblePoints(state);
    return `<article class="selected-map weather-${state.weatherStyle} swim-${state.swimmerStyle}"><header class="map-header"><div class="map-brand">Eric’s weather<span>San Francisco</span></div><div class="map-units">${visible.length} illustrative forecast points<br>High / low °F · UV max · rain in</div></header><div class="map-surface">${geography()}<div class="weather-layer">${visible.map(p=>weatherLabel(p,state)).join('')}</div><div class="beach-layer">${SFMap.beaches.map(b=>`<button type="button" class="beach-marker" data-beach="${b.id}" style="${position(b.lon,b.lat)}" aria-label="${b.name}: show beach conditions">${icons.svg(pinned.swim)}</button>`).join('')}</div>${state.located?`<div class="person-layer"><div class="person-marker" role="img" aria-label="Simulated personal location" style="${position(-122.448,37.730)}">${icons.svg(pinned.location)}</div></div>`:''}<div class="region-exits"><button type="button" data-destination="Marin">${icons.svg(pinned.jump)} Marin</button><button type="button" data-destination="East Bay">East Bay ${icons.svg(pinned.jump)}</button></div></div><div class="region-picker"><label>Forecast point<select data-point-picker>${visible.map(p=>`<option value="${p.id}" ${p.id===state.selected?'selected':''}>${p.name}${p.added?' · added':''}</option>`).join('')}</select></label><span>${selected.name}${selected.added?' · proposed demo location':''}</span></div><footer class="map-footer"><span>${visible.length} demo locations · ${visible.filter(p=>p.added).length} added for this study</span><span>Land / parks: DataSF · elevation: USGS · schematic roads</span></footer></article>`;
  }
  function save() {
    try {localStorage.setItem('sf-parks-study-v5',JSON.stringify({...config,kept}));} catch {}
    $('#choice-status').textContent=`${config.density} locations · ${kept.length} options kept · choices saved locally`;
  }
  function renderMain() {
    normalizeSelection();const target=$('#main-map');target.innerHTML=markup();
    target.querySelectorAll('[data-point]').forEach(b=>b.onclick=()=>{config.selected=b.dataset.point;renderMain();target.querySelector(`[data-point="${config.selected}"]`)?.focus({preventScroll:true});save();});
    target.querySelector('[data-point-picker]').onchange=e=>{config.selected=e.target.value;renderMain();target.querySelector('[data-point-picker]').focus({preventScroll:true});save();};
    target.querySelectorAll('[data-destination]').forEach(b=>b.onclick=()=>$('#map-message').textContent=`${b.dataset.destination} would open its regional map. This mockup covers SF only.`);
    target.querySelectorAll('[data-beach]').forEach(b=>b.onclick=()=>{
      const beach=SFMap.beaches.find(p=>p.id===b.dataset.beach);
      $('#beach-content').innerHTML=`<h2>${beach.name}</h2><dl><dt>Water</dt><dd>${beach.water}°F</dd><dt>Surf</dt><dd>${beach.surf}</dd><dt>Wind</dt><dd>${beach.wind}</dd><dt>Quality</dt><dd>${beach.quality}</dd></dl><p>Illustrative beach conditions, independent of the selected weather region.</p>`;
      $('#beach-detail').showModal();
    });
  }
  const previewObserver=new ResizeObserver(entries=>entries.forEach(e=>scalePreview(e.target)));
  function scalePreview(el) {
    const map=el.querySelector('.selected-map');if(!map)return;
    const beach=el.classList.contains('swimmer-crop'),scale=el.clientWidth/(beach?650:1000);
    map.style.transform=beach?`translate(${-50*scale}px,${-80*scale}px) scale(${scale})`:`scale(${scale})`;
  }
  function renderDeck(family) {
    const options=choices[family],el=$('#'+family+'-deck'),key=family==='weather'?'weatherStyle':'swimmerStyle';
    el.classList.remove('carousel');
    el.innerHTML=options.filter(o=>!hidden[family].includes(o.id)).map(o=>{
      const identity=family+':'+o.id;
      return `<article class="choice-card ${config[key]===o.id?'active':''} ${kept.includes(identity)?'kept':''} ${minimized.includes(identity)?'minimized':''}" data-card="${identity}"><header><h3>${o.title}</h3><span>${o.confirmed?'Selected direction':o.recommended?'Suggested starting point':o.id==='reference'||o.id==='bare'?'Reference treatment':'Alternative'}</span></header><div class="choice-map ${family==='swimmer'?'swimmer-crop':''}" data-preview="${o.id}"></div>${family==='swimmer'?`<div class="button-specimens swim-${o.id}" aria-hidden="true" inert>${['water','land','park'].map(surface=>`<div class="specimen-${surface}"><span class="button-sample"><button class="beach-marker" tabindex="-1">${icons.svg(pinned.swim)}</button></span><small>${surface}</small></div>`).join('')}</div>`:''}<p>${o.note}</p><p class="tradeoff">${o.tradeoff}</p><div class="choice-actions"><button type="button" data-try="${identity}" aria-pressed="${config[key]===o.id}">${config[key]===o.id?'On the map':'Try on map'}</button><button type="button" data-keep="${identity}" aria-pressed="${kept.includes(identity)}">${kept.includes(identity)?'Kept':'Keep option'}</button><button type="button" data-minimize="${identity}">${minimized.includes(identity)?'Expand':'Minimize'}</button><button type="button" data-hide="${identity}">Hide</button></div></article>`;
    }).join('');
    el.querySelectorAll('[data-preview]').forEach(preview=>{preview.innerHTML=markup({...config,[key]:preview.dataset.preview});preview.setAttribute('inert','');preview.setAttribute('aria-hidden','true');previewObserver.observe(preview);scalePreview(preview);});
    el.querySelectorAll('[data-try]').forEach(b=>b.onclick=()=>{const[f,id]=b.dataset.try.split(':');activeFamily=f;config[f==='weather'?'weatherStyle':'swimmerStyle']=id;render();});
    el.querySelectorAll('[data-keep]').forEach(b=>b.onclick=()=>{const id=b.dataset.keep;kept=kept.includes(id)?kept.filter(x=>x!==id):[...kept,id];save();renderDecks();});
    el.querySelectorAll('[data-minimize]').forEach(b=>b.onclick=()=>{const id=b.dataset.minimize;minimized=minimized.includes(id)?minimized.filter(x=>x!==id):[...minimized,id];renderDecks();});
    el.querySelectorAll('[data-hide]').forEach(b=>b.onclick=()=>{const[f,id]=b.dataset.hide.split(':');hidden[f].push(id);renderDecks();});
    $('#'+family+'-restore').innerHTML=`<span>${options.length-hidden[family].length} of ${options.length} options visible</span>`+options.filter(o=>hidden[family].includes(o.id)).map(o=>`<button type="button" data-restore="${family}:${o.id}">Restore ${o.title}</button>`).join('');
    $('#'+family+'-restore').querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>{const[f,id]=b.dataset.restore.split(':');hidden[f]=hidden[f].filter(x=>x!==id);renderDecks();});
    requestAnimationFrame(()=>{el.classList.toggle('carousel',el.getBoundingClientRect().height>innerHeight*.5||innerWidth<700);el.querySelectorAll('.choice-map').forEach(scalePreview);});
  }
  function renderDecks(){
    const active=document.activeElement,attr=['data-try','data-keep','data-minimize','data-hide','data-restore'].find(a=>active?.hasAttribute(a)),id=attr?active.getAttribute(attr):null;
    previewObserver.disconnect();renderDeck('weather');renderDeck('swimmer');
    if(id){const next=document.querySelector(`[${attr}="${id}"]`)||document.querySelector(`[data-restore="${id}"]`)||document.querySelector(`[data-try="${id}"]`);next?.focus({preventScroll:true});}
  }
  function renderControls() {
    for(const [key,family]of [['weatherStyle','weather'],['swimmerStyle','swimmer']])$('#'+key).innerHTML=choices[family].map(o=>`<option value="${o.id}" ${config[key]===o.id?'selected':''}>${o.title}</option>`).join('');
    $('#density').value=config.density;$('#sample-day').value=config.sample;
    $('#demo-location').textContent=config.located?'Hide demo location':'Show demo location';$('#demo-location').setAttribute('aria-pressed',config.located);
    $('#added-locations').textContent=additions.map(p=>p.name).join(' · ');
  }
  function render(){renderMain();renderControls();renderDecks();save();}
  for(const key of ['weatherStyle','swimmerStyle','density'])$('#'+key).onchange=e=>{config[key]=e.target.value;activeFamily=key==='swimmerStyle'?'swimmer':'weather';render();};
  $('#sample-day').onchange=e=>{config.sample=e.target.value;render();};
  $('#demo-location').onclick=()=>{config.located=!config.located;render();};
  $('#save-recipe').onclick=()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify({version:5,recipe:config,kept,locationCount:visiblePoints(config).length,addedDemoLocations:additions.map(p=>({id:p.id,name:p.name,lon:p.lon,lat:p.lat})),terrainBlend:.7,precipitationRule:'daily inches strictly greater than 0.05'},null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='sf-density-choices.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  document.querySelectorAll('[data-scroll]').forEach(b=>b.onclick=()=>{const[f,direction]=b.dataset.scroll.split(':');activeFamily=f;$('#'+f+'-deck').scrollBy({left:Number(direction)*510,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});});
  document.querySelectorAll('[data-reset]').forEach(b=>b.onclick=()=>{const f=b.dataset.reset;hidden[f]=[];minimized=minimized.filter(id=>!id.startsWith(f+':'));renderDecks();});
  document.addEventListener('keydown',e=>{
    if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||e.target.isContentEditable||$('#beach-detail').open||e.metaKey||e.ctrlKey||e.altKey)return;
    if(!['h','l','Home','End'].includes(e.key))return;
    const options=choices[activeFamily].filter(o=>!hidden[activeFamily].includes(o.id)),key=activeFamily==='weather'?'weatherStyle':'swimmerStyle';
    const current=options.findIndex(o=>o.id===config[key]);const next=e.key==='Home'?0:e.key==='End'?options.length-1:Math.max(0,Math.min(options.length-1,current+(e.key==='h'?-1:1)));
    if(options[next]){e.preventDefault();config[key]=options[next].id;render();document.querySelector(`[data-card="${activeFamily}:${options[next].id}"]`)?.scrollIntoView({block:'nearest',inline:'center',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});}
  });
  window.ParksStudy={getConfig:()=>({...config}),project,bounds,points,additions,visiblePoints,roads,bandColors,referenceBands,renderMap:markup};
  render();
})();
