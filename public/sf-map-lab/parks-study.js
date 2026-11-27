(() => {
  const $ = selector => document.querySelector(selector);
  const icons = ParksIcons;
  const bounds = { w: -122.522, e: -122.351, n: 37.820, s: 37.706 };
  const project = (lon, lat) => [(lon - bounds.w) / (bounds.e - bounds.w) * 1000, (bounds.n - lat) / (bounds.n - bounds.s) * 900];
  const position = (lon, lat) => { const [x,y] = project(lon,lat); return `left:${x/10}%;top:${y/9}%`; };
  const path = points => points.map((p,i) => `${i ? 'L' : 'M'}${project(...p).map(v => v.toFixed(1)).join(',')}`).join('');
  const polygon = polygons => polygons.map(poly => poly.map(r => path(r) + 'Z').join('')).join('');
  const points = SFMap.locations.filter(p => !p.proposed).map((p,i) => ({...p,high:[61,65,60,66,70,67,64,73,68,62][i],low:[51,53,50,52,55,54,53,56,54,49][i],uvMax:[3,4,3,4,5,4,4,5,5,4][i],precip:[.12,.06,.09,.03,0,.05,.04,0,0,.05][i]}));
  // These visual choices are confirmed. Older recipes cannot override them.
  const pinned = {terrain:'bands',label:'bare',swim:'freestyle',jump:'compass-solid',location:'person-pin'};
  const defaults = {...pinned,sample:'mixed',selected:'innerSunset',located:true};
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem('sf-parks-study-v3') || '{}') || {}; } catch {}
  const query = Object.fromEntries(new URLSearchParams(location.search));
  const config = {...defaults};
  for (const [key,values] of Object.entries({sample:['mixed','dry'],selected:points.map(p => p.id)})) {
    const value = query[key] ?? stored[key];
    if (values.includes(value)) config[key] = value;
  }
  config.located = query.located !== undefined ? query.located === 'true' : stored.located !== undefined ? stored.located === true : true;
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
  const bandColors = {brown:['#f0e0ca','#e8d2b4','#dfc19d','#d5b288'],green:['#d4e3c3','#c9dcb7','#bbd0a6','#adc698']};
  function bands(clip,colors) {
    return `<g clip-path="url(#${clip})"><g transform="${terrainTransform}">${SF_TERRAIN.contours.filter(l=>[60,120,180,240].includes(l.m)).map((l,i)=>`<path data-elevation="${l.m}" d="${l.paths.map(p=>p+'Z').join('')}" fill="${colors[i]}" fill-rule="evenodd"/>`).join('')}</g></g>`;
  }
  function geography() {
    const g=SF_GEOGRAPHY;
    const land=g.neighborhoods.map(n=>polygon(n.polygons)).join('');
    const parks=g.neighborhoods.filter(n=>['Presidio','Lincoln Park'].includes(n.name)).map(n=>polygon(n.polygons)).join('')+g.parks.map(p=>polygon(p.polygons)).join('');
    return `<svg class="geography-v3" viewBox="0 0 1000 900" aria-hidden="true"><defs><clipPath id="sf-land"><path d="${land}"/></clipPath><clipPath id="sf-parks"><path d="${parks}"/></clipPath></defs><rect width="1000" height="900" class="map-sea"/><path class="map-land" d="${land}"/>${bands('sf-land',bandColors.brown)}<path class="map-parks" d="${parks}"/>${bands('sf-parks',bandColors.green)}<path class="lake-water" d="${path([[-122.497,37.727],[-122.494,37.730],[-122.491,37.730],[-122.489,37.725],[-122.490,37.720],[-122.494,37.720],[-122.496,37.723]])}Z"/><g class="road-lines">${roads.map(r=>`<path data-road="${r.id}" class="${r.highway?'highway':''}" d="${path(r.points)}"/>`).join('')}</g>${bridge([-122.4758,37.8077],[-122.4786,37.8324],'golden-gate')}${bridge([-122.386,37.789],[-122.365,37.808],'bay-bridge')}</svg>`;
  }
  function weatherLabel(p) {
    let mobile=['outerSunset','pacHeights','mission','lakeMerced'];
    if(['innerSunset','innerRichmond','outerRichmond'].includes(config.selected)) mobile=mobile.filter(id=>id!=='outerSunset');
    if(['marina','northBeach'].includes(config.selected)) mobile=mobile.filter(id=>id!=='pacHeights');
    if(config.selected==='marketStreet') mobile=mobile.filter(id=>id!=='mission');
    const rain=config.sample==='dry'?0:p.precip;
    return `<button type="button" class="weather-label ${p.id===config.selected?'is-selected':''} ${mobile.includes(p.id)?'mobile-show':''}" data-point="${p.id}" style="${position(p.lon,p.lat)}" aria-pressed="${p.id===config.selected}" aria-label="${p.name}: daily high ${p.high}, low ${p.low} degrees Fahrenheit, UV maximum ${p.uvMax}${rain>.05?`, precipitation ${rain.toFixed(2)} inches`:''}"><span class="temperature-row"><span class="temp-high">${p.high}°</span><span class="temp-divider">/</span><span class="temp-low">${p.low}°</span></span><span class="secondary-row"><span class="uv-value">UV${p.uvMax}</span>${rain>.05?`<span class="rain-value">${rain.toFixed(2)}″</span>`:''}</span></button>`;
  }
  function markup() {
    const selected=points.find(p=>p.id===config.selected);
    return `<article class="selected-map"><header class="map-header"><div class="map-brand">Eric’s weather<span>San Francisco</span></div><div class="map-units">Illustrative daily forecast<br>High / low °F · UV max · rain in</div></header><div class="map-surface">${geography()}<div class="weather-layer">${points.map(weatherLabel).join('')}</div><div class="beach-layer">${SFMap.beaches.map(b=>`<button type="button" class="beach-marker" data-beach="${b.id}" style="${position(b.lon,b.lat)}" aria-label="${b.name}: show beach conditions">${icons.svg(pinned.swim)}</button>`).join('')}</div>${config.located?`<div class="person-layer"><div class="person-marker" role="img" aria-label="Simulated personal location" style="${position(-122.435,37.743)}">${icons.svg(pinned.location)}</div></div>`:''}<div class="region-exits"><button type="button" data-destination="Marin">${icons.svg(pinned.jump)} Marin</button><button type="button" data-destination="East Bay">East Bay ${icons.svg(pinned.jump)}</button></div></div><div class="region-picker"><label>Forecast point<select data-point-picker>${points.map(p=>`<option value="${p.id}" ${p.id===config.selected?'selected':''}>${p.name}</option>`).join('')}</select></label></div><footer class="map-footer"><span>${selected.name} selected</span><span>Land / parks: DataSF · elevation: USGS · schematic roads</span></footer></article>`;
  }
  function save() {
    try { localStorage.setItem('sf-parks-study-v3',JSON.stringify(config)); } catch {}
  }
  function render() {
    const target=$('#main-map');target.innerHTML=markup();
    target.querySelectorAll('[data-point]').forEach(b=>b.onclick=()=>{config.selected=b.dataset.point;render();target.querySelector(`[data-point="${config.selected}"]`)?.focus({preventScroll:true});});
    target.querySelector('[data-point-picker]').onchange=e=>{config.selected=e.target.value;render();};
    target.querySelectorAll('[data-destination]').forEach(b=>b.onclick=()=>$('#map-message').textContent=`${b.dataset.destination} would open its regional map. This mockup covers SF only.`);
    target.querySelectorAll('[data-beach]').forEach(b=>b.onclick=()=>{
      const beach=SFMap.beaches.find(p=>p.id===b.dataset.beach);
      $('#beach-content').innerHTML=`<h2>${beach.name}</h2><dl><dt>Water</dt><dd>${beach.water}°F</dd><dt>Surf</dt><dd>${beach.surf}</dd><dt>Wind</dt><dd>${beach.wind}</dd><dt>Quality</dt><dd>${beach.quality}</dd></dl><p>Illustrative beach conditions, independent of the selected weather region.</p>`;
      $('#beach-detail').showModal();
    });
    $('#sample-day').value=config.sample;
    $('#demo-location').textContent=config.located?'Hide demo location':'Show demo location';
    $('#demo-location').setAttribute('aria-pressed',config.located);
    save();
  }
  $('#sample-day').onchange=e=>{config.sample=e.target.value;render();};
  $('#demo-location').onclick=()=>{config.located=!config.located;render();};
  $('#save-recipe').onclick=()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify({version:3,recipe:config,confirmed:{parkLabels:false,bridgeLabels:false,roadLabels:false,weatherBackground:false,weatherLeaders:false,weatherDots:false,uvRow:2,viewport:bounds},precipitationRule:'daily inches strictly greater than 0.05'},null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='sf-selected-recipe.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  window.ParksStudy={getConfig:()=>({...config}),project,bounds,points,roads,bandColors};
  render();
})();
