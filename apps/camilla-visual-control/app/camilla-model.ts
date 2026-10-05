import { templateForRaw } from "./filter-catalog";

export type RawFilter = {
  type: string;
  description?: string | null;
  parameters: Record<string, unknown>;
};

export type MixerSource = { channel: number; gain?: number; scale?: string; mute?: boolean | null };
export type MixerMapping = { dest: number; mute?: boolean | null; sources: MixerSource[] };
export type Mixer = {
  channels: { in: number; out: number };
  labels?: string[] | null;
  mapping: MixerMapping[];
};

export type PipelineFilterStep = { type: "Filter"; channels?: number[] | null; names: string[]; bypassed?: boolean | null; description?: string | null };
type PipelineMixerStep = { type: "Mixer"; name: string; bypassed?: boolean | null };

export type CamillaConfig = {
  title?: string;
  description?: string;
  devices: {
    samplerate: number;
    chunksize?: number;
    capture: { channels: number; [key: string]: unknown };
    playback: { channels: number; [key: string]: unknown };
    [key: string]: unknown;
  };
  filters: Record<string, RawFilter>;
  mixers: Record<string, Mixer>;
  pipeline: Array<PipelineFilterStep | PipelineMixerStep>;
  [key: string]: unknown;
};

export type FilterKind = "HPF" | "LPF" | "GEQ" | "PEQ" | "SHELF" | "IIR" | "FIR" | "GAIN" | "DELAY" | "LIMITER" | "VOLUME" | "LOUDNESS" | "DITHER" | "DIFFEQ" | "OTHER";

export type UiFilter = {
  id: string;
  yamlName: string;
  name: string;
  kind: FilterKind;
  freq?: number;
  gain?: number;
  order?: number;
  slope?: number;
  delay?: number;
  limit?: number;
  bands?: number[];
  freqMin?: number;
  freqMax?: number;
  color: string;
  enabled: boolean;
  rawType: string;
  subtype?: string;
  templateId?: string;
  parameters: Record<string, unknown>;
};

export type OutputChannel = {
  id: string;
  output: number;
  short: string;
  name: string;
  range: string;
  color: string;
  source: string;
  muted: boolean;
  filterNames: string[];
};

export type OutputMixerState = { gain: number; muted: boolean; available: boolean };

const channelColors = ["#62e6c7", "#52d4ff", "#b58cff", "#ff9f43", "#f7d154", "#ffca6e"];
const filterColors: Record<FilterKind, string> = {
  HPF: "#62e6c7", LPF: "#ff9f43", GEQ: "#b58cff", GAIN: "#ff7185",
  PEQ: "#59c7ff", SHELF: "#8fd3ff", IIR: "#7f9cff", FIR: "#e4a8ff",
  DELAY: "#7a9ba8", LIMITER: "#ff5e73", VOLUME: "#f1d477", LOUDNESS: "#efb55f",
  DITHER: "#9eacb1", DIFFEQ: "#9ba7ff", OTHER: "#8ca1aa",
};

type Signal = { filters: string[]; origins: number[]; muted: boolean };

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function filterKind(filter: RawFilter): FilterKind {
  const subtype = String(filter.parameters.type ?? "");
  if (filter.type === "Gain") return "GAIN";
  if (filter.type === "Delay") return "DELAY";
  if (filter.type === "Limiter") return "LIMITER";
  if (filter.type === "Volume") return "VOLUME";
  if (filter.type === "Loudness") return "LOUDNESS";
  if (filter.type === "Dither") return "DITHER";
  if (filter.type === "DiffEq") return "DIFFEQ";
  if (filter.type === "Conv") return "FIR";
  if (subtype === "GraphicEqualizer") return "GEQ";
  if (subtype === "Peaking" || subtype === "FivePointPeq") return "PEQ";
  if (subtype.toLowerCase().includes("shelf") || subtype === "Tilt") return "SHELF";
  if (subtype.toLowerCase().includes("highpass")) return "HPF";
  if (subtype.toLowerCase().includes("lowpass")) return "LPF";
  if (filter.type === "Biquad" || filter.type === "BiquadCombo") return "IIR";
  return "OTHER";
}

