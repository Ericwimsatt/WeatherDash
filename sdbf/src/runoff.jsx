import React, { useEffect,useRef } from "react";
import { Chart,BarController,BarElement,CategoryScale,LinearScale,LineController,LineElement,PointElement,Tooltip } from "chart.js";
import { rainLimits, hour } from "../data/point-rain.mjs";
import { runoffHorizon } from "../data/runoff-forecast.mjs";

Chart.register(BarController,BarElement,CategoryScale,LinearScale,LineController,LineElement,PointElement,Tooltip);
const shortDate = new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",timeZone:"UTC"});
const coastal = "#247184";
const inland = "#ba723a";

export default function RunoffChart({site,now}) {
  const canvas = useRef(null);
  const scroller = useRef(null);
  const throughHour = Math.floor(now/hour);
  const values=runoffHorizon(site,now);
  const edgeLine=(series,before,after)=>[
    {x:-1,y:before},
    ...series.map((y,x)=>({x,y})),
    {x:series.length,y:after},
  ];
  const skip=values.localKnown && values.inlandKnown && Math.max(values.localTotal,values.inlandTotal)<.1;
  useEffect(() => {
    if (!canvas.current || skip) return;
    const labels=values.starts.map(time=>shortDate.format(time));
    const chart = new Chart(canvas.current,{
      type:"bar",
      data:{labels,datasets:[
        {label:"Local daily rain",data:values.localDaily,backgroundColor:coastal,order:2},
        {label:"Inland daily rain",data:values.inlandDaily,backgroundColor:inland,order:2},
        {type:"line",label:"Local rolling 3-day rain",data:edgeLine(values.local3,values.local3Before,values.local3After),xAxisID:"xLine",borderColor:coastal,backgroundColor:coastal,pointRadius:0,pointHoverRadius:3,borderWidth:2,borderCapStyle:"round",borderJoinStyle:"round",tension:.35,cubicInterpolationMode:"monotone",spanGaps:true,clip:false,order:1},
        {type:"line",label:"Inland rolling 4-day rain",data:edgeLine(values.inland4,values.inland4Before,values.inland4After),xAxisID:"xLine",borderColor:inland,backgroundColor:inland,pointRadius:0,pointHoverRadius:3,borderWidth:2,borderCapStyle:"round",borderJoinStyle:"round",tension:.35,cubicInterpolationMode:"monotone",spanGaps:true,clip:false,order:1},
      ]},
      options:{
        responsive:false,maintainAspectRatio:false,animation:false,interaction:{mode:"nearest",intersect:false},
        plugins:{tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} in`}}},
        scales:{y:{beginAtZero:true,suggestedMax:1,ticks:{callback:value=>`${value}″`}},x:{grid:{display:false}},xLine:{type:"linear",display:false,min:-.5,max:values.starts.length-.5}},
      },
      plugins:[{id:"runoff-guides",beforeDatasetsDraw({ctx,chartArea,scales}){
        const x=(scales.x.getPixelForValue(3)+scales.x.getPixelForValue(4))/2;
        ctx.save();ctx.fillStyle="#eaf3f577";ctx.fillRect(x,chartArea.top,chartArea.right-x,chartArea.bottom-chartArea.top);
        ctx.setLineDash([4,4]);ctx.lineWidth=1;
        for (const [value,color] of [[rainLimits.local,coastal],[rainLimits.inland,inland]]) {
          const y=scales.y.getPixelForValue(value);ctx.strokeStyle=color;ctx.beginPath();ctx.moveTo(chartArea.left,y);ctx.lineTo(chartArea.right,y);ctx.stroke();
        }
        ctx.strokeStyle="#496271";ctx.beginPath();ctx.moveTo(x,chartArea.top);ctx.lineTo(x,chartArea.bottom);ctx.stroke();ctx.restore();
      }}],
    });
    return ()=>chart.destroy();
  },[site.localPoint,site.inlandPoint,throughHour,skip]);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = 4*76;
  },[site.localPoint,site.inlandPoint]);

  if (!site.localPoint && !site.inlandPoint) return null;
  if (skip) return <p className="runoff-hint no-rain">No rain forecast over the next 10 days.</p>;
  return <section className="runoff-chart"><div className="runoff-heading"><h3>Rainfall and runoff</h3></div>
    <div className="runoff-plot-scroll" ref={scroller} tabIndex={0} role="region" aria-label="Scrollable rainfall and runoff chart">
      <div className="runoff-plot" style={{width:`${Math.max(880,values.starts.length*76)}px`}}><canvas ref={canvas} width={Math.max(880,values.starts.length*76)} height={240} role="img" aria-label="Daily local and inland rainfall with rolling three- and four-day totals for the past 4 days and next 10 days" /></div>
    </div>
  </section>;
}
