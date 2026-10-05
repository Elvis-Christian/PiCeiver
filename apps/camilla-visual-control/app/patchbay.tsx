"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { CamillaConfig } from "./camilla-model";
import { addMixerSource, buildPatchbayGraph, patchMixerSource, removeMixerSource, setMixerDestinationMute, setMixerSourceScale, validatePatchbay } from "./patchbay-model";
import { createPatchbayHistory, patchbayIsDirty, patchbayReducer } from "./patchbay-reducer";

const laneColors = ["#59a8ff", "#ff9f43", "#8bc95d", "#f05f4f", "#a97ae8", "#c9856d", "#56c9c1", "#e2bd57"];

type GraphViewMode = "stages" | "channels";

type CompactSegment = {
  id: string;
  title: string;
  detail: string;
  kind: "capture" | "mixer" | "playback" | "filter-bank";
  nodes: ReturnType<typeof buildPatchbayGraph>["stages"][number]["nodes"];
  startStage: number;
  endStage: number;
  channelLabels?: string[];
  filtersByChannel?: Array<Array<{ label: string; detail: string; muted: boolean }>>;
};

function compactGraphStages(graph: ReturnType<typeof buildPatchbayGraph>): CompactSegment[] {
  const segments: CompactSegment[] = [];
  const channelLabelsBefore = (stageIndex: number, channelCount: number) => {
    let fallback: string[] | undefined;
    for (let candidateIndex = stageIndex - 1; candidateIndex >= 0; candidateIndex -= 1) {
      const nodes = graph.stages[candidateIndex].nodes;
      if (nodes.length !== channelCount) continue;
      const labels = nodes.map((node, channel) => node.label || `CH ${channel}`);
      fallback ??= labels;
      if (labels.some((label) => !/^(?:IN|OUT)\s+\d+$/i.test(label))) return labels;
    }
    return fallback ?? Array.from({ length: channelCount }, (_, channel) => `CH ${channel}`);
  };
  for (let stageIndex = 0; stageIndex < graph.stages.length;) {
    const stage = graph.stages[stageIndex];
    if (stage.kind !== "filter") {
      segments.push({ ...stage, startStage: stageIndex, endStage: stageIndex });
      stageIndex += 1;
      continue;
    }
    const startStage = stageIndex;
    const filterStages = [];
    while (stageIndex < graph.stages.length && graph.stages[stageIndex].kind === "filter") {
      filterStages.push(graph.stages[stageIndex]);
      stageIndex += 1;
    }
    const channelCount = Math.max(1, ...filterStages.map((item) => item.nodes.length));
    const filtersByChannel = Array.from({ length: channelCount }, (_, channel) => filterStages.flatMap((item) => {
      const node = item.nodes[channel];
      return node && !node.passive ? [{ label: node.label, detail: node.detail, muted: node.muted }] : [];
    }));
    segments.push({
      id: `filter-bank-${startStage}`,
      title: filterStages.length === 1 ? filterStages[0].title : "FILTROS POR CANAL",
      detail: `${filterStages.length} etapa${filterStages.length === 1 ? "" : "s"} · ${channelCount} canais`,
      kind: "filter-bank",
      nodes: filterStages[0].nodes,
      startStage,
      endStage: stageIndex - 1,
      channelLabels: channelLabelsBefore(startStage, channelCount),
      filtersByChannel,
    });
  }
  return segments;
}

