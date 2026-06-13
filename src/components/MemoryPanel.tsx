import { memoryClimateDetail, memoryClimateHeadline } from "../lib/memoryPresentation";
import type { MemoryReport, MemoryTrace, UcuBedenState } from "../lib/types";

const previewLimit = 4;

function TraceItem({ trace }: { trace: MemoryTrace }) {
  return (
    <li className="memory-trace-item">
      <p>{trace.transformed_text}</p>
      <span className="memory-trace-meta">
        <span>{trace.date}</span>
        <span>{trace.source}</span>
        <span>{trace.status}</span>
      </span>
    </li>
  );
}

function TraceGroup({ title, ids, traces }: { title: string; ids: string[]; traces: Map<string, MemoryTrace> }) {
  const selected = ids.map((id) => traces.get(id)).filter((trace): trace is MemoryTrace => trace !== undefined);
  const preview = selected.slice(0, previewLimit);
  const remaining = selected.slice(previewLimit);
  return (
    <section className="memory-group">
      <header className="memory-group-header">
        <h3>{title}</h3>
        <span>{selected.length}</span>
      </header>
      {preview.length === 0 ? (
        <p className="memory-empty">Kayıt yok.</p>
      ) : (
        <ul className="memory-trace-list">
          {preview.map((trace) => <TraceItem key={trace.id} trace={trace} />)}
        </ul>
      )}
      {remaining.length > 0 ? (
        <details className="memory-more">
          <summary>{remaining.length} iz daha</summary>
          <ul className="memory-trace-list">
            {remaining.map((trace) => <TraceItem key={trace.id} trace={trace} />)}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function ReportMemory({ report, traceList }: { report: MemoryReport; traceList: MemoryTrace[] }) {
  const traces = new Map(traceList.map((trace) => [trace.id, trace]));
  const todayCalled = traceList
    .filter((trace) => Boolean(report.built_through && trace.last_recalled_at?.startsWith(report.built_through)))
    .sort((a, b) => (b.last_recalled_at ?? "").localeCompare(a.last_recalled_at ?? ""))
    .map((trace) => trace.id);
  return (
    <div className="memory-report">
      <section className="memory-climate">
        <span>hafıza havası</span>
        <h3>{memoryClimateHeadline(report)}</h3>
        <p>{memoryClimateDetail(report)}.</p>
      </section>
      <div className="memory-groups">
        <TraceGroup title="bugün çağrılanlar" ids={todayCalled} traces={traces} />
        <TraceGroup title="bastırılmış olanlar" ids={report.suppressed} traces={traces} />
        <TraceGroup title="rüyadan dönenler" ids={report.dream_returns} traces={traces} />
        <TraceGroup title="dolaylı çağrılanlar" ids={report.indirect_only} traces={traces} />
        <TraceGroup title="dışarıdan içeri sızanlar" ids={report.external_leakage} traces={traces} />
      </div>
    </div>
  );
}

function LegacyMemory({ state }: { state: UcuBedenState }) {
  return (
    <div className="label-list">
      <div className="label-row"><span className="label">baskın</span><span>{state.dominant_words.join(", ") || "Kayıt yok."}</span></div>
      <div className="label-row"><span className="label">takıntılar</span><span>{state.obsessions.join(", ") || "Kayıt yok."}</span></div>
      <div className="label-row"><span className="label">kaçındığı</span><span>{state.avoided_words.join(", ") || "Kayıt yok."}</span></div>
      <div className="label-row"><span className="label">dönüp duran</span><span>{state.poetic_drift.things_it_keeps_returning_to.join(", ") || "Kayıt yok."}</span></div>
      <div className="label-row"><span className="label">unuttuğu</span><span>{state.poetic_drift.things_it_is_forgetting.join(", ") || "Kayıt yok."}</span></div>
    </div>
  );
}

export function MemoryPanel({ state, report, traces }: { state: UcuBedenState; report: MemoryReport | null; traces: MemoryTrace[] }) {
  return (
    <section className="section">
      <h2 className="section-title">Hafıza</h2>
      {report ? <ReportMemory report={report} traceList={traces} /> : <LegacyMemory state={state} />}
    </section>
  );
}
