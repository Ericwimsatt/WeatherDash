(() => {
  function scale(el){const map=el.querySelector('.mini-map');if(map){map.style.transform=`scale(${el.clientWidth/780})`;SFMap.drawLeaders(map);}}
  const resizer=new ResizeObserver(entries=>entries.forEach(e=>scale(e.target)));
  function render(el){if(el.dataset.rendered)return;el.dataset.rendered='true';const config=SFMap.normalize({...SFMap.defaults,...JSON.parse(el.dataset.mapConfig)});el.innerHTML=SFMap.markup(config,true);el.setAttribute('aria-hidden','true');el.setAttribute('inert','');scale(el);resizer.observe(el);}
  const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){render(e.target);observer.unobserve(e.target)}}),{rootMargin:'600px'});
  document.querySelectorAll('[data-map-config]').forEach(el=>observer.observe(el));
  addEventListener('beforeprint',()=>document.querySelectorAll('[data-map-config]').forEach(render));
})();
