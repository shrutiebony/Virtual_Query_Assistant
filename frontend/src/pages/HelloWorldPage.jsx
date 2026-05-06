import React, { useState, useEffect, useRef } from 'react';
import './HelloWorldPage.css';

const API     = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const NEON    = 'postgresql://neondb_owner:npg_Rn56FbVsmiQI@ep-wandering-art-amtq6t2m-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require';
const DEF_Q   = 'What is the total revenue per employee department?';

function tok() { return localStorage.getItem('token') || ''; }

// ── Shared atoms ──────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const MAP = {
    idle:    { icon: '⏸', label: 'Idle',    cls: 'sb-idle'    },
    running: { icon: '⚙️', label: 'Running', cls: 'sb-running' },
    done:    { icon: '✅', label: 'Done',    cls: 'sb-done'    },
    error:   { icon: '❌', label: 'Failed',  cls: 'sb-error'   },
  };
  const { icon, label, cls } = MAP[status] || MAP.idle;
  return <span className={`hw-status ${cls}`}>{icon} {label}</span>;
}

function TimingBadge({ ms }) {
  if (!ms) return null;
  return <span className="hw-timing">{ms < 1000 ? `${ms}ms` : `${(ms/1000).toFixed(1)}s`}</span>;
}

function CodeBlock({ sql }) {
  const [copied, setCopied] = useState(false);
  if (!sql) return null;
  return (
    <div className="hw-code-card">
      <div className="hw-code-header">
        <span className="hw-code-lang">SQL</span>
        <button className={`hw-code-copy ${copied ? 'ok' : ''}`}
          onClick={() => { navigator.clipboard.writeText(sql); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre className="hw-code">{sql}</pre>
    </div>
  );
}

function DataTable({ data, columns, maxRows = 5 }) {
  if (!Array.isArray(data) || !data.length) return null;
  const first = data.find(r => r && typeof r === 'object') || {};
  const cols  = columns?.length ? columns : Object.keys(first);
  if (!cols.length) return null;
  return (
    <div className="hw-table-outer">
      <table className="hw-table">
        <thead><tr>{cols.map(c => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {data.slice(0, maxRows).map((row, i) => (
            <tr key={i}>{cols.map(c => <td key={c}>{String(row[c] ?? '')}</td>)}</tr>
          ))}
        </tbody>
      </table>
      {data.length > maxRows && (
        <div className="hw-table-more">+ {data.length - maxRows} more rows</div>
      )}
    </div>
  );
}

function SkeletonLoader() {
  return (
    <div className="hw-skeleton">
      <div className="hw-skel hw-skel-line" />
      <div className="hw-skel hw-skel-line hw-skel-short" />
      <div className="hw-skel hw-skel-block" />
    </div>
  );
}

function SectionLabel({ children }) {
  return <div className="hw-section-label">{children}</div>;
}

function Divider() { return <hr className="hw-divider" />; }

// ── HOW IT WORKS diagrams ─────────────────────────────────────────────────

function L1Diagram() {
  return (
    <div className="hw-diagram">
      <SectionLabel>How It Works</SectionLabel>
      <div className="hw-diagram-flow">
        <div className="hw-dnode">❓ Question</div>
        <div className="hw-darrow">→</div>
        <div className="hw-dnode hw-dnode-blue">🤖 AI / Gemini</div>
        <div className="hw-darrow">→</div>
        <div className="hw-dnode">📝 SQL</div>
        <div className="hw-darrow">→</div>
        <div className="hw-dnode hw-dnode-success">✅ Result</div>
      </div>
      <div className="hw-diagram-note">One pass. No second chances.</div>
    </div>
  );
}

function L2Diagram() {
  return (
    <div className="hw-diagram">
      <SectionLabel>How It Works</SectionLabel>
      <div className="hw-diagram-react">
        <div className="hw-react-row">
          <div className="hw-dnode">❓ Ask</div>
          <div className="hw-darrow">→</div>
          <div className="hw-dnode hw-dnode-purple">💭 Think</div>
          <div className="hw-darrow">→</div>
          <div className="hw-dnode hw-dnode-purple">⚡ Generate SQL</div>
          <div className="hw-darrow">→</div>
          <div className="hw-dnode hw-dnode-purple">🔄 Execute</div>
          <div className="hw-darrow">→</div>
          <div className="hw-dnode hw-dnode-success">✅ Done</div>
        </div>
        <div className="hw-react-loop-label">
          ↺ &nbsp;If error — agent reasons about the mistake and retries (up to 3 times)
        </div>
      </div>
    </div>
  );
}

function L3Diagram() {
  const agents = [
    { icon: '🗂️', label: 'Schema Agent' },
    { icon: '⚡', label: 'SQL Agent' },
    { icon: '🛡️', label: 'Safety Agent' },
    { icon: '💡', label: 'Insight Agent' },
  ];
  return (
    <div className="hw-diagram">
      <SectionLabel>How It Works</SectionLabel>
      <div className="hw-diagram-parallel">
        <div className="hw-par-left">
          <div className="hw-dnode">❓ Question</div>
        </div>
        <div className="hw-par-middle">
          <div className="hw-par-fork">→</div>
          <div className="hw-par-agents">
            {agents.map(a => (
              <div key={a.label} className="hw-par-agent-node hw-dnode-green">
                {a.icon} {a.label}
              </div>
            ))}
          </div>
          <div className="hw-par-join">→</div>
        </div>
        <div className="hw-par-right">
          <div className="hw-dnode hw-dnode-success">🎯 Answer</div>
        </div>
      </div>
      <div className="hw-diagram-note">All 4 agents run simultaneously.</div>
    </div>
  );
}

// ── Level 1 Card ─────────────────────────────────────────────────────────

function Level1Card({ question, trigger, onResult }) {
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
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ question, tables: {} }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const elapsed = Date.now() - t0;
      setR(data); setMs(elapsed); setS('done');
      onResult?.({ sql: data.sql, data: data.preview, timing: elapsed });
    } catch (e) {
      setE(e.message || 'Query failed'); setS('error');
      onResult?.({ error: true });
    }
  }

  return (
    <div className="hw-card hw-card-l1">
      <div className="hw-card-head">
        <div className="hw-badge hw-badge-l1">L1</div>
        <div className="hw-card-meta">
          <div className="hw-card-title">Basic Agent</div>
          <div className="hw-card-sub">Single query — no reasoning, no retry</div>
        </div>
        <StatusBadge status={status} />
      </div>

      <L1Diagram />
      <Divider />

      <SectionLabel>Execution</SectionLabel>

      {status === 'idle' && (
        <p className="hw-idle-msg">Click <strong>Run All 3 Agents</strong> to start.</p>
      )}
      {status === 'running' && <SkeletonLoader />}

      {(status === 'done' || status === 'error') && (
        <div className="hw-exec-body">
          <div className="hw-attempt-row">
            <span className="hw-attempt-chip hw-chip-blue">Attempt 1 of 1</span>
            <TimingBadge ms={ms} />
          </div>
          {error ? (
            <div className="hw-error-box">
              <div className="hw-error-title">❌ Agent stopped — no retry</div>
              <div className="hw-error-text">{error}</div>
            </div>
          ) : (
            <>
              <CodeBlock sql={result?.sql} />
              <DataTable
                data={result?.preview}
                columns={result?.preview?.[0] ? Object.keys(result.preview[0]) : []}
              />
            </>
          )}
        </div>
      )}

      <div className="hw-card-footer">
        <Divider />
        <div className="hw-key-msg hw-key-blue">
          💬 Simple and fast. No error recovery.
        </div>
      </div>
    </div>
  );
}

// ── Level 2 Card ─────────────────────────────────────────────────────────

function Level2Card({ question, trigger, onResult }) {
  const [status, setS]    = useState('idle');
  const [result, setR]    = useState(null);
  const [error,  setE]    = useState('');
  const [ms,     setMs]   = useState(null);
  const [visible, setVis] = useState(0);
  const timerRef          = useRef(null);

  useEffect(() => { if (trigger) run(); }, [trigger]); // eslint-disable-line

  useEffect(() => {
    if (!result?.react_trace) return;
    const total = (result.react_trace.thoughts?.length || 0) * 3;
    let n = 0;
    timerRef.current = setInterval(() => {
      n++;
      setVis(n);
      if (n >= total) clearInterval(timerRef.current);
    }, 300);
    return () => clearInterval(timerRef.current);
  }, [result]);

  async function run() {
    clearInterval(timerRef.current);
    setS('running'); setE(''); setR(null); setMs(null); setVis(0);
    const t0 = Date.now();
    try {
      const res = await fetch(`${API}/pg/nl-query-auto`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ pg_uri: NEON, question, react: true, limit: 50 }),
      });
      let data;
      try { data = await res.json(); } catch { throw new Error(`Server error (${res.status})`); }
      if (!res.ok) throw new Error(data?.detail || `Request failed (${res.status})`);
      const elapsed = Date.now() - t0;
      setR(data); setMs(elapsed); setS('done');
      onResult?.({ sql: data.sql, data: data.data, timing: elapsed, attempts: data.react_trace?.attempts || 1 });
    } catch (e) {
      setE(e.message || 'Query failed'); setS('error');
      onResult?.({ error: true });
    }
  }

  const trace    = result?.react_trace;
  const attempts = trace?.thoughts?.length || 0;
  const corrected = attempts > 1;

  return (
    <div className="hw-card hw-card-l2">
      <div className="hw-card-head">
        <div className="hw-badge hw-badge-l2">L2</div>
        <div className="hw-card-meta">
          <div className="hw-card-title">ReAct Agent</div>
          <div className="hw-card-sub">Reasons → Acts → Observes → Repeats</div>
        </div>
        <StatusBadge status={status} />
      </div>

      <L2Diagram />
      <Divider />

      <SectionLabel>Execution</SectionLabel>

      {status === 'idle' && (
        <p className="hw-idle-msg">Click <strong>Run All 3 Agents</strong> to start.</p>
      )}
      {status === 'running' && !trace && (
        <div className="hw-react-thinking">
          <span className="hw-thinking-dot" />
          <span className="hw-thinking-dot" style={{ animationDelay: '.15s' }} />
          <span className="hw-thinking-dot" style={{ animationDelay: '.3s' }} />
          <span className="hw-thinking-label">Agent is reasoning…</span>
        </div>
      )}

      {(status === 'done' || status === 'error' || (status === 'running' && trace)) && (
        <div className="hw-exec-body">
          {corrected && (
            <div className="hw-corrected-banner">
              🔄 Self-Corrected &nbsp;·&nbsp; {attempts} attempts made
            </div>
          )}

          {trace && (trace.thoughts || []).map((thought, i) => {
            const base = i * 3;
            return (
              <div key={i} className="hw-attempt-group">
                <div className="hw-attempt-row">
                  <span className="hw-attempt-chip hw-chip-purple">
                    {i === 0 ? 'Attempt 1' : `Attempt ${i + 1} — fixing error`}
                  </span>
                  {i > 0 && <span className="hw-self-fix-tag">↺ Self-Corrected</span>}
                </div>

                {visible > base && (
                  <div className="hw-trace-row hw-trace-think hw-fade-in">
                    <span className="hw-trace-icon">💭</span>
                    <div>
                      <div className="hw-trace-lbl">Thinking</div>
                      <div className="hw-trace-txt">{thought}</div>
                    </div>
                  </div>
                )}
                {visible > base + 1 && trace.actions?.[i] && (
                  <div className="hw-trace-row hw-trace-act hw-fade-in">
                    <span className="hw-trace-icon">⚡</span>
                    <div style={{ flex: 1 }}>
                      <div className="hw-trace-lbl">SQL Generated</div>
                      <pre className="hw-trace-sql">{trace.actions[i]}</pre>
                    </div>
                  </div>
                )}
                {visible > base + 2 && trace.observations?.[i] && (
                  <div className={`hw-trace-row hw-fade-in ${
                    String(trace.observations[i]).toLowerCase().match(/error|fail/)
                      ? 'hw-trace-fail' : 'hw-trace-ok'
                  }`}>
                    <span className="hw-trace-icon">
                      {String(trace.observations[i]).toLowerCase().match(/error|fail/) ? '✗' : '✓'}
                    </span>
                    <div>
                      <div className="hw-trace-lbl">Observation</div>
                      <div className="hw-trace-txt">{trace.observations[i]}</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {error && (
            <div className="hw-error-box">
              <div className="hw-error-title">❌ Query Failed</div>
              <div className="hw-error-text">{error}</div>
            </div>
          )}
          {result && (
            <>
              <div className="hw-attempt-row">
                <span className="hw-attempt-chip hw-chip-purple">
                  {attempts} attempt{attempts !== 1 ? 's' : ''}
                </span>
                <TimingBadge ms={ms} />
              </div>
              <CodeBlock sql={result.sql} />
              <DataTable data={result.data} columns={result.columns} />
            </>
          )}
        </div>
      )}

      <div className="hw-card-footer">
        <Divider />
        <div className="hw-key-msg hw-key-purple">
          💬 Intelligent retry. Learns from mistakes automatically.
        </div>
      </div>
    </div>
  );
}

// ── Level 3 Card ─────────────────────────────────────────────────────────

const AGENTS = [
  { id: 'schema',  icon: '🗂️', label: 'Schema Agent',  desc: 'Reads table structure' },
  { id: 'sql',     icon: '⚡', label: 'SQL Agent',      desc: 'Generates optimized SQL' },
  { id: 'safety',  icon: '🛡️', label: 'Safety Agent',  desc: 'Validates query safety' },
  { id: 'insight', icon: '💡', label: 'Insight Agent',  desc: 'Synthesizes key insights' },
];

function Level3Card({ question, trigger, onResult }) {
  const [status, setS]   = useState('idle');
  const [result, setR]   = useState(null);
  const [error,  setE]   = useState('');
  const [ms,     setMs]  = useState(null);
  const [ags,    setAgs] = useState({});
  const timers           = useRef([]);

  useEffect(() => { if (trigger) run(); }, [trigger]); // eslint-disable-line

  function clearTimers() { timers.current.forEach(clearTimeout); timers.current = []; }

  async function run() {
    clearTimers();
    setS('running'); setE(''); setR(null); setMs(null);
    const init = {}; AGENTS.forEach(a => { init[a.id] = 'waiting'; }); setAgs(init);
    AGENTS.forEach((a, i) => {
      timers.current.push(setTimeout(() => setAgs(p => ({ ...p, [a.id]: 'running' })), i * 240));
    });

    const t0 = Date.now();
    try {
      const res = await fetch(`${API}/swarm/pg-query`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tok()}` },
        body:    JSON.stringify({ pg_uri: NEON, question, limit: 50 }),
      });
      let data;
      try { data = await res.json(); } catch { throw new Error(`Server error (${res.status})`); }
      if (!res.ok) throw new Error(data?.detail || `Request failed (${res.status})`);

      const elapsed = Date.now() - t0;
      AGENTS.forEach((a, i) => {
        timers.current.push(setTimeout(() => setAgs(p => ({ ...p, [a.id]: 'done' })), i * 150));
      });

      const firstOk     = (data.subtask_results || []).find(r => !r.error) || data.subtask_results?.[0] || {};
      const summaryText = typeof data.summary === 'string'
        ? data.summary
        : (data.summary?.text || data.summary?.answer || data.summary?.summary || '');

      timers.current.push(setTimeout(() => {
        setR({ sql: firstOk.sql || '', data: firstOk.data || [], columns: firstOk.columns || [],
               rowCount: firstOk.row_count ?? firstOk.data?.length ?? 0,
               agentsRun: data.agents_run ?? AGENTS.length,
               summary: summaryText });
        setMs(elapsed); setS('done');
        onResult?.({ sql: firstOk.sql, data: firstOk.data, timing: elapsed, agents: data.agents_run });
      }, AGENTS.length * 150 + 200));

    } catch (e) {
      setE(e.message || 'Swarm failed'); setS('error');
      AGENTS.forEach(a => setAgs(p => ({ ...p, [a.id]: 'error' })));
      onResult?.({ error: true });
    }
  }

  const anyAgent = Object.keys(ags).length > 0;

  return (
    <div className="hw-card hw-card-l3">
      <div className="hw-card-head">
        <div className="hw-badge hw-badge-l3">L3</div>
        <div className="hw-card-meta">
          <div className="hw-card-title">Swarm Agent</div>
          <div className="hw-card-sub">Multiple AI agents working in parallel</div>
        </div>
        <StatusBadge status={status} />
      </div>

      <L3Diagram />
      <Divider />

      <SectionLabel>Execution</SectionLabel>

      {status === 'idle' && (
        <p className="hw-idle-msg">Click <strong>Run All 3 Agents</strong> to start.</p>
      )}

      {anyAgent && (
        <div className="hw-agents-grid">
          {AGENTS.map(a => {
            const st = ags[a.id] || 'waiting';
            return (
              <div key={a.id} className={`hw-agent-card hw-ag-${st}`}>
                <div className="hw-agent-head">
                  <span className="hw-agent-icon">{a.icon}</span>
                  <span className="hw-agent-name">{a.label}</span>
                  <span className={`hw-ag-badge hw-ag-badge-${st}`}>
                    {st === 'waiting' ? '⏳ Waiting' :
                     st === 'running' ? '🔄 Running' :
                     st === 'done'    ? '✅ Done'    : '❌ Error'}
                  </span>
                </div>
                <div className="hw-agent-desc">{a.desc}</div>
                {st === 'running' && <div className="hw-agent-bar" />}
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="hw-error-box">
          <div className="hw-error-title">❌ Swarm Failed</div>
          <div className="hw-error-text">{error}</div>
        </div>
      )}

      {result && (
        <div className="hw-exec-body hw-fade-in">
          <div className="hw-attempt-row">
            <span className="hw-attempt-chip hw-chip-green">
              ✓ {result.agentsRun} agents completed
            </span>
            <TimingBadge ms={ms} />
          </div>
          <CodeBlock sql={result.sql} />
          <DataTable data={result.data} columns={result.columns} />
          {result.summary ? (
            <div className="hw-insight">
              <div className="hw-insight-head">💡 AI Insight</div>
              <div className="hw-insight-body">{String(result.summary)}</div>
            </div>
          ) : null}
        </div>
      )}

      <div className="hw-card-footer">
        <Divider />
        <div className="hw-key-msg hw-key-green">
          💬 Fully autonomous. Parallel execution. Best accuracy.
        </div>
      </div>
    </div>
  );
}

// ── Comparison Table ─────────────────────────────────────────────────────

function ComparisonTable({ l1, l2, l3 }) {
  if (!l1 && !l2 && !l3) return null;
  const fmt = v => v?.timing ? (v.timing < 1000 ? `${v.timing}ms` : `${(v.timing/1000).toFixed(1)}s`) : '—';
  const rows = [
    { feat: 'Agents used',          l1: '1',          l2: '1',         l3: '4'          },
    { feat: 'Self-correction',      l1: '❌ No',       l2: '✅ Yes',    l3: '✅ Yes'     },
    { feat: 'Parallel execution',   l1: '❌ No',       l2: '❌ No',     l3: '✅ Yes'     },
    { feat: 'Max attempts',         l1: '1',           l2: 'Up to 3',   l3: 'Unlimited'  },
    { feat: 'Time taken',           l1: fmt(l1),       l2: fmt(l2),     l3: fmt(l3)      },
    { feat: 'Accuracy',             l1: 'Basic',       l2: 'Better',    l3: 'Best ⭐'    },
  ];
  return (
    <div className="hw-compare hw-fade-in">
      <div className="hw-compare-head">
        <div className="hw-compare-title">Side-by-Side Comparison</div>
        <div className="hw-compare-sub">Results from your last run</div>
      </div>
      <div className="hw-compare-scroll">
        <table className="hw-compare-table">
          <thead>
            <tr>
              <th className="hw-cth-feat">Feature</th>
              <th className="hw-cth hw-cth-l1">
                <span className="hw-cbadge hw-cbadge-l1">L1</span> Basic Agent
              </th>
              <th className="hw-cth hw-cth-l2">
                <span className="hw-cbadge hw-cbadge-l2">L2</span> ReAct Agent
              </th>
              <th className="hw-cth hw-cth-l3">
                <span className="hw-cbadge hw-cbadge-l3">L3</span> Swarm Agent
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={i % 2 ? 'hw-crow-alt' : ''}>
                <td className="hw-cfeat">{r.feat}</td>
                <td className="hw-cval">{r.l1}</td>
                <td className="hw-cval">{r.l2}</td>
                <td className="hw-cval">{r.l3}</td>
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
  const [l1,       setL1]= useState(null);
  const [l2,       setL2]= useState(null);
  const [l3,       setL3]= useState(null);

  function runAll() { setL1(null); setL2(null); setL3(null); setT(t => t + 1); }

  return (
    <div className="hw-page">

      {/* Header */}
      <div className="hw-hero">
        <div>
          <div className="hw-hero-eyebrow">✦ Live Demo &nbsp;·&nbsp; SJSU CMPE 295B</div>
          <h1 className="hw-hero-title">AI Agent Architecture</h1>
          <p className="hw-hero-desc">
            Three levels of AI intelligence on the same question. Watch how each approach handles
            complexity, errors, and scale differently.
          </p>
        </div>
        <div className="hw-hero-pills">
          <div className="hw-hero-pill hw-pill-blue">L1 · Basic</div>
          <div className="hw-hero-pill hw-pill-purple">L2 · ReAct</div>
          <div className="hw-hero-pill hw-pill-green">L3 · Swarm</div>
        </div>
      </div>

      {/* Question input */}
      <div className="hw-input-section">
        <div className="hw-input-lbl">Question sent to all 3 agents:</div>
        <div className="hw-input-row">
          <input
            className="hw-q-input"
            value={question}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runAll()}
            placeholder="Ask anything about the database…"
          />
          <button className="hw-run-btn" onClick={runAll}>
            ▶ &nbsp;Run All 3 Agents
          </button>
        </div>
        <div className="hw-input-note">
          Demo DB tables: <code>employees</code> · <code>departments</code> · <code>orders</code> · <code>sales_performance</code>
        </div>
      </div>

      {/* Cards */}
      <div className="hw-grid">
        <Level1Card question={question} trigger={trigger} onResult={setL1} />
        <Level2Card question={question} trigger={trigger} onResult={setL2} />
        <Level3Card question={question} trigger={trigger} onResult={setL3} />
      </div>

      {/* Comparison */}
      {(l1 || l2 || l3) && <ComparisonTable l1={l1} l2={l2} l3={l3} />}

    </div>
  );
}
