"use client";

import { useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { OutputChannel, RawFilter } from "./camilla-model";
import {
  defaultValues,
  FILTER_FAMILIES,
  FILTER_TEMPLATES,
  FilterField,
  FilterTemplate,
  FilterValue,
  FilterValues,
  suggestFilterName,
  templateForRaw,
  validateTemplateValues,
  valuesForRaw,
} from "./filter-catalog";

type CoeffFile={name:string;size?:number;lastModified?:number};

function parseList(value:string) {
  return value.split(/[\s,;]+/).filter(Boolean).map(Number).filter(Number.isFinite);
}

const previewNumber=(values:FilterValues,key:string,fallback:number)=>typeof values[key]==="number"?Number(values[key]):fallback;
const previewClamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const previewX=(freq:number,maxFreq:number)=>34+(Math.log10(previewClamp(freq,20,maxFreq))-Math.log10(20))/(Math.log10(maxFreq)-Math.log10(20))*752;
const previewFreq=(x:number,maxFreq:number)=>10**(Math.log10(20)+previewClamp((x-34)/752,0,1)*(Math.log10(maxFreq)-Math.log10(20)));
const previewY=(gain:number)=>12+(24-previewClamp(gain,-30,24))/54*136;

function previewResponse(template:FilterTemplate,values:FilterValues,freq:number) {
  const subtype=(template.subtype??"").toLowerCase();
  const center=previewNumber(values,"freq",1000);
  const order=previewNumber(values,"order",subtype.endsWith("fo")?1:2);
  const linkwitzRiley=subtype.includes("linkwitzriley");
  const crossoverOrder=linkwitzRiley?Math.max(1,order/2):order;
  const crossoverStages=linkwitzRiley?2:1;
  if(subtype.includes("highpass"))return -10*crossoverStages*Math.log10(1+(center/freq)**(2*crossoverOrder));
  if(subtype.includes("lowpass"))return -10*crossoverStages*Math.log10(1+(freq/center)**(2*crossoverOrder));
  if(template.id==="gain")return previewNumber(values,"gain",0);
  if(template.id==="tilt")return previewNumber(values,"gain",0)*(Math.log10(freq)-Math.log10(632.5))/3;
  if(template.id==="loudness")return previewNumber(values,"low_boost",7)/(1+(freq/180)**3)+previewNumber(values,"high_boost",7)/(1+(3500/freq)**3);
  if(template.id==="geq"){
    const gains=Array.isArray(values.gains)?values.gains:[];if(!gains.length)return 0;
    const low=previewNumber(values,"freq_min",20);const high=previewNumber(values,"freq_max",20000);
    const position=previewClamp(Math.log(previewClamp(freq,low,high)/low)/Math.log(high/low)*gains.length-.5,0,gains.length-1);
    const left=Math.floor(position);const mix=position-left;return Number(gains[left]??0)*(1-mix)+Number(gains[Math.min(gains.length-1,left+1)]??0)*mix;
  }
  if(template.id==="five-peq"){
    const bell=(f:number,g:number,q:number)=>g*Math.exp(-.5*(Math.log(freq/f)*Math.max(.25,q)/.72)**2);
    const low=previewNumber(values,"gls",0)/(1+(freq/previewNumber(values,"fls",80))**3);
    const high=previewNumber(values,"ghs",0)/(1+(previewNumber(values,"fhs",10000)/freq)**3);
    return low+high+bell(previewNumber(values,"fp1",200),previewNumber(values,"gp1",0),previewNumber(values,"qp1",1))+bell(previewNumber(values,"fp2",1000),previewNumber(values,"gp2",0),previewNumber(values,"qp2",1))+bell(previewNumber(values,"fp3",5000),previewNumber(values,"gp3",0),previewNumber(values,"qp3",1));
  }
  if(subtype.includes("lowshelf"))return previewNumber(values,"gain",0)/(1+(freq/center)**3);
  if(subtype.includes("highshelf"))return previewNumber(values,"gain",0)/(1+(center/freq)**3);
  if(subtype==="peaking")return previewNumber(values,"gain",0)*Math.exp(-.5*(Math.log(freq/center)*previewNumber(values,"q",1)/.72)**2);
  if(subtype.includes("notch"))return -24*Math.exp(-.5*(Math.log(freq/previewNumber(values,"freq_z",center))*previewNumber(values,"q_p",previewNumber(values,"q",2))/.72)**2);
  if(subtype==="bandpass")return -10*Math.log10(1+(freq/center-center/freq)**2*previewNumber(values,"q",1)**2);
  if(subtype==="linkwitztransform"){
    const actual=previewNumber(values,"freq_act",50);const target=previewNumber(values,"freq_target",30);
    return 10*Math.log10((1+(actual/freq)**4)/(1+(target/freq)**4));
  }
  return 0;
}

function previewExplanation(template:FilterTemplate) {
  if(template.subtype?.includes("LinkwitzRiley"))return "O Linkwitz–Riley foi desenvolvido para dividir um sinal entre duas vias que se somam de modo plano no ponto de crossover. Ele cruza a −6 dB: use o highpass e o lowpass com a mesma frequência e ordem, depois ajuste o alinhamento físico/temporal das caixas.";
  if(template.subtype?.includes("Butterworth"))return "O Butterworth foi desenvolvido para entregar uma resposta maximamente plana em uma via isolada. Ele cruza a −3 dB; por isso, dois filtros Butterworth iguais não têm automaticamente a soma plana de um par Linkwitz–Riley. Use-o quando o comportamento de cada via for a prioridade.";
  if(template.id==="bq-peaking")return "PEQ significa equalizador paramétrico. Escolha a frequência do problema, use ganho positivo para reforçar ou negativo para cortar, e ajuste Q: Q alto trabalha uma faixa estreita; Q baixo atua de forma larga. Comece com cortes pequenos, normalmente entre −1 e −4 dB.";
  if(template.id==="geq")return "Divide o intervalo em centros logarítmicos. Cada valor controla o ganho de uma banda; o CamillaDSP calcula automaticamente a largura entre elas.";
  if(template.id==="five-peq")return "Combina duas prateleiras e três bandas paramétricas. Frequência move cada ponto horizontalmente, ganho move verticalmente e Q determina a largura da intervenção.";
  if(template.curve==="phase")return "Este filtro atua principalmente no tempo ou na fase. A magnitude pode permanecer plana; use-o para alinhamento temporal e coerência entre vias.";
  if(template.curve==="dynamic")return "Este é um processamento dependente do nível. A resposta muda conforme o sinal ou o fader, portanto a figura representa seu comportamento de transferência.";
  if(template.curve==="none")return "Este estágio não possui uma curva de magnitude útil. Seus parâmetros atuam na quantização, no formato ou na carga de processamento.";
  if(template.family==="Crossover")return "Define a região entregue a esta via. A frequência estabelece o ponto de corte e a ordem determina quão rapidamente o conteúdo fora da banda é atenuado.";
  if(template.subtype?.includes("shelf")||template.subtype?.includes("Shelf"))return "Uma prateleira altera todo o conteúdo de um lado da frequência escolhida. Ganho define o patamar e Q ou inclinação controla a transição.";
  if(template.subtype==="Peaking")return "Uma banda paramétrica reforça ou atenua uma região. Frequência define o centro, ganho a intensidade e Q ou largura a extensão afetada.";
  return `${template.description} O gráfico usa frequência logarítmica e ganho em dB para antecipar o efeito antes da implantação.`;
}

function FilterPreview({template,values,samplerate,onChange}:{template:FilterTemplate;values:FilterValues;samplerate:number;onChange:(key:string,value:FilterValue)=>void}) {
  const maxFreq=Math.min(20000,samplerate/2*.98);
  const curve=Array.from({length:189},(_,index)=>{const x=34+index*4;const freq=previewFreq(x,maxFreq);return `${x.toFixed(1)},${previewY(previewResponse(template,values,freq)).toFixed(1)}`;}).join(" ");
  const interactive=template.curve==="magnitude"&&(template.fields.some((field)=>field.key==="freq")||template.id==="geq"||template.id==="five-peq");
  const updateFromPointer=(clientX:number,clientY:number,target:SVGSVGElement)=>{
    const rect=target.getBoundingClientRect();const x=(clientX-rect.left)/rect.width*820;const y=(clientY-rect.top)/rect.height*180;
    const freq=Math.round(previewFreq(x,maxFreq));const gain=Math.round(previewClamp(24-(y-12)/136*54,-30,24)*10)/10;
    if(template.id==="geq"){
      const bands=Array.isArray(values.gains)?[...values.gains]:[];if(!bands.length)return;
      const low=previewNumber(values,"freq_min",20);const high=previewNumber(values,"freq_max",maxFreq);const position=Math.log(previewClamp(freq,low,high)/low)/Math.log(high/low);const index=previewClamp(Math.round(position*bands.length-.5),0,bands.length-1);bands[index]=gain;onChange("gains",bands);return;
    }
    if(template.id==="five-peq"){
      const points:[[string,string],[string,string],[string,string],[string,string],[string,string]]=[["fls","gls"],["fp1","gp1"],["fp2","gp2"],["fp3","gp3"],["fhs","ghs"]];
      const nearest=points.reduce((best,item)=>Math.abs(Math.log(previewNumber(values,item[0],1000)/freq))<Math.abs(Math.log(previewNumber(values,best[0],1000)/freq))?item:best,points[0]);onChange(nearest[0],freq);onChange(nearest[1],gain);return;
    }
    if(template.fields.some((field)=>field.key==="freq"))onChange("freq",freq);
    if(template.fields.some((field)=>field.key==="gain"))onChange("gain",gain);
  };
  const startDrag=(event:ReactPointerEvent<SVGSVGElement>)=>{if(!interactive)return;event.currentTarget.setPointerCapture(event.pointerId);const target=event.currentTarget;updateFromPointer(event.clientX,event.clientY,target);const move=(next:PointerEvent)=>updateFromPointer(next.clientX,next.clientY,target);const stop=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",stop);};window.addEventListener("pointermove",move);window.addEventListener("pointerup",stop);};
  return <section className={`filter-preview ${interactive?"interactive":""}`}><div className="preview-heading"><span>PRÉVIA TÉCNICA</span><b>{interactive?"ARRASTE A CURVA PARA AJUSTAR":"RESPOSTA ESTIMADA"}</b></div>{template.curve==="magnitude"?<svg viewBox="0 0 820 180" role="img" aria-label={`Prévia dinâmica de ${template.label}`} onPointerDown={startDrag}><rect x="34" y="12" width="752" height="136" rx="3"/>{[24,12,0,-12,-24].map((db)=><g key={db}><line x1="34" x2="786" y1={previewY(db)} y2={previewY(db)}/><text x="5" y={previewY(db)+3}>{db>0?"+":""}{db}</text></g>)}{[20,100,1000,10000,maxFreq].map((freq)=><g key={freq}><line x1={previewX(freq,maxFreq)} x2={previewX(freq,maxFreq)} y1="12" y2="148"/><text x={previewX(freq,maxFreq)} y="166" textAnchor="middle">{freq>=1000?`${Math.round(freq/1000)}k`:Math.round(freq)}</text></g>)}<polyline points={curve}/>{interactive&&template.id!=="geq"&&template.id!=="five-peq"&&<circle cx={previewX(previewNumber(values,"freq",1000),maxFreq)} cy={previewY(previewNumber(values,"gain",previewResponse(template,values,previewNumber(values,"freq",1000))))} r="5"/>}</svg>:<div className="preview-no-curve"><span>{template.curve==="phase"?"φ":template.curve==="dynamic"?"↗":"∿"}</span><b>{template.curve==="phase"?"ATUAÇÃO EM TEMPO / FASE":template.curve==="dynamic"?"COMPORTAMENTO DEPENDENTE DO NÍVEL":"SEM CURVA DE MAGNITUDE"}</b></div>}<div className="preview-explanation"><b>O QUE ESTE FILTRO FAZ</b><p>{previewExplanation(template)}</p><small>A prévia é educativa; a configuração será validada pelo CamillaDSP antes de entrar no pipeline.</small></div></section>;
}

function DbKnobField({field,value,onChange,onCommit}:{field:FilterField;value:FilterValue|undefined;onChange:(value:FilterValue)=>void;onCommit?:()=>void}) {
  const valueRef=useRef(Number(value??field.default));const clamp=(next:number)=>Math.max(field.min??-150,Math.min(field.max??150,Math.round(next)));
  const set=(next:number)=>{const safe=clamp(next);valueRef.current=safe;onChange(safe);};
  const wheel=(event:React.WheelEvent<HTMLButtonElement>)=>{event.preventDefault();event.stopPropagation();if(event.deltaY===0)return;set(valueRef.current+(event.deltaY<0?1:-1));};
  const begin=(event:React.PointerEvent<HTMLButtonElement>)=>{event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);const startY=event.clientY;const start=valueRef.current;const move=(pointer:PointerEvent)=>set(start+(startY-pointer.clientY)/10);const stop=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",stop);onCommit?.();};window.addEventListener("pointermove",move);window.addEventListener("pointerup",stop);};
  const numeric=Number(value??field.default);const angle=(numeric>=0?numeric/Math.max(1,field.max??12):numeric/Math.max(1,Math.abs(field.min??-12)))*132;
  return <label className="db-knob-field"><span>{field.label}</span><input type="number" value={numeric} min={field.min} max={field.max} step="1" onChange={(event)=>set(Number(event.target.value))} onBlur={onCommit}/><button type="button" style={{"--db-knob-angle":`${angle}deg`} as React.CSSProperties} onWheelCapture={wheel} onPointerDown={begin} onDoubleClick={()=>{set(0);if(onCommit)queueMicrotask(onCommit);}} title="Arraste, use a roda do mouse ou dê duplo clique para zerar"><i/></button><small>{field.help||"1 dB por passo · o valor acima aceita edição pelo teclado."}</small></label>;
}

function FieldControl({field,value,onChange,coeffs,onUpload,onCommit}:{field:FilterField;value:FilterValue|undefined;onChange:(value:FilterValue)=>void;coeffs:CoeffFile[];onUpload?:(file:File)=>Promise<void>;onCommit?:()=>void}) {
  const changeAndCommit=(next:FilterValue)=>{onChange(next);if(onCommit)queueMicrotask(onCommit);};
  if(field.control==="boolean")return <label className="switch-field"><input type="checkbox" checked={Boolean(value)} onChange={(event)=>changeAndCommit(event.target.checked)}/><span>{field.label}</span><small>{field.help}</small></label>;
  if(field.control==="select")return <label><span>{field.label}</span><select value={String(value??field.default)} onChange={(event)=>changeAndCommit(event.target.value)}>{field.options?.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}</select>{field.help&&<small>{field.help}</small>}</label>;
  if(field.control==="list")return <label className="wide-field"><span>{field.label}</span><textarea rows={3} value={Array.isArray(value)?value.join(", "):String(value??"")} onChange={(event)=>onChange(parseList(event.target.value))} onBlur={onCommit}/>{field.help&&<small>{field.help}</small>}</label>;
  if(field.control==="coeff")return <label className="wide-field"><span>{field.label}</span><div className="coeff-picker"><select value={String(value??"")} onChange={(event)=>changeAndCommit(event.target.value)}><option value="">Selecione um arquivo…</option>{coeffs.map((file)=><option key={file.name} value={file.name}>{file.name}{file.size?` · ${(file.size/1024).toFixed(0)} kB`:""}</option>)}</select><span className="upload-button">ENVIAR<input type="file" onChange={(event)=>{const file=event.target.files?.[0];if(file&&onUpload)void onUpload(file).then(()=>{onChange(file.name);onCommit?.();});event.currentTarget.value="";}}/></span></div>{field.help&&<small>{field.help}</small>}</label>;
  if(field.unit==="dB")return <DbKnobField field={field} value={value} onChange={onChange} onCommit={onCommit}/>;
  if(field.control==="number"){const current=Number(value??field.default);const step=field.step??.1;const decimals=String(step).includes(".")?String(step).split(".")[1].length:0;const clamp=(next:number)=>Math.max(field.min??-Infinity,Math.min(field.max??Infinity,Math.round(next/step)*step));const adjust=(delta:number)=>changeAndCommit(Number(clamp(current+delta).toFixed(decimals)));return <label><span>{field.label}</span><div className="value-stepper"><input type="number" value={current} min={field.min} max={field.max} step={step} onChange={(event)=>onChange(Number(event.target.value))} onBlur={onCommit}/><div><button type="button" aria-label={`Aumentar ${field.label}`} onClick={()=>adjust(step)}>▲</button><button type="button" aria-label={`Diminuir ${field.label}`} onClick={()=>adjust(-step)}>▼</button></div></div>{field.help&&<small>{field.help}</small>}</label>;}
  return <label><span>{field.label}</span><div className="value-input"><input value={String(value??field.default)} onChange={(event)=>onChange(event.target.value)} onBlur={onCommit}/>{field.unit&&<b>{field.unit}</b>}</div>{field.help&&<small>{field.help}</small>}</label>;
}

export function FilterFields({template,values,onChange,coeffs,onUpload,onCommit}:{template:FilterTemplate;values:FilterValues;onChange:(key:string,value:FilterValue)=>void;coeffs:CoeffFile[];onUpload?:(file:File)=>Promise<void>;onCommit?:()=>void}) {
  return <div className={`catalog-fields ${template.id==="five-peq"?"dense":""}`}>{template.fields.filter((field)=>!field.showWhen||values[field.showWhen.key]===field.showWhen.value).map((field)=><FieldControl key={field.key} field={field} value={values[field.key]} onChange={(value)=>onChange(field.key,value)} coeffs={coeffs} onUpload={onUpload} onCommit={onCommit}/>)}</div>;
}

export function CatalogFilterEditor({filter,coeffs,onPatch,onCommit,onUpload}:{filter:RawFilter;coeffs:CoeffFile[];onPatch:(parameters:Record<string,unknown>)=>void;onCommit:()=>void;onUpload?:(file:File)=>Promise<void>}) {
  const template=templateForRaw(filter);
  if(!template)return <div className="unsupported-filter"><b>Filtro preservado sem editor visual</b><span>{filter.type} · {String(filter.parameters.type??"sem subtipo")}</span><small>O YAML continua intacto; este tipo não possui um manipulador catalogado.</small></div>;
  const values=valuesForRaw(template,filter);
  const change=(key:string,value:FilterValue)=>{const next={...values,[key]:value};const parameters:Record<string,unknown>={};if(template.fields.some((field)=>field.key==="shape_mode")){parameters.q=undefined;parameters.bandwidth=undefined;parameters.slope=undefined;}for(const field of template.fields){if(field.virtual||field.showWhen&&next[field.showWhen.key]!==field.showWhen.value)continue;let fieldValue=next[field.key];if(field.control==="coeff"&&typeof fieldValue==="string"&&fieldValue)fieldValue=`/home/elvis/camilladsp/coeffs/${fieldValue.split(/[\\/]/).pop()}`;parameters[field.key]=fieldValue;}if(template.subtype)parameters.type=template.subtype;onPatch(parameters);};
  return <div className="catalog-editor"><FilterFields template={template} values={values} onChange={change} coeffs={coeffs} onUpload={onUpload} onCommit={onCommit}/><div className="catalog-commit"><span>{template.curve==="phase"?"Manipulador de fase / tempo":template.curve==="dynamic"?"Processamento dinâmico":template.curve==="none"?"Sem curva de magnitude":"Curva sobreposta ao espectro"}</span><b>SOLTAR / SAIR DO CAMPO → APLICAR</b></div></div>;
}

export function FilterCreator({open,currentChannel,channels,samplerate,existingNames,coeffs,onClose,onCreate,onUpload}:{open:boolean;currentChannel:number;channels:OutputChannel[];samplerate:number;existingNames:string[];coeffs:CoeffFile[];onClose:()=>void;onCreate:(args:{template:FilterTemplate;values:FilterValues;name:string;description:string;channels:number[];copies:boolean})=>Promise<void>;onUpload:(file:File)=>Promise<void>}) {
  const [family,setFamily]=useState<(typeof FILTER_FAMILIES)[number]>("Crossover");
  const visible=useMemo(()=>FILTER_TEMPLATES.filter((template)=>template.family===family),[family]);
  const [templateId,setTemplateId]=useState("lr-hp");
  const template=FILTER_TEMPLATES.find((item)=>item.id===templateId)??visible[0]??FILTER_TEMPLATES[0];
  const [values,setValues]=useState<FilterValues>(()=>defaultValues(template));
  const [name,setName]=useState(()=>suggestFilterName(template,values));
  const [description,setDescription]=useState("");
  const [targets,setTargets]=useState<number[]>([currentChannel]);
  const [copies,setCopies]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const choose=(next:FilterTemplate)=>{const defaults=defaultValues(next);setTemplateId(next.id);setValues(defaults);setName(suggestFilterName(next,defaults));setDescription("");setError("");};
  if(!open)return null;
  const validation=validateTemplateValues(template,values,samplerate);
  const safeName=name.trim();
  if(!safeName)validation.push("Informe um nome YAML.");
  if(!/^[A-Za-z0-9_$-]+$/.test(safeName))validation.push("O nome aceita letras, números, _, - e tokens $.");
  if(existingNames.includes(safeName))validation.push(`${safeName} já existe.`);
  if(targets.length===0)validation.push("Escolha ao menos um canal.");
  const deploy=async()=>{if(validation.length)return;setBusy(true);setError("");try{await onCreate({template,values,name:safeName,description,channels:targets,copies});onClose();}catch(reason){setError(reason instanceof Error?reason.message:"Não foi possível criar o filtro.");}finally{setBusy(false);}};
  const cpu=template.rawType==="Conv"?"PESADO / DEPENDE DOS TAPS":template.id==="geq"&&Array.isArray(values.gains)&&values.gains.length>16?"MODERADO":"LEVE";
  return <div className="modal-backdrop" role="presentation"><section className="filter-creator" role="dialog" aria-modal="true" aria-label="Criar filtro"><header><div><small>NOVO BLOCO DO CAMILLADSP</small><h2>Inserir filtro</h2></div><button onClick={onClose} aria-label="Fechar">×</button></header><div className="creator-body"><aside><small>FAMÍLIA</small><nav>{FILTER_FAMILIES.map((item)=><button key={item} className={family===item?"active":""} onClick={()=>{setFamily(item);const next=FILTER_TEMPLATES.find((candidate)=>candidate.family===item);if(next)choose(next);}}>{item}</button>)}</nav><small>TIPO</small><div className="template-list">{visible.map((item)=><button key={item.id} className={template.id===item.id?"active":""} onClick={()=>choose(item)}><b>{item.short}</b><span>{item.label}</span></button>)}</div></aside><div className="creator-config"><div className="template-heading"><b>{template.label}</b><span>{template.description}</span></div><div className="identity-fields"><label><span>NOME YAML</span><input value={name} onChange={(event)=>setName(event.target.value)}/></label><label><span>DESCRIÇÃO</span><input value={description} onChange={(event)=>setDescription(event.target.value)} placeholder="opcional"/></label></div><FilterFields template={template} values={values} onChange={(key,value)=>setValues((current)=>({...current,[key]:value}))} coeffs={coeffs} onUpload={onUpload}/><FilterPreview template={template} values={values} samplerate={samplerate} onChange={(key,value)=>setValues((current)=>({...current,[key]:value}))}/></div><aside className="creator-route"><small>APLICAR A</small><div className="channel-checks">{channels.map((channel)=><label key={channel.output} className={targets.includes(channel.output)?"selected":""}><input type="checkbox" checked={targets.includes(channel.output)} onChange={()=>setTargets((current)=>current.includes(channel.output)?current.filter((item)=>item!==channel.output):[...current,channel.output])}/><b>{channel.short}</b><span>{channel.name}</span></label>)}</div><label className="copy-mode"><input type="checkbox" checked={copies} onChange={(event)=>setCopies(event.target.checked)}/><span><b>Uma cópia por canal</b><small>Desmarcado: um filtro compartilhado entre os canais.</small></span></label><div className="deploy-summary"><span>POSIÇÃO</span><b>{template.mustBeLast?"Último estágio da saída":"Após os filtros atuais · antes do Dither"}</b><span>CARGA ESTIMADA</span><b>{cpu}</b><span>PERSISTÊNCIA</span><b>DSP agora · YAML ao salvar</b></div>{(error||validation.length>0)&&<div className="creator-errors">{error||validation[0]}</div>}<button className="deploy-filter" disabled={busy||validation.length>0} onClick={()=>void deploy()}>{busy?"VALIDANDO…":"IMPLANTAR NO DSP"}</button></aside></div></section></div>;
}

export function FilterRoutingDialog({open,filterName,channels,assigned,onClose,onApply}:{open:boolean;filterName:string;channels:OutputChannel[];assigned:number[];onClose:()=>void;onApply:(channels:number[])=>Promise<void>}) {
  const [targets,setTargets]=useState<number[]>(assigned);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  if(!open)return null;
  return <div className="modal-backdrop"><section className="routing-dialog" role="dialog" aria-modal="true" aria-label={`Roteamento de ${filterName}`}><header><div><small>ESTRUTURA DO PIPELINE</small><h2>Roteamento · {filterName}</h2></div><button onClick={onClose}>×</button></header><p>Escolha as saídas que compartilharão esta mesma definição. A ordem do filtro será preservada no estágio final.</p><div className="channel-checks">{channels.map((channel)=><label key={channel.output} className={targets.includes(channel.output)?"selected":""}><input type="checkbox" checked={targets.includes(channel.output)} onChange={()=>setTargets((current)=>current.includes(channel.output)?current.filter((item)=>item!==channel.output):[...current,channel.output])}/><b>{channel.short}</b><span>{channel.name}</span></label>)}</div>{error&&<div className="creator-errors">{error}</div>}<footer><button onClick={onClose}>CANCELAR</button><button disabled={busy||targets.length===0} onClick={()=>{setBusy(true);setError("");void onApply(targets).then(onClose).catch((reason)=>setError(reason instanceof Error?reason.message:"Falha no roteamento")).finally(()=>setBusy(false));}}>{busy?"VALIDANDO…":"APLICAR ROTEAMENTO"}</button></footer></section></div>;
}
