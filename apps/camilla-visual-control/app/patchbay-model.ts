import { CamillaConfig, MixerMapping, MixerSource } from "./camilla-model";

export type PatchbayDiagnostic = {
  severity: "error" | "warning";
  path: string;
  message: string;
};

export type PatchbayGraphNode = { label: string; detail: string; muted: boolean; passive?: boolean };
export type PatchbayGraphStage = { id: string; title: string; detail: string; kind: "capture" | "mixer" | "filter" | "playback"; nodes: PatchbayGraphNode[] };
export type PatchbayGraphEdge = { fromStage: number; fromNode: number; toStage: number; toNode: number; label: string; muted: boolean };
export type PatchbayGraph = { stages: PatchbayGraphStage[]; edges: PatchbayGraphEdge[]; maxChannels: number };

function sourceLabel(source: MixerSource) {
  const labels: string[] = [];
  if (source.gain !== undefined) labels.push(source.scale === "linear" ? `×${source.gain}` : `${source.gain} dB`);
  if (source.mute === true) labels.push("mute");
  return labels.join(" · ");
}

export function buildPatchbayGraph(config: CamillaConfig): PatchbayGraph {
  const stages: PatchbayGraphStage[] = [{
    id: "capture",
    title: String(config.devices.capture.device ?? config.devices.capture.type ?? "CAPTURA"),
    detail: `${config.devices.capture.channels} canais`,
    kind: "capture",
    nodes: Array.from({ length: config.devices.capture.channels }, (_, channel) => ({ label: `IN ${channel}`, detail: "captura", muted: false })),
  }];
  const edges: PatchbayGraphEdge[] = [];
  let channelCount = config.devices.capture.channels;
  for (const [pipelineIndex, step] of config.pipeline.entries()) {
    const fromStage = stages.length - 1;
    if (step.type === "Mixer") {
      const mixer = config.mixers[step.name];
      const outputCount = mixer?.channels.out ?? channelCount;
      const stageIndex = stages.length;
      stages.push({
        id: `mixer-${pipelineIndex}-${step.name}`,
        title: step.name,
        detail: mixer ? `${mixer.channels.in} → ${mixer.channels.out}` : "referência ausente",
        kind: "mixer",
        nodes: Array.from({ length: outputCount }, (_, dest) => {
          const mapping = mixer?.mapping.find((item) => item.dest === dest);
          const label = mixer?.labels?.[dest]?.trim() || `OUT ${dest}`;
          return { label, detail: mapping ? `${mapping.sources.length} fonte${mapping.sources.length === 1 ? "" : "s"}` : "sem mapeamento", muted: step.bypassed === true || mapping?.mute === true || !mapping?.sources.length };
        }),
      });
      if (mixer) for (const mapping of mixer.mapping) for (const source of mapping.sources) {
        if (source.channel < 0 || source.channel >= channelCount || mapping.dest < 0 || mapping.dest >= outputCount) continue;
        edges.push({ fromStage, fromNode: source.channel, toStage: stageIndex, toNode: mapping.dest, label: sourceLabel(source), muted: step.bypassed === true || mapping.mute === true || source.mute === true });
      }
      channelCount = outputCount;
      continue;
    }
    const stageIndex = stages.length;
    const targets = new Set(step.channels ?? Array.from({ length: channelCount }, (_, channel) => channel));
    const label = step.names.join(" · ") || "Filtro sem referência";
    stages.push({
      id: `filter-${pipelineIndex}`,
      title: step.names.length === 1 ? step.names[0] : "GRUPO DE FILTROS",
      detail: `${step.names.length} filtro${step.names.length === 1 ? "" : "s"}${step.bypassed ? " · bypass" : ""}`,
      kind: "filter",
      nodes: Array.from({ length: channelCount }, (_, channel) => targets.has(channel)
        ? { label, detail: `CH ${channel}${step.bypassed ? " · BYPASS" : ""}`, muted: false }
        : { label: "PASS", detail: `CH ${channel}`, muted: false, passive: true }),
    });
    for (let channel = 0; channel < channelCount; channel += 1) edges.push({ fromStage, fromNode: channel, toStage: stageIndex, toNode: channel, label: "", muted: false });
  }
  const playbackStage = stages.length;
  const playbackCount = config.devices.playback.channels;
  stages.push({
    id: "playback",
    title: String(config.devices.playback.device ?? config.devices.playback.type ?? "PLAYBACK"),
    detail: `${playbackCount} canais`,
    kind: "playback",
    nodes: Array.from({ length: playbackCount }, (_, channel) => ({ label: `OUT ${channel}`, detail: "playback", muted: false })),
  });
  for (let channel = 0; channel < Math.min(channelCount, playbackCount); channel += 1) edges.push({ fromStage: playbackStage - 1, fromNode: channel, toStage: playbackStage, toNode: channel, label: "", muted: false });
  return { stages, edges, maxChannels: Math.max(1, ...stages.map((stage) => stage.nodes.length)) };
}

function updateMixer(
  config: CamillaConfig,
  mixerName: string,
  transform: (mapping: MixerMapping[]) => MixerMapping[],
): CamillaConfig {
  const mixer = config.mixers[mixerName];
  if (!mixer) return config;
  return {
    ...config,
    mixers: {
      ...config.mixers,
      [mixerName]: { ...mixer, mapping: transform(mixer.mapping) },
    },
  };
}

function mappingForDestination(mapping: MixerMapping[], dest: number) {
  return mapping.find((item) => item.dest === dest);
}

