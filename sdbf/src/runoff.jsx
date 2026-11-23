import React, { useEffect,useRef } from "react";
import { Chart,BarController,BarElement,CategoryScale,LinearScale,LineController,LineElement,PointElement,Legend,Tooltip } from "chart.js";
import { pointTotal,rainLimits, rainPeriods, hour } from "../data/point-rain.mjs";

Chart.register(BarController,BarElement,CategoryScale,LinearScale,LineController,LineElement,PointElement,Legend,Tooltip);
const day = 24*hour;
const calendar = new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:"America/Los_Angeles"});
const shortDate = new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",timeZone:"UTC"});
const coastal = "#247184";
const inland = "#ba723a";

function dayStart(now) {
  const date = calendar.format(now);
  const seven = Date.parse(date+"T07:00:00Z");
  return calendar.format(seven)===date ? seven : seven+hour;
}

export default function RunoffChart({site,now}) {
  const canvas = useRef(null);
  const throughHour = Math.floor(now/hour);
  useEffect(() => {
    if (!canvas.current) return;
    const today = dayStart(throughHour*hour);
    const starts = [-4,-3,-2,-1,0,1,2].map(offset => dayStart(today+offset*day+12*hour));
    const ends = starts.map(time => dayStart(time+36*hour));
    const labels = starts.map(time => shortDate.format(time));
    const points = (point, period) => ends.map((end,index) => {
      const {total,complete} = pointTotal(point,period ? end-period*hour : starts[index],end);
      return complete ? total : null;
    });
    const chart = new Chart(canvas.current,{
      type:"bar",
      data:{labels,datasets:[
        {label:"Local daily",data:points(site.localPoint),backgroundColor:coastal,order:2},
        {label:"Inland daily",data:points(site.inlandPoint),backgroundColor:inland,order:2},
        {type:"line",label:"Local 3-day",data:points(site.localPoint,rainPeriods.local),borderColor:coastal,backgroundColor:coastal,pointRadius:2,borderWidth:2,order:1},
        {type:"line",label:"Inland 4-day",data:points(site.inlandPoint,rainPeriods.inland),borderColor:inland,backgroundColor:inland,pointRadius:2,borderWidth:2,order:1},
      ]},
      options:{
        responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:"index",intersect:false},
        plugins:{legend:{labels:{boxWidth:12,font:{size:11}}},tooltip:{callbacks:{label:ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} in`}}},
        scales:{y:{beginAtZero:true,suggestedMax:1,ticks:{callback:value=>`${value}″`}},x:{grid:{display:false}}},
      },
      plugins:[{id:"runoff-guides",beforeDatasetsDraw({ctx,chartArea,scales}){
        const x = (scales.x.getPixelForValue(3)+scales.x.getPixelForValue(4))/2;
        ctx.save();
        ctx.fillStyle = "#eaf3f577";
        ctx.fillRect(x,chartArea.top,chartArea.right-x,chartArea.bottom-chartArea.top);
        ctx.setLineDash([4,4]);
        ctx.lineWidth=1;
        for (const [value,color] of [[rainLimits.local,coastal],[rainLimits.inland,inland]]) {
          const y = scales.y.getPixelForValue(value);
          ctx.strokeStyle=color;
          ctx.beginPath();ctx.moveTo(chartArea.left,y);ctx.lineTo(chartArea.right,y);ctx.stroke();
        }
        ctx.strokeStyle="#496271";
        ctx.beginPath();ctx.moveTo(x,chartArea.top);ctx.lineTo(x,chartArea.bottom);ctx.stroke();
        ctx.restore();
      }}],
    });
    return () => chart.destroy();
  },[site.localPoint,site.inlandPoint,throughHour]);

  if (!site.localPoint && !site.inlandPoint) return <p className="timeline-note">Coordinate rainfall chart unavailable. Gauge evidence appears above.</p>;
  return <section className="runoff-chart"><h3>Runoff rain chart</h3>
    <p>Rainfall in inches. Bars show daily rain and lines show rolling totals. Shading starts today and includes forecast hours.</p>
    <div className="runoff-plot"><canvas ref={canvas} role="img" aria-label="Local and inland daily rain bars and three- and four-day rolling rain totals" /></div>
  </section>;
}