export function toUiFilter(name: string, filter: RawFilter): UiFilter {
  const kind = filterKind(filter);
  const params = filter.parameters;
  const template = templateForRaw(filter);
  const freq = typeof params.freq === "number" ? params.freq : undefined;
  const order = typeof params.order === "number" ? params.order : undefined;
  const friendly = template ? template.label
    : kind === "HPF" ? `Highpass ${freq} Hz`
    : kind === "LPF" ? `Lowpass ${freq && freq >= 1000 ? `${freq / 1000} kHz` : `${freq} Hz`}`
    : kind === "GEQ" ? "Equalizador gráfico"
    : kind === "GAIN" ? "Headroom de saída"
    : kind === "DELAY" ? "Atraso A/V"
    : kind === "LIMITER" ? "Proteção de pico LFE"
    : name;
  return {
    id: name,
    yamlName: name,
    name: friendly,
    kind,
    freq,
    gain: typeof params.gain === "number" ? params.gain : undefined,
    order,
    slope: order ? order * 6 : undefined,
    delay: typeof params.delay === "number" ? params.delay : undefined,
    limit: typeof params.clip_limit === "number" ? params.clip_limit : undefined,
    bands: Array.isArray(params.gains) ? params.gains.map(Number) : undefined,
    freqMin: typeof params.freq_min === "number" ? params.freq_min : undefined,
    freqMax: typeof params.freq_max === "number" ? params.freq_max : undefined,
    color: filterColors[kind],
    enabled: true,
    rawType: filter.type,
    subtype: typeof params.type === "string" ? params.type : undefined,
    templateId: template?.id,
    parameters: { ...params },
  };
}

function rangeFor(filters: UiFilter[]) {
  const hp = filters.find((filter) => filter.kind === "HPF")?.freq;
  const lp = filters.find((filter) => filter.kind === "LPF")?.freq;
  const geq = filters.find((filter) => filter.kind === "GEQ");
  const limiter = filters.some((filter) => filter.kind === "LIMITER");
  if (hp && lp) return `${hp} Hz — ${lp >= 1000 ? `${lp / 1000} kHz` : `${lp} Hz`}${limiter ? " · limiter" : ""}`;
  if (hp && geq) return `HP ${hp} Hz · EQ ${geq.bands?.length ?? 0} bandas`;
  if (hp) return `HP ${hp} Hz`;
  return `${filters.length} filtros`;
}

export function buildOutputChannels(config: CamillaConfig): OutputChannel[] {
  const inputCount = config.devices.capture.channels;
  let signals: Signal[] = Array.from({ length: inputCount }, (_, index) => ({ filters: [], origins: [index], muted: false }));
  let labels: string[] = [];

  for (const step of config.pipeline) {
    if (step.type === "Filter") {
      const targets = step.channels ?? signals.map((_, index) => index);
      signals = signals.map((signal, index) => targets.includes(index)
        ? { ...signal, filters: unique([...signal.filters, ...step.names]) }
        : signal);
      continue;
    }
    if (step.bypassed === true) continue;
    const mixer = config.mixers[step.name];
    if (!mixer) continue;
    const next: Signal[] = Array.from({ length: mixer.channels.out }, () => ({ filters: [], origins: [], muted: true }));
    for (const mapping of mixer.mapping) {
      const sources = mapping.sources.filter((source) => source.mute !== true).map((source) => signals[source.channel]).filter(Boolean);
      next[mapping.dest] = {
        filters: unique(sources.flatMap((source) => source.filters)),
        origins: unique(sources.flatMap((source) => source.origins)),
        muted: mapping.mute === true || sources.length === 0 || sources.every((source) => source.muted),
      };
    }
    signals = next;
    if (mixer.labels?.length === mixer.channels.out) labels = mixer.labels.map((label) => label.trim());
  }

  const count = config.devices.playback.channels;
  return Array.from({ length: count }, (_, output) => {
    const signal = signals[output] ?? { filters: [], origins: [], muted: false };
    const short = labels[output] || `OUT-${output}`;
    const filters = signal.filters.map((name) => config.filters[name]).filter(Boolean).map((filter, index) => toUiFilter(signal.filters[index], filter));
    const source = signal.origins.length ? signal.origins.map((origin) => `IN ${origin}`).join(" + ") : "sem origem";
    const names: Record<string, string> = {
      "LEFT-H": "Frontal alta · Esq.", "RIGHT-H": "Frontal alta · Dir.", CENTER: "Canal central",
      LFE: "Subwoofer", "LEFT-L": "Mid-bass · Esq.", "RIGHT-L": "Mid-bass · Dir.",
    };
    return {
      id: `ch${output}`,
      output,
      short,
      name: names[short] ?? `Saída ${output}`,
      range: rangeFor(filters),
      color: channelColors[output % channelColors.length],
      source,
      muted: signal.muted,
      filterNames: signal.filters,
    };
  });
}

