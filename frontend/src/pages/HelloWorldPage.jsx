import React, { useState, useEffect, useRef } from 'react';
import './HelloWorldPage.css';

const API   = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const NEON  = 'postgresql://neondb_owner:npg_Rn56FbVsmiQI@ep-wandering-art-amtq6t2m-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require';
const DEF_Q = 'What is the total revenue per employee department?';

const L1_COLOR = '#2563eb';
const L2_COLOR = '#7c3aed';
const L3_COLOR = '#059669';

function tok() { return localStorage.getItem('token') || ''; }

// ── Atoms ─────────────────────────────────────────────────────────────────

function StatusDot({ status }) {
  return <span className={`aw-dot aw-dot-${status}`} title={status} />;
}

function Tag({ color, children }) {
  return <span className="aw-tag" style={{ background: `${color}12`, color, border: `1px solid ${color}30` }}>{children}</span>;
}

function Chip({ label, color }) {
  return <span className="aw-chip" style={{ background: `${color}10`, color, borderColor: `${color}25` }}>{label}</span>;
}

function SLabel({ children }) {
  return <div className="aw-section-label">{children}</div>;
}

function Rule() { return <hr className="aw-rule" />; }

function CodeBlock({ sql }) {
  const [copied, setCopied] = useState(false);
  if (!sql) return null;
  const doCopy = () => { navigator.clipboard.writeText(sql); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="aw-code-card">
      <div className="aw-code-bar">
        <span className="aw-code-lang">Generated SQL</span>
        <button className={`aw-copy-btn ${copied ? 'copied' : ''}`} onClick={doCopy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="aw-code">{sql}</pre>
    </div>
  );
}

function DataTable({ data, columns }) {
  if (!Array.isArray(data) || !data.length) return null;
  const first = data.find(r => r && typeof r === 'object') || {};
  const cols  = columns?.length ? columns : Object.keys(first);
  if (!cols.length) return null;
  return (
    <div className="aw-table-wrap">
      <table className="aw-table">
        <thead><tr>{cols.map(c => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {data.slice(0, 6).map((row, i) => (
            <tr key={i}>{cols.map(c => <td key={c}>{String(row[c] ?? '')}</td>)}</tr>
          ))}
        </tbody>
      </table>
      {data.length > 6 && <div className="aw-table-more">{data.length - 6} more rows not shown</div>}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="aw-skeleton">
      <div className="aw-skel aw-skel-md" />
      <div className="aw-skel aw-skel-sm" />
      <div className="aw-skel aw-skel-lg" />
    </div>
  );
}

function TimingBadge({ ms }) {
  if (!ms) return null;
  const label = ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
  return <span className="aw-timing">{label}</span>;
}

// ── Pipeline diagrams — no emojis, pure text + CSS ───────────────────────

function L1Pipeline() {
  const steps = ['Receive question', 'Generate SQL via AI', 'Execute on database', 'Return results'];
  return (
    <div className="aw-pipeline">
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          <div className="aw-pipe-node aw-pipe-blue">{s}</div>
          {i < steps.length - 1 && <div className="aw-pipe-arrow" />}
        </React.Fragment>
      ))}
    </div>
  );
}

function L2Pipeline() {
  return (
    <div className="aw-pipeline-react">
      <div className="aw-react-forward">
        {['Question', 'Reason about context', 'Write SQL', 'Execute & observe'].map((s, i, arr) => (
          <React.Fragment key={i}>
            <div className="aw-pipe-node aw-pipe-purple">{s}</div>
            {i < arr.length - 1 && <div className="aw-pipe-arrow" />}
          </React.Fragment>
        ))}
      </div>
      <div className="aw-react-back">
        <div className="aw-react-back-line" />
        <div className="aw-react-back-label">If execution fails — reads the error and tries again (up to 3 attempts)</div>
        <div className="aw-react-back-line" />
      </div>
    </div>
  );
}

