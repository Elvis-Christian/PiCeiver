"use client";

import { useState } from "react";
import { CamillaConfig } from "./camilla-model";

type DeviceKind = "capture" | "playback";
const kinds = ["Alsa", "Wasapi", "Jack", "CoreAudio", "Pulse", "RawFile", "WavFile", "Stdin", "Bluez"];

function numberValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function DeviceFields({ kind, value, onChange }: { kind: DeviceKind; value: Record<string, unknown>; onChange: (next: Record<string, unknown>) => void }) {
  const patch = (key: string, next: string | number) => onChange({ ...value, [key]: next });
  return <section className={`device-card ${kind}`}>
    <div><small>{kind === "capture" ? "ENTRADA / CAPTURA" : "SAÍDA / PLAYBACK"}</small><h3>{kind === "capture" ? "Fonte que alimenta o DSP" : "Destino processado pelo DSP"}</h3><p>Estes parâmetros pertencem somente à {kind === "capture" ? "captura" : "saída"}.</p></div>
    <div className="device-fields">
      <label><span>BACKEND</span><select value={String(value.type ?? "Alsa")} onChange={(event) => patch("type", event.target.value)}>{kinds.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span>CANAIS</span><input type="number" min="1" max="64" value={numberValue(value.channels, kind === "capture" ? 2 : 2)} onChange={(event) => patch("channels", numberValue(event.target.value, 2))} /></label>
      <label><span>DEVICE / IDENTIFICADOR</span><input value={String(value.device ?? "")} onChange={(event) => patch("device", event.target.value)} placeholder={kind === "capture" ? "plughw:1,0" : "camilla_tee"} /></label>
      <label><span>FORMATO</span><input value={String(value.format ?? "S32LE")} onChange={(event) => patch("format", event.target.value)} placeholder="S32LE" /></label>
    </div>
  </section>;
}

export function SettingsManager({ config, busy, linkedPairs, onLinkedPairs, onClose, onApply }: { config: CamillaConfig; busy: boolean; linkedPairs: Array<[number, number]>; onLinkedPairs: (pairs: Array<[number, number]>) => void; onClose: () => void; onApply: (next: CamillaConfig) => Promise<void> }) {
  const [draft, setDraft] = useState<CamillaConfig>(() => structuredClone(config));
  const [advanced, setAdvanced] = useState(false);
  const [advancedText, setAdvancedText] = useState(() => JSON.stringify(config.devices, null, 2));
  const [pairs, setPairs] = useState<Array<[number, number]>>(linkedPairs);
  const [pairLeft, setPairLeft] = useState(0);
  const [pairRight, setPairRight] = useState(1);
  const [error, setError] = useState("");
  const protectedOutput = draft.devices.playback.device === "camilla_tee" && draft.devices.playback.channels === 6;
  const updateDevice = (key: DeviceKind, value: Record<string, unknown>) => setDraft((current) => ({ ...current, devices: { ...current.devices, [key]: value } }));
  const apply = async () => {
    if (draft.devices.capture.channels < 1 || draft.devices.playback.channels < 1) { setError("Captura e saída precisam ter pelo menos um canal."); return; }
    if (!protectedOutput && !window.confirm("A saída deixará de usar camilla_tee com 6 canais. O espectro por saída e a interface atual podem deixar de refletir o DSP até que o roteamento seja reconfigurado. Aplicar mesmo assim?")) return;
    try { setError(""); await onApply(draft); onLinkedPairs(pairs); onClose(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível aplicar as configurações."); }
  };
  return <div className="modal-backdrop"><section className="settings-manager" role="dialog" aria-modal="true" aria-label="Configurações do sistema">
    <header><div><small>CONFIGURAÇÃO DO SISTEMA</small><h2>Interfaces, clock e identidade</h2></div><button onClick={onClose} aria-label="Fechar">×</button></header>
    <div className="settings-intro"><span>As alterações só entram no DSP ao usar <b>VALIDAR E APLICAR</b>. Salvar YAML continua sendo uma ação separada.</span>{!protectedOutput && <em>ANÁLISE ESPECTRAL NÃO PROTEGIDA</em>}</div>
    <div className="settings-grid">
      <section className="settings-project"><small>PROJETO</small><label><span>TÍTULO</span><input value={draft.title ?? ""} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Nome visível do sistema" /></label><label><span>DESCRIÇÃO</span><textarea value={draft.description ?? ""} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Objetivo, ambiente ou observações" /></label></section>
      <section className="settings-engine"><small>CLOCK E MOTOR</small><div className="engine-fields"><label><span>SAMPLE RATE</span><input type="number" min="8000" step="1000" value={numberValue(draft.devices.samplerate, 48000)} onChange={(event) => setDraft((current) => ({ ...current, devices: { ...current.devices, samplerate: numberValue(event.target.value, 48000) } }))} /></label><label><span>CHUNK SIZE</span><input type="number" min="16" step="1" value={numberValue(draft.devices.chunksize, 1024)} onChange={(event) => setDraft((current) => ({ ...current, devices: { ...current.devices, chunksize: numberValue(event.target.value, 1024) } }))} /></label><label><span>QUEUE LIMIT</span><input type="number" min="1" step="1" value={numberValue(draft.devices.queuelimit, 4)} onChange={(event) => setDraft((current) => ({ ...current, devices: { ...current.devices, queuelimit: numberValue(event.target.value, 4) } }))} /></label></div></section>
      <section className="settings-links"><small>PAINEL DE CANAIS</small><h3>Pares vinculados</h3><p>Um par aparece como um canal no painel. O ganho vira o centro, e o balanço atenua um lado até mute.</p><div className="link-add"><select value={pairLeft} onChange={(event) => setPairLeft(Number(event.target.value))}>{Array.from({ length: draft.devices.playback.channels }, (_, item) => <option key={item} value={item}>Canal {item}</option>)}</select><span>↔</span><select value={pairRight} onChange={(event) => setPairRight(Number(event.target.value))}>{Array.from({ length: draft.devices.playback.channels }, (_, item) => <option key={item} value={item}>Canal {item}</option>)}</select><button disabled={pairLeft === pairRight || pairs.some(([left, right]) => left === pairLeft || right === pairLeft || left === pairRight || right === pairRight)} onClick={() => setPairs((current) => [...current, [Math.min(pairLeft, pairRight), Math.max(pairLeft, pairRight)]])}>VINCULAR</button></div><div className="link-list">{pairs.length ? pairs.map((pair) => <span key={pair.join("-")}>Canais {pair[0]} + {pair[1]}<button onClick={() => setPairs((current) => current.filter((item) => item !== pair))}>×</button></span>) : <em>Nenhum par vinculado.</em>}</div></section>
      <DeviceFields kind="capture" value={draft.devices.capture} onChange={(value) => updateDevice("capture", value)} />
      <DeviceFields kind="playback" value={draft.devices.playback} onChange={(value) => updateDevice("playback", value)} />
    </div>
    <button className="advanced-toggle" onClick={() => setAdvanced((value) => !value)}>{advanced ? "− FECHAR PARÂMETROS AVANÇADOS" : "+ PARÂMETROS AVANÇADOS CAMILLADSP"}</button>
    {advanced && <div className="advanced-settings"><label><span>DEVICES COMPLETO (JSON)</span><textarea value={advancedText} onChange={(event) => { const value = event.target.value; setAdvancedText(value); try { const devices = JSON.parse(value) as CamillaConfig["devices"]; setDraft((current) => ({ ...current, devices })); setError(""); } catch { setError("JSON de devices inválido."); } }} spellCheck={false} /></label><p>Use para campos específicos de backend — rate adjust, resampler, silence, labels e opções de rede. A estrutura será validada pelo CamillaDSP antes de aplicar.</p></div>}
    {error && <div className="settings-error">{error}</div>}
    <footer><button onClick={onClose}>CANCELAR</button><button className="apply-settings" disabled={busy} onClick={() => void apply()}>{busy ? "VALIDANDO…" : "VALIDAR E APLICAR"}</button></footer>
  </section></div>;
}
