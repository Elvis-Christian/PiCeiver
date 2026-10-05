import type { RawFilter } from "./camilla-model";

export type FilterValue = string | number | boolean | number[];
export type FilterValues = Record<string, FilterValue>;
export type FilterField = {
  key: string;
  label: string;
  control: "number" | "select" | "boolean" | "list" | "coeff";
  default: FilterValue;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ value: string; label: string }>;
  help?: string;
  virtual?: boolean;
  showWhen?: { key: string; value: FilterValue };
};

export type FilterTemplate = {
  id: string;
  family: "Utilitários" | "Crossover" | "Equalização" | "IIR avançado" | "FIR" | "Saída";
  label: string;
  short: string;
  description: string;
  rawType: string;
  subtype?: string;
  fields: FilterField[];
  curve: "magnitude" | "phase" | "dynamic" | "none";
  mustBeLast?: boolean;
};

const numberField = (key:string,label:string,defaultValue:number,unit?:string,min?:number,max?:number,step=.1,help?:string):FilterField => ({key,label,control:"number",default:defaultValue,unit,min,max,step,help});
const boolField = (key:string,label:string,defaultValue=false,help?:string):FilterField => ({key,label,control:"boolean",default:defaultValue,help});
const selectField = (key:string,label:string,defaultValue:string,options:Array<[string,string]>,help?:string,virtual=false):FilterField => ({key,label,control:"select",default:defaultValue,options:options.map(([value,text])=>({value,label:text})),help,virtual});
const listField = (key:string,label:string,defaults:number[],help?:string):FilterField => ({key,label,control:"list",default:defaults,help});
const shapeFields = (kind:"q-bandwidth"|"q-slope"):FilterField[] => {
  const second=kind==="q-bandwidth"?"bandwidth":"slope";
  return [
    selectField("shape_mode","FORMA","q",[["q","Q"],[second,second==="slope"?"Inclinação":"Largura em oitavas"]],undefined,true),
    {...numberField("q","Q",.707,undefined,.01,100,.01),showWhen:{key:"shape_mode",value:"q"}},
    {...numberField(second,second==="slope"?"INCLINAÇÃO":"LARGURA",second==="slope"?6:1,second==="slope"?"dB/oct":"oct",second==="slope"?-12:.01,second==="slope"?12:10,.01),showWhen:{key:"shape_mode",value:second}},
  ];
};

const ditherTypes:Array<[string,string]> = [
  ["None","Sem dither"],["Flat","Flat · qualquer sample rate"],["Highpass","Highpass · qualquer sample rate"],
  ["Fweighted441","F-weighted · 44,1 kHz"],["FweightedShort441","F-weighted short · 44,1 kHz"],["FweightedLong441","F-weighted long · 44,1 kHz"],
  ["Gesemann441","Gesemann · 44,1 kHz"],["Gesemann48","Gesemann · 48 kHz"],["Lipshitz441","Lipshitz · 44,1 kHz"],["LipshitzLong441","Lipshitz long · 44,1 kHz"],
  ["Shibata441","Shibata · 44,1 kHz"],["ShibataHigh441","Shibata high · 44,1 kHz"],["ShibataLow441","Shibata low · 44,1 kHz"],
  ["Shibata48","Shibata · 48 kHz"],["ShibataHigh48","Shibata high · 48 kHz"],["ShibataLow48","Shibata low · 48 kHz"],
  ["Shibata882","Shibata · 88,2 kHz"],["ShibataLow882","Shibata low · 88,2 kHz"],["Shibata96","Shibata · 96 kHz"],["ShibataLow96","Shibata low · 96 kHz"],
  ["Shibata192","Shibata · 192 kHz"],["ShibataLow192","Shibata low · 192 kHz"],
];