function L3Pipeline() {
  const agents = ['Schema Reader', 'SQL Generator', 'Safety Validator', 'Insight Synthesiser'];
  return (
    <div className="aw-pipeline-swarm">
      <div className="aw-pipe-node aw-pipe-green" style={{ flexShrink: 0 }}>Question</div>
      <div className="aw-swarm-fork">
        <div className="aw-swarm-lines">
          {agents.map((_, i) => <div key={i} className="aw-swarm-tick" />)}
        </div>
        <div className="aw-swarm-agents">
          {agents.map(a => (
            <div key={a} className="aw-swarm-agent-node">{a}</div>
          ))}
        </div>
        <div className="aw-swarm-lines">
          {agents.map((_, i) => <div key={i} className="aw-swarm-tick" />)}
        </div>
      </div>
      <div className="aw-pipe-node aw-pipe-green" style={{ flexShrink: 0 }}>Final answer</div>
    </div>
  );
}

// ── Level 1 ───────────────────────────────────────────────────────────────

function Level1({ question, trigger, onResult }) {
  const [status, setS] = useState('idle');
  const [result, setR] = useState(null);
  const [error,  setE] = useState('');
  const [ms,     setMs]= useState(null);

  useEffect(() => { if (trigger) run(); }, [trigger]); // eslint-disable-line

  async function run() {
    setS('running'); setE(''); setR(null); setMs(null);
    const t0 = Date.now();
    try {
      const res  = await fetch(`${API}/plugin/query`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, tables: {} }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const elapsed = Date.now() - t0;
      setR(data); setMs(elapsed); setS('done');
      onResult?.({ sql: data.sql, data: data.preview, timing: elapsed });
    } catch (e) { setE(e.message || 'Query failed'); setS('error'); onResult?.({ error: true }); }
  }

  return (
    <div className="aw-card" style={{ borderTop: `3px solid ${L1_COLOR}` }}>
      {/* Header */}
      <div className="aw-card-head">
        <div className="aw-level-badge" style={{ background: `${L1_COLOR}12`, color: L1_COLOR, borderColor: `${L1_COLOR}25` }}>L1</div>
        <div className="aw-card-titles">
          <div className="aw-card-title">Single Agent</div>
          <div className="aw-card-sub">One question in, one answer out — no reasoning, no retry</div>
        </div>
        <StatusDot status={status} />
      </div>

      {/* What happens */}
      <div className="aw-explain">
        <SLabel>What Happens</SLabel>
        <p className="aw-explain-text">
          The question is passed directly to a large language model (Gemini). The model generates
          SQL, the database executes it, and the result is returned. There is no error checking —
          if the SQL fails, the agent stops.
        </p>
        <L1Pipeline />
      </div>

      <Rule />
      <SLabel>Execution</SLabel>

      {status === 'idle' && <p className="aw-idle">Press <strong>Run All</strong> to execute.</p>}
      {status === 'running' && <Skeleton />}

      {(status === 'done' || status === 'error') && (
        <div className="aw-exec">
          <div className="aw-exec-row">
            <Chip label="Attempt 1 of 1" color={L1_COLOR} />
            <TimingBadge ms={ms} />
          </div>
          {error
            ? <div className="aw-error"><div className="aw-error-head">Execution failed — agent stopped</div><div className="aw-error-body">{error}</div></div>
            : <><CodeBlock sql={result?.sql} /><DataTable data={result?.preview} columns={result?.preview?.[0] ? Object.keys(result.preview[0]) : []} /></>
          }
        </div>
      )}

      <div className="aw-footer" style={{ borderTop: `1px solid ${L1_COLOR}15`, background: `${L1_COLOR}06` }}>
        <strong>Characteristic:</strong> Fastest, but no recovery from mistakes. Suitable for simple, well-defined queries.
      </div>
    </div>
  );
}

// ── Level 2 ───────────────────────────────────────────────────────────────

