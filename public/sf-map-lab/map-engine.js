/* SF map study. Every weather value and condition is synthetic. No network or location APIs. */
(() => {
  const bounds = { w: -122.544, e: -122.366, n: 37.822, s: 37.708 };
  const project = (lon, lat) => [(lon-bounds.w)/(bounds.e-bounds.w)*1000,(bounds.n-lat)/(bounds.n-bounds.s)*810];
  const locations = [
    {id:'outerRichmond',name:'Outer Richmond',short:'Outer Richmond',lon:-122.4895,lat:37.7761,temp:57,wind:16,uv:2,rain:10,condition:'fog',reason:'Fog until 2 pm',adj:['innerRichmond','outerSunset']},
    {id:'innerRichmond',name:'Inner Richmond',short:'Inner Richmond',lon:-122.4635,lat:37.7811,temp:60,wind:11,uv:3,rain:5,condition:'cloud',reason:'Clearing at noon',adj:['outerRichmond','pacHeights','innerSunset']},
    {id:'outerSunset',name:'Outer Sunset',short:'Outer Sunset',lon:-122.4945,lat:37.7626,temp:56,wind:19,uv:2,rain:15,condition:'fog',reason:'Gusts to 28 mph',adj:['innerSunset','outerRichmond','lakeMerced']},
    {id:'innerSunset',name:'Inner Sunset',short:'Inner Sunset',lon:-122.4684,lat:37.7626,temp:61,wind:12,uv:3,rain:5,condition:'cloud',reason:'Cloud breaks',adj:['outerSunset','innerRichmond','mission']},
    {id:'marketStreet',name:'Market Street',short:'Market Street',lon:-122.4194,lat:37.7749,temp:65,wind:9,uv:4,rain:0,condition:'sun',reason:'Dry through 6 pm',adj:['mission','pacHeights','northBeach']},
    {id:'pacHeights',name:'Pacific Heights',short:'Pacific Heights',lon:-122.4362,lat:37.7914,temp:62,wind:13,uv:4,rain:0,condition:'cloud',reason:'Breezy on the ridge',adj:['marina','innerRichmond','marketStreet']},
    {id:'marina',name:'Marina',short:'Marina',lon:-122.4348,lat:37.8027,temp:60,wind:17,uv:3,rain:0,condition:'cloud',reason:'Wind after 3 pm',adj:['pacHeights','northBeach']},
    {id:'mission',name:'Mission',short:'Mission',lon:-122.4148,lat:37.7599,temp:68,wind:7,uv:5,rain:0,condition:'sun',reason:'Warmest of these spots',adj:['marketStreet','innerSunset','lakeMerced']},
    {id:'northBeach',name:'North Beach',short:'North Beach',lon:-122.4103,lat:37.8005,temp:63,wind:12,uv:4,rain:0,condition:'sun',reason:'Sun through 4 pm',adj:['marina','marketStreet']},
    {id:'lakeMerced',name:'Lake Merced',short:'Lake Merced',lon:-122.492,lat:37.7235,temp:58,wind:14,uv:2,rain:10,condition:'cloud',reason:'Low cloud at the lake',adj:['outerSunset','innerSunset','mission']},
    {id:'noeValley',name:'Noe Valley',short:'Noe Valley',lon:-122.4335,lat:37.7489,temp:66,wind:9,uv:5,rain:0,condition:'sun',reason:'Sun through 5 pm',adj:['mission','innerSunset'],proposed:true},
    {id:'potreroHill',name:'Potrero Hill',short:'Potrero Hill',lon:-122.398,lat:37.7572,temp:67,wind:11,uv:5,rain:0,condition:'sun',reason:'Breeze after 3 pm',adj:['mission','marketStreet'],proposed:true},
    {id:'bayview',name:'Bayview',short:'Bayview',lon:-122.3895,lat:37.7347,temp:66,wind:13,uv:5,rain:0,condition:'sun',reason:'Dry afternoon',adj:['potreroHill','excelsior'],proposed:true},
    {id:'excelsior',name:'Excelsior',short:'Excelsior',lon:-122.4313,lat:37.7232,temp:61,wind:15,uv:3,rain:5,condition:'cloud',reason:'Cloud on the southern ridge',adj:['noeValley','lakeMerced'],proposed:true},
  ];
  const beaches = [
    {id:'ocean',name:'Ocean Beach',lon:-122.5108,lat:37.7597,status:'avoid',label:'Strong surf',water:54,surf:'6–8 ft',quality:'Not available',wind:'19 mph W',note:'Surf concern is shown independently of water-quality evidence. No current water-quality result is available in this sample.'},
    {id:'baker',name:'Baker Beach',lon:-122.4829,lat:37.7946,status:'caution',label:'Shore break',water:55,surf:'3–5 ft',quality:'Sample 2 days old',wind:'16 mph W',note:'A less severe sample surf state still needs a visible reason. A water sample is evidence about water quality, not a guarantee about swimming.'},
    {id:'crissy',name:'Crissy Field',lon:-122.448,lat:37.8045,status:'unknown',label:'Quality unknown',water:56,surf:'1–2 ft',quality:'No recent result',wind:'17 mph W',note:'Small modeled waves do not resolve missing water-quality evidence. Unknown keeps its own shape and word.'},
    {id:'aquatic',name:'Aquatic Park',lon:-122.422,lat:37.806,status:'info',label:'No posted advisory',water:56,surf:'<1 ft',quality:'Sample 2 days old',wind:'12 mph W',note:'“No posted advisory” describes one evidence channel. It must never be shortened to “safe.” All values here are invented for design review.'},
  ];
  const defaults = {orientation:'hybrid',overlay:'ticket',pattern:'exceptions',scene:'marine',swim:'swimmer',uv:'uv',location:'dot',jump:'edge',boundary:'points',beach:'independent',time:'now',selected:'innerSunset',located:false,unit:'f',metric:'wind',coverage:'existing'};
  const visibleLocations=c=>locations.filter(r=>(c.coverage==='expanded'||!r.proposed)&&(c.coverage!=='six'||['outerRichmond','outerSunset','marina','mission','marketStreet','lakeMerced',c.selected].includes(r.id)));
  const paths = {
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    cloud:'<path d="M6 18h12a4 4 0 0 0 .3-8 6.3 6.3 0 0 0-12-1A4.5 4.5 0 0 0 6 18Z"/>',
    fog:'<path d="M4 9h16M2 13h15M7 17h15M4 21h13M7 5h10"/>',
    rain:'<path d="M5 14h14a3.5 3.5 0 0 0-.7-6.9 5.4 5.4 0 0 0-10.2-.5A3.8 3.8 0 0 0 5 14Zm2 3-1 4m7-4-1 4m7-4-1 4"/>',
    wind:'<path d="M2 8h13a3 3 0 1 0-3-3M2 12h18a2.5 2.5 0 1 1-2.5 2.5M2 16h8a2.5 2.5 0 1 1-2.5 2.5"/>',
    moon:'<path d="M20 15.5A8.5 8.5 0 0 1 8.5 4a8.6 8.6 0 1 0 11.5 11.5Z"/>',
    swimmer:'<circle cx="17" cy="5" r="2"/><path d="m5 13 5-5 4 3 4 1M10 8 6 5M2 17q2.5-3 5 0t5 0 5 0 5 0M2 21q2.5-3 5 0t5 0 5 0 5 0"/>',
    flag:'<path d="M5 22V3m0 0h14l-3 4 3 4H5M2 22h7"/>',
    waves:'<path d="M2 7q2.5-3 5 0t5 0 5 0 5 0M2 12q2.5-3 5 0t5 0 5 0 5 0M2 17q2.5-3 5 0t5 0 5 0 5 0"/>',
    shield:'<path d="M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6Z"/><path d="M12 7v6m0 4h.01"/>',
    uv:'<path d="M3 3v9a3 3 0 0 0 6 0V3m4 0 4 12 4-12M4 21h16"/>',
    shade:'<path d="M3 13a9 9 0 0 1 18 0H3Zm9-9v17m-3 0h6M5 3 3 1m16 2 2-2"/>',
    dot:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>',
    crosshair:'<circle cx="12" cy="12" r="6"/><path d="M12 1v5m0 12v5M1 12h5m12 0h5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    arrow:'<path d="m12 2 8 19-8-4-8 4Z"/>',
    edge:'<path d="M3 5h10v14H3m9-7h10m-4-4 4 4-4 4"/>',
    compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6Z"/>',
    chevron:'<path d="m9 5 7 7-7 7"/>',
    pin:'<path d="M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 1 1 14 0Z"/><circle cx="12" cy="9" r="2"/>',
    tree:'<path d="m12 2-6 8h3l-5 7h16l-5-7h3Zm0 15v5"/>',
    bridge:'<path d="M2 17h20M5 21V3m14 18V3M5 5q7 13 14 0M9 11v6m6-6v6"/>',
    hill:'<path d="m2 20 7-13 4 7 3-5 6 11H2Zm5-9 2 2 2-2"/>',
    tower:'<path d="M7 22 9 3h6l2 19M6 22h12M9 3V1h6v2M11 6v5m2-5v5"/>',
    ferry:'<path d="M6 13V7h12v6M10 7V3h4v4M3 14l9-2 9 2-3 6H6Zm-1 8q2.5-2 5 0t5 0 5 0 5 0"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    alert:'<path d="m12 2 11 19H1L12 2Zm0 6v6m0 3h.01"/>',
    unknown:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3h.01"/>',
    close:'<path d="m5 5 14 14M5 19 19 5"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 10v7m0-11h.01"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    layers:'<path d="m12 2 10 6-10 6L2 8Zm-10 11 10 6 10-6M2 18l10 6 10-6"/>',
  };
  const icon = (name, cls='') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.cloud}</svg>`;
  const esc = value => String(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pos = (lon,lat) => {const [x,y]=project(lon,lat);return `left:${x/10}%;top:${y/8.1}%`};
  const geoPath = polygons => polygons.map(poly=>poly.map(r=>r.map((c,i)=>`${i?'L':'M'}${project(...c).map(v=>v.toFixed(1)).join(',')}`).join('')+'Z').join('')).join('');
  const line = coords => coords.map((c,i)=>`${i?'L':'M'}${project(...c).map(v=>v.toFixed(1)).join(',')}`).join('');
  const roads = [
    {name:'Geary',coords:[[-122.510,37.780],[-122.482,37.780],[-122.454,37.781],[-122.429,37.785],[-122.405,37.787]],label:[-122.476,37.783]},
    {name:'19th Ave',coords:[[-122.477,37.710],[-122.476,37.742],[-122.477,37.764],[-122.477,37.773],[-122.472,37.787]],label:[-122.478,37.747]},
    {name:'Van Ness',coords:[[-122.418,37.775],[-122.424,37.805]],label:[-122.423,37.787]},
    {name:'Market',coords:[[-122.443,37.759],[-122.420,37.775],[-122.394,37.794]],label:[-122.406,37.789]},
    {name:'Sunset Blvd',coords:[[-122.496,37.733],[-122.495,37.765]],label:[-122.501,37.743]},
    {name:'Embarcadero',coords:[[-122.419,37.808],[-122.407,37.809],[-122.397,37.802],[-122.393,37.794],[-122.388,37.785]],label:[-122.397,37.800]},
    {name:'101',highway:true,coords:[[-122.475,37.810],[-122.473,37.800],[-122.459,37.798],[-122.446,37.800],[-122.426,37.798]],label:[-122.459,37.799]},
    {name:'101',highway:true,coords:[[-122.406,37.708],[-122.405,37.733],[-122.407,37.750],[-122.406,37.766],[-122.417,37.769]],label:[-122.406,37.732]},
    {name:'280',highway:true,coords:[[-122.459,37.708],[-122.438,37.727],[-122.424,37.731],[-122.404,37.740],[-122.395,37.759],[-122.392,37.771]],label:[-122.428,37.729]},
  ];
  const landmarks = [
    ['Golden Gate Bridge','bridge',-122.477,37.814],['Sutro Tower','tower',-122.4528,37.7552],['Twin Peaks','hill',-122.4477,37.7502],['Ferry Building','ferry',-122.3936,37.7955],['Coit Tower','tower',-122.4058,37.8024],
  ];
  const parks = [['Presidio',-122.471,37.795],['Golden Gate Park',-122.482,37.770],['Twin Peaks',-122.450,37.750],['Dolores Park',-122.427,37.760],['Lake Merced',-122.493,37.728],['Glen Canyon',-122.443,37.739],['McLaren Park',-122.420,37.720],['Lincoln Park',-122.500,37.786]];
  function basemap(config) {
    const g = window.SF_GEOGRAPHY;
    const label = (text,lon,lat,cls) => {const [x,y]=project(lon,lat);return `<text x="${x}" y="${y}" class="${cls}" text-anchor="middle">${esc(text)}</text>`};
    const point = locations.find(r=>r.id===config.selected)||locations[3];
    let html = `<svg class="base-map" viewBox="0 0 1000 810" aria-hidden="true"><rect width="1000" height="810" class="sea"/><g class="land">${g.neighborhoods.map(n=>`<path d="${geoPath(n.polygons)}"/>`).join('')}</g>`;
    html += `<g class="park-shapes">${g.neighborhoods.filter(n=>['Presidio','Lincoln Park'].includes(n.name)).map(n=>`<path d="${geoPath(n.polygons)}"/>`).join('')}${g.parks.map(p=>`<path d="${geoPath(p.polygons)}"/>`).join('')}</g>`;
    // Lake water is a deliberate schematic; park footprints above are public geometry.
    html += `<path class="lake-water" d="${line([[-122.497,37.727],[-122.494,37.730],[-122.491,37.730],[-122.489,37.725],[-122.490,37.720],[-122.494,37.720],[-122.496,37.723]])}Z"/>`;
    html += `<g class="road-lines">${roads.map(r=>`<path class="${r.highway?'highway':'street'}" d="${line(r.coords)}"/>`).join('')}</g>`;
    if (config.boundary==='areas') html += `<g class="coverage-areas">${g.neighborhoods.filter(n=>['Inner Richmond','Outer Richmond','Sunset/Parkside','Inner Sunset','Mission','Marina','Pacific Heights','North Beach','Lakeshore','Castro/Upper Market'].includes(n.name)).map(n=>`<path d="${geoPath(n.polygons)}"/>`).join('')}</g>`;
    if(config.boundary==='halo'){const [x,y]=project(point.lon,point.lat);html+=`<ellipse class="coverage-halo" cx="${x}" cy="${y}" rx="72" ry="56"/>`;}
    if(config.orientation==='parks'||config.orientation==='hybrid')html+=`<g class="park-labels">${parks.filter((p,i)=>config.orientation==='parks'||[0,1,2,4].includes(i)).map(p=>label(...p,'park-label')).join('')}</g>`;
    if(config.orientation==='streets'||config.orientation==='hybrid')html+=`<g class="road-labels">${roads.filter((r,i)=>config.orientation==='streets'||[0,1,3,6].includes(i)).map(r=>label(r.name,...r.label,r.highway?'road-label route-label':'road-label')).join('')}</g>`;
    html+= label('PACIFIC OCEAN',-122.529,37.748,'water-label')+label('SAN FRANCISCO BAY',-122.386,37.817,'water-label');
    html+= `<g class="city-context">${label('SAN FRANCISCO',-122.403,37.717,'city-label')}${label('N',-122.374,37.810,'north-label')}<path d="M955 70v-25m-5 6 5-6 5 6" class="north-arrow"/></g></svg>`;
    if(config.orientation==='landmarks'||config.orientation==='hybrid')html+=`<div class="landmarks">${landmarks.filter((p,i)=>config.orientation==='landmarks'||[0,1,3].includes(i)).map(([name,symbol,lon,lat])=>`<div class="landmark landmark-${symbol}" style="${pos(lon,lat)}">${icon(symbol)}<span>${name}</span></div>`).join('')}</div>`;
    return html;
  }
  function weather(region,config) {
    let r={...region};
    if(config.scene==='clear'){r.temp+=region.lon< -122.46?5:7;r.condition='sun';r.uv+=2;r.rain=0;r.reason=r.lon< -122.46?'Coast cleared at noon':'Sunny through 6 pm';}
    if(config.scene==='rain'){r.temp-=3;r.condition='rain';r.rain=r.lon< -122.46?85:65;r.uv=1;r.reason=r.lon< -122.46?'Rain through 4 pm':'Rain arriving at 2 pm';}
    if(config.scene==='wind'){r.wind+=12;r.condition=r.lon< -122.46?'wind':r.condition;r.reason=`Gusts to ${r.wind+10} mph`;}
    if(config.scene==='uv'){r.temp+=5;r.uv=r.lon< -122.46?5:8;r.condition=r.lon< -122.48?'cloud':'sun';r.reason=r.uv>=8?'UV 8 · very high':'UV 5 · moderate';}
    if(config.scene==='night'){r.temp-=8;r.uv=0;r.condition=r.condition==='sun'?'moon':r.condition;r.reason='Overnight low '+(r.temp-3)+'°';}
    if(config.scene==='partial'&&['outerRichmond','marina'].includes(r.id)){r.wind=null;r.uv=null;r.reason='Wind & UV unavailable';}
    if(config.scene==='stale'){r.stale=true;r.reason='Last forecast · 3 hours ago';}
    if(config.scene==='loading'){r.loading=true;r.reason='Loading this forecast';}
    if(config.scene==='error'){r.error=true;r.reason='Forecast unavailable';}
    if(config.time==='later'){r.temp+=r.lon< -122.46?2:-2;r.wind+=3;r.reason=r.lon< -122.46?'Fog returning after 6 pm':'Sunny, then cooling';}
    return r;
  }
  const deg=(value,config)=>config.unit==='c'?Math.round((value-32)*5/9)+'°':value+'°';
  const uvText=r=>r.uv===null?'UV —':`UV ${r.uv}`;
  function secondary(r,c) {
    if(r.loading||r.error)return r.reason;
    if(c.pattern==='uniform')return `${r.wind??'—'} mph · ${uvText(r)}`;
    if(c.pattern==='lens')return c.metric==='wind'?`${r.wind??'—'} mph wind`:c.metric==='uv'?`${uvText(r)} · modeled`:`${r.rain}% rain chance`;
    if(c.pattern==='dayplan')return r.reason;
    if(c.pattern==='quiet')return '';
    if(r.stale)return 'Forecast · 3 h old';
    if(r.wind===null||r.uv===null)return r.reason;
    if(r.rain>=50)return `${r.rain}% rain chance`;
    if(r.wind>=18)return `Wind ${r.wind} mph`;
    if(r.uv>=6)return `${uvText(r)} · high exposure`;
    if(r.condition==='fog')return 'Fog · low visibility';
    return '';
  }
  function regionMarkup(region,config) {
    const r=weather(region,config),selected=r.id===config.selected,secondaryText=secondary(r,config);
    const notable = r.wind>=18||r.rain>=50||r.uv>=6||r.stale||r.error||r.uv===null;
    let main = r.loading?'…':r.error?'—':deg(r.temp,config);
    if(config.pattern==='lens'&&!r.error&&!r.loading)main=config.metric==='wind'?`${r.wind??'—'}<small>mph</small>`:config.metric==='uv'?`${r.uv??'—'}<small>UV</small>`:`${r.rain}<small>%</small>`;
    const isSparse=config.pattern==='quiet'&&!selected;
    const mobileReps=['outerSunset','innerRichmond',config.selected==='outerRichmond'?'lakeMerced':'mission','marina'].filter(id=>!(id==='marina'&&['pacHeights','northBeach'].includes(config.selected))&&!(id==='innerRichmond'&&config.selected==='outerRichmond')&&!(id==='outerSunset'&&config.selected==='innerSunset')&&!(id==='mission'&&['marketStreet','noeValley','potreroHill'].includes(config.selected)));
    return `<button type="button" class="region-label ${selected?'is-selected':''} ${notable?'is-notable':''} ${r.loading?'is-loading':''} ${r.error?'is-error':''} ${isSparse?'sparse':''} ${mobileReps.includes(r.id)?'mobile-representative':''}" data-region="${r.id}" aria-pressed="${selected}" aria-label="${esc(r.name)}, ${r.error?r.reason:r.loading?r.reason:`${deg(r.temp,config)} ${config.unit==='c'?'Celsius':'Fahrenheit'}, ${r.condition}, wind ${r.wind??'unavailable'}${r.wind===null?'':' miles per hour'}`}. Show forecast" style="${pos(r.lon,r.lat)}"><span class="anchor-dot"></span><span class="label-body"><span class="label-title">${esc(r.short)}</span><span class="label-reading">${icon(r.error||r.loading?'unknown':r.condition)}<b>${main}</b>${config.overlay==='strip'?`<span class="strip-metric">${r.error||r.loading?'—':r.wind??'—'} mph</span>`:''}</span>${secondaryText?`<span class="label-secondary">${esc(secondaryText)}</span>`:''}</span></button>`;
  }
  function beachForScene(beach,c) {
    const b={...beach};
    if(c.scene==='rain'){b.status='caution';b.label='Runoff concern';b.quality='Recent-rain flag';b.note='This fixture shows a recent-rain concern separately from surf and water temperature. It is not a live advisory or a measured water-quality result.';}
    if(c.scene==='partial'&&b.id==='aquatic'){b.status='unknown';b.label='Data unavailable';b.quality='Unavailable';b.note='The sample water-quality channel did not return. Unknown is preserved in the map, list and beach detail; a prior informational state is not reused.';}
    return b;
  }
  function beachMarkup(beach,c) {
    const b=beachForScene(beach,c);
    return `<button type="button" class="beach-pin status-${b.status} beach-${b.id}" data-beach="${b.id}" style="${pos(b.lon,b.lat)}" aria-label="${esc(b.name)}, ${esc(b.label)}. Show beach conditions"><span class="beach-symbol">${icon(c.swim)}<span class="status-shape">${b.status==='avoid'?'!':b.status==='unknown'?'?':b.status==='caution'?'!':'i'}</span></span><span class="beach-label">${b.name}<small>${b.label}</small></span></button>`;
  }
  function beachSummaryMarkup(beach,c) {
    const b=beachForScene(beach,c);
    return `<button type="button" class="beach-summary-row status-${b.status}" data-beach="${b.id}">${icon(c.swim)}<span><b>${b.name}</b><small>${b.label}</small></span><span>${deg(b.water,c)}<small>water</small></span>${icon('chevron')}</button>`;
  }
  function detail(config) {
    const r=weather(locations.find(r=>r.id===config.selected)||locations[3],config);
    const adjacent=r.adj.slice(0,2).map(id=>locations.find(l=>l.id===id));
    const unavailable=r.error||r.loading;
    const times=config.scene==='night'?['9 pm','11 pm','1 am','3 am']:config.time==='later'?['4 pm','6 pm','8 pm','10 pm']:['Noon','2 pm','4 pm','6 pm'];
    return `<section class="forecast-detail" aria-label="Selected forecast"><div class="detail-title"><div><span class="detail-context">Selected forecast point</span><h3>${r.name}</h3></div><div class="detail-current">${icon(unavailable?'unknown':r.condition)}<strong>${unavailable?'—':deg(r.temp,config)}</strong></div></div><p class="detail-reason">${r.reason}</p><dl class="detail-values"><div><dt>Wind</dt><dd>${unavailable?'—':r.wind??'—'} <small>mph</small></dd></div><div><dt>Rain chance</dt><dd>${unavailable?'—':r.rain}<small>%</small></dd></div><div><dt>${icon(config.uv)} UV index</dt><dd>${unavailable?'—':r.uv??'—'}</dd></div></dl><div class="hour-row">${times.map((t,i)=>`<span>${t}<b>${unavailable?'—':deg(r.temp+[0,1,-1,-3][i],config)}</b>${icon(unavailable?'unknown':i===3?(config.scene==='night'?'moon':'cloud'):r.condition)}</span>`).join('')}</div><p class="point-note">Forecast for one coordinate. Nearby blocks can differ.</p><div class="adjacent-regions"><span>Compare nearby</span>${adjacent.map(a=>`<button type="button" data-region="${a.id}">${icon(config.jump)}<span>${a.short}</span></button>`).join('')}</div></section>`;
  }
  function sceneBanner(c) {
    const data={rain:['Rain moving east','The coast gets a rain signal first. The same field stays comparable across all points.'],wind:['Wind stands out at the coast','Wind escalates on exposed points; inland labels stay quieter.'],uv:['UV deserves map space today','High modeled UV appears even where skies are partly cloudy.'],partial:['Some fields are unavailable','A dash is missing data. It does not mean calm wind or zero UV.'],stale:['Showing an older forecast','All values below are from a sample forecast 3 hours old.'],loading:['Loading forecasts','Locations remain visible while sample values load.'],error:['Forecasts could not load','Try again keeps the chosen map and selected location.'],night:['Tonight across San Francisco','UV is zero in this synthetic night scene; temperatures take priority.']};
    if(!data[c.scene])return '';
    return `<div class="scene-banner ${['partial','stale','error'].includes(c.scene)?'banner-warning':''}">${icon(['partial','error'].includes(c.scene)?'alert':c.scene==='stale'?'clock':c.scene==='night'?'moon':c.scene==='loading'?'clock':c.scene==='uv'?c.uv:c.scene==='wind'?'wind':'rain')}<span><strong>${data[c.scene][0]}</strong><small>${data[c.scene][1]}</small></span>${c.scene==='error'?'<button type="button" data-retry>Try again</button>':''}</div>`;
  }
  function markup(c,mini=false) {
    return `<article class="weather-mock ${mini?'mini-map':''} orientation-${c.orientation} overlay-${c.overlay} pattern-${c.pattern} scene-${c.scene} boundary-${c.boundary} beach-mode-${c.beach}" data-map-root>
      <header class="mock-header"><div class="app-wordmark">Eric’s weather<span>San Francisco</span></div><span class="sample-stamp">Illustrative weather · ${c.scene==='night'?(c.time==='later'?'3 am':'9 pm'):(c.time==='later'?'4 pm':'12 pm')} ${c.unit==='c'?'°C':'°F'}</span></header>
      ${sceneBanner(c)}
      <div class="mock-body"><div class="map-column"><div class="map-toolbar"><span>${c.pattern==='lens'?c.metric==='wind'?'Wind · mph':c.metric==='uv'?'UV index · modeled':'Rain chance · %':'San Francisco'}</span><div class="time-switch" aria-label="Forecast time"><button type="button" data-time="now" aria-pressed="${c.time==='now'}">${c.scene==='night'?'Tonight':'Now'}</button><button type="button" data-time="later" aria-pressed="${c.time==='later'}">${c.scene==='night'?'+6 hours':'4 pm'}</button></div><button type="button" class="locate-control ${c.located?'located':''}" data-locate title="Show a simulated current location">${icon(c.location)}<span>${c.located?'Located · demo':'Locate · demo'}</span></button></div>
      <div class="map-surface">${basemap(c)}<div class="weather-regions">${visibleLocations(c).map(r=>regionMarkup(r,c)).join('')}</div><div class="beach-pins">${c.beach==='selected'?beachMarkup(beaches.find(b=>b.id===(c.selected.includes('Sunset')?'ocean':c.selected.includes('Richmond')?'baker':'aquatic')),c):beaches.map(b=>beachMarkup(b,c)).join('')}</div>${c.located?`<div class="user-location-layer"><div class="current-location" style="${pos(-122.455,37.7655)}">${icon(c.location)}<span>You · demo</span></div></div>`:''}<div class="map-edge-links"><button type="button" data-edge="Marin">${icon(c.jump)} Marin</button><button type="button" data-edge="East Bay">East Bay ${icon(c.jump)}</button></div><div class="map-scale"><span></span>1 mile · approximate</div></div>
      <div class="map-legend"><span>${icon('pin')} Weather point</span><span>${icon(c.swim)} Beach conditions</span><span class="sample-key">Sample data · schematic roads${c.coverage==='expanded'?' · 4 proposed points':''}</span></div><div class="mobile-region-picker"><label>Forecast point <select data-region-select>${locations.filter(r=>c.coverage==='expanded'||!r.proposed).map(r=>`<option value="${r.id}" ${r.id===c.selected?'selected':''}>${r.name}${r.proposed?' (proposed)':''}</option>`).join('')}</select></label></div><div class="map-attribution">Land & parks: <a href="https://data.sf.gov/Geographic-Locations-and-Boundaries/Analysis-Neighborhoods/j2bu-swwd" target="_blank" rel="noreferrer">DataSF</a> · simplified. ${c.boundary==='areas'?'Dashed areas are context, not weather boundaries.':'No official weather-region boundaries implied.'}</div></div>
      <aside class="map-detail-dock">${detail(c)}<section class="beach-summary"><h3>At the water</h3><p>Beach conditions belong to the beach.</p>${beaches.map(b=>beachSummaryMarkup(b,c)).join('')}<p class="beach-footnote">Surf and water quality are separate. Every condition in this study is made up.</p></section></aside></div><div class="map-message" role="status" hidden></div><section class="beach-drawer" hidden aria-label="Beach detail"></section></article>`;
  }
  function normalize(input) {
    const choices={orientation:['parks','streets','landmarks','hybrid'],overlay:['ticket','chip','strip','bare'],pattern:['exceptions','uniform','lens','dayplan','quiet'],scene:['marine','clear','rain','wind','uv','night','partial','stale','loading','error'],swim:['swimmer','flag','waves'],uv:['sun','uv','shade'],location:['dot','crosshair','arrow'],jump:['edge','compass','chevron'],boundary:['points','halo','areas'],beach:['independent','symbols','selected'],time:['now','later'],selected:locations.map(r=>r.id),unit:['f','c'],metric:['wind','uv','rain'],coverage:['existing','six','expanded']};
    const result=Object.fromEntries(Object.entries(defaults).map(([key,value])=>[key,key==='located'?input[key]===true||input[key]==='true':choices[key]?.includes(input[key])?input[key]:value]));
    if(result.coverage!=='expanded'&&locations.find(r=>r.id===result.selected)?.proposed)result.selected='innerSunset';
    return result;
  }
  const mapObservers=new WeakMap();
  function drawLeaders(root) {
    const surface=root.querySelector('.map-surface');if(!surface)return;
    const rect=surface.getBoundingClientRect();if(!rect.width||!rect.height)return;
    const ns='http://www.w3.org/2000/svg';let svg=surface.querySelector('.leader-lines');
    if(!svg){svg=document.createElementNS(ns,'svg');svg.classList.add('leader-lines');svg.setAttribute('aria-hidden','true');surface.prepend(svg);}
    svg.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);svg.replaceChildren();
    const connect=(x,y,target,color,beach=false)=>{const box=target.getBoundingClientRect();const ex=Math.max(box.left,Math.min(box.right,x)),ey=Math.max(box.top,Math.min(box.bottom,y));if(Math.hypot(ex-x,ey-y)>2){const line=document.createElementNS(ns,'line');for(const [key,value] of Object.entries({x1:x-rect.left,y1:y-rect.top,x2:ex-rect.left,y2:ey-rect.top,stroke:color}))line.setAttribute(key,value);line.setAttribute('vector-effect','non-scaling-stroke');svg.append(line);}if(beach){const dot=document.createElementNS(ns,'circle');for(const [key,value]of Object.entries({cx:x-rect.left,cy:y-rect.top,r:2.5,fill:color}))dot.setAttribute(key,value);svg.append(dot);}};
    surface.querySelectorAll('.region-label').forEach(button=>{if(getComputedStyle(button).display==='none')return;const anchor=button.querySelector('.anchor-dot').getBoundingClientRect();connect(anchor.left+anchor.width/2,anchor.top+anchor.height/2,button.querySelector('.label-body'),'#709087');});
    const beachLayer=surface.querySelector('.beach-pins').getBoundingClientRect();
    surface.querySelectorAll('.beach-pin').forEach(button=>{if(getComputedStyle(button).display==='none')return;const beach=beaches.find(b=>b.id===button.dataset.beach),[x,y]=project(beach.lon,beach.lat);connect(beachLayer.left+x/1000*beachLayer.width,beachLayer.top+y/810*beachLayer.height,button.querySelector('.beach-symbol'),getComputedStyle(button).color,true);});
  }
  function mount(container,config={},options={}) {
    let c=normalize(config);
    function render(){container.innerHTML=markup(c,options.mini);requestAnimationFrame(()=>drawLeaders(container));if(options.mini){container.setAttribute('inert','');container.setAttribute('aria-hidden','true');return;}
      container.querySelectorAll('[data-region]').forEach(b=>b.addEventListener('click',()=>{c.selected=b.dataset.region;render();container.querySelector(`.weather-regions [data-region="${c.selected}"]`)?.focus({preventScroll:true});options.onChange?.({...c});}));
      container.querySelector('[data-region-select]')?.addEventListener('change',e=>{c.selected=e.target.value;render();options.onChange?.({...c});});
      container.querySelectorAll('[data-time]').forEach(b=>b.addEventListener('click',()=>{c.time=b.dataset.time;render();container.querySelector(`[data-time="${c.time}"]`)?.focus({preventScroll:true});options.onChange?.({...c});}));
      container.querySelector('[data-locate]')?.addEventListener('click',()=>{c.located=!c.located;render();container.querySelector('[data-locate]')?.focus({preventScroll:true});options.onChange?.({...c});});
      container.querySelector('[data-retry]')?.addEventListener('click',()=>{c.scene='marine';render();options.onChange?.({...c});});
      container.querySelectorAll('[data-edge]').forEach(b=>b.addEventListener('click',()=>{const m=container.querySelector('.map-message');m.hidden=false;m.innerHTML=`${esc(b.dataset.edge)} is outside this SF-only study. In the app this would open that regional map. <button type="button">Dismiss</button>`;m.querySelector('button').onclick=()=>m.hidden=true;}));
      container.querySelectorAll('[data-beach]').forEach(b=>b.addEventListener('click',()=>showBeach(b.dataset.beach,b)));
    }
    function showBeach(id,trigger){const b=beachForScene(beaches.find(b=>b.id===id),c),drawer=container.querySelector('.beach-drawer');drawer.hidden=false;drawer.innerHTML=`<header><div><span class="detail-context">Beach-specific sample conditions</span><h3>${b.name}</h3></div><button type="button" class="close-drawer" aria-label="Close beach conditions">${icon('close')}</button></header><p class="beach-state status-${b.status}">${icon(c.swim)}<strong>${b.label}</strong></p><dl class="beach-detail-values"><div><dt>Water temperature</dt><dd>${deg(b.water,c)} ${c.unit==='c'?'C':'F'}</dd></div><div><dt>Surf estimate</dt><dd>${b.surf}</dd></div><div><dt>Wind</dt><dd>${b.wind}</dd></div><div><dt>Water quality</dt><dd>${b.quality}</dd></div><div><dt>Tide</dt><dd>Rising · 3.2 ft MLLW</dd></div></dl><p>${b.note}</p><p class="sample-disclosure">Illustrative values only. No beach advisory, closure, or forecast is being reported live.</p><button type="button" class="return-weather">Return to weather map</button>`;
      const close=()=>{drawer.hidden=true;trigger.focus();};drawer.querySelector('.close-drawer').onclick=close;drawer.querySelector('.return-weather').onclick=close;drawer.querySelector('.close-drawer').focus();drawer.onkeydown=e=>{if(e.key==='Escape')close();};
    }
    mapObservers.get(container)?.disconnect();const observer=new ResizeObserver(()=>drawLeaders(container));observer.observe(container);mapObservers.set(container,observer);
    render();return {update(next){c=normalize({...c,...next});render();},getConfig(){return {...c};}};
  }
  window.SFMap={mount,markup,defaults,locations,beaches,icon,esc,weather,project,normalize,drawLeaders};
  if(document.body.dataset.standalone!==undefined){const params=new URLSearchParams(location.search);const config={...defaults,...document.body.dataset,...Object.fromEntries(params)};config.located=params.get('located')==='true';mount(document.querySelector('#standalone-map'),config);}
})();