const baseTemplates:FilterTemplate[] = [
  {id:"gain",family:"Utilitários",label:"Ganho",short:"GAIN",description:"Atenuação, ganho, inversão de fase ou mute fixo.",rawType:"Gain",curve:"magnitude",fields:[numberField("gain","GANHO",0,"dB",-150,150,.1),selectField("scale","ESCALA","dB",[["dB","dB"],["linear","Linear"]]),boolField("inverted","INVERTER POLARIDADE"),boolField("mute","MUTE")]},
  {id:"delay",family:"Utilitários",label:"Delay / alinhamento",short:"DELAY",description:"Atraso em milissegundos, milímetros ou amostras.",rawType:"Delay",curve:"phase",fields:[numberField("delay","ATRASO",0,"ms",0,100000,.01),selectField("unit","UNIDADE","ms",[["ms","Milissegundos"],["mm","Milímetros"],["samples","Amostras"]]),boolField("subsample","PRECISÃO SUBSAMPLE",false)]},
  {id:"limiter",family:"Utilitários",label:"Limiter",short:"LIMIT",description:"Proteção de pico por clipping duro ou suave.",rawType:"Limiter",curve:"dynamic",fields:[numberField("clip_limit","LIMITE",-1,"dB",-150,0,.1),boolField("soft_clip","SOFT CLIP",false)]},
  {id:"volume",family:"Utilitários",label:"Volume auxiliar",short:"VOL",description:"Controle de volume associado aos faders Aux do CamillaDSP.",rawType:"Volume",curve:"dynamic",fields:[selectField("fader","FADER","Aux1",[["Aux1","Aux 1"],["Aux2","Aux 2"],["Aux3","Aux 3"],["Aux4","Aux 4"]]),numberField("ramp_time","RAMPA",400,"ms",0,10000,1),numberField("limit","LIMITE MÁXIMO",10,"dB",-150,50,.1)]},
  {id:"loudness",family:"Utilitários",label:"Loudness dinâmico",short:"LOUD",description:"Compensação de graves e agudos vinculada a um fader.",rawType:"Loudness",curve:"magnitude",fields:[selectField("fader","FADER","Main",[["Main","Main"],["Aux1","Aux 1"],["Aux2","Aux 2"],["Aux3","Aux 3"],["Aux4","Aux 4"]]),numberField("reference_level","NÍVEL DE REFERÊNCIA",-25,"dB",-100,20,.1),numberField("high_boost","BOOST AGUDOS",7,"dB",0,20,.1),numberField("low_boost","BOOST GRAVES",7,"dB",0,20,.1),boolField("attenuate_mid","ATENUAR MÉDIOS",false)]},
  {id:"lr-hp",family:"Crossover",label:"Linkwitz–Riley Highpass",short:"LR HP",description:"Divide uma via acima do corte e soma de forma plana com o Linkwitz–Riley Lowpass correspondente. Ideal para crossovers de caixas; cruza a −6 dB.",rawType:"BiquadCombo",subtype:"LinkwitzRileyHighpass",curve:"magnitude",fields:[numberField("freq","FREQUÊNCIA",80,"Hz",1,100000,1),numberField("order","ORDEM",4,undefined,2,16,2)]},
  {id:"lr-lp",family:"Crossover",label:"Linkwitz–Riley Lowpass",short:"LR LP",description:"Entrega os graves/médios abaixo do corte e soma de forma plana com o Linkwitz–Riley Highpass correspondente. Ideal para crossovers de caixas; cruza a −6 dB.",rawType:"BiquadCombo",subtype:"LinkwitzRileyLowpass",curve:"magnitude",fields:[numberField("freq","FREQUÊNCIA",300,"Hz",1,100000,1),numberField("order","ORDEM",4,undefined,2,16,2)]},
  {id:"bw-hp",family:"Crossover",label:"Butterworth Highpass",short:"BW HP",description:"Remove graves abaixo do corte com resposta maximamente plana. Use quando a prioridade é manter uma única via plana; cruza a −3 dB e não é um par de soma plana por si só.",rawType:"BiquadCombo",subtype:"ButterworthHighpass",curve:"magnitude",fields:[numberField("freq","FREQUÊNCIA",80,"Hz",1,100000,1),numberField("order","ORDEM",2,undefined,1,16,1)]},
  {id:"bw-lp",family:"Crossover",label:"Butterworth Lowpass",short:"BW LP",description:"Remove agudos acima do corte com resposta maximamente plana. Use quando a prioridade é manter uma única via plana; cruza a −3 dB e não é um par de soma plana por si só.",rawType:"BiquadCombo",subtype:"ButterworthLowpass",curve:"magnitude",fields:[numberField("freq","FREQUÊNCIA",300,"Hz",1,100000,1),numberField("order","ORDEM",2,undefined,1,16,1)]},
  {id:"geq",family:"Equalização",label:"Equalizador gráfico",short:"GEQ",description:"Bandas igualmente espaçadas em escala logarítmica.",rawType:"BiquadCombo",subtype:"GraphicEqualizer",curve:"magnitude",fields:[numberField("freq_min","FREQ. MÍNIMA",20,"Hz",1,100000,1),numberField("freq_max","FREQ. MÁXIMA",20000,"Hz",1,100000,1),listField("gains","GANHOS DAS BANDAS",[0,0,0,0,0,0,0,0],"Uma banda por valor, em dB.")]},
  {id:"five-peq",family:"Equalização",label:"Equalizador paramétrico de 5 pontos",short:"5PEQ",description:"Low shelf, três pontos paramétricos e high shelf.",rawType:"BiquadCombo",subtype:"FivePointPeq",curve:"magnitude",fields:[numberField("fls","LOW SHELF · Hz",80,"Hz",1,100000,1),numberField("gls","LOW SHELF · dB",0,"dB",-40,40,.1),numberField("qls","LOW SHELF · Q",.707,undefined,.01,100,.01),numberField("fp1","PEQ 1 · Hz",200,"Hz",1,100000,1),numberField("gp1","PEQ 1 · dB",0,"dB",-40,40,.1),numberField("qp1","PEQ 1 · Q",1,undefined,.01,100,.01),numberField("fp2","PEQ 2 · Hz",1000,"Hz",1,100000,1),numberField("gp2","PEQ 2 · dB",0,"dB",-40,40,.1),numberField("qp2","PEQ 2 · Q",1,undefined,.01,100,.01),numberField("fp3","PEQ 3 · Hz",5000,"Hz",1,100000,1),numberField("gp3","PEQ 3 · dB",0,"dB",-40,40,.1),numberField("qp3","PEQ 3 · Q",1,undefined,.01,100,.01),numberField("fhs","HIGH SHELF · Hz",10000,"Hz",1,100000,1),numberField("ghs","HIGH SHELF · dB",0,"dB",-40,40,.1),numberField("qhs","HIGH SHELF · Q",.707,undefined,.01,100,.01)]},
  {id:"tilt",family:"Equalização",label:"Tilt",short:"TILT",description:"Inclinação simétrica de graves para agudos.",rawType:"BiquadCombo",subtype:"Tilt",curve:"magnitude",fields:[numberField("gain","INCLINAÇÃO TOTAL",0,"dB",-100,100,.1)]},
  {id:"dither",family:"Saída",label:"Dither",short:"DITHER",description:"Dither e redução de profundidade; sempre inserido no final.",rawType:"Dither",curve:"none",mustBeLast:true,fields:[selectField("type","TIPO","Highpass",ditherTypes),numberField("bits","BITS",16,"bit",2,64,1),numberField("amplitude","AMPLITUDE FLAT",2,"LSB",0,100,.1)]},
  {id:"diffeq",family:"IIR avançado",label:"Equação de diferenças",short:"DIFFEQ",description:"Filtro por coeficientes genéricos a e b.",rawType:"DiffEq",curve:"magnitude",fields:[listField("a","COEFICIENTES A",[1]),listField("b","COEFICIENTES B",[1])]},
  {id:"conv-wav",family:"FIR",label:"FIR de arquivo WAV",short:"FIR WAV",description:"Convolução usando um canal de arquivo WAV.",rawType:"Conv",subtype:"Wav",curve:"magnitude",fields:[{key:"filename",label:"ARQUIVO",control:"coeff",default:"",help:"Arquivo armazenado na pasta de coeficientes do Pi."},numberField("channel","CANAL DO WAV",0,undefined,0,255,1)]},
  {id:"conv-raw",family:"FIR",label:"FIR Raw / texto",short:"FIR RAW",description:"Convolução usando coeficientes raw ou texto.",rawType:"Conv",subtype:"Raw",curve:"magnitude",fields:[{key:"filename",label:"ARQUIVO",control:"coeff",default:""},selectField("format","FORMATO","TEXT",[["TEXT","Texto"],["S16LE","S16LE"],["S24LE","S24LE"],["S24LE3","S24LE3"],["S32LE","S32LE"],["FLOAT32LE","FLOAT32LE"],["FLOAT64LE","FLOAT64LE"]]),numberField("skip_bytes_lines","PULAR BYTES / LINHAS",0,undefined,0,100000000,1),numberField("read_bytes_lines","LER BYTES / LINHAS",0,undefined,0,100000000,1)]},
  {id:"conv-values",family:"FIR",label:"FIR por valores",short:"FIR VALUES",description:"Coeficientes FIR inseridos diretamente no YAML.",rawType:"Conv",subtype:"Values",curve:"magnitude",fields:[listField("values","COEFICIENTES",[1])]},
  {id:"conv-dummy",family:"FIR",label:"FIR Dummy para teste",short:"FIR DUMMY",description:"Resposta unitária usada para estimar carga de CPU.",rawType:"Conv",subtype:"Dummy",curve:"none",fields:[numberField("length","COMPRIMENTO",65536,"taps",1,10000000,1)]},
];

