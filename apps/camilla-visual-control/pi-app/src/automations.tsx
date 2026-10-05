import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./automations.css";

type Action = {
  id: string;
  label: string;
  detail: string;
  group: string;
  available: boolean;
  confirm?: string;
};

type ServiceMap = Record<string, string>;

type Snapshot = {
  generated_at: string;
  status: {
    camilladsp: { state: string; volume?: number; mute?: boolean; clipped?: number; load?: number; error?: string };
    source: { source?: string; updated_at?: string };
    amplifier: { power?: string; mode?: string; confidence?: string; updated_at?: string };
    tvbox: { status?: string; checked_at?: string };
    services: ServiceMap;
  };
  actions: Action[];
};

const groupCopy: Record<string, { eyebrow: string; title: string; note: string }> = {
  source: { eyebrow: "ROTEAMENTO", title: "Fonte de áudio", note: "Carrega o perfil correspondente no CamillaDSP." },
  amplifier: { eyebrow: "KENWOOD SL16", title: "Amplificador", note: "Comandos confirmados pelo Arduino; energia é o último comando conhecido." },
  volume: { eyebrow: "CAMILLA DSP", title: "Volume", note: "Ajuste em passos de 2 dB, limitado entre −80 e 0 dB." },
  planned: { eyebrow: "EXPANSÃO", title: "Próximas automações", note: "Já identificadas, ainda sem executor ativo." },
};

function formatTime(value?: string) {
  if (!value) return "sem registro";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });
}

function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("Carregando estado do PiCeiver…");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/automations", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const next = (await response.json()) as Snapshot;
      setSnapshot(next);
      setNotice("Estado atualizado");
    } catch (error) {
      setNotice(`Painel sem conexão: ${error instanceof Error ? error.message : "erro desconhecido"}`);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(refresh, 0);
    const timer = window.setInterval(refresh, 5000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const run = async (action: Action) => {
    if (!action.available || busy) return;
    if (action.confirm && !window.confirm(action.confirm)) return;
    setBusy(action.id);
    setNotice(`Executando ${action.label}…`);
    try {
      const response = await fetch(`/api/automations/${encodeURIComponent(action.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      setNotice(`${action.label}: comando confirmado`);
      await refresh();
    } catch (error) {
      setNotice(`${action.label}: ${error instanceof Error ? error.message : "falha"}`);
    } finally {
      setBusy(null);
    }
  };

  const grouped = useMemo(() => {
    const values: Record<string, Action[]> = {};
    for (const action of snapshot?.actions ?? []) (values[action.group] ??= []).push(action);
    return values;
  }, [snapshot]);

  const status = snapshot?.status;
  const dspOnline = status?.camilladsp.state === "RUNNING";

  return (
    <main className="automation-shell">
      <header className="automation-topbar">
        <a className="back-link" href="/gui/control/index.html">← ÁUDIO</a>
        <div className="automation-brand"><span>PC</span><div><strong>PiCeiver</strong><small>CENTRAL DE AUTOMAÇÕES</small></div></div>
        <div className={`live-state ${dspOnline ? "ok" : "bad"}`}><i />{dspOnline ? "DSP ONLINE" : "DSP OFFLINE"}</div>
      </header>

      <section className="automation-hero">
        <div><small>CONTROLE LOCAL · 192.168.178.117</small><h1>Sistema de áudio e automações</h1><p>Comandos permitidos, estado vivo e espaço reservado para as próximas rotinas.</p></div>
        <div className="hero-reading"><span>ÚLTIMA LEITURA</span><b>{snapshot ? new Date(snapshot.generated_at).toLocaleTimeString("pt-BR") : "—"}</b><small>{notice}</small></div>
      </section>

      <section className="status-grid">
        <article><span>FONTE</span><b>{status?.source.source?.toUpperCase() ?? "—"}</b><small>{formatTime(status?.source.updated_at)}</small></article>
        <article><span>VOLUME</span><b>{typeof status?.camilladsp.volume === "number" ? `${status.camilladsp.volume.toFixed(1)} dB` : "—"}</b><small>{status?.camilladsp.mute ? "MUTE ATIVO" : "saída liberada"}</small></article>
        <article><span>AMPLIFICADOR</span><b>{status?.amplifier.power === "on" ? `LIGADO · ${status.amplifier.mode?.toUpperCase()}` : status?.amplifier.power?.toUpperCase() ?? "—"}</b><small>último comando confirmado</small></article>
        <article><span>TV BOX</span><b>{status?.tvbox.status === "active" ? "ATIVA" : status?.tvbox.status === "inactive" ? "INATIVA" : "—"}</b><small>{formatTime(status?.tvbox.checked_at)}</small></article>
      </section>

      <section className="automation-groups">
        {["source", "amplifier", "volume", "planned"].map((group) => {
          const copy = groupCopy[group];
          const actions = grouped[group] ?? [];
          return (
            <article className={`action-panel ${group === "planned" ? "planned" : ""}`} key={group}>
              <header><div><small>{copy.eyebrow}</small><h2>{copy.title}</h2></div><p>{copy.note}</p></header>
              <div className="action-grid">
                {actions.map((action) => (
                  <button key={action.id} disabled={!action.available || busy !== null} onClick={() => run(action)} className={busy === action.id ? "working" : ""}>
                    <span>{action.available ? busy === action.id ? "EXECUTANDO" : "DISPONÍVEL" : "PLANEJADO"}</span>
                    <b>{action.label}</b>
                    <small>{action.detail}</small>
                  </button>
                ))}
              </div>
            </article>
          );
        })}
      </section>

      <section className="service-panel">
        <header><div><small>INFRAESTRUTURA</small><h2>Serviços</h2></div><p>Leitura do systemd; estes indicadores não executam manutenção.</p></header>
        <div>{Object.entries(status?.services ?? {}).map(([name, state]) => <span className={state === "active" ? "up" : "down"} key={name}><i />{name}<b>{state}</b></span>)}</div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