function Level2({ question, trigger, onResult }) {
  const [status, setS]  = useState('idle');
  const [result, setR]  = useState(null);
  const [error,  setE]  = useState('');
  const [ms,     setMs] = useState(null);
  const [visible, setV] = useState(0);
  const tid = useRef(null);

  useEffect(() => { if (trigger) run(); }, [trigger]); // eslint-disable-line

  useEffect(() => {
    if (!result?.react_trace) return;
    const total = (result.react_trace.thoughts?.length || 0) * 3;
    let n = 0;
    tid.current = setInterval(() => { n++; setV(n); if (n >= total) clearInterval(tid.current); }, 350);
    return () => clearInterval(tid.current);
  }, [result]);

  async function run() {
    clearInterval(tid.current);
    setS('running'); setE(''); setR(null); setMs(null); setV(0);
    const t0 = Date.now();
    try {
      const res = await fetch(`${API}/pg/nl-query-auto`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pg_uri: NEON, question, react: true, limit: 50 }),
      });
      let data; try { data = await res.json(); } catch { throw new Error(`Server error (${res.status})`); }
      if (!res.ok) throw new Error(data?.detail || `Failed (${res.status})`);
      const elapsed = Date.now() - t0;
      setR(data); setMs(elapsed); setS('done');
      onResult?.({ sql: data.sql, data: data.data, timing: elapsed, attempts: data.react_trace?.attempts || 1 });
    } catch (e) { setE(e.message); setS('error'); onResult?.({ error: true }); }
  }

  const trace    = result?.react_trace;
  const attempts = trace?.thoughts?.length || 0;

  return (
    <div className="aw-card" style={{ borderTop: `3px solid ${L2_COLOR}` }}>
      <div className="aw-card-head">
        <div className="aw-level-badge" style={{ background: `${L2_COLOR}12`, color: L2_COLOR, borderColor: `${L2_COLOR}25` }}>L2</div>
        <div className="aw-card-titles">
          <div className="aw-card-title">ReAct Agent</div>
          <div className="aw-card-sub">Reason, Act, Observe — self-corrects on failure</div>
        </div>
        <StatusDot status={status} />
      </div>

      <div className="aw-explain">
        <SLabel>What Happens</SLabel>
        <p className="aw-explain-text">
          ReAct stands for <em>Reason + Act</em>. The agent does not just generate SQL — it first
          thinks about the schema and question, generates SQL, executes it, and reads the result.
          If execution fails, it reads the error message and reasons about how to correct the query,
          then tries again. This loop repeats until success or the attempt limit is reached.
        </p>
        <L2Pipeline />
      </div>

      <Rule />
      <SLabel>Execution trace</SLabel>

      {status === 'idle' && <p className="aw-idle">Press <strong>Run All</strong> to execute.</p>}
      {status === 'running' && !trace && (
        <div className="aw-thinking">
          <div className="aw-thinking-bar" />
          <span>Agent is reasoning about the question and schema…</span>
        </div>
      )}

      {(status === 'done' || status === 'error' || trace) && (
        <div className="aw-exec">
          {attempts > 1 && (
            <div className="aw-correction-notice" style={{ borderColor: `${L2_COLOR}30`, background: `${L2_COLOR}08` }}>
              Self-corrected — completed in {attempts} attempts
            </div>
          )}

          {trace && (trace.thoughts || []).map((thought, i) => {
            const base = i * 3;
            return (
              <div key={i} className="aw-attempt-block">
                <div className="aw-attempt-header">
                  <span className="aw-attempt-num" style={{ background: `${L2_COLOR}12`, color: L2_COLOR }}>
                    Attempt {i + 1}
                    {i > 0 && <span className="aw-retry-label"> — correcting previous error</span>}
                  </span>
                </div>

                {visible > base && (
                  <div className="aw-trace-item aw-trace-think aw-fadein">
                    <div className="aw-trace-label">Reasoning</div>
                    <div className="aw-trace-content aw-trace-italic">{thought}</div>
                  </div>
                )}
                {visible > base + 1 && trace.actions?.[i] && (
                  <div className="aw-trace-item aw-trace-act aw-fadein">
                    <div className="aw-trace-label">SQL written</div>
                    <pre className="aw-trace-code">{trace.actions[i]}</pre>
                  </div>
                )}
                {visible > base + 2 && trace.observations?.[i] && (
                  <div className={`aw-trace-item aw-fadein ${String(trace.observations[i]).match(/error|fail/i) ? 'aw-trace-fail' : 'aw-trace-ok'}`}>
                    <div className="aw-trace-label">Execution result</div>
                    <div className="aw-trace-content">{trace.observations[i]}</div>
                  </div>
                )}
              </div>
            );
          })}

          {error && <div className="aw-error"><div className="aw-error-head">Execution failed</div><div className="aw-error-body">{error}</div></div>}

          {result && (
            <div className="aw-exec-row" style={{ marginTop: 14 }}>
              <Chip label={`${attempts} attempt${attempts !== 1 ? 's' : ''}`} color={L2_COLOR} />
              <TimingBadge ms={ms} />
            </div>
          )}
          <CodeBlock sql={result?.sql} />
          <DataTable data={result?.data} columns={result?.columns} />
        </div>
      )}

      <div className="aw-footer" style={{ borderTop: `1px solid ${L2_COLOR}15`, background: `${L2_COLOR}06` }}>
        <strong>Characteristic:</strong> Slower than Level 1, but recovers from mistakes.
        The agent reads its own errors and adjusts — no human intervention needed.
      </div>
    </div>
  );
}

