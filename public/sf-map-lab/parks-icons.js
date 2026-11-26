(() => {
  const stroke = body => `<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
  const groups = [
    {id:'swim',title:'Swimmer symbols',intro:'Five swimmers, as SVGs only. The solid competition pictogram is closest to the Olympic-style direction you requested; it is an original drawing.',options:[
      {id:'freestyle',title:'Competition freestyle',note:'Solid pictogram · Olympic-style direction',svg:'<circle cx="23" cy="8" r="3" fill="currentColor"/><path d="m5 8 7-5 9 8-5 6-5-3 4-4-4-3-4 3Z" fill="currentColor"/>'+stroke('<path d="M2 22q3.5-4 7 0t7 0 7 0 7 0M2 28q3.5-4 7 0t7 0 7 0 7 0"/>')},
      {id:'crawl',title:'Open-water crawl',note:'Fine stroke · raised arm',svg:stroke('<circle cx="24" cy="9" r="2.7"/><path d="m5 17 8-8 7 6 7 2M13 9l-5-5-5 2M2 23q3.5-4 7 0t7 0 7 0 7 0M2 29q3.5-4 7 0t7 0 7 0 7 0"/>')},
      {id:'breaststroke',title:'Breaststroke',note:'Front view · symmetrical arms',svg:'<circle cx="16" cy="7" r="3" fill="currentColor"/>'+stroke('<path d="m3 14 7-3 6 5 6-5 7 3M16 12v7M2 23q3.5-4 7 0t7 0 7 0 7 0M2 29q3.5-4 7 0t7 0 7 0 7 0"/>')},
      {id:'backstroke',title:'Backstroke',note:'Relaxed posture · one water line',svg:'<circle cx="25" cy="15" r="3" fill="currentColor"/>'+stroke('<path d="m4 20 9-5 7 4M13 15 8 4l5-2M2 27q3.5-4 7 0t7 0 7 0 7 0"/>')},
      {id:'minimal-swim',title:'Small swimmer',note:'Reduced detail for small map markers',svg:'<circle cx="24" cy="9" r="3.2" fill="currentColor"/>'+stroke('<path stroke-width="2.8" d="m4 18 8-9 8 8M12 9 7 5M2 26q4-4 8 0t8 0 8 0 4 0"/>')},
    ]},
    {id:'jump',title:'Compasses for adjacent regions',intro:'These belong on the Marin / East Bay destination controls. No standalone north compass is drawn on the map.',options:[
      {id:'compass-ring',title:'Ring + needle',note:'Familiar navigation compass',svg:stroke('<circle cx="16" cy="16" r="13"/><path d="m22 10-4 10-8 2 4-10Z"/>')},
      {id:'compass-solid',title:'Solid needle',note:'Stronger small-size silhouette',svg:stroke('<circle cx="16" cy="16" r="13"/>')+'<path d="m22 9-4 11-9 3 4-10Z" fill="currentColor"/><path d="m22 9-6 7-7 7 4-10Z" fill="#fffdf7" stroke="currentColor" stroke-width="1"/>'},
      {id:'compass-rose',title:'Four-point rose',note:'Clear cardinal structure without letters',svg:stroke('<circle cx="16" cy="16" r="11"/><path d="m16 1 3 12 12 3-12 3-3 12-3-12-12-3 12-3Z"/>')},
      {id:'compass-eight',title:'Eight-point rose',note:'Most cartographic',svg:stroke('<path d="m16 1 3 10 8-6-6 8 10 3-10 3 6 8-8-6-3 10-3-10-8 6 6-8-10-3 10-3-6-8 8 6Z"/><circle cx="16" cy="16" r="2"/>')},
      {id:'compass-open',title:'Open diamond',note:'Least ink · no enclosing ring',svg:stroke('<path d="m16 2 6 14-6 14-6-14Zm-6 14h12"/>')+'<path d="m16 2 6 14h-6Z" fill="currentColor"/>'},
    ]},
    {id:'location',title:'Personal location images',intro:'A crosshair and five original person drawings. The yellow standing person follows the familiar Street View metaphor without copying its artwork. All are editable SVG images.',options:[
      {id:'crosshair',title:'Crosshair',note:'Precise location / recenter',svg:stroke('<circle cx="16" cy="16" r="8"/><path d="M16 1v9m0 12v9M1 16h9m12 0h9"/><circle cx="16" cy="16" r="2"/>')},
      {id:'person-yellow',title:'Yellow standing person',note:'Street View-like human marker',svg:'<g fill="#d79229" stroke="#765016" stroke-width=".8"><circle cx="16" cy="5" r="3.4"/><rect x="11.5" y="10" width="9" height="11" rx="3"/></g><g fill="none" stroke="#b77414" stroke-width="3.4" stroke-linecap="round"><path d="M10 12 7 21m15-9 3 9M13 21v9m6-9v9"/></g>'},
      {id:'person-blue',title:'Blue standing person',note:'Simple human silhouette',svg:'<circle cx="16" cy="5" r="3.5" fill="currentColor"/><path d="M12 10h8l3 11h-4v10h-6V21H9Z" fill="currentColor"/>'},
      {id:'person-pin',title:'Person in a pin',note:'Human identity with an exact point',svg:stroke('<path d="M27 12c0 8-11 18-11 18S5 20 5 12a11 11 0 1 1 22 0Z"/>')+'<circle cx="16" cy="9" r="3" fill="currentColor"/><path d="M10 19v-3a6 6 0 0 1 12 0v3Z" fill="currentColor"/>'},
      {id:'person-walking',title:'Walking person',note:'Useful when travel mode matters',svg:'<circle cx="19" cy="5" r="3" fill="currentColor"/>'+stroke('<path stroke-width="3" d="m15 11-4 6-6 2m10-8 4 7 7 2M15 11l-2 10-5 9m5-9 7 3 2 6"/>')},
      {id:'person-circle',title:'Person in a circle',note:'A stable badge for “me”',svg:stroke('<circle cx="16" cy="16" r="14"/>')+'<circle cx="16" cy="11" r="4" fill="currentColor"/><path d="M7 25a9 9 0 0 1 18 0" fill="currentColor"/>'},
    ]},
  ];
  function svg(id, title=''){const option=groups.flatMap(g=>g.options).find(o=>o.id===id)||groups[0].options[0];return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" class="study-icon" ${title?`role="img" aria-label="${title}"`:'aria-hidden="true"'}>${option.svg}</svg>`;}
  window.ParksIcons={groups,svg};
})();