const biquadTemplates:FilterTemplate[] = [
  {id:"bq-free",label:"Biquad livre",short:"FREE",description:"Coeficientes normalizados fornecidos diretamente.",subtype:"Free",fields:[numberField("a1","A1",0),numberField("a2","A2",0),numberField("b0","B0",1),numberField("b1","B1",0),numberField("b2","B2",0)]},
  {id:"bq-hp",label:"Highpass 2ª ordem",short:"HPF",description:"Passa-altas de 12 dB/oitava.",subtype:"Highpass",fields:[numberField("freq","FREQUÊNCIA",80,"Hz",1,100000,1),numberField("q","Q",.707,undefined,.01,100,.01)]},
  {id:"bq-lp",label:"Lowpass 2ª ordem",short:"LPF",description:"Passa-baixas de 12 dB/oitava.",subtype:"Lowpass",fields:[numberField("freq","FREQUÊNCIA",300,"Hz",1,100000,1),numberField("q","Q",.707,undefined,.01,100,.01)]},
  {id:"bq-hpfo",label:"Highpass 1ª ordem",short:"HPF 1",description:"Passa-altas de 6 dB/oitava.",subtype:"HighpassFO",fields:[numberField("freq","FREQUÊNCIA",80,"Hz",1,100000,1)]},
  {id:"bq-lpfo",label:"Lowpass 1ª ordem",short:"LPF 1",description:"Passa-baixas de 6 dB/oitava.",subtype:"LowpassFO",fields:[numberField("freq","FREQUÊNCIA",300,"Hz",1,100000,1)]},
  {id:"bq-highshelf",label:"High shelf",short:"H-SHELF",description:"Prateleira paramétrica de agudos.",subtype:"Highshelf",fields:[numberField("freq","FREQUÊNCIA",5000,"Hz",1,100000,1),numberField("gain","GANHO",0,"dB",-100,100,.1),...shapeFields("q-slope")]},
  {id:"bq-lowshelf",label:"Low shelf",short:"L-SHELF",description:"Prateleira paramétrica de graves.",subtype:"Lowshelf",fields:[numberField("freq","FREQUÊNCIA",100,"Hz",1,100000,1),numberField("gain","GANHO",0,"dB",-100,100,.1),...shapeFields("q-slope")]},
  {id:"bq-highshelffo",label:"High shelf 1ª ordem",short:"H-SHELF 1",description:"Prateleira de agudos de 6 dB/oitava.",subtype:"HighshelfFO",fields:[numberField("freq","FREQUÊNCIA",5000,"Hz",1,100000,1),numberField("gain","GANHO",0,"dB",-100,100,.1)]},
  {id:"bq-lowshelffo",label:"Low shelf 1ª ordem",short:"L-SHELF 1",description:"Prateleira de graves de 6 dB/oitava.",subtype:"LowshelfFO",fields:[numberField("freq","FREQUÊNCIA",100,"Hz",1,100000,1),numberField("gain","GANHO",0,"dB",-100,100,.1)]},
  {id:"bq-peaking",label:"Peaking / PEQ",short:"PEQ",description:"PEQ significa equalizador paramétrico: escolha uma frequência, aumente ou reduza em dB e controle a largura com Q. Use para corrigir um pico/vale localizado sem alterar o restante do espectro.",subtype:"Peaking",fields:[numberField("freq","FREQUÊNCIA",1000,"Hz",1,100000,1),numberField("gain","GANHO",0,"dB",-100,100,.1),...shapeFields("q-bandwidth")]},
  {id:"bq-notch",label:"Notch",short:"NOTCH",description:"Rejeição estreita de uma frequência.",subtype:"Notch",fields:[numberField("freq","FREQUÊNCIA",1000,"Hz",1,100000,1),...shapeFields("q-bandwidth")]},
  {id:"bq-generalnotch",label:"General notch",short:"G-NOTCH",description:"Notch com polos e zeros em frequências independentes.",subtype:"GeneralNotch",fields:[numberField("freq_z","FREQ. ZERO",1000,"Hz",1,100000,1),numberField("freq_p","FREQ. POLO",900,"Hz",1,100000,1),numberField("q_p","Q DO POLO",1,undefined,.01,100,.01),boolField("normalize_at_dc","NORMALIZAR EM DC",false)]},
  {id:"bq-bandpass",label:"Bandpass",short:"BPF",description:"Passa-faixa de segunda ordem.",subtype:"Bandpass",fields:[numberField("freq","FREQUÊNCIA",1000,"Hz",1,100000,1),...shapeFields("q-bandwidth")]},
  {id:"bq-allpass",label:"Allpass 2ª ordem",short:"APF",description:"Altera fase mantendo magnitude plana.",subtype:"Allpass",fields:[numberField("freq","FREQUÊNCIA",1000,"Hz",1,100000,1),...shapeFields("q-bandwidth")]},
  {id:"bq-allpassfo",label:"Allpass 1ª ordem",short:"APF 1",description:"Ajuste de fase de primeira ordem.",subtype:"AllpassFO",fields:[numberField("freq","FREQUÊNCIA",1000,"Hz",1,100000,1)]},
  {id:"bq-linkwitz-transform",label:"Linkwitz transform",short:"LT",description:"Transforma a resposta de caixa selada para outro alvo.",subtype:"LinkwitzTransform",fields:[numberField("freq_act","FREQ. REAL",50,"Hz",1,100000,1),numberField("q_act","Q REAL",.707,undefined,.01,100,.01),numberField("freq_target","FREQ. ALVO",30,"Hz",1,100000,1),numberField("q_target","Q ALVO",.707,undefined,.01,100,.01)]},
].map((template)=>({...template,family:"IIR avançado",rawType:"Biquad",curve:template.subtype?.includes("Allpass")?"phase":"magnitude"} as FilterTemplate));