// ── Level 3 ───────────────────────────────────────────────────────────────

const SWARM_AGENTS = [
  { id: 'schema',  label: 'Schema Reader',       desc: 'Reads all tables and column types from the database' },
  { id: 'sql',     label: 'SQL Generator',        desc: 'Writes and self-corrects SQL using ReAct loop' },
  { id: 'safety',  label: 'Safety Validator',     desc: 'Checks the query for injection and data-safety issues' },
  { id: 'insight', label: 'Insight Synthesiser',  desc: 'Interprets the results and writes a plain-English summary' },
];

function Level3({ question, trigger, onResult }) {
  const [status, setS]  = useState('idle');
  const [result, setR]  = useState(null);
  const [error,  setE]  = useState('');
  const [ms,     setMs] = useState(null);
  const [ags,    setAgs]= useState({});
  const timers          = useRef([]);

  useEffect(() => { if (trigger) run(); }, [trigger]); // eslint-disable-line

  function clearT() { timers.current.forEach(clearTimeout); timers.current = []; }

  async function run() {
    clearT();
    setS('running'); setE(''); setR(null); setMs(null);
    const init = {}; SWARM_AGENTS.forEach(a => { init[a.id] = 'waiting'; }); setAgs(init);
    SWARM_AGENTS.forEach((a, i) => {
      timers.current.push(setTimeout(() => setAgs(p => ({ ...p, [a.id]: 'running' })), i * 260));
    });
    const t0 = Date.now();
    try {
      const res = await fetch(`${API}/swarm/pg-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tok()}` },
        body: JSON.stringify({ pg_uri: NEON, question, limit: 50 }),
      });
      let data; try { data = await res.json(); } catch { throw new Error(`Server error (${res.status})`); }
      if (!res.ok) throw new Error(data?.detail || `Failed (${res.status})`);
      const elapsed = Date.now() - t0;
      SWARM_AGENTS.forEach((a, i) => {
        timers.current.push(setTimeout(() => setAgs(p => ({ ...p, [a.id]: 'done' })), i * 140));
      });
      const firstOk = (data.subtask_results || []).find(r => !r.error) || data.subtask_results?.[0] || {};
      const summary = typeof data.summary === 'string' ? data.summary
        : (data.summary?.text || data.summary?.answer || data.summary?.summary || '');
      timers.current.push(setTimeout(() => {
        setR({ sql: firstOk.sql || '', data: firstOk.data || [], columns: firstOk.columns || [],
               agentsRun: data.agents_run ?? SWARM_AGENTS.length, summary });
        setMs(elapsed); setS('done');
        onResult?.({ sql: firstOk.sql, data: firstOk.data, timing: elapsed, agents: data.agents_run });
      }, SWARM_AGENTS.length * 140 + 200));
    } catch (e) {
      setE(e.message); setS('error');
      SWARM_AGENTS.forEach(a => setAgs(p => ({ ...p, [a.id]: 'error' })));
      onResult?.({ error: true });
    }
  }

  const anyAgent = Object.keys(ags).length > 0;

  return (
    <div className="aw-card" style={{ borderTop: `3px solid ${L3_COLOR}` }}>
      <div className="aw-card-head">
        <div className="aw-level-badge" style={{ background: `${L3_COLOR}12`, color: L3_COLOR, borderColor: `${L3_COLOR}25` }}>L3</div>
        <div className="aw-card-titles">
          <div className="aw-card-title">Swarm of Agents</div>
          <div className="aw-card-sub">Four specialised agents run simultaneously, then combine results</div>
        </div>
        <StatusDot status={status} />
      </div>

      <div className="aw-explain">
        <SLabel>What Happens</SLabel>
        <p className="aw-explain-text">
          Instead of one agent doing everything, four specialised agents run in parallel. One reads
          the database schema, one generates and validates the SQL, one checks query safety, and one
          interprets the results. A coordinator then combines their outputs into a single coherent
          answer. This is faster and more accurate than any single agent for complex questions.
        </p>
        <L3Pipeline />
      </div>

      <Rule />
      <SLabel>Agent activity</SLabel>

      {status === 'idle' && <p className="aw-idle">Press <strong>Run All</strong> to execute.</p>}

      {anyAgent && (
        <div className="aw-agents-list">
          {SWARM_AGENTS.map(a => {
            const st = ags[a.id] || 'waiting';
            return (
              <div key={a.id} className={`aw-agent-row aw-ag-${st}`}>
                <StatusDot status={st} />
                <div className="aw-agent-info">
                  <div className="aw-agent-name">{a.label}</div>
                  <div className="aw-agent-desc">{a.desc}</div>
                </div>
                <span className={`aw-ag-status-label aw-ag-lbl-${st}`}>
                  {st === 'waiting' ? 'Queued' : st === 'running' ? 'Running' : st === 'done' ? 'Complete' : 'Error'}
                </span>
                {st === 'running' && <div className="aw-ag-bar" style={{ '--c': L3_COLOR }} />}
              </div>
            );
          })}
        </div>
      )}

      {error && <div className="aw-error" style={{ margin: '0 0 12px' }}><div className="aw-error-head">Swarm failed</div><div className="aw-error-body">{error}</div></div>}

      {result && (
        <div className="aw-exec aw-fadein">
          <div className="aw-exec-row">
            <Chip label={`${result.agentsRun} agents completed`} color={L3_COLOR} />
            <TimingBadge ms={ms} />
          </div>
          <CodeBlock sql={result.sql} />
          <DataTable data={result.data} columns={result.columns} />
          {result.summary ? (
            <div className="aw-insight" style={{ borderColor: `${L3_COLOR}25`, background: `${L3_COLOR}06` }}>
              <div className="aw-insight-label" style={{ color: L3_COLOR }}>AI-generated insight</div>
              <div className="aw-insight-text">{String(result.summary)}</div>
            </div>
          ) : null}
        </div>
      )}

      <div className="aw-footer" style={{ borderTop: `1px solid ${L3_COLOR}15`, background: `${L3_COLOR}06` }}>
        <strong>Characteristic:</strong> Highest accuracy and richest output. Each agent is an expert
        in its domain — parallel execution minimises total time.
      </div>
    </div>
  );
}

