"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addFilterToConfig,
  buildOutputChannels,
  CamillaConfig,
  ensureSpectrumInfrastructure,
  fallbackConfig,
  filterChannels,
  filterIsBypassed,
  moveFilterStep,
  OutputChannel,
  outputMixerState,
  patchFilter,
  patchOutputMixer,
  removeFilterFromConfig,
  routeFilterInConfig,
  toggleFilterBypass,
  toUiFilter,
  UiFilter,
} from "./camilla-model";
import { FilterCreator, FilterRoutingDialog, CatalogFilterEditor } from "./filter-manager";
import { FilterTemplate, FilterValues, rawFilterFromTemplate } from "./filter-catalog";
import { ProfileManager, StoredProfile, TransferParts } from "./profile-manager";
import { SettingsManager } from "./settings-manager";
import { Patchbay } from "./patchbay";

type MeterData = { captureRms: number[]; capturePeak: number[]; playbackRms: number[]; playbackPeak: number[]; load?: number; status?: string };
type SpectrumData = { channel: number; bins: number[]; rateHz: number; online: boolean; error?: string | null };
type LiveState = "connecting" | "live" | "applying" | "error" | "demo";
type CoeffFile = { name: string; size?: number; lastModified?: number };

async function fetchStoredProfiles() {
  const aliasesResponse=await fetch("/api/profilealiases",{cache:"no-store"}).catch(()=>null);
  if(aliasesResponse?.ok){
    const aliases=await aliasesResponse.json() as Array<{name:string;aliasOf?:string|null}>;
    const canonical=aliases.filter((item)=>item.name.toLowerCase().endsWith(".yml")&&!item.aliasOf);
    const profiles=await Promise.all(canonical.map(async(item)=>{try{const response=await fetch(`/api/getconfigfile?name=${encodeURIComponent(item.name)}`,{cache:"no-store"});if(!response.ok)return null;const config=await response.json() as CamillaConfig;return {name:item.name,title:config.title,description:config.description,valid:true,lastModified:0,aliasOf:null} satisfies StoredProfile;}catch{return null;}}));
    return profiles.filter((item):item is StoredProfile=>item!==null);
  }
  const storedResponse=await fetch("/api/storedconfigs",{cache:"no-store"});
  if(!storedResponse.ok)throw new Error("não foi possível listar os perfis YAML");
  const stored=await storedResponse.json() as StoredProfile[];
  return stored.filter((item)=>item.valid&&item.name.toLowerCase().endsWith(".yml")&&!item.aliasOf);
}

const freqToX = (freq: number) => (Math.log10(freq) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20));
const xToFreq = (x: number) => 10 ** (Math.log10(20) + x * (Math.log10(20000) - Math.log10(20)));
const gainToY = (gain: number) => (20 - gain) / 60;
const gainToGraphTop = (gain: number) => {
  const ratio = gainToY(gain);
  return `calc(${ratio * 100}% + ${18 - ratio * 52}px)`;
};
const hasCurve = (filter: UiFilter) => ["HPF", "LPF", "GEQ", "PEQ", "SHELF", "IIR", "GAIN", "LOUDNESS"].includes(filter.kind);
const hasNode = (filter: UiFilter) => ["HPF", "LPF", "PEQ", "SHELF"].includes(filter.kind) && filter.freq !== undefined;

function partSelected(config:CamillaConfig,name:string,parts:TransferParts) {
  const kind=toUiFilter(name,config.filters[name]).kind;
  if(kind==="HPF"||kind==="LPF")return parts.crossovers;
  if(["GEQ","PEQ","SHELF","IIR","FIR","DIFFEQ"].includes(kind))return parts.equalizers;
  return parts.dynamics;
}

function transferProfileParts(source:CamillaConfig,target:CamillaConfig,parts:TransferParts):CamillaConfig {
  const sourceNames=new Set(Object.keys(source.filters).filter((name)=>partSelected(source,name,parts)));
  const targetNames=new Set(Object.keys(target.filters).filter((name)=>partSelected(target,name,parts)));
  const filters={...target.filters};
  for(const name of targetNames)delete filters[name];
  for(const name of sourceNames)filters[name]=structuredClone(source.filters[name]);
  type FilterStep=Extract<CamillaConfig["pipeline"][number],{type:"Filter"}>;
  type Anchored={anchor:string;step:FilterStep;priority:number;order:number};
  const priority=(step:FilterStep,owner:CamillaConfig)=>{const kinds=step.names.map((name)=>owner.filters[name]&&toUiFilter(name,owner.filters[name]).kind);if(kinds.includes("DELAY"))return 5;if(kinds.includes("GAIN"))return 10;if(kinds.some((kind)=>kind==="HPF"||kind==="LPF"))return 20;if(kinds.includes("LIMITER"))return 30;if(kinds.some((kind)=>["GEQ","PEQ","SHELF","IIR","FIR","DIFFEQ"].includes(kind??"")))return 40;if(kinds.includes("DITHER"))return 90;return 50;};
  const collect=(owner:CamillaConfig,keep:(name:string)=>boolean)=>{let anchor="__start";const result:Anchored[]=[];owner.pipeline.forEach((step,order)=>{if(step.type==="Mixer"){anchor=step.name;return;}const names=step.names.filter(keep);if(names.length)result.push({anchor,step:{...step,names},priority:priority({...step,names},owner),order});});return result;};
  const targetKept=collect(target,(name)=>!targetNames.has(name)&&!sourceNames.has(name));
  const sourceMoved=collect(source,(name)=>sourceNames.has(name));
  const buckets=new Map<string,Anchored[]>();
  for(const item of [...targetKept,...sourceMoved])buckets.set(item.anchor,[...(buckets.get(item.anchor)??[]),item]);
  for(const items of buckets.values())items.sort((a,b)=>a.priority-b.priority||a.order-b.order);
  const mixerOwner=parts.mixer?source:target;
  const mixerSteps=mixerOwner.pipeline.filter((step)=>step.type==="Mixer");
  const pipeline:CamillaConfig["pipeline"]=[];
  const inject=(anchor:string)=>{for(const item of buckets.get(anchor)??[])pipeline.push(item.step);buckets.delete(anchor);};
  inject("__start");for(const step of mixerSteps){pipeline.push(structuredClone(step));inject(step.name);}for(const items of buckets.values())for(const item of items)pipeline.push(item.step);
  const candidate={...target,filters,pipeline,...(parts.mixer?{mixers:structuredClone(source.mixers)}:{})};
  return ensureSpectrumInfrastructure(candidate);
}

function geqCenters(filter: UiFilter) {
  const bands = filter.bands ?? [];
  const min = filter.freqMin ?? 20;
  const ratio = (filter.freqMax ?? 20000) / min;
  return bands.map((_, index) => min * ratio ** ((index + .5) / Math.max(1, bands.length)));
}

function responseAt(filter: UiFilter, freq: number) {
  if (filter.kind === "GAIN") return filter.gain ?? 0;
  if (filter.kind === "GEQ") return geqCenters(filter).reduce((sum, center, index) => {
    const distance = Math.log2(freq / center);
    return sum + (filter.bands?.[index] ?? 0) * Math.exp(-(distance * distance) / .5);
  }, 0);
  if (filter.kind === "PEQ") {
    const center=filter.freq??1000;const q=Number(filter.parameters.q??1);const bandwidth=Number(filter.parameters.bandwidth??Math.max(.05,1/q));const distance=Math.log2(freq/center);
    return (filter.gain??0)*Math.exp(-(distance*distance)/(2*Math.max(.03,bandwidth/2.355)**2));
  }
  if (filter.kind === "SHELF") {
    const center=filter.freq??1000;const gain=filter.gain??0;const high=String(filter.subtype??"").toLowerCase().includes("high")||filter.subtype==="Tilt";
    const transition=1/(1+Math.exp(-Math.log2(freq/center)*4));return filter.subtype==="Tilt"?gain*(transition-.5):(high?gain*transition:gain*(1-transition));
  }
  if (filter.kind !== "HPF" && filter.kind !== "LPF") return 0;
  const octaves = Math.log2(freq / (filter.freq ?? 1000));
  if (filter.kind === "HPF") return octaves < 0 ? octaves * (filter.slope ?? 24) : 0;
  return octaves > 0 ? -octaves * (filter.slope ?? 24) : 0;
}