export function outputMixerState(config:CamillaConfig,output:number):OutputMixerState {
  const routeMapping=config.mixers.route_inputs?.mapping.find((item)=>item.dest===output);
  if(!routeMapping||routeMapping.sources.length===0)return {gain:0,muted:false,available:false};
  const finalMixerName=[...config.pipeline].reverse().find((step)=>step.type==="Mixer")?.name;
  const finalMapping=finalMixerName?config.mixers[finalMixerName]?.mapping.find((item)=>item.dest===output):undefined;
  const gains=routeMapping.sources.map((source)=>source.scale==="linear"?20*Math.log10(Math.max(Number(source.gain??1),1e-6)):Number(source.gain??0));
  return {gain:Math.round((gains.reduce((sum,value)=>sum+value,0)/gains.length)*2)/2,muted:routeMapping.mute===true||finalMapping?.mute===true,available:true};
}

export function patchOutputMixer(config:CamillaConfig,output:number,values:{gain?:number;mute?:boolean}):CamillaConfig {
  const mixer=config.mixers.route_inputs;if(!mixer)return config;
  const mapping=mixer.mapping.map((item)=>item.dest!==output?item:{...item,...(values.mute!==undefined?{mute:values.mute}:{}),sources:item.sources.map((source)=>values.gain===undefined?source:{...source,gain:values.gain,scale:"dB"})});
  const mixers={...config.mixers,route_inputs:{...mixer,mapping}};
  const finalMixerName=[...config.pipeline].reverse().find((step)=>step.type==="Mixer")?.name;
  if(values.mute!==undefined&&finalMixerName&&finalMixerName!=="route_inputs"&&mixers[finalMixerName]){const finalMixer=mixers[finalMixerName];mixers[finalMixerName]={...finalMixer,mapping:finalMixer.mapping.map((item)=>item.dest===output?{...item,mute:values.mute}:item)};}
  return {...config,mixers};
}

export function ensureSpectrumInfrastructure(config:CamillaConfig):CamillaConfig {
  return {...config,devices:{...config.devices,playback:{...config.devices.playback,type:"Alsa",channels:6,device:"camilla_tee"}}};
}

export function patchFilter(config: CamillaConfig, name: string, values: Partial<UiFilter>): CamillaConfig {
  const current = config.filters[name];
  if (!current) return config;
  const parameters = { ...current.parameters };
  if (values.freq !== undefined) parameters.freq = values.freq;
  if (values.gain !== undefined) parameters.gain = values.gain;
  if (values.delay !== undefined) parameters.delay = values.delay;
  if (values.limit !== undefined) parameters.clip_limit = values.limit;
  if (values.order !== undefined) parameters.order = values.order;
  if (values.bands !== undefined) parameters.gains = values.bands;
  if (values.freqMin !== undefined) parameters.freq_min = values.freqMin;
  if (values.freqMax !== undefined) parameters.freq_max = values.freqMax;
  if (values.parameters !== undefined) Object.assign(parameters, values.parameters);
  return { ...config, filters: { ...config.filters, [name]: { ...current, parameters } } };
}

function lastMixerIndex(config:CamillaConfig) {
  let result=-1;
  config.pipeline.forEach((step,index)=>{if(step.type==="Mixer")result=index;});
  return result;
}