// ── Comparison table ──────────────────────────────────────────────────────

function ComparisonTable({ l1, l2, l3 }) {
  if (!l1 && !l2 && !l3) return null;
  const fmt = v => v?.timing ? (v.timing < 1000 ? `${v.timing} ms` : `${(v.timing / 1000).toFixed(1)} s`) : '—';
  const check  = v => v ? 'Yes' : 'No';
  const rows = [
    { label: 'Agents used',               l1: '1',            l2: '1',         l3: '4' },
    { label: 'Reads its own errors',      l1: 'No',           l2: 'Yes',       l3: 'Yes' },
    { label: 'Parallel execution',        l1: 'No',           l2: 'No',        l3: 'Yes' },
    { label: 'Maximum query attempts',    l1: '1',            l2: 'Up to 3',   l3: 'Unlimited' },
    { label: 'Time for this question',    l1: fmt(l1),        l2: fmt(l2),     l3: fmt(l3) },
    { label: 'Provides AI interpretation',l1: 'No',           l2: 'No',        l3: 'Yes' },
    { label: 'Best suited for',           l1: 'Simple lookups',l2:'Queries that may fail once',l3:'Complex analytical questions' },
  ];
  return (
    <div className="aw-compare">
      <div className="aw-compare-head">
        <div className="aw-compare-title">Side-by-side comparison</div>
        <div className="aw-compare-sub">Based on results from the run above</div>
      </div>
      <div className="aw-compare-scroll">
        <table className="aw-compare-table">
          <thead>
            <tr>
              <th className="aw-cth-feat">Feature</th>
              <th className="aw-cth" style={{ borderTop: `3px solid ${L1_COLOR}` }}>
                <span className="aw-cbadge" style={{ background: `${L1_COLOR}15`, color: L1_COLOR }}>L1</span>
                Single Agent
              </th>
              <th className="aw-cth" style={{ borderTop: `3px solid ${L2_COLOR}` }}>
                <span className="aw-cbadge" style={{ background: `${L2_COLOR}15`, color: L2_COLOR }}>L2</span>
                ReAct Agent
              </th>
              <th className="aw-cth" style={{ borderTop: `3px solid ${L3_COLOR}` }}>
                <span className="aw-cbadge" style={{ background: `${L3_COLOR}15`, color: L3_COLOR }}>L3</span>
                Swarm Agent
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={i % 2 ? 'aw-row-alt' : ''}>
                <td className="aw-cfeat">{r.label}</td>
                <td className="aw-cval">{r.l1}</td>
                <td className="aw-cval">{r.l2}</td>
                <td className="aw-cval">{r.l3}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function HelloWorldPage() {
  const [question, setQ] = useState(DEF_Q);
  const [trigger,  setT] = useState(0);
  const [l1, setL1] = useState(null);
  const [l2, setL2] = useState(null);
  const [l3, setL3] = useState(null);

  function runAll() { setL1(null); setL2(null); setL3(null); setT(t => t + 1); }

  return (
    <div className="aw-page">

      {/* Hero */}
      <div className="aw-hero">
        <div className="aw-hero-body">
          <div className="aw-hero-eyebrow">AI Agent Architecture · Live Demo</div>
          <h1 className="aw-hero-title">Three Levels of AI Intelligence</h1>
          <p className="aw-hero-desc">
            The same question is answered by three increasingly sophisticated AI agent designs.
            Watch how each approach handles the problem differently — from a single direct query
            to a self-correcting loop to a fully parallel team of specialists.
          </p>
        </div>
        <div className="aw-hero-badges">
          <div className="aw-hero-badge" style={{ borderColor: `${L1_COLOR}40`, color: L1_COLOR }}>
            <span className="aw-hero-badge-num">L1</span>
            <span>Single Agent</span>
          </div>
          <div className="aw-hero-badge" style={{ borderColor: `${L2_COLOR}40`, color: L2_COLOR }}>
            <span className="aw-hero-badge-num">L2</span>
            <span>ReAct Loop</span>
          </div>
          <div className="aw-hero-badge" style={{ borderColor: `${L3_COLOR}40`, color: L3_COLOR }}>
            <span className="aw-hero-badge-num">L3</span>
            <span>Swarm</span>
          </div>
        </div>
      </div>

      {/* Question input */}
      <div className="aw-question-bar">
        <div className="aw-question-label">Question sent to all three agents</div>
        <div className="aw-question-row">
          <input
            className="aw-question-input"
            value={question}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runAll()}
            placeholder="Type a question about the database…"
          />
          <button className="aw-run-btn" onClick={runAll}>Run All</button>
        </div>
        <div className="aw-question-hint">
          Demo database · Tables: employees, departments, orders, sales_performance
        </div>
      </div>

      {/* Level cards */}
      <div className="aw-grid">
        <Level1 question={question} trigger={trigger} onResult={setL1} />
        <Level2 question={question} trigger={trigger} onResult={setL2} />
        <Level3 question={question} trigger={trigger} onResult={setL3} />
      </div>

      {/* Comparison */}
      {(l1 || l2 || l3) && <ComparisonTable l1={l1} l2={l2} l3={l3} />}
    </div>
  );
}