function formatFreq(freq?: number) {
  if (freq === undefined) return "—";
  if (freq >= 1000) return `${(freq / 1000).toFixed(freq % 1000 ? 1 : 0)}k`;
  return `${Math.round(freq)}`;
}

function filterSummary(filter: UiFilter) {
  if (filter.kind === "HPF" || filter.kind === "LPF") return `${formatFreq(filter.freq)} Hz · ordem ${filter.order}`;
  if (filter.kind === "GAIN") return `${filter.gain} dB · escala dB`;
  if (filter.kind === "DELAY") return `${filter.delay} ms · unidade padrão`;
  if (filter.kind === "LIMITER") return `limite ${filter.limit} dB · hard clip`;
  if (filter.kind === "GEQ") return `${filter.bands?.length ?? 0} bandas · ${filter.freqMin}—${formatFreq(filter.freqMax)} Hz`;
  if (filter.kind === "PEQ") return `${formatFreq(filter.freq)} Hz · ${filter.gain??0} dB · Q ${String(filter.parameters.q??"—")}`;
  if (filter.kind === "SHELF") return `${formatFreq(filter.freq)} Hz · ${filter.gain??0} dB`;
  if (filter.kind === "FIR") return `${String(filter.subtype??"Conv")} · ${String(filter.parameters.filename??(Array.isArray(filter.parameters.values)?`${filter.parameters.values.length} taps`:""))}`;
  if (filter.kind === "DITHER") return `${String(filter.parameters.type)} · ${String(filter.parameters.bits)} bit`;
  if (filter.kind === "VOLUME") return `${String(filter.parameters.fader)} · limite ${String(filter.parameters.limit??50)} dB`;
  if (filter.kind === "LOUDNESS") return `${String(filter.parameters.fader)} · referência ${String(filter.parameters.reference_level)} dB`;
  if (filter.kind === "DIFFEQ") return `${Array.isArray(filter.parameters.a)?filter.parameters.a.length:0}A · ${Array.isArray(filter.parameters.b)?filter.parameters.b.length:0}B`;
  return filter.rawType;
}

function levelPercent(db: number | undefined) {
  if (db === undefined || !Number.isFinite(db)) return 0;
  return Math.max(0, Math.min(100, ((db + 96) / 102) * 100));
}

function ChannelMiniMeter({rms,peak,label}:{rms:number|undefined;peak:number|undefined;label:string}) {
  const safePeak=Number.isFinite(peak)?Number(peak):-120;
  const [heldPeak,setHeldPeak]=useState(safePeak);
  const holdUntilRef=useRef(0);
  useEffect(()=>{
    const now=Date.now();
    setHeldPeak((current)=>{
      if(safePeak>=current){holdUntilRef.current=now+1100;return safePeak;}
      if(now<holdUntilRef.current)return current;
      return Math.max(safePeak,current-2.2);
    });
  },[safePeak]);
  const safeRms=Number.isFinite(rms)?Number(rms):-120;
  return <span className={`mini-meter ${safePeak>-3?"hot":""}`} role="meter" aria-label={`${label}: RMS ${safeRms>-100?safeRms.toFixed(1):"menos infinito"} dB, pico ${safePeak>-100?safePeak.toFixed(1):"menos infinito"} dB`} aria-valuemin={-96} aria-valuemax={6} aria-valuenow={Math.max(-96,safePeak)} title={`RMS ${safeRms>-100?safeRms.toFixed(1):"−∞"} dB · pico ${safePeak>-100?safePeak.toFixed(1):"−∞"} dB`}><i className="mini-rms" style={{height:`${levelPercent(safeRms)}%`}}/><b className="mini-peak" style={{bottom:`${levelPercent(safePeak)}%`}}/><em className="mini-hold" style={{bottom:`${levelPercent(heldPeak)}%`}}/></span>;
}