export function addMixerSource(config: CamillaConfig, mixerName: string, dest: number, channel: number): CamillaConfig {
  return updateMixer(config, mixerName, (mapping) => {
    const existing = mappingForDestination(mapping, dest);
    const source: MixerSource = { channel, gain: 0, scale: "dB", mute: false };
    if (!existing) return [...mapping, { dest, mute: false, sources: [source] }].sort((left, right) => left.dest - right.dest);
    return mapping.map((item) => item.dest === dest ? { ...item, sources: [...item.sources, source] } : item);
  });
}

export function patchMixerSource(
  config: CamillaConfig,
  mixerName: string,
  dest: number,
  sourceIndex: number,
  values: Partial<MixerSource>,
): CamillaConfig {
  return updateMixer(config, mixerName, (mapping) => mapping.map((item) => item.dest !== dest ? item : {
    ...item,
    sources: item.sources.map((source, index) => index === sourceIndex ? { ...source, ...values } : source),
  }));
}

export function removeMixerSource(config: CamillaConfig, mixerName: string, dest: number, sourceIndex: number): CamillaConfig {
  return updateMixer(config, mixerName, (mapping) => mapping.map((item) => item.dest !== dest ? item : {
    ...item,
    sources: item.sources.filter((_, index) => index !== sourceIndex),
  }));
}

export function setMixerSourceScale(config: CamillaConfig, mixerName: string, dest: number, sourceIndex: number, scale: "dB" | "linear"): CamillaConfig {
  const source = config.mixers[mixerName]?.mapping.find((item) => item.dest === dest)?.sources[sourceIndex];
  if (!source) return config;
  const currentScale = source.scale === "linear" ? "linear" : "dB";
  if (currentScale === scale) return config;
  const currentGain = Number(source.gain ?? (currentScale === "linear" ? 1 : 0));
  const gain = scale === "linear" ? 10 ** (currentGain / 20) : 20 * Math.log10(Math.max(currentGain, 1e-6));
  return patchMixerSource(config, mixerName, dest, sourceIndex, { scale, gain: Math.round(gain * 10000) / 10000 });
}

export function setMixerDestinationMute(config: CamillaConfig, mixerName: string, dest: number, mute: boolean): CamillaConfig {
  return updateMixer(config, mixerName, (mapping) => {
    const existing = mappingForDestination(mapping, dest);
    if (!existing) return [...mapping, { dest, mute, sources: [] }].sort((left, right) => left.dest - right.dest);
    return mapping.map((item) => item.dest === dest ? { ...item, mute } : item);
  });
}

export function validatePatchbay(config: CamillaConfig): PatchbayDiagnostic[] {
  const diagnostics: PatchbayDiagnostic[] = [];
  for (const [name, mixer] of Object.entries(config.mixers)) {
    if (!Number.isInteger(mixer.channels.in) || mixer.channels.in < 1) diagnostics.push({ severity: "error", path: `mixers.${name}.channels.in`, message: "O mixer precisa ter pelo menos uma entrada." });
    if (!Number.isInteger(mixer.channels.out) || mixer.channels.out < 1) diagnostics.push({ severity: "error", path: `mixers.${name}.channels.out`, message: "O mixer precisa ter pelo menos uma saída." });
    if (mixer.labels && mixer.labels.length !== mixer.channels.out) diagnostics.push({ severity: "warning", path: `mixers.${name}.labels`, message: `Há ${mixer.labels.length} labels para ${mixer.channels.out} saídas.` });
    const destinations = new Set<number>();
    for (const [mappingIndex, mapping] of mixer.mapping.entries()) {
      const path = `mixers.${name}.mapping[${mappingIndex}]`;
      if (!Number.isInteger(mapping.dest) || mapping.dest < 0 || mapping.dest >= mixer.channels.out) diagnostics.push({ severity: "error", path: `${path}.dest`, message: `Destino ${mapping.dest} fora do intervalo 0–${Math.max(0, mixer.channels.out - 1)}.` });
      if (destinations.has(mapping.dest)) diagnostics.push({ severity: "error", path: `${path}.dest`, message: `O destino ${mapping.dest} aparece mais de uma vez.` });
      destinations.add(mapping.dest);
      if (mapping.sources.length === 0) diagnostics.push({ severity: "warning", path: `${path}.sources`, message: `A saída ${mapping.dest} está sem fonte.` });
      for (const [sourceIndex, source] of mapping.sources.entries()) {
        if (!Number.isInteger(source.channel) || source.channel < 0 || source.channel >= mixer.channels.in) diagnostics.push({ severity: "error", path: `${path}.sources[${sourceIndex}].channel`, message: `Fonte ${source.channel} fora do intervalo 0–${Math.max(0, mixer.channels.in - 1)}.` });
        if (source.gain !== undefined && !Number.isFinite(source.gain)) diagnostics.push({ severity: "error", path: `${path}.sources[${sourceIndex}].gain`, message: "O ganho precisa ser numérico." });
        if (source.scale !== undefined && source.scale !== "dB" && source.scale !== "linear") diagnostics.push({ severity: "error", path: `${path}.sources[${sourceIndex}].scale`, message: `Escala ${source.scale} não suportada pelo editor.` });
      }
    }
    for (let dest = 0; dest < mixer.channels.out; dest += 1) {
      if (!destinations.has(dest)) diagnostics.push({ severity: "warning", path: `mixers.${name}.mapping`, message: `A saída ${dest} ainda não possui mapeamento.` });
    }
  }
  for (const [index, step] of config.pipeline.entries()) {
    if (step.type === "Mixer" && !config.mixers[step.name]) diagnostics.push({ severity: "error", path: `pipeline[${index}]`, message: `O pipeline referencia o mixer inexistente ${step.name}.` });
    if (step.type === "Filter") {
      for (const name of step.names) if (!config.filters[name]) diagnostics.push({ severity: "error", path: `pipeline[${index}]`, message: `O pipeline referencia o filtro inexistente ${name}.` });
    }
  }
  return diagnostics;
}