function insertionIndex(config:CamillaConfig,raw:RawFilter) {
  if(raw.type==="Dither")return config.pipeline.length;
  const afterMixer=lastMixerIndex(config)+1;
  let index=config.pipeline.length;
  while(index>afterMixer){
    const step=config.pipeline[index-1];
    if(step.type!=="Filter"||!step.names.every((name)=>config.filters[name]?.type==="Dither"))break;
    index--;
  }
  return index;
}

export function addFilterToConfig(config:CamillaConfig,name:string,filter:RawFilter,channels:number[]):CamillaConfig {
  const pipeline=[...config.pipeline];
  pipeline.splice(insertionIndex(config,filter),0,{type:"Filter",channels:[...channels].sort((a,b)=>a-b),names:[name],bypassed:false});
  return {...config,filters:{...config.filters,[name]:filter},pipeline};
}

export function filterChannels(config:CamillaConfig,name:string) {
  return buildOutputChannels(config).filter((channel)=>channel.filterNames.includes(name)).map((channel)=>channel.output);
}

export function routeFilterInConfig(config:CamillaConfig,name:string,channels:number[]):CamillaConfig {
  const raw=config.filters[name];if(!raw)return config;
  const pipeline=config.pipeline.map((step)=>step.type==="Filter"&&step.names.includes(name)?{...step,names:step.names.filter((item)=>item!==name)}:step).filter((step)=>step.type!=="Filter"||step.names.length>0);
  const base={...config,pipeline};
  const next=[...pipeline];
  next.splice(insertionIndex(base,raw),0,{type:"Filter",channels:[...channels].sort((a,b)=>a-b),names:[name],bypassed:false});
  return {...base,pipeline:next};
}

export function removeFilterFromConfig(config:CamillaConfig,name:string):CamillaConfig {
  const pipeline=config.pipeline.map((step)=>step.type==="Filter"&&step.names.includes(name)?{...step,names:step.names.filter((item)=>item!==name)}:step).filter((step)=>step.type!=="Filter"||step.names.length>0);
  const filters={...config.filters};delete filters[name];
  return {...config,filters,pipeline};
}

export function toggleFilterBypass(config:CamillaConfig,name:string):CamillaConfig {
  const matching=config.pipeline.filter((step):step is PipelineFilterStep=>step.type==="Filter"&&step.names.includes(name));
  const shouldBypass=!matching.every((step)=>step.bypassed===true);
  const pipeline=config.pipeline.flatMap((step)=>{
    if(step.type!=="Filter"||!step.names.includes(name))return [step];
    if(step.names.length===1)return [{...step,bypassed:shouldBypass}];
    const at=step.names.indexOf(name);const result:PipelineFilterStep[]=[];
    if(at>0)result.push({...step,names:step.names.slice(0,at)});
    result.push({...step,names:[name],bypassed:shouldBypass});
    if(at<step.names.length-1)result.push({...step,names:step.names.slice(at+1)});
    return result;
  });
  return {...config,pipeline};
}

export function filterIsBypassed(config:CamillaConfig,name:string) {
  const steps=config.pipeline.filter((step):step is PipelineFilterStep=>step.type==="Filter"&&step.names.includes(name));
  return steps.length>0&&steps.every((step)=>step.bypassed===true);
}

export function moveFilterStep(config:CamillaConfig,name:string,direction:-1|1):CamillaConfig {
  let pipeline:CamillaConfig["pipeline"]=config.pipeline.flatMap((step)=>{
    if(step.type!=="Filter"||!step.names.includes(name)||step.names.length===1)return [step];
    const at=step.names.indexOf(name);const out:PipelineFilterStep[]=[];
    if(at>0)out.push({...step,names:step.names.slice(0,at)});out.push({...step,names:[name]});if(at<step.names.length-1)out.push({...step,names:step.names.slice(at+1)});return out;
  });
  const index=pipeline.findIndex((step)=>step.type==="Filter"&&step.names.includes(name));if(index<0)return config;
  const channels=new Set((pipeline[index] as PipelineFilterStep).channels??[]);
  let target=index+direction;
  while(target>=0&&target<pipeline.length){
    const step=pipeline[target];
    if(step.type==="Filter"&&(step.channels??[]).some((channel)=>channels.has(channel)))break;
    target+=direction;
  }
  if(target<0||target>=pipeline.length||pipeline[target].type!=="Filter")return config;
  pipeline=[...pipeline];[pipeline[index],pipeline[target]]=[pipeline[target],pipeline[index]];
  return {...config,pipeline};
}