function OutputGainKnob({value,color,disabled,onChange,onCommit,onActiveChange}:{value:number;color:string;disabled:boolean;onChange:(value:number)=>void;onCommit:()=>void;onActiveChange?:(active:boolean)=>void}) {
  const valueRef=useRef(value);const wheelCommitRef=useRef<number|undefined>(undefined);
  useEffect(()=>{valueRef.current=value;},[value]);
  useEffect(()=>()=>{if(wheelCommitRef.current!==undefined)window.clearTimeout(wheelCommitRef.current);},[]);
  const clamp=(next:number)=>Math.max(-20,Math.min(15,Math.round(next*2)/2));
  const rotation=value<0?(value/20)*135:(value/15)*135;
  const begin=(event:React.PointerEvent<HTMLButtonElement>)=>{if(disabled)return;event.stopPropagation();onActiveChange?.(true);event.currentTarget.setPointerCapture(event.pointerId);const startY=event.clientY;const start=valueRef.current;const move=(pointer:PointerEvent)=>{const next=clamp(start+(startY-pointer.clientY)/8);valueRef.current=next;onChange(next);};const stop=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",stop);onCommit();onActiveChange?.(false);};window.addEventListener("pointermove",move);window.addEventListener("pointerup",stop);};
  const key=(event:React.KeyboardEvent<HTMLButtonElement>)=>{if(!["ArrowUp","ArrowRight","ArrowDown","ArrowLeft","Home"].includes(event.key))return;event.preventDefault();event.stopPropagation();const next=event.key==="Home"?0:clamp(valueRef.current+(["ArrowUp","ArrowRight"].includes(event.key)?.5:-.5));valueRef.current=next;onActiveChange?.(true);onChange(next);queueMicrotask(()=>{onCommit();onActiveChange?.(false);});};
  const wheel=(event:React.WheelEvent<HTMLButtonElement>)=>{if(disabled||event.deltaY===0)return;event.preventDefault();event.stopPropagation();const next=clamp(valueRef.current+(event.deltaY<0?.5:-.5));valueRef.current=next;onActiveChange?.(true);onChange(next);if(wheelCommitRef.current!==undefined)window.clearTimeout(wheelCommitRef.current);wheelCommitRef.current=window.setTimeout(()=>{wheelCommitRef.current=undefined;onCommit();onActiveChange?.(false);},180);};
  return <button type="button" className="output-gain" disabled={disabled} role="slider" aria-label={`Ganho do mixer ${value.toFixed(1)} dB`} aria-valuemin={-20} aria-valuemax={15} aria-valuenow={value} title="Ganho do mixer · arraste ou use a roda do mouse · duplo clique retorna a 0 dB" onPointerDown={begin} onWheelCapture={wheel} onKeyDown={key} onDoubleClick={(event)=>{event.stopPropagation();valueRef.current=0;onActiveChange?.(true);onChange(0);queueMicrotask(()=>{onCommit();onActiveChange?.(false);});}} style={{"--knob-color":color,"--knob-angle":`${rotation}deg`} as React.CSSProperties}><i/><b>{value>0?"+":""}{value.toFixed(1)}</b><span>dB</span></button>;
}

function OutputBalanceKnob({value,disabled,onChange,onCommit}:{value:number;disabled:boolean;onChange:(value:number)=>void;onCommit:()=>void}) {
  const valueRef=useRef(value);useEffect(()=>{valueRef.current=value;},[value]);const clamp=(next:number)=>Math.max(-1,Math.min(1,Math.round(next*20)/20));
  const begin=(event:React.PointerEvent<HTMLButtonElement>)=>{if(disabled)return;event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);const startY=event.clientY;const start=valueRef.current;const move=(pointer:PointerEvent)=>{const next=clamp(start+(startY-pointer.clientY)/70);valueRef.current=next;onChange(next);};const stop=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",stop);onCommit();};window.addEventListener("pointermove",move);window.addEventListener("pointerup",stop);};
  const angle=value*118;return <button type="button" className="output-balance" disabled={disabled} onPointerDown={begin} onDoubleClick={(event)=>{event.stopPropagation();valueRef.current=0;onChange(0);queueMicrotask(onCommit);}} style={{"--balance-angle":`${angle}deg`} as React.CSSProperties} title="Balanço do par · arraste para atenuar um lado · duplo clique centraliza"><i/><span>L</span><b>BAL</b><span>R</span></button>;
}

function VuMeters({ meters, channels, selected }: { meters: MeterData; channels: OutputChannel[]; selected: number }) {
  const ticks = [-96, -72, -48, -24, -12, 0, 6];
  const rows = (values: number[], peaks: number[], prefix: string, count: number) => Array.from({ length: count }, (_, index) => {
    const rms = values[index] ?? -120;
    const peak = peaks[index] ?? -120;
    return <div className={`vu-row ${prefix === "OUT" && index === selected ? "selected" : ""}`} key={`${prefix}-${index}`}>
      <b>{index}</b><div className="vu-track"><i style={{ width: `${levelPercent(rms)}%` }} /><span style={{ left: `${levelPercent(peak)}%` }} /></div><em>{peak > -100 ? peak.toFixed(0) : "−∞"}</em>
    </div>;
  });
  return <section className="vu-panel" aria-label="Medidores de entrada e saída">
    <div className="vu-title"><b>VU · RMS / PEAK</b><span className={meters.status&&meters.status!=="RUNNING"?"paused":""}>{meters.status&&meters.status!=="RUNNING"?`${meters.status} · SEM STREAM`:Number.isFinite(meters.load) ? `DSP ${Number(meters.load).toFixed(1)}%` : "aguardando"}</span></div>
    <div className="vu-group"><small>IN</small><div className="vu-scale">{ticks.map((tick) => <span key={tick}>{tick}</span>)}</div>{rows(meters.captureRms, meters.capturePeak, "IN", 2)}</div>
    <div className="vu-group"><small>OUT</small><div className="vu-scale">{ticks.map((tick) => <span key={tick}>{tick}</span>)}</div>{rows(meters.playbackRms, meters.playbackPeak, "OUT", channels.length)}</div>
  </section>;
}

function SpectrumGraph({ filters, channel, spectrum, activeId, channelGain, channelGainActive, onActivate, onChange, onCommit }: {
  filters: UiFilter[]; channel: OutputChannel; spectrum: SpectrumData; activeId: string; channelGain: number; channelGainActive: boolean;
  onActivate: (id: string) => void; onChange: (id: string, values: Partial<UiFilter>) => void; onCommit: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const draw = () => {
      const rect = canvas.getBoundingClientRect(); const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) { canvas.width = Math.floor(rect.width * dpr); canvas.height = Math.floor(rect.height * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = rect.width; const h = rect.height; const top = 18; const bottom = h - 34; const graphH = bottom - top;
      ctx.clearRect(0, 0, w, h);
      const gradient = ctx.createLinearGradient(0, top, 0, bottom); gradient.addColorStop(0, "rgba(18,35,46,.2)"); gradient.addColorStop(1, "rgba(3,8,12,.4)"); ctx.fillStyle = gradient; ctx.fillRect(0, top, w, graphH);
      ctx.font = "10px var(--font-geist-mono)"; ctx.textBaseline = "top";
      const logTicks:number[]=[];for(const decade of [10,100,1000,10000])for(let multiple=1;multiple<=9;multiple++){const freq=decade*multiple;if(freq>=20&&freq<=20000)logTicks.push(freq);}
      const labeledTicks=new Set([20,50,100,200,500,1000,2000,5000,10000,20000]);
      logTicks.forEach((freq)=>{const x=Math.min(w-.5,Math.max(.5,freqToX(freq)*w));const decade=freq===100||freq===1000||freq===10000;const boundary=freq===20||freq===20000;ctx.strokeStyle=decade?"rgba(151,187,201,.24)":boundary?"rgba(151,187,201,.17)":"rgba(134,167,181,.065)";ctx.lineWidth=decade?1.15:1;ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.stroke();if(labeledTicks.has(freq)){const label=freq>=1000?`${freq/1000}k`:String(freq);const labelWidth=ctx.measureText(label).width;const labelX=Math.max(2,Math.min(w-labelWidth-2,x-labelWidth/2));ctx.fillStyle=decade?"rgba(190,215,224,.72)":"rgba(171,196,207,.48)";ctx.fillText(label,labelX,bottom+10);}});ctx.lineWidth=1;
      [20,12,6,0,-6,-12,-24,-40].forEach((db) => { const y = top + gainToY(db) * graphH; ctx.strokeStyle = db === 0 ? "rgba(187,218,225,.24)" : "rgba(134,167,181,.08)"; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); ctx.fillStyle = "rgba(171,196,207,.45)"; ctx.fillText(`${db>0?"+":""}${db}`,8,Math.max(2,y-13)); });
      const spectrumY=(db:number)=>top+(-6-Math.max(-96,Math.min(-6,db)))/90*graphH;
      [-20,-40,-60,-80].forEach((db)=>{const y=spectrumY(db);ctx.fillStyle="rgba(171,196,207,.34)";const label=`${db} dBFS`;ctx.fillText(label,w-ctx.measureText(label).width-8,Math.max(2,y-13));});
      const points: Array<[number,number]> = [];
      if(spectrum.online&&spectrum.bins.length>1){for(let px=0;px<=w;px+=3){const position=px/w*(spectrum.bins.length-1);const left=Math.floor(position);const mix=position-left;const db=(spectrum.bins[left]??-96)*(1-mix)+(spectrum.bins[Math.min(spectrum.bins.length-1,left+1)]??-96)*mix;points.push([px,spectrumY(db)]);}}
      if(points.length){const fill=ctx.createLinearGradient(0,top,0,bottom); fill.addColorStop(0,`${channel.color}55`); fill.addColorStop(.55,`${channel.color}16`); fill.addColorStop(1,`${channel.color}00`); ctx.beginPath(); points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)); ctx.lineTo(w,bottom);ctx.lineTo(0,bottom);ctx.closePath();ctx.fillStyle=fill;ctx.fill(); ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=channel.color;ctx.globalAlpha=channel.muted?.24:.84;ctx.lineWidth=1.5;ctx.stroke();ctx.globalAlpha=1;}
      const trimY=top+gainToY(Math.max(-40,Math.min(20,channelGain)))*graphH;ctx.strokeStyle="#ffabc0";ctx.globalAlpha=channelGainActive?.96:.36;ctx.lineWidth=channelGainActive?2.5:1.15;if(channelGainActive){ctx.shadowColor="#ffabc0";ctx.shadowBlur=12;}ctx.beginPath();ctx.moveTo(0,trimY);ctx.lineTo(w,trimY);ctx.stroke();ctx.shadowBlur=0;ctx.globalAlpha=1;
      filters.filter(hasCurve).forEach((filter)=>{ctx.beginPath();for(let px=0;px<=w;px+=2){const f=xToFreq(px/w);const y=top+gainToY(Math.max(-40,Math.min(20,responseAt(filter,f))))*graphH;if(px===0)ctx.moveTo(px,y);else ctx.lineTo(px,y);}const selected=filter.id===activeId;ctx.strokeStyle=filter.color;ctx.globalAlpha=selected?1:.18;ctx.lineWidth=selected?3:1.4;if(selected){ctx.shadowColor=filter.color;ctx.shadowBlur=12;}ctx.stroke();ctx.shadowBlur=0;ctx.globalAlpha=1;});
    };
    draw();const observer=new ResizeObserver(draw);observer.observe(canvas);return()=>observer.disconnect();
  },[filters,activeId,channel,spectrum,channelGain,channelGainActive]);

  const startDrag=(event:React.PointerEvent<HTMLButtonElement>,filter:UiFilter)=>{event.currentTarget.setPointerCapture(event.pointerId);const canvas=canvasRef.current;if(!canvas)return;const startX=event.clientX;const startY=event.clientY;const startFreq=filter.freq??1000;const startGain=filter.gain??0;const move=(e:PointerEvent)=>{const rect=canvas.getBoundingClientRect();const octaves=(e.clientX-startX)/Math.max(1,rect.width)*Math.log2(20000/20);const values:Partial<UiFilter>={freq:Math.round(Math.max(20,Math.min(20000,startFreq*2**octaves)))};if(filter.kind==="PEQ"||filter.kind==="SHELF"){const gain=Math.max(-20,Math.min(20,startGain+(startY-e.clientY)*60/Math.max(1,rect.height-52)));values.gain=Math.round(gain*10)/10;}onChange(filter.id,values);};const stop=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",stop);onCommit();};window.addEventListener("pointermove",move);window.addEventListener("pointerup",stop);};
  const activeGeq=filters.find((filter)=>filter.id===activeId&&filter.kind==="GEQ");
  const startGeqDrag=(event:React.PointerEvent<HTMLButtonElement>,filter:UiFilter,index:number)=>{event.currentTarget.setPointerCapture(event.pointerId);const canvas=canvasRef.current;if(!canvas)return;const startY=event.clientY;const startGain=filter.bands?.[index]??0;const move=(e:PointerEvent)=>{const rect=canvas.getBoundingClientRect();const gain=Math.round(Math.max(-20,Math.min(20,startGain+(startY-e.clientY)*60/Math.max(1,rect.height-52)))*10)/10;const bands=[...(filter.bands??[])];bands[index]=gain;onChange(filter.id,{bands});};const stop=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",stop);onCommit();};window.addEventListener("pointermove",move);window.addEventListener("pointerup",stop);};
  return <div className="spectrum-stage"><canvas ref={canvasRef} aria-label={`Espectro da saída ${channel.output} e curvas do YAML`} />{filters.filter((filter)=>hasNode(filter)&&filter.id===activeId).map((filter)=>{const frequency=filter.freq??1000;const nodeGain=responseAt(filter,frequency);return <button key={filter.id} className="filter-node active" style={{left:`${freqToX(frequency)*100}%`,top:gainToGraphTop(nodeGain),"--node-color":filter.color} as React.CSSProperties} onPointerDown={(event)=>{onActivate(filter.id);startDrag(event,filter);}} aria-label={`${filter.yamlName}, ${formatFreq(frequency)} Hz; selecionar e arrastar`}><span>{formatFreq(frequency)}</span></button>;})}{activeGeq&&geqCenters(activeGeq).map((center,index)=><button key={`geq-${index}`} className="geq-node" style={{left:`${freqToX(center)*100}%`,top:gainToGraphTop(responseAt(activeGeq,center)),"--node-color":activeGeq.color} as React.CSSProperties} onPointerDown={(event)=>startGeqDrag(event,activeGeq,index)} onDoubleClick={(event)=>{event.stopPropagation();const bands=[...(activeGeq.bands??[])];bands[index]=0;onChange(activeGeq.id,{bands});queueMicrotask(onCommit);}} title="Arraste verticalmente · duplo clique retorna a 0 dB" aria-label={`Banda ${index+1}, ${formatFreq(center)} Hz, ${activeGeq.bands?.[index]??0} dB`}><span>{formatFreq(center)}</span></button>)}</div>;
}

function FilterControls({ filter, rawFilter, coeffs, onChange, onPatch, onCommit, onUpload }: { filter: UiFilter; rawFilter: import("./camilla-model").RawFilter; coeffs: CoeffFile[]; onChange: (values: Partial<UiFilter>) => void; onPatch: (parameters:Record<string,unknown>)=>void; onCommit: () => void; onUpload:(file:File)=>Promise<void> }) {
  const commitChange=(values:Partial<UiFilter>)=>{onChange(values);queueMicrotask(onCommit);};
  if(filter.kind==="GEQ"){
    const centers=geqCenters(filter);const bands=filter.bands??[];
    return <div className="geq-wrap"><div className="geq-fields"><label><span>FREQ. MÍNIMA</span><div className="value-input"><input type="number" value={filter.freqMin} onChange={(e)=>onChange({freqMin:Number(e.target.value)})} onBlur={onCommit}/><b>Hz</b></div></label><label><span>FREQ. MÁXIMA</span><div className="value-input"><input type="number" value={filter.freqMax} onChange={(e)=>onChange({freqMax:Number(e.target.value)})} onBlur={onCommit}/><b>Hz</b></div></label></div><div className="geq-editor">{bands.map((gain,index)=><label key={`${centers[index]}-${index}`}><b>{gain>0?"+":""}{gain.toFixed(1)}</b><input type="range" min="-20" max="20" step=".1" value={gain} title="Duplo clique retorna esta banda a 0 dB" onChange={(e)=>{const next=[...bands];next[index]=Number(e.target.value);onChange({bands:next});}} onDoubleClick={(event)=>{event.stopPropagation();const next=[...bands];next[index]=0;commitChange({bands:next});}} onPointerUp={onCommit} onBlur={onCommit}/><span>{formatFreq(centers[index])}</span></label>)}<div className="geq-actions"><button onClick={()=>commitChange({bands:[...bands,0]})}>＋ BANDA</button><button disabled={bands.length<=1} onClick={()=>commitChange({bands:bands.slice(0,-1)})}>− BANDA</button></div></div><div className="geq-note">Os pontos no espectro correspondem às bandas e podem ser arrastados verticalmente. Duplo clique no slider ou no ponto retorna a banda a 0 dB. O CamillaDSP calcula automaticamente a largura/Q a partir do intervalo e da quantidade de bandas.</div></div>;
  }
  return <CatalogFilterEditor filter={rawFilter} coeffs={coeffs} onPatch={onPatch} onCommit={onCommit} onUpload={onUpload}/>;
}

export default function Home(){
  const [config,setConfig]=useState<CamillaConfig>(fallbackConfig);const configRef=useRef(config);
  const [channelId,setChannelId]=useState("ch0");const [activeId,setActiveId]=useState("fh_hp300");
  const [meters,setMeters]=useState<MeterData>({captureRms:[],capturePeak:[],playbackRms:[],playbackPeak:[]});
  const [spectrum,setSpectrum]=useState<SpectrumData>({channel:0,bins:[],rateHz:2,online:false});
  const [masterVolume,setMasterVolume]=useState(-16);const [masterMute,setMasterMute]=useState(false);const [dimmed,setDimmed]=useState(false);const preDimVolumeRef=useRef(-16);const volumeEditingRef=useRef(false);const dimTargetRef=useRef<number|null>(null);
  const [storedConfigs,setStoredConfigs]=useState<StoredProfile[]>([]);const [loadedConfigName,setLoadedConfigName]=useState("");const [configBusy,setConfigBusy]=useState(false);const [profileNotice,setProfileNotice]=useState<{kind:"success"|"error";text:string}|null>(null);
  const [coeffFiles,setCoeffFiles]=useState<CoeffFile[]>([]);const [creatorOpen,setCreatorOpen]=useState(false);const [routingOpen,setRoutingOpen]=useState(false);const [profileOpen,setProfileOpen]=useState(false);const [settingsOpen,setSettingsOpen]=useState(false);const [patchbayOpen,setPatchbayOpen]=useState(false);const [focusOutput,setFocusOutput]=useState<number|null>(null);const [linkedPairs,setLinkedPairs]=useState<Array<[number,number]>>([]);const [pairBalances,setPairBalances]=useState<Record<string,number>>({});const [gainEditingOutput,setGainEditingOutput]=useState<number|null>(null);
  const [liveState,setLiveState]=useState<LiveState>("connecting");const [unsaved,setUnsaved]=useState(false);const [,setMessage]=useState("Conectando ao CamillaDSP…");
  const channels=useMemo(()=>buildOutputChannels(config),[config]);
  const channel=channels.find((item)=>item.id===channelId)??channels[0];
  const filters=useMemo(()=>channel.filterNames.map((name)=>config.filters[name]?toUiFilter(name,config.filters[name]):null).filter((item):item is UiFilter=>Boolean(item)),[channel,config]);
  const active=filters.find((filter)=>filter.id===activeId)??filters[0];
  const usedBy=channels.filter((item)=>active&&item.filterNames.includes(active.id)).map((item)=>item.short);
  const mixerStates=useMemo(()=>channels.map((item)=>outputMixerState(config,item.output)),[channels,config]);
  const railChannels=useMemo(()=>{const linked=new Set(linkedPairs.flat());const result:Array<{primary:OutputChannel;pair?:OutputChannel}>=[];for(const item of channels){const pair=linkedPairs.find(([left,right])=>left===item.output||right===item.output);if(pair){if(pair[0]!==item.output)continue;const secondary=channels.find((candidate)=>candidate.output===pair[1]);result.push({primary:item,pair:secondary});}else if(!linked.has(item.output))result.push({primary:item});}return result;},[channels,linkedPairs]);

  useEffect(()=>{let cancelled=false;Promise.all([
    fetch("/api/getconfig",{cache:"no-store"}).then((response)=>{if(!response.ok)throw new Error("offline");return response.json();}),
    fetch("/api/getparam/volume",{cache:"no-store"}).then((response)=>response.text()),
    fetch("/api/getparam/mute",{cache:"no-store"}).then((response)=>response.text()),
    fetch("/api/getactiveconfigfile",{cache:"no-store"}).then((response)=>{if(!response.ok)throw new Error("perfil ativo indisponível");return response.json() as Promise<{configFileName?:string}>;}),
    fetch("/api/getparam/updateinterval",{cache:"no-store"}).then((response)=>response.text()),
  ]).then(([loaded,volume,mute,activeInfo,updateInterval]:[CamillaConfig,string,string,{configFileName?:string},string])=>{if(cancelled)return;configRef.current=loaded;setConfig(loaded);const parsedVolume=Number(volume);if(Number.isFinite(parsedVolume)){setMasterVolume(parsedVolume);preDimVolumeRef.current=parsedVolume;}setMasterMute(mute.trim().toLowerCase()==="true");setLoadedConfigName(activeInfo.configFileName||"perfil-em-memória.yml");if(Number(updateInterval)>100)void fetch("/api/setparam/updateinterval",{method:"POST",headers:{"Content-Type":"text/plain"},body:"100"});setLiveState("live");setMessage("Configuração ativa lida do CamillaDSP");}).catch(()=>{if(cancelled)return;setLiveState("demo");setMessage("Demonstração: backend do Pi não está neste endereço");});return()=>{cancelled=true;};},[]);
  useEffect(()=>{let cancelled=false;fetchStoredProfiles().then((available)=>{if(!cancelled)setStoredConfigs(available);}).catch((error)=>{if(!cancelled)setProfileNotice({kind:"error",text:`Falha ao atualizar perfis: ${error instanceof Error?error.message:"erro desconhecido"}`});});return()=>{cancelled=true;};},[profileOpen]);
  useEffect(()=>{if(!profileNotice)return;const timer=window.setTimeout(()=>setProfileNotice(null),12000);return()=>window.clearTimeout(timer);},[profileNotice]);
  useEffect(()=>{let cancelled=false;fetch("/api/storedcoeffs",{cache:"no-store"}).then((response)=>response.json() as Promise<CoeffFile[]>).then((available)=>{if(!cancelled)setCoeffFiles(available);}).catch(()=>{});return()=>{cancelled=true;};},[]);
  useEffect(()=>{try{const saved=window.localStorage.getItem("camilla-control-linked-pairs");if(saved){const parsed=JSON.parse(saved) as unknown;if(Array.isArray(parsed))setLinkedPairs(parsed.filter((item):item is [number,number]=>Array.isArray(item)&&item.length===2&&item.every(Number.isInteger)));}}catch{}},[]);
  useEffect(()=>{window.localStorage.setItem("camilla-control-linked-pairs",JSON.stringify(linkedPairs));},[linkedPairs]);
  useEffect(()=>{let cancelled=false;let timer:number;const poll=async()=>{let delay=250;try{const response=await fetch("/api/getparamjson/faders",{cache:"no-store"});if(!response.ok)throw new Error("offline");const faders=await response.json() as Array<{volume?:number;mute?:boolean}>;const main=faders[0];const incoming=Number(main?.volume);if(!cancelled&&main){setMasterMute(Boolean(main.mute));if(Number.isFinite(incoming)&&!volumeEditingRef.current){setMasterVolume(incoming);const expectedDim=dimTargetRef.current;if(expectedDim===null){preDimVolumeRef.current=incoming;}else if(Math.abs(incoming-expectedDim)>.05){dimTargetRef.current=null;preDimVolumeRef.current=incoming;setDimmed(false);}}}}catch{delay=1200;}if(!cancelled)timer=window.setTimeout(poll,delay);};poll();return()=>{cancelled=true;window.clearTimeout(timer);};},[]);
  useEffect(()=>{let cancelled=false;let timer:number;const poll=async()=>{let delay=75;try{const response=await fetch("/api/status",{cache:"no-store"});if(!response.ok)throw new Error("offline");const data=await response.json();if(!cancelled){setMeters({captureRms:data.capturesignalrms??[],capturePeak:data.capturesignalpeak??[],playbackRms:data.playbacksignalrms??[],playbackPeak:data.playbacksignalpeak??[],load:data.processingload,status:data.cdsp_status});setLiveState((state)=>state==="connecting"?"live":state);}}catch{delay=1200;}if(!cancelled)timer=window.setTimeout(poll,delay);};poll();return()=>{cancelled=true;window.clearTimeout(timer);};},[]);
  useEffect(()=>{let cancelled=false;let timer:number;setSpectrum({channel:channel.output,bins:[],rateHz:15,online:false});const poll=async()=>{let delay=67;try{const response=await fetch(`/api/spectrum?channel=${channel.output}`,{cache:"no-store"});if(!response.ok)throw new Error("offline");const data=await response.json();if(!cancelled)setSpectrum({channel:data.channel,bins:Array.isArray(data.bins)?data.bins:[],rateHz:Number(data.rate_hz)||15,online:!data.error&&Number(data.updated)>0,error:data.error});}catch(error){delay=1500;if(!cancelled)setSpectrum((current)=>({...current,online:false,error:error instanceof Error?error.message:"offline"}));}if(!cancelled)timer=window.setTimeout(poll,delay);};poll();return()=>{cancelled=true;window.clearTimeout(timer);};},[channel.output]);

  const selectChannel=(id:string)=>{setChannelId(id);const nextChannel=channels.find((item)=>item.id===id);const preferred=nextChannel?.filterNames.find((name)=>["HPF","LPF","GEQ"].includes(toUiFilter(name,config.filters[name]).kind))??nextChannel?.filterNames[0];if(preferred)setActiveId(preferred);};
  const updateFilter=(id:string,values:Partial<UiFilter>)=>{const next=patchFilter(configRef.current,id,values);configRef.current=next;setConfig(next);setUnsaved(true);};
  const updateOutputGain=(output:number,gain:number)=>{const next=patchOutputMixer(configRef.current,output,{gain});configRef.current=next;setConfig(next);setUnsaved(true);};
  const pairKey=(pair:[number,number])=>`${pair[0]}-${pair[1]}`;
  const updatePairGain=(pair:[number,number],gain:number,balance:number)=>{let next=patchOutputMixer(configRef.current,pair[0],{gain:gain-Math.max(0,balance)*20,mute:balance>=1});next=patchOutputMixer(next,pair[1],{gain:gain-Math.max(0,-balance)*20,mute:balance<=-1});configRef.current=next;setConfig(next);setUnsaved(true);};
  const updatePairBalance=(pair:[number,number],balance:number,gain:number)=>{setPairBalances((current)=>({...current,[pairKey(pair)]:balance}));updatePairGain(pair,gain,balance);};
  const commitLive=async()=>{if(liveState==="demo"){setMessage("Alteração mantida no protótipo; abra a versão hospedada no Pi para aplicar ao DSP");return;}setLiveState("applying");setMessage("Validando e aplicando ao CamillaDSP…");try{const liveConfig=await fetch("/api/getconfig",{cache:"no-store"}).then((response)=>{if(!response.ok)throw new Error("não foi possível confirmar os dispositivos ativos");return response.json() as Promise<CamillaConfig>;});const candidate={...configRef.current,devices:liveConfig.devices};configRef.current=candidate;setConfig(candidate);const validation=await fetch("/api/validateconfig",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(candidate)});if(!validation.ok)throw new Error(await validation.text());const apply=await fetch("/api/setconfig",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({config:candidate})});if(!apply.ok)throw new Error(await apply.text());setLiveState("live");setMessage("Aplicado ao CamillaDSP · dispositivos ativos preservados · ainda não salvo no YAML");}catch(error){setLiveState("error");setMessage(`Falha ao aplicar: ${error instanceof Error?error.message:"erro desconhecido"}`);}};
  const toggleOutputMute=(output:number,mute:boolean)=>{const next=patchOutputMixer(configRef.current,output,{mute});configRef.current=next;setConfig(next);setUnsaved(true);if(!mute&&focusOutput===output)setFocusOutput(null);queueMicrotask(()=>void commitLive());};
  const toggleChannelFocus=(outputs:number[])=>{const removing=focusOutput===outputs[0];let next=configRef.current;for(const item of channels)next=patchOutputMixer(next,item.output,{mute:removing?false:!outputs.includes(item.output)});configRef.current=next;setConfig(next);setFocusOutput(removing?null:outputs[0]);setUnsaved(true);queueMicrotask(()=>void commitLive());};
  const setMasterParam=async(name:"volume"|"mute",value:number|boolean)=>{if(liveState==="demo")return;try{const response=await fetch(`/api/setparam/${name}`,{method:"POST",headers:{"Content-Type":"text/plain"},body:String(value)});if(!response.ok)throw new Error(await response.text());setMessage(`${name==="volume"?"Volume principal":"Mute principal"} aplicado ao CamillaDSP`);}catch(error){setLiveState("error");setMessage(`Falha no controle principal: ${error instanceof Error?error.message:"erro desconhecido"}`);}};
  const toggleMute=()=>{const next=!masterMute;setMasterMute(next);void setMasterParam("mute",next);};
  const commitMasterVolume=async(value:number)=>{await setMasterParam("volume",value);volumeEditingRef.current=false;};
  const toggleDim=()=>{const next=!dimmed;let target:number;if(next){preDimVolumeRef.current=masterVolume;target=Math.max(-120,masterVolume-20);dimTargetRef.current=target;}else{target=preDimVolumeRef.current;dimTargetRef.current=null;}setDimmed(next);setMasterVolume(target);volumeEditingRef.current=true;void commitMasterVolume(target);};
  const applyConfigObject=async(next:CamillaConfig)=>{const validation=await fetch("/api/validateconfig",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(next)});if(!validation.ok)throw new Error(await validation.text());const apply=await fetch("/api/setconfig",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({config:next})});if(!apply.ok)throw new Error(await apply.text());configRef.current=next;setConfig(next);};
  const applySystemSettings=async(next:CamillaConfig)=>{setLiveState("applying");setMessage("Validando interfaces e reiniciando a configuração do DSP…");try{await applyConfigObject(next);setUnsaved(true);setLiveState("live");setMessage("Interfaces e identificação aplicadas · ainda não salvas no YAML");}catch(error){setLiveState("error");setMessage(`Falha nas interfaces: ${error instanceof Error?error.message:"erro desconhecido"}`);throw error;}};
  const applyPatchbayDraft=async(next:CamillaConfig)=>{if(liveState==="demo")throw new Error("O backend do DSP não está disponível para validar o Patchbay.");setLiveState("applying");setMessage("Validando e aplicando o rascunho do Patchbay…");try{const live=await fetch("/api/getconfig",{cache:"no-store"}).then((response)=>{if(!response.ok)throw new Error("não foi possível reler os dispositivos ativos");return response.json() as Promise<CamillaConfig>;});const candidate={...next,devices:live.devices};await applyConfigObject(candidate);const confirmation=await fetch("/api/getconfig",{cache:"no-store"});if(!confirmation.ok)throw new Error("o DSP não confirmou a configuração aplicada");const confirmed=await confirmation.json() as CamillaConfig;configRef.current=confirmed;setConfig(confirmed);setUnsaved(true);setLiveState("live");setMessage("Patchbay aplicado e confirmado no DSP · ainda não salvo no YAML");return confirmed;}catch(error){setLiveState("error");setMessage(`Falha no Patchbay: ${error instanceof Error?error.message:"erro desconhecido"}`);throw error;}};
  const uploadCoeff=async(file:File)=>{const body=new FormData();body.append("file0",file,file.name);const response=await fetch("/api/uploadcoeffs",{method:"POST",body});if(!response.ok)throw new Error(await response.text());const refreshed=await fetch("/api/storedcoeffs",{cache:"no-store"}).then((item)=>item.json() as Promise<CoeffFile[]>);setCoeffFiles(refreshed);setMessage(`${file.name} enviado para os coeficientes do Pi`);};
  const applyStructural=async(next:CamillaConfig,success:string,nextActive?:string)=>{setLiveState("applying");setMessage("Validando estrutura e pipeline…");try{await applyConfigObject(next);setUnsaved(true);setLiveState("live");setMessage(`${success} · ainda não salvo no YAML`);if(nextActive)setActiveId(nextActive);}catch(error){setLiveState("error");setMessage(`Falha estrutural: ${error instanceof Error?error.message:"erro desconhecido"}`);throw error;}};
  const createCatalogFilter=async({template,values,name,description,channels:targets,copies}:{template:FilterTemplate;values:FilterValues;name:string;description:string;channels:number[];copies:boolean})=>{let candidate=configRef.current;let firstName=name;if(copies){for(const output of targets){const label=channels.find((item)=>item.output===output)?.short??`out${output}`;let candidateName=`${name}_${label.toLowerCase().replace(/[^a-z0-9]+/g,"_")}`;let serial=2;while(candidate.filters[candidateName])candidateName=`${name}_${serial++}`;if(firstName===name)firstName=candidateName;candidate=addFilterToConfig(candidate,candidateName,rawFilterFromTemplate(template,values,description),[output]);}}else candidate=addFilterToConfig(candidate,name,rawFilterFromTemplate(template,values,description),targets);await applyStructural(candidate,`${copies?targets.length:"1"} filtro${copies&&targets.length!==1?"s":""} implantado${copies&&targets.length!==1?"s":""}`,firstName);};
  const duplicateActive=async()=>{if(!active)return;let name=`${active.id}_copy`;let serial=2;while(configRef.current.filters[name])name=`${active.id}_copy${serial++}`;const raw=structuredClone(configRef.current.filters[active.id]);const targets=filterChannels(configRef.current,active.id);await applyStructural(addFilterToConfig(configRef.current,name,raw,targets.length?targets:[channel.output]),`${active.id} duplicado como ${name}`,name);};
  const routeActive=async(targets:number[])=>{if(!active)return;await applyStructural(routeFilterInConfig(configRef.current,active.id,targets),`${active.id} roteado para ${targets.length} canal${targets.length===1?"":"is"}`,active.id);};
  const bypassActive=async()=>{if(!active)return;const next=toggleFilterBypass(configRef.current,active.id);await applyStructural(next,`${active.id} ${filterIsBypassed(next,active.id)?"em bypass":"ativado"}`,active.id);};
  const moveActive=async(direction:-1|1)=>{if(!active)return;await applyStructural(moveFilterStep(configRef.current,active.id,direction),`${active.id} reordenado`,active.id);};
  const deleteActive=async()=>{if(!active||!window.confirm(`Remover ${active.id} do pipeline e excluir sua definição?`))return;const next=removeFilterFromConfig(configRef.current,active.id);const nextChannel=buildOutputChannels(next).find((item)=>item.id===channelId);const nextActive=nextChannel?.filterNames[0];await applyStructural(next,`${active.id} removido`,nextActive);};
  const fetchConfigFile=async(name:string)=>{const response=await fetch(`/api/getconfigfile?name=${encodeURIComponent(name)}`,{cache:"no-store"});if(!response.ok)throw new Error(await response.text());return response.json() as Promise<CamillaConfig>;};
  const saveCurrentConfig=async()=>{if(liveState==="demo"||configBusy||!unsaved)return;setConfigBusy(true);setMessage(`Salvando ${loadedConfigName}…`);try{const validation=await fetch("/api/validateconfig",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(configRef.current)});if(!validation.ok)throw new Error(await validation.text());const previous=await fetchConfigFile(loadedConfigName);const stamp=new Date().toISOString().replace(/[:.]/g,"-");const backupName=`${loadedConfigName}.backup-${stamp}`;const backup=await fetch("/api/saveconfigfile",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({filename:backupName,config:previous})});if(!backup.ok)throw new Error(`backup: ${await backup.text()}`);const save=await fetch("/api/saveconfigfile",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({filename:loadedConfigName,config:configRef.current})});if(!save.ok)throw new Error(await save.text());setUnsaved(false);setLiveState("live");setMessage(`${loadedConfigName} salvo · backup ${backupName}`);}catch(error){setLiveState("error");setMessage(`Falha ao salvar YAML: ${error instanceof Error?error.message:"erro desconhecido"}`);}finally{setConfigBusy(false);}};
  const loadStoredConfig=async(name:string)=>{if(liveState==="demo")throw new Error("O backend do DSP não está disponível.");if(configBusy||name===loadedConfigName)return false;if(!storedConfigs.some((item)=>item.name===name))throw new Error(`${name} não existe mais no diretório de configurações.`);if(unsaved&&!window.confirm(`Existem alterações não salvas em ${loadedConfigName}. Carregar ${name} descartará essas alterações da tela.`))return false;setConfigBusy(true);setProfileNotice(null);setLiveState("applying");setMessage(`Carregando e validando ${name}…`);try{const stored=await fetchConfigFile(name);const next=ensureSpectrumInfrastructure(stored);if(stored.devices.playback.device!=="camilla_tee"||stored.devices.playback.channels!==6){const stamp=new Date().toISOString().replace(/[:.]/g,"-");const backupName=`${name}.backup-infrastructure-${stamp}`;const backup=await fetch("/api/saveconfigfile",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({filename:backupName,config:stored})});if(!backup.ok)throw new Error(`backup: ${await backup.text()}`);const save=await fetch("/api/saveconfigfile",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({filename:name,config:next})});if(!save.ok)throw new Error(`infraestrutura: ${await save.text()}`);}await applyConfigObject(next);const activate=await fetch("/api/setactiveconfigfile",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name})});if(!activate.ok)throw new Error(`perfil ativo: ${await activate.text()}`);const confirmation=await fetch("/api/getactiveconfigfile",{cache:"no-store"});if(!confirmation.ok)throw new Error("o DSP aplicou a configuração, mas não confirmou o arquivo ativo");const activeInfo=await confirmation.json() as {configFileName?:string;config?:CamillaConfig};if(activeInfo.configFileName!==name)throw new Error(`o backend confirmou ${activeInfo.configFileName||"nenhum arquivo"}, não ${name}`);const confirmedConfig=activeInfo.config??next;configRef.current=confirmedConfig;setConfig(confirmedConfig);setLoadedConfigName(name);setStoredConfigs(await fetchStoredProfiles());setUnsaved(false);setLiveState("live");const success=`${name} carregado, confirmado no DSP e definido para edição`;setProfileNotice({kind:"success",text:success});setMessage(success);return true;}catch(error){setLiveState("error");const failure=`Falha ao carregar YAML: ${error instanceof Error?error.message:"erro desconhecido"}`;setProfileNotice({kind:"error",text:failure});setMessage(failure);throw error;}finally{setConfigBusy(false);}};
  const transferProfile=async(sourceName:string,destinationName:string,parts:TransferParts)=>{if(liveState==="demo"||configBusy)return;setConfigBusy(true);try{const [source,target]=await Promise.all([fetchConfigFile(sourceName),fetchConfigFile(destinationName)]);const candidate=transferProfileParts(source,target,parts);const validation=await fetch("/api/validateconfig",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(candidate)});if(!validation.ok)throw new Error(await validation.text());const stamp=new Date().toISOString().replace(/[:.]/g,"-");const backupName=`${destinationName}.backup-transfer-${stamp}`;const backup=await fetch("/api/saveconfigfile",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({filename:backupName,config:target})});if(!backup.ok)throw new Error(`backup: ${await backup.text()}`);const save=await fetch("/api/saveconfigfile",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({filename:destinationName,config:candidate})});if(!save.ok)throw new Error(`destino: ${await save.text()}`);if(destinationName===loadedConfigName){await applyConfigObject(candidate);setUnsaved(false);}setMessage(`Componentes transferidos de ${sourceName} para ${destinationName} · backup ${backupName}`);setStoredConfigs(await fetchStoredProfiles());}catch(error){setLiveState("error");setMessage(`Falha na transferência: ${error instanceof Error?error.message:"erro desconhecido"}`);throw error;}finally{setConfigBusy(false);}};
  const createProfile=async(sourceName:string|null,newName:string)=>{if(liveState==="demo"||configBusy)return;setConfigBusy(true);try{const available=await fetchStoredProfiles();if(available.some((item)=>item.name.toLowerCase()===newName.toLowerCase()))throw new Error(`${newName} já existe e não será sobrescrito.`);const candidate=sourceName?ensureSpectrumInfrastructure(structuredClone(await fetchConfigFile(sourceName))):{title:"Novo perfil CamillaDSP",description:"Perfil genérico: interfaces atuais, processamento ainda não configurado.",devices:structuredClone(configRef.current.devices),filters:{},mixers:{},pipeline:[]} as CamillaConfig;const validation=await fetch("/api/validateconfig",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(candidate)});if(!validation.ok)throw new Error(await validation.text());const save=await fetch("/api/saveconfigfile",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({filename:newName,config:candidate})});if(!save.ok)throw new Error(await save.text());setStoredConfigs(await fetchStoredProfiles());setLiveState("live");setMessage(sourceName?`${newName} criado a partir de ${sourceName} · o DSP continua em ${loadedConfigName}`:`${newName} criado como perfil genérico · o DSP continua em ${loadedConfigName}`);}catch(error){setLiveState("error");setMessage(`Falha ao criar perfil: ${error instanceof Error?error.message:"erro desconhecido"}`);throw error;}finally{setConfigBusy(false);}};
  const deleteProfile=async(name:string)=>{if(liveState==="demo"||configBusy)return;if(name===loadedConfigName)throw new Error("O perfil ativo não pode ser apagado.");setConfigBusy(true);try{const response=await fetch("/api/deleteconfigs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify([name])});if(!response.ok)throw new Error(await response.text());setStoredConfigs(await fetchStoredProfiles());setMessage(`${name} foi apagado. O DSP continua em ${loadedConfigName}.`);}catch(error){setLiveState("error");setMessage(`Falha ao apagar perfil: ${error instanceof Error?error.message:"erro desconhecido"}`);throw error;}finally{setConfigBusy(false);}};
  if(!active)return null;
  const selectedLinkedPair=linkedPairs.find(([left,right])=>left===channel.output||right===channel.output);
  const peakOutputs=selectedLinkedPair??[channel.output];
  const peak=Math.max(...peakOutputs.map((output)=>meters.playbackPeak[output]??-Infinity));
  const peakLabel=peakOutputs.join("+");
  const heroTitle=selectedLinkedPair?.map((output)=>channels.find((item)=>item.output===output)?.short??`OUT ${output}`).join(" + ")??channel.short;
  return <main className="app-shell">
    <header className="topbar"><div className="brand-mark"><span>CD</span></div><div className="brand-copy"><strong>Camilla Control</strong><small>{config.title||"DSP STACK · LIVE YAML MIRROR"}</small></div><div className="system-status"><a className="topbar-action topbar-automations" href="/gui/control/automations/index.html">AUTOMAÇÕES</a><button className="topbar-action topbar-profile" onClick={()=>setProfileOpen(true)}>GERENCIAR PERFIS</button><button className={`yaml-status topbar-yaml ${unsaved?"pending":""} ${profileNotice?"profile-confirmed":""}`} disabled={!unsaved||configBusy||liveState==="demo"} onClick={()=>void saveCurrentConfig()} title={unsaved?`Salvar todas as alterações em ${loadedConfigName}. Um backup será criado antes da gravação.`:`${loadedConfigName||"Perfil ativo"} já contém a configuração atual.`}><span>{configBusy&&unsaved?"SALVANDO…":unsaved?"SALVAR ALTERAÇÕES":"YAML SALVO"}</span><small>{loadedConfigName||"CARREGANDO PERFIL…"}</small></button><button className="topbar-action" onClick={()=>setPatchbayOpen(true)} title="Abrir Patchbay: mixers e pipeline">PATCHBAY</button><button className="topbar-action gear" onClick={()=>setSettingsOpen(true)} title="Configurar título, captura e playback" aria-label="Configurações">⚙</button><span className="topbar-telemetry"><span className={`topbar-spectrum ${spectrum.online?"online":""}`}>{spectrum.online?`REAL · ${spectrum.rateHz.toFixed(0)} Hz`:"AGUARDANDO TAP"}</span><span className="cpu">DSP <b>{meters.load?.toFixed(1)??"—"}%</b></span></span></div></header>
    <section className="workspace">
      <aside className="channel-rail">{railChannels.map(({primary:item,pair})=>{const mixer=mixerStates[item.output];const pairState=pair?mixerStates[pair.output]:undefined;const pairId=pair?[item.output,pair.output] as [number,number]:undefined;const balance=pairId?pairBalances[pairKey(pairId)]??0:0;const pairMuted=Boolean(pair&&item.muted&&pair.muted);const visibleMuted=pair?pairMuted:item.muted;const baseGain=pairId?Math.max(mixer?.gain??0,pairState?.gain??0):mixer?.gain??0;const selected=channelId===item.id||(pair?.id===channelId);return <div key={item.id} className={`channel-card ${pair?"is-linked":""} ${selected?"selected":""} ${visibleMuted?"is-muted":""}`} style={{"--channel-color":item.color} as React.CSSProperties}><button className="channel-select" onClick={()=>selectChannel(item.id)}><span className="channel-index">{item.output}{pair?` / ${pair.output}`:""}</span><span className="channel-details"><b>{pair?`${item.short} + ${pair.short}`:item.short}</b>{!pair&&<em>{item.range}</em>}</span></button><div className="channel-knobs">{pairId&&<OutputBalanceKnob value={balance} disabled={!mixer?.available||visibleMuted} onChange={(next)=>updatePairBalance(pairId,next,baseGain)} onCommit={commitLive}/>}<OutputGainKnob value={baseGain} color={item.color} disabled={!mixer?.available||visibleMuted} onChange={(gain)=>pairId?updatePairGain(pairId,gain,balance):updateOutputGain(item.output,gain)} onCommit={commitLive} onActiveChange={(isActive)=>setGainEditingOutput(isActive?item.output:null)}/></div><ChannelMiniMeter rms={meters.playbackRms[item.output]} peak={meters.playbackPeak[item.output]} label={item.short}/><div className="channel-quick-actions"><button className={`channel-mute ${visibleMuted?"muted":"live"}`} disabled={!mixer?.available} onClick={()=>{if(pairId){let next=configRef.current;for(const output of pairId)next=patchOutputMixer(next,output,{mute:!visibleMuted});configRef.current=next;setConfig(next);setUnsaved(true);queueMicrotask(()=>void commitLive());}else toggleOutputMute(item.output,!item.muted);}} aria-label={`${visibleMuted?"Desmutar":"Mutar"} ${item.short}`} title={`${visibleMuted?"Mutado · clique para ativar":"Ativo · clique para mutar"}`}><i/></button><button className={`channel-focus ${focusOutput===item.output?"engaged":""}`} disabled={!mixer?.available} onClick={()=>toggleChannelFocus(pairId?[...pairId]:[item.output])} aria-label={`${focusOutput===item.output?"Desfocar":"Focar"} ${item.short}`} title={focusOutput===item.output?"Foco ativo · clique para desmutar todos":"Foco · muta todos os outros canais"}>◎</button></div></div>;})}<VuMeters meters={meters} channels={channels} selected={channel.output}/></aside>
      <section className="main-panel">
        <div className="panel-heading">
          <div className="graph-context-tab">
            <div className="channel-hero" style={{"--channel-color":channel.color} as React.CSSProperties}><h1><i className="hero-signal"/>{heroTitle}</h1></div>
            <div className="output-level" title="Pico real do último bloco processado na saída selecionada, em dBFS, atualizado pelo CamillaDSP a cada 100 ms"><span>PEAK · OUT {peakLabel}</span><b>{peak>-100?`${peak.toFixed(1)} dB`:"−∞"}</b></div>
          </div>
          <div className="heading-actions">
            <label className="master-volume" title="Volume principal sincronizado com o CamillaDSP quatro vezes por segundo"><span>VOLUME · LIVE</span><input type="range" min="-60" max="6" step=".5" value={masterVolume} onPointerDown={()=>{volumeEditingRef.current=true;}} onKeyDown={()=>{volumeEditingRef.current=true;}} onChange={(event)=>{setMasterVolume(Number(event.target.value));dimTargetRef.current=null;setDimmed(false);}} onPointerUp={(event)=>void commitMasterVolume(Number(event.currentTarget.value))} onKeyUp={(event)=>void commitMasterVolume(Number(event.currentTarget.value))} onBlur={(event)=>{if(volumeEditingRef.current)void commitMasterVolume(Number(event.currentTarget.value));}} aria-label="Volume principal sincronizado ao vivo"/><b>{masterVolume.toFixed(1)} dB</b></label>
            <button className={masterMute?"engaged":""} onClick={toggleMute}>MUTE</button><button className={dimmed?"engaged dim":""} onClick={toggleDim}>DIM −20</button>
          </div>
        </div>
        <div className="graph-card graph-card-full"><SpectrumGraph filters={filters} channel={channel} spectrum={spectrum} activeId={active.id} channelGain={mixerStates[channel.output]?.gain??0} channelGainActive={gainEditingOutput===channel.output} onActivate={setActiveId} onChange={updateFilter} onCommit={commitLive}/></div>
        <div className="filter-strip"><button className="filter-card add-filter" onClick={()=>setCreatorOpen(true)}><span>＋</span><b>INSERIR FILTRO</b><small>catálogo CamillaDSP</small></button>{filters.map((filter,index)=>{const bypassed=filterIsBypassed(config,filter.id);return <button key={filter.id} className={`filter-card ${filter.id===active.id?"active":""} ${bypassed?"bypassed":""}`} style={{"--filter-color":filter.color} as React.CSSProperties} onClick={()=>setActiveId(filter.id)}><span className="filter-number">{String(index+1).padStart(2,"0")}</span><span className="filter-copy"><small>{filter.kind} · {filter.yamlName}</small><b>{filter.name}</b><em>{bypassed?"BYPASS · ":""}{filterSummary(filter)}</em></span><span className={`power ${bypassed?"":"on"}`}>●</span></button>})}</div>
        <section className={`control-deck ${active.kind==="GEQ"?"geq-deck":""}`} style={{"--active-color":active.color} as React.CSSProperties}><div className="deck-title"><span className="filter-tag">{active.kind}</span><div><small>EDITANDO AO VIVO · {active.yamlName}</small><h2>{active.name}</h2><em>Usado por: {usedBy.join(", ")||"nenhum canal final"}</em></div><div className="filter-tools"><button className="reorder" aria-label="Mover filtro para antes" title="Mover antes" onClick={()=>void moveActive(-1)}>←</button><button className="reorder" aria-label="Mover filtro para depois" title="Mover depois" onClick={()=>void moveActive(1)}>→</button><button title="Ativar ou colocar este filtro em bypass" onClick={()=>void bypassActive()}>{filterIsBypassed(config,active.id)?"ATIVAR":"BYPASS"}</button><button title="Escolher os canais que usam este filtro" onClick={()=>setRoutingOpen(true)}>ROTEAR</button><button title="Criar uma cópia independente" onClick={()=>void duplicateActive()}>DUPLICAR</button><button className="delete" title="Remover filtro do pipeline e do YAML em edição" onClick={()=>void deleteActive()}>EXCLUIR</button></div></div><FilterControls filter={active} rawFilter={config.filters[active.id]} coeffs={coeffFiles} onChange={(values)=>updateFilter(active.id,values)} onPatch={(parameters)=>updateFilter(active.id,{parameters})} onCommit={commitLive} onUpload={uploadCoeff}/></section>
      </section>
    </section>
    {creatorOpen&&<FilterCreator open currentChannel={channel.output} channels={channels} samplerate={config.devices.samplerate} existingNames={Object.keys(config.filters)} coeffs={coeffFiles} onClose={()=>setCreatorOpen(false)} onCreate={createCatalogFilter} onUpload={uploadCoeff}/>}
    {routingOpen&&<FilterRoutingDialog open filterName={active.id} channels={channels} assigned={filterChannels(config,active.id)} onClose={()=>setRoutingOpen(false)} onApply={routeActive}/>}
    {profileOpen&&<ProfileManager profiles={storedConfigs} activeName={loadedConfigName} unsaved={unsaved} busy={configBusy} onClose={()=>setProfileOpen(false)} onLoad={loadStoredConfig} onTransfer={transferProfile} onCreate={createProfile} onDelete={deleteProfile}/>}
    {settingsOpen&&<SettingsManager config={config} busy={configBusy||liveState==="applying"} linkedPairs={linkedPairs} onLinkedPairs={setLinkedPairs} onClose={()=>setSettingsOpen(false)} onApply={applySystemSettings}/>}
    {patchbayOpen&&<Patchbay open config={config} busy={liveState==="applying"||configBusy} onClose={()=>setPatchbayOpen(false)} onApply={applyPatchbayDraft}/>}
    {profileNotice&&<div className={`profile-toast ${profileNotice.kind==="error"?"error":""}`} role="status" aria-live="polite"><i>{profileNotice.kind==="error"?"!":"✓"}</i><span><b>{profileNotice.kind==="error"?"PERFIL NÃO CARREGADO":"PERFIL ATIVO ATUALIZADO"}</b><small>{profileNotice.text}</small></span></div>}
  </main>;
}