export const FILTER_TEMPLATES:FilterTemplate[] = [...baseTemplates,...biquadTemplates];

export const FILTER_FAMILIES = ["Utilitários","Crossover","Equalização","IIR avançado","FIR","Saída"] as const;

export function defaultValues(template:FilterTemplate):FilterValues {
  return Object.fromEntries(template.fields.map((field)=>[field.key,Array.isArray(field.default)?[...field.default]:field.default]));
}

export function templateForRaw(filter:RawFilter):FilterTemplate|undefined {
  const subtype=typeof filter.parameters.type==="string"?filter.parameters.type:undefined;
  return FILTER_TEMPLATES.find((template)=>template.rawType===filter.type&&(template.subtype===undefined||template.subtype===subtype));
}

export function valuesForRaw(template:FilterTemplate,filter:RawFilter):FilterValues {
  const values=defaultValues(template);
  for(const field of template.fields){
    if(field.virtual)continue;
    const value=filter.parameters[field.key];
    if(typeof value==="string"||typeof value==="number"||typeof value==="boolean"||Array.isArray(value))values[field.key]=Array.isArray(value)?value.map(Number):value;
  }
  if(template.fields.some((field)=>field.key==="shape_mode")){
    values.shape_mode=filter.parameters.bandwidth!==undefined?"bandwidth":filter.parameters.slope!==undefined?"slope":"q";
  }
  if((template.id==="conv-wav"||template.id==="conv-raw")&&typeof values.filename==="string")values.filename=values.filename.split(/[\\/]/).pop()??values.filename;
  return values;
}

