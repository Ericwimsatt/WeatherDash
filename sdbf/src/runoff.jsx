import React, { useEffect,useRef } from "react";
import { Chart,BarController,BarElement,CategoryScale,LinearScale,LineController,LineElement,PointElement,Tooltip } from "chart.js";
import { hour } from "../data/point-rain.mjs";
import { rainBands } from "../data/rating.mjs";
import { regionalRainLabel } from "./evidence.js";
import { runoffHorizon } from "../data/runoff-forecast.mjs";

Chart.defaults.font.family = '"Atkinson Hyperlegible", system-ui, sans-serif';
Chart.register(BarController,BarElement,CategoryScale,LinearScale,LineController,LineElement,PointElement,Tooltip);
const shortDate = new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",timeZone:"UTC"});
const coastal = "#247184";
const regional = "#76559a";
const chartBands = {local:[{amount:.1}],regional:[{amount:.35}]};

export default function RunoffChart({site,sites,now}) {
  const canvas = useRef(null);
  const scroller = useRef(null);
  const throughHour = Math.floor(now/hour);
  const values=runoffHorizon(site,now,sites);
  const edgeLine=(series,before,after)=>[
    {x:-1,y:before},
    ...series.map((y,x)=>({x,y})),
    {x:series.length,y:after},
  ];
  const skip=values.localKnown && values.regionalKnown && Math.max(values.localTotal,values.regionalTotal,values.regionalCurrent ?? 0,...values.regional.filter(Number.isFinite))<rainBands.local[0].amount;
  useEffect(() => {
    if (!canvas.current || skip) return;
    const labels=values.starts.map(time=>shortDate.format(time));
    const chart = new Chart(canvas.current,{
      type:"bar",
      data:{labels,datasets:[
        {label:"Local daily rain",data:values.localDaily,backgroundColor:coastal,order:2},
        {type:"line",label:"Cumulative local rain last 3 days",data:edgeLine(values.local3,values.local3Before,values.local3After),xAxisID:"xLine",borderColor:coastal,backgroundColor:coastal,pointRadius:0,pointHoverRadius:3,borderWidth:2,borderCapStyle:"round",borderJoinStyle:"round",tension:.35,cubicInterpolationMode:"monotone",spanGaps:true,clip:false,order:1},
        {type:"line",label:regionalRainLabel,data:edgeLine(values.regional,values.regionalBefore,values.regionalAfter),xAxisID:"xLine",borderColor:regional,backgroundColor:regional,borderDash:[6,3],pointRadius:0,pointHoverRadius:3,borderWidth:2,tension:.35,spanGaps:false,order:1},
        {type:"line",label:`${regionalRainLabel} now`,data:[{x:values.currentX,y:values.regionalCurrent}],xAxisID:"xLine",borderColor:regional,backgroundColor:regional,pointRadius:5,showLine:false,order:0},
        {type:"line",label:"Cumulative local rain last 3 days now",data:[{x:values.currentX,y:values.localCurrent}],xAxisID:"xLine",borderColor:coastal,backgroundColor:coastal,pointRadius:5,showLine:false,order:0},
      ]},
      options:{
        responsive:false,maintainAspectRatio:false,animation:false,interaction:{mode:"nearest",intersect:false},
        plugins:{tooltip:{callbacks:{title:items=>{
          const item=items[0];
          if (!item) return "";
          if (item.dataset.label.endsWith(" now")) return "Current rolling total";
          const index=item.dataset.xAxisID === "xLine" ? Math.round(item.parsed.x) : item.dataIndex;
          return values.starts[index] == null ? "" : shortDate.format(values.starts[index]);
        },label:ctx=>`${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} in`}}},
        scales:{y:{beginAtZero:true,suggestedMax:Math.max(...Object.values(chartBands).flatMap(bands=>bands.map(band=>band.amount))),ticks:{callback:value=>`${value}″`}},x:{grid:{display:false}},xLine:{type:"linear",display:false,min:-.5,max:values.starts.length-.5}},
      },
      plugins:[{id:"runoff-guides",beforeDatasetsDraw({ctx,chartArea,scales}){
        const x=(scales.x.getPixelForValue(3)+scales.x.getPixelForValue(4))/2;
        ctx.save();ctx.fillStyle="#eaf3f577";ctx.fillRect(x,chartArea.top,chartArea.right-x,chartArea.bottom-chartArea.top);
        ctx.setLineDash([4,4]);ctx.lineWidth=1;
        for (const [value,color] of Object.entries(chartBands).flatMap(([field,bands])=>bands.map(band=>[band.amount,{local:coastal,regional}[field]]))) {
          const y=scales.y.getPixelForValue(value);ctx.strokeStyle=color;ctx.beginPath();ctx.moveTo(chartArea.left,y);ctx.lineTo(chartArea.right,y);ctx.stroke();
        }
        ctx.strokeStyle="#496271";ctx.beginPath();ctx.moveTo(x,chartArea.top);ctx.lineTo(x,chartArea.bottom);ctx.stroke();
        ctx.translate(x+6,chartArea.top+6);ctx.rotate(Math.PI/2);
        ctx.setLineDash([]);ctx.font="600 12px \"Atkinson Hyperlegible\", sans-serif";ctx.textBaseline="top";
        const labelWidth=ctx.measureText("Today").width;
        ctx.fillStyle="#fff";ctx.fillRect(-3,-3,labelWidth+6,20);
        ctx.fillStyle="#496271";ctx.fillText("Today",0,0);ctx.restore();
      }}],
    });
    // Wait until the parent dialog is open so its viewport can be measured.
    const frame = requestAnimationFrame(() => {
      if (!scroller.current) return;
      const todayX = (chart.scales.x.getPixelForValue(3)+chart.scales.x.getPixelForValue(4))/2;
      scroller.current.scrollLeft = todayX-scroller.current.clientWidth/2;
    });
    return ()=>{ cancelAnimationFrame(frame);chart.destroy(); };
  },[site.localPoint,site.inlandPoint,sites,throughHour,skip]);

  if (!site.localPoint && !site.inlandPoint) return null;
  if (skip) return null;
  return <section className="runoff-chart"><div className="runoff-heading"><h3>Rainfall and runoff</h3></div>
    <div className="runoff-plot-scroll" ref={scroller} tabIndex={0} role="region" aria-label="Scrollable rainfall and runoff chart">
      <div className="runoff-plot" style={{width:`${Math.max(880,values.starts.length*76)}px`}}><canvas ref={canvas} width={Math.max(880,values.starts.length*76)} height={240} role="img" aria-label="Rainfall and runoff chart" /></div>
    </div>
  </section>;
}