function PipelineGraph({ config, selectedMixer, onSelectMixer }: { config: CamillaConfig; selectedMixer: string; onSelectMixer: (name: string) => void }) {
  const graph = useMemo(() => buildPatchbayGraph(config), [config]);
  const compactSegments = useMemo(() => compactGraphStages(graph), [graph]);
  const [viewMode, setViewMode] = useState<GraphViewMode>("stages");
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 1600, height: 400 });
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setViewport({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const width = Math.max(320, viewport.width);
  const height = Math.max(220, viewport.height);
  const horizontalPadding = 20;
  const stageStep = (width - horizontalPadding * 2) / graph.stages.length;
  const stageWidth = Math.max(48, stageStep - 12);
  const top = 62;
  const rowStep = Math.min(58, Math.max(32, (height - top - 18) / graph.maxChannels));
  const nodeHeight = Math.min(42, Math.max(26, rowStep - 8));
  const nodeTop = (stageIndex: number, nodeIndex: number) => top + ((graph.maxChannels - graph.stages[stageIndex].nodes.length) * rowStep) / 2 + nodeIndex * rowStep;
  const renderStageGraph = () => <div className="patch-graph" style={{ width, height }}>
      <svg className="patch-graph-wires" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Conexões entre canais, mixers e filtros">
        <defs><marker id="patch-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 8 4 L 0 8 z" /></marker></defs>
        {graph.edges.map((edge, index) => {
          const x1 = horizontalPadding + edge.fromStage * stageStep + stageWidth;
          const x2 = horizontalPadding + edge.toStage * stageStep;
          const y1 = nodeTop(edge.fromStage, edge.fromNode) + nodeHeight / 2;
          const y2 = nodeTop(edge.toStage, edge.toNode) + nodeHeight / 2;
          const color = laneColors[edge.toNode % laneColors.length];
          return <g key={`${edge.fromStage}-${edge.fromNode}-${edge.toStage}-${edge.toNode}-${index}`} className={edge.muted ? "muted" : ""} style={{ color }}>
            <path d={`M ${x1} ${y1} C ${x1 + 58} ${y1}, ${x2 - 58} ${y2}, ${x2} ${y2}`} markerEnd="url(#patch-arrow)" />
            {edge.label && <text x={x2 - 12} y={y2 - 7} textAnchor="end">{edge.label}</text>}
          </g>;
        })}
      </svg>
      {graph.stages.map((stage, stageIndex) => {
        const left = horizontalPadding + stageIndex * stageStep;
        const isSelected = stage.kind === "mixer" && selectedMixer === stage.title;
        return <div className={`patch-graph-stage ${stage.kind} ${isSelected ? "selected" : ""}`} style={{ left, top: 18, width: stageWidth, height: height - 42 }} key={stage.id}>
          {stage.kind === "mixer" ? <button className="patch-stage-title" onClick={() => onSelectMixer(stage.title)}><b>{stage.title}</b><span>{stage.detail}</span></button> : <div className="patch-stage-title"><b>{stage.title}</b><span>{stage.detail}</span></div>}
          {stage.nodes.map((node, nodeIndex) => <div className={`patch-graph-node ${node.muted ? "muted" : ""} ${node.passive ? "passive" : ""}`} style={{ top: nodeTop(stageIndex, nodeIndex) - 18, height: nodeHeight, "--lane-color": laneColors[nodeIndex % laneColors.length] } as React.CSSProperties} key={`${stage.id}-${nodeIndex}`}><b>{node.label}</b><span>{node.detail}</span></div>)}
        </div>;
      })}
    </div>;

  const renderChannelGraph = () => {
    const gap = 12;
    const availableWidth = width - horizontalPadding * 2 - gap * Math.max(0, compactSegments.length - 1);
    const weights = compactSegments.map((segment) => segment.kind === "filter-bank" ? Math.min(4.6, 1.35 + (segment.filtersByChannel?.length ?? 1) * .48) : 1);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let cursor = horizontalPadding;
    const layouts = compactSegments.map((segment, index) => {
      const segmentWidth = availableWidth * (weights[index] / totalWeight);
      const layout = { segment, left: cursor, width: segmentWidth };
      cursor += segmentWidth + gap;
      return layout;
    });
    const normalNodeTop = (segment: CompactSegment, nodeIndex: number) => top + ((graph.maxChannels - segment.nodes.length) * rowStep) / 2 + nodeIndex * rowStep;
    const anchor = (segmentIndex: number, nodeIndex: number, side: "in" | "out") => {
      const layout = layouts[segmentIndex];
      if (layout.segment.kind === "filter-bank") {
        const count = Math.max(1, layout.segment.filtersByChannel?.length ?? 1);
        const columnWidth = (layout.width - 16) / count;
        return { x: layout.left + 8 + columnWidth * (nodeIndex + .5), y: side === "in" ? 62 : height - 23 };
      }
      return { x: layout.left + (side === "out" ? layout.width : 0), y: normalNodeTop(layout.segment, nodeIndex) + nodeHeight / 2 };
    };
    const boundaryEdges = compactSegments.flatMap((segment, segmentIndex) => segmentIndex === compactSegments.length - 1 ? [] : graph.edges
      .filter((edge) => edge.fromStage === segment.endStage && edge.toStage === compactSegments[segmentIndex + 1].startStage)
      .map((edge) => ({ ...edge, fromSegment: segmentIndex, toSegment: segmentIndex + 1 })));
    return <div className="patch-graph patch-graph-channels" style={{ width, height }}>
      <svg className="patch-graph-wires" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Pipeline compacto, com filtros empilhados por canal">
        <defs><marker id="patch-arrow-compact" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 8 4 L 0 8 z" /></marker></defs>
        {boundaryEdges.map((edge, index) => {
          const from = anchor(edge.fromSegment, edge.fromNode, "out");
          const to = anchor(edge.toSegment, edge.toNode, "in");
          const color = laneColors[edge.toNode % laneColors.length];
          const verticalEntry = compactSegments[edge.toSegment].kind === "filter-bank";
          const verticalExit = compactSegments[edge.fromSegment].kind === "filter-bank";
          const path = verticalEntry || verticalExit
            ? `M ${from.x} ${from.y} C ${(from.x + to.x) / 2} ${from.y}, ${(from.x + to.x) / 2} ${to.y}, ${to.x} ${to.y}`
            : `M ${from.x} ${from.y} C ${from.x + 42} ${from.y}, ${to.x - 42} ${to.y}, ${to.x} ${to.y}`;
          return <g key={`${edge.fromSegment}-${edge.fromNode}-${edge.toSegment}-${edge.toNode}-${index}`} className={edge.muted ? "muted" : ""} style={{ color }}>
            <path d={path} markerEnd="url(#patch-arrow-compact)" />
            {edge.label && <text x={to.x - 9} y={to.y - 7} textAnchor="end">{edge.label}</text>}
          </g>;
        })}
      </svg>
      {layouts.map(({ segment, left, width: segmentWidth }) => {
        const isSelected = segment.kind === "mixer" && selectedMixer === segment.title;
        if (segment.kind === "filter-bank") return <div className="patch-filter-bank" style={{ left, top: 18, width: segmentWidth, height: height - 42 }} key={segment.id}>
          <div className="patch-stage-title"><b>{segment.title}</b><span>{segment.detail}</span></div>
          <div className="patch-channel-columns">
            {segment.filtersByChannel?.map((filters, channel) => <section className="patch-channel-column" style={{ "--lane-color": laneColors[channel % laneColors.length] } as React.CSSProperties} key={channel}>
              <header><b>{segment.channelLabels?.[channel]}</b><span>CH {channel}</span></header>
              <div className="patch-channel-filters" style={{ "--filter-count": Math.max(1, filters.length) } as React.CSSProperties}>
                {filters.length ? filters.map((filter, filterIndex) => <div className={`patch-channel-filter ${filter.muted ? "muted" : ""}`} key={`${filter.label}-${filterIndex}`}><b>{filter.label}</b><span>{filter.detail}</span></div>) : <div className="patch-channel-filter passive"><b>PASS</b><span>sem filtros</span></div>}
              </div>
            </section>)}
          </div>
        </div>;
        return <div className={`patch-graph-stage ${segment.kind} ${isSelected ? "selected" : ""}`} style={{ left, top: 18, width: segmentWidth, height: height - 42 }} key={segment.id}>
          {segment.kind === "mixer" ? <button className="patch-stage-title" onClick={() => onSelectMixer(segment.title)}><b>{segment.title}</b><span>{segment.detail}</span></button> : <div className="patch-stage-title"><b>{segment.title}</b><span>{segment.detail}</span></div>}
          {segment.nodes.map((node, nodeIndex) => <div className={`patch-graph-node ${node.muted ? "muted" : ""} ${node.passive ? "passive" : ""}`} style={{ top: normalNodeTop(segment, nodeIndex) - 18, height: nodeHeight, "--lane-color": laneColors[nodeIndex % laneColors.length] } as React.CSSProperties} key={`${segment.id}-${nodeIndex}`}><b>{node.label}</b><span>{node.detail}</span></div>)}
        </div>;
      })}
    </div>;
  };

  return <section className="patch-graph-shell" aria-label="Fluxo completo do pipeline">
    <div className="patch-graph-heading"><div><small>FLUXO COMPLETO · YAML ATIVO</small><b>{viewMode === "stages" ? `${graph.stages.length} estágios` : `${graph.maxChannels} canais`} · {graph.edges.length} conexões</b></div><div className="patch-graph-controls"><div className="patch-graph-legend"><span><i /> sinal ativo</span><span className="muted"><i /> mute</span><span className="pass"><i /> passagem</span></div><div className="patch-view-switch" role="group" aria-label="Modo de visualização"><button className={viewMode === "stages" ? "active" : ""} aria-pressed={viewMode === "stages"} onClick={() => setViewMode("stages")}>ETAPAS</button><button className={viewMode === "channels" ? "active" : ""} aria-pressed={viewMode === "channels"} onClick={() => setViewMode("channels")}>CANAIS</button></div></div></div>
    <div className="patch-graph-viewport" ref={viewportRef}>{viewMode === "stages" ? renderStageGraph() : renderChannelGraph()}</div>
  </section>;
}

export function Patchbay({ open, config, busy, onClose, onApply }: { open: boolean; config: CamillaConfig; busy: boolean; onClose: () => void; onApply: (draft: CamillaConfig) => Promise<CamillaConfig> }) {
  const [history, dispatch] = useReducer(patchbayReducer, config, createPatchbayHistory);
  const [selected, setSelected] = useState(Object.keys(config.mixers)[0] ?? "");
  const [applyError, setApplyError] = useState("");
  const draft = history.present;
  const dirty = patchbayIsDirty(history);
  const diagnostics = useMemo(() => validatePatchbay(draft), [draft]);
  const errors = diagnostics.filter((item) => item.severity === "error");
  const mixer = draft.mixers[selected];
  if (!open) return null;

  const edit = (next: CamillaConfig) => dispatch({ type: "edit", config: next });
  const close = () => { if (!dirty || window.confirm("Descartar o rascunho do Patchbay?")) onClose(); };
  const apply = async () => {
    if (!dirty || errors.length || busy) return;
    setApplyError("");
    try {
      const confirmed = await onApply(draft);
      dispatch({ type: "reset", config: confirmed });
    } catch (reason) {
      setApplyError(reason instanceof Error ? reason.message : "Não foi possível aplicar o rascunho.");
    }
  };

  return <div className="patchbay-screen" role="dialog" aria-modal="true" aria-label="Patchbay">
    <header><div><small>PATCHBAY · RASCUNHO ESTRUTURAL</small><h2>Mixers e pipeline</h2><p>O pipeline mostra a ordem do sinal. A mesa abaixo edita cada conexão do mixer sem depender de arrastar e soltar.</p></div><button onClick={close} aria-label="Fechar Patchbay">×</button></header>
    <div className="patchbay-toolbar">
      <span className={dirty ? "draft" : "confirmed"}>{dirty ? "RASCUNHO NÃO APLICADO" : "CONFIGURAÇÃO CONFIRMADA"}</span>
      <button disabled={!history.past.length || busy} onClick={() => dispatch({ type: "undo" })}>DESFAZER</button>
      <button disabled={!history.future.length || busy} onClick={() => dispatch({ type: "redo" })}>REFAZER</button>
      <button disabled={!dirty || busy} onClick={() => dispatch({ type: "discard" })}>DESCARTAR</button>
      <button className="patch-apply" disabled={!dirty || errors.length > 0 || busy} onClick={() => void apply()}>{busy ? "APLICANDO…" : "VALIDAR E APLICAR"}</button>
    </div>
    <PipelineGraph config={draft} selectedMixer={selected} onSelectMixer={setSelected} />
    <section className="patch-inspector"><div className="patch-inspector-title"><div><small>MESA DE MIXER</small><h3>{selected || "Nenhum mixer"}</h3></div>{mixer && <span>{mixer.channels.in} entradas · {mixer.channels.out} saídas</span>}</div>
      {mixer ? <div className="patch-edit-matrix">{Array.from({ length: mixer.channels.out }, (_, dest) => {
        const mapping = mixer.mapping.find((item) => item.dest === dest);
        return <section className="patch-destination" key={dest}>
          <header><div><b>OUT {dest}</b><span>{mixer.labels?.[dest] || `Saída ${dest}`}</span></div><label><input type="checkbox" checked={mapping?.mute === true} onChange={(event) => edit(setMixerDestinationMute(draft, selected, dest, event.target.checked))} /> MUTAR DESTINO</label></header>
          <div className="patch-sources">{mapping?.sources.map((source, sourceIndex) => <div className={`patch-source ${source.mute ? "muted" : ""}`} key={`${dest}-${sourceIndex}`}>
            <label><span>FONTE</span><select value={source.channel} onChange={(event) => edit(patchMixerSource(draft, selected, dest, sourceIndex, { channel: Number(event.target.value) }))}>{Array.from({ length: mixer.channels.in }, (_, channel) => <option value={channel} key={channel}>IN {channel}</option>)}</select></label>
            <label><span>GANHO</span><input type="number" step="0.1" value={source.gain ?? (source.scale === "linear" ? 1 : 0)} onChange={(event) => edit(patchMixerSource(draft, selected, dest, sourceIndex, { gain: Number(event.target.value) }))} /></label>
            <label><span>ESCALA</span><select value={source.scale ?? "dB"} onChange={(event) => edit(setMixerSourceScale(draft, selected, dest, sourceIndex, event.target.value as "dB" | "linear"))}><option value="dB">dB</option><option value="linear">linear</option></select></label>
            <label className="patch-source-mute"><input type="checkbox" checked={source.mute === true} onChange={(event) => edit(patchMixerSource(draft, selected, dest, sourceIndex, { mute: event.target.checked }))} /> MUTE</label>
            <button className="patch-remove" onClick={() => edit(removeMixerSource(draft, selected, dest, sourceIndex))} aria-label={`Remover IN ${source.channel} de OUT ${dest}`}>×</button>
          </div>) || <em>Sem fonte conectada.</em>}</div>
          <button className="patch-add-source" onClick={() => edit(addMixerSource(draft, selected, dest, 0))}>＋ CONECTAR FONTE</button>
        </section>;
      })}</div> : <p>O YAML não contém este mixer. Se a referência aparece no pipeline, ela precisa ser corrigida antes de aplicar.</p>}
      {(diagnostics.length > 0 || applyError) && <div className="patch-diagnostics" role="status">{applyError && <p className="error"><b>BACKEND</b><span>{applyError}</span></p>}{diagnostics.map((item, index) => <p className={item.severity} key={`${item.path}-${index}`}><b>{item.severity === "error" ? "ERRO" : "AVISO"}</b><span>{item.message} <code>{item.path}</code></span></p>)}</div>}
    </section>
  </div>;
}