export function rawFilterFromTemplate(template:FilterTemplate,values:FilterValues,description?:string):RawFilter {
  const parameters:Record<string,unknown>={};
  if(template.subtype)parameters.type=template.subtype;
  for(const field of template.fields){
    if(field.virtual||field.showWhen&&values[field.showWhen.key]!==field.showWhen.value)continue;
    let value=values[field.key];
    if(field.control==="coeff"&&typeof value==="string"&&value)value=`/home/elvis/camilladsp/coeffs/${value.split(/[\\/]/).pop()}`;
    parameters[field.key]=value;
  }
  return {type:template.rawType,description:description?.trim()||null,parameters};
}

export function suggestFilterName(template:FilterTemplate,values:FilterValues) {
  const freq=typeof values.freq==="number"?`_${Math.round(values.freq)}`:"";
  return `${template.id.replace(/^bq-/,"").replace(/[^a-z0-9]+/gi,"_")}${freq}`;
}

export function validateTemplateValues(template:FilterTemplate,values:FilterValues,samplerate:number) {
  const errors:string[]=[];
  for(const field of template.fields){
    if(field.showWhen&&values[field.showWhen.key]!==field.showWhen.value)continue;
    const value=values[field.key];
    if(field.control==="coeff"&&!value)errors.push(`${field.label}: selecione ou envie um arquivo.`);
    if(field.control==="list"&&(!Array.isArray(value)||value.length===0))errors.push(`${field.label}: informe ao menos um valor.`);
    if(typeof value==="number"&&field.min!==undefined&&value<field.min)errors.push(`${field.label}: mínimo ${field.min}.`);
    if(typeof value==="number"&&field.max!==undefined&&value>field.max)errors.push(`${field.label}: máximo ${field.max}.`);
  }
  const freqKeys=["freq","freq_min","freq_max","freq_z","freq_p","freq_act","freq_target","fls","fp1","fp2","fp3","fhs"];
  for(const key of freqKeys)if(typeof values[key]==="number"&&Number(values[key])>=samplerate/2)errors.push(`${key}: deve ficar abaixo de ${samplerate/2} Hz.`);
  if(template.subtype?.startsWith("LinkwitzRiley")&&Number(values.order)%2!==0)errors.push("Linkwitz–Riley exige ordem par.");
  if(template.id==="geq"&&Number(values.freq_min)>=Number(values.freq_max))errors.push("A frequência mínima deve ser menor que a máxima.");
  if(template.id==="dither"){
    const subtype=String(values.type);const rateTag=subtype.match(/(441|48|882|96|192)$/)?.[1];
    const expected=rateTag==="441"?44100:rateTag==="48"?48000:rateTag==="882"?88200:rateTag==="96"?96000:rateTag==="192"?192000:undefined;
    if(expected&&expected!==samplerate)errors.push(`${subtype} foi projetado para ${expected/1000} kHz; o YAML está em ${samplerate/1000} kHz.`);
  }
  return errors;
}