export const fallbackConfig: CamillaConfig = {
  title: "DSP Stack - Active 3-way front + center + sub",
  description: "Direct USB TOSLINK input -> USB 6ch output",
  devices: { samplerate: 48000, chunksize: 1200, capture: { channels: 2 }, playback: { channels: 6 } },
  filters: {
    "EQ-high": { type: "BiquadCombo", parameters: { type: "GraphicEqualizer", freq_min: 20, freq_max: 20000, gains: [0, 0, 0, 0, 0, 0, 2.1, 2.9] } },
    av_delay: { type: "Delay", parameters: { delay: 6.5, subsample: null, unit: null } },
    c_hp120: { type: "BiquadCombo", parameters: { type: "LinkwitzRileyHighpass", freq: 120, order: 4 } },
    c_lp7000: { type: "BiquadCombo", parameters: { type: "LinkwitzRileyLowpass", freq: 7000, order: 4 } },
    fh_hp300: { type: "BiquadCombo", parameters: { type: "LinkwitzRileyHighpass", freq: 300, order: 4 } },
    lfe_limiter: { type: "Limiter", parameters: { clip_limit: -1, soft_clip: false } },
    mb_hp80: { type: "BiquadCombo", parameters: { type: "LinkwitzRileyHighpass", freq: 80, order: 4 } },
    mb_lp300: { type: "BiquadCombo", parameters: { type: "LinkwitzRileyLowpass", freq: 300, order: 4 } },
    output_headroom_12db: { type: "Gain", parameters: { gain: -12, inverted: false, mute: false, scale: "dB" } },
    sub_hp20: { type: "BiquadCombo", parameters: { type: "LinkwitzRileyHighpass", freq: 20, order: 4 } },
    sub_lp80: { type: "BiquadCombo", parameters: { type: "LinkwitzRileyLowpass", freq: 80, order: 4 } },
  },
  mixers: {
    route_inputs: { channels: { in: 2, out: 6 }, labels: ["LEFT-H", "RIGHT-H", "CENTER", "LFE", "LEFT-L", "RIGHT-L"], mapping: [
      { dest: 0, mute: false, sources: [{ channel: 0 }] }, { dest: 1, mute: false, sources: [{ channel: 1 }] },
      { dest: 2, mute: true, sources: [{ channel: 0 }, { channel: 1 }] }, { dest: 3, mute: false, sources: [{ channel: 0 }, { channel: 1 }] },
      { dest: 4, mute: false, sources: [{ channel: 0 }] }, { dest: 5, mute: false, sources: [{ channel: 1 }] },
    ] },
    select_source: { channels: { in: 2, out: 2 }, labels: ["LEFT", "RIGHT"], mapping: [{ dest: 0, sources: [{ channel: 0 }] }, { dest: 1, sources: [{ channel: 1 }] }] },
    stereo_widen: { channels: { in: 6, out: 6 }, labels: null, mapping: Array.from({ length: 6 }, (_, dest) => ({ dest, sources: [{ channel: dest }] })) },
  },
  pipeline: [
    { type: "Mixer", name: "select_source" }, { type: "Filter", channels: [0, 1], names: ["av_delay"] },
    { type: "Mixer", name: "route_inputs" }, { type: "Mixer", name: "stereo_widen" },
    { type: "Filter", channels: [0, 1, 2, 4, 5], names: ["output_headroom_12db"] },
    { type: "Filter", channels: [0, 1], names: ["fh_hp300"] }, { type: "Filter", channels: [2], names: ["c_hp120", "c_lp7000"] },
    { type: "Filter", channels: [3], names: ["sub_hp20", "sub_lp80"] }, { type: "Filter", channels: [3], names: ["lfe_limiter"] },
    { type: "Filter", channels: [4, 5], names: ["mb_hp80", "mb_lp300"] }, { type: "Filter", channels: [0, 1], names: ["EQ-high"] },
  ],
};
