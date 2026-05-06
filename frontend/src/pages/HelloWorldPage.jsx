import React, { useState, useEffect, useRef } from 'react';
import './HelloWorldPage.css';

const API    = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const NEON   = 'postgresql://neondb_owner:npg_Rn56FbVsmiQI@ep-wandering-art-amtq6t2m-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require';
const DEF_Q  = 'How many employees are in each department?';

function token() { return localStorage.getItem('token') || ''; }

const AGENTS = [
  { id: 'schema',  label: 'Schema Agent',  desc: 'Reads table structure & column types',      color: '#3b82f6' },
  { id: 'sql',     label: 'SQL Agent',      desc: 'Generates optimized SQL using ReAct loop',  color: '#8b5cf6' },
  { id: 'safety',  label: 'Safety Agent',   desc: 'Validates query safety & correctness',      color: '#f59e0b' },
  { id: 'insight', label: 'Insight Agent',  desc: 'Synthesizes results into key insights',     color: '#10b981' },
];

// ── helpers ──────────────────────────────────────────────────────────────
function SqlBlock({ sql, copied, onCopy }) {
  if (!sql) return null;
  return (
    <div className="hw-sql-card">
      <div className="hw-sql-bar">
        <span className="hw-label">Generated SQL</span>
        <button className={`hw-copy ${copied ? 'ok' : ''}`} onClick={onCopy}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre className="hw-sql">{sql}</pre>
    </div>
  );
}

function ResultTable({ data, columns, maxRows = 8 }) {
  if (!Array.isArray(data) || !data.length) return null;
  const first = data.find(r => r && typeof r === 'object') || {};
  const cols = columns?.length ? columns : Object.keys(first);
  const rows = data.slice(0, maxRows);
  return (
    <div className="hw-table-wrap">
      <table className="hw-table">
        <thead><tr>{cols.map(c => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>{cols.map(c => <td key={c}>{String(row[c] ?? '')}</td>)}</tr>
          ))}
        </tbody>
      </table>
      {data.length > maxRows && (
        <div className="hw-more">+{data.length - maxRows} more rows</div>
      )}
    </div>
  );
}

// ── Level 1: Single Agent ─────────────────────────────────────────────────
function Level1() {
  const [q, setQ]         = useState(DEF_Q);
  const [loading, setL]   = useState(false);
  const [result, setR]    = useState(null);
  const [error, setE]     = useState('');
  const [copied, setC]    = useState(false);

  async function run() {
    if (!q.trim()) return;
    setL(true); setE(''); setR(null);
    try {
      const res  = await fetch(`${API}/plugin/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, tables: {} }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setR(data);
    } catch(e) { setE(e.message); }
    finally    { setL(false); }
  }

  return (
    <div className="hw-card">
      <div className="hw-card-header">
        <div className="hw-badge hw-badge-1">01</div>
        <div>
          <div className="hw-card-title">Single Agent Query</div>
          <div className="hw-card-sub">
            Direct NL → SQL pipeline. One agent, one call, instant answer.
          </div>
        </div>
        <div className="hw-arch-tag">Plugin API → Gemini → Neon DB</div>
      </div>

      <div className="hw-input-row">
        <input className="hw-input" value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && run()} placeholder="Ask a question…" />
        <button className="hw-btn hw-btn-1" onClick={run} disabled={loading}>
          {loading ? <><span className="hw-spin" />Running…</> : 'Run Agent'}
        </button>
      </div>

      {error && <div className="hw-error">{error}</div>}

      {result && (
        <div className="hw-result hw-fadein">
          <div className="hw-stats-row">
            <div className="hw-stat"><span>{result.row_count}</span>Rows</div>
            <div className="hw-stat"><span className="hw-stat-ok">✓</span>Success</div>
            <div className="hw-stat"><span>1</span>Agent</div>
          </div>
          <SqlBlock sql={result.sql} copied={copied}
            onCopy={() => { navigator.clipboard.writeText(result.sql); setC(true); setTimeout(()=>setC(false),2000); }} />
          <ResultTable data={result.preview} columns={result.preview?.[0] ? Object.keys(result.preview[0]) : []} />
          {result.result_url && (
            <a href={result.result_url} target="_blank" rel="noreferrer" className="hw-view-btn">
              View Full Results →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ── Level 2: ReAct Loop ───────────────────────────────────────────────────
function Level2() {
  const [q, setQ]           = useState(DEF_Q);
  const [loading, setL]     = useState(false);
  const [result, setR]      = useState(null);
  const [error, setE]       = useState('');
  const [visibleSteps, setV]= useState(0);
  const [copied, setC]      = useState(false);

  async function run() {
    if (!q.trim()) return;
    setL(true); setE(''); setR(null); setV(0);
    try {
      const res  = await fetch(`${API}/pg/nl-query-auto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pg_uri: NEON, question: q, limit: 50, react: true }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Query failed');
      }
      const data = await res.json();
      setR(data);
    } catch(e) { setE(e.message); }
    finally    { setL(false); }
  }

  // Animate steps appearing one by one
  useEffect(() => {
    if (!result?.react_trace) return;
    const trace  = result.react_trace;
    const total  = (trace.thoughts?.length || 0) * 3; // 3 items per attempt
    let step = 0;
    const id = setInterval(() => {
      step++;
      setV(step);
      if (step >= total) clearInterval(id);
    }, 500);
    return () => clearInterval(id);
  }, [result]);

  const trace = result?.react_trace;
  const attempts = trace?.thoughts?.length || 0;

  return (
    <div className="hw-card">
      <div className="hw-card-header">
        <div className="hw-badge hw-badge-2">02</div>
        <div>
          <div className="hw-card-title">ReAct Self-Correcting Loop</div>
          <div className="hw-card-sub">
            Iterative Reason + Act cycles. Agent diagnoses errors and corrects its own SQL.
          </div>
        </div>
        <div className="hw-arch-tag">Schema → ReAct → Execute → Retry</div>
      </div>

      <div className="hw-input-row">
        <input className="hw-input" value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && run()} placeholder="Ask a question…" />
        <button className="hw-btn hw-btn-2" onClick={run} disabled={loading}>
          {loading ? <><span className="hw-spin" />Running…</> : 'Run ReAct'}
        </button>
      </div>

      {error && <div className="hw-error">{error}</div>}

      {loading && (
        <div className="hw-react-loading hw-fadein">
          <div className="hw-pulse-ring" />
          <span>ReAct agent reasoning…</span>
        </div>
      )}

      {result && trace && (
        <div className="hw-fadein">
          {/* Attempts badge */}
          <div className="hw-react-meta">
            <span className={`hw-attempt-badge ${attempts > 1 ? 'corrected' : 'clean'}`}>
              {attempts > 1 ? `⟳ Self-corrected in ${attempts} attempts` : '✓ Solved on first attempt'}
            </span>
            <span className="hw-react-count">{attempts} attempt{attempts !== 1 ? 's' : ''}</span>
          </div>

          {/* Step-by-step trace */}
          <div className="hw-trace">
            {(trace.thoughts || []).map((thought, i) => {
              const baseStep = i * 3;
              return (
                <div key={i} className="hw-attempt-block">
                  <div className="hw-attempt-label">
                    {i === 0 ? 'Initial Attempt' : `Correction Attempt ${i + 1}`}
                    {i > 0 && <span className="hw-correction-tag">Self-Corrected</span>}
                  </div>

                  {visibleSteps > baseStep && (
                    <div className="hw-step hw-step-thought hw-fadein">
                      <div className="hw-step-icon">💭</div>
                      <div>
                        <div className="hw-step-label">Thought</div>
                        <div className="hw-step-text">{thought}</div>
                      </div>
                    </div>
                  )}

                  {visibleSteps > baseStep + 1 && trace.actions?.[i] && (
                    <div className="hw-step hw-step-action hw-fadein">
                      <div className="hw-step-icon">⚡</div>
                      <div>
                        <div className="hw-step-label">Action — SQL Generated</div>
                        <pre className="hw-step-sql">{trace.actions[i]}</pre>
                      </div>
                    </div>
                  )}

                  {visibleSteps > baseStep + 2 && trace.observations?.[i] && (
                    <div className={`hw-step hw-fadein ${
                      trace.observations[i].toLowerCase().includes('error') ||
                      trace.observations[i].toLowerCase().includes('fail')
                        ? 'hw-step-error' : 'hw-step-obs'}`}>
                      <div className="hw-step-icon">
                        {trace.observations[i].toLowerCase().includes('error') ||
                         trace.observations[i].toLowerCase().includes('fail') ? '✗' : '✓'}
                      </div>
                      <div>
                        <div className="hw-step-label">Observation</div>
                        <div className="hw-step-text">{trace.observations[i]}</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Final result */}
          <div className="hw-stats-row">
            <div className="hw-stat"><span>{result.count ?? 0}</span>Rows</div>
            <div className="hw-stat"><span>{attempts}</span>Attempts</div>
            <div className="hw-stat"><span className="hw-stat-ok">✓</span>Success</div>
          </div>
          <SqlBlock sql={result.sql} copied={copied}
            onCopy={() => { navigator.clipboard.writeText(result.sql); setC(true); setTimeout(()=>setC(false),2000); }} />
          <ResultTable data={result.data} columns={result.columns} />
        </div>
      )}
    </div>
  );
}

// ── Level 3: Swarm ────────────────────────────────────────────────────────
function Level3() {
  const [q, setQ]           = useState(DEF_Q);
  const [loading, setL]     = useState(false);
  const [result, setR]      = useState(null);
  const [error, setE]       = useState('');
  const [agentStates, setAS]= useState({});
  const [copied, setC]      = useState(false);
  const startTime           = useRef({});

  async function run() {
    if (!q.trim()) return;
    setL(true); setE(''); setR(null);

    // Stagger agent "start" animations
    const initial = {};
    AGENTS.forEach(a => { initial[a.id] = 'waiting'; });
    setAS(initial);

    AGENTS.forEach((a, i) => {
      setTimeout(() => {
        startTime.current[a.id] = Date.now();
        setAS(prev => ({ ...prev, [a.id]: 'running' }));
      }, i * 280);
    });

    try {
      const t0  = Date.now();
      const res = await fetch(`${API}/swarm/pg-query`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token()}`,
        },
        body: JSON.stringify({ pg_uri: NEON, question: q, limit: 50, max_subtasks: 4 }),
      });

      let data;
      try { data = await res.json(); }
      catch(_) { throw new Error(`Server error (${res.status})`); }

      if (!res.ok) throw new Error(data?.detail || data?.error || `Request failed (${res.status})`);

      const totalMs = Date.now() - t0;

      // Pull first successful subtask result for display
      const firstOk = (data.subtask_results || []).find(r => !r.error) || data.subtask_results?.[0] || {};
      const summaryText = typeof data.summary === 'string'
        ? data.summary
        : data.summary?.text || data.summary?.answer || data.summary?.summary || '';

      // Mark all agents done with staggered finish
      AGENTS.forEach((a, i) => {
        setTimeout(() => setAS(prev => ({ ...prev, [a.id]: 'done' })), i * 120);
      });

      setTimeout(() => setR({
        sql:        firstOk.sql        || '',
        data:       firstOk.data       || [],
        columns:    firstOk.columns    || [],
        row_count:  firstOk.row_count  ?? (firstOk.data?.length ?? 0),
        agents_run: data.agents_run    ?? AGENTS.length,
        succeeded:  data.agents_succeeded ?? AGENTS.length,
        summary:    summaryText,
        totalMs,
      }), AGENTS.length * 120 + 200);

    } catch(e) {
      setE(e.message || 'Swarm query failed');
      AGENTS.forEach(a => setAS(prev => ({ ...prev, [a.id]: 'error' })));
    } finally {
      setL(false);
    }
  }

  const allDone  = AGENTS.every(a => agentStates[a.id] === 'done');
  const anyAgent = Object.keys(agentStates).length > 0;

  return (
    <div className="hw-card">
      <div className="hw-card-header">
        <div className="hw-badge hw-badge-3">03</div>
        <div>
          <div className="hw-card-title">Swarm Parallel Multi-Agent</div>
          <div className="hw-card-sub">
            Specialized agents run in parallel — schema, SQL generation, safety validation, insights.
          </div>
        </div>
        <div className="hw-arch-tag">4 Agents → Parallel → Synthesize</div>
      </div>

      <div className="hw-input-row">
        <input className="hw-input" value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && run()} placeholder="Ask a question…" />
        <button className="hw-btn hw-btn-3" onClick={run} disabled={loading}>
          {loading ? <><span className="hw-spin" />Running Swarm…</> : 'Run Swarm'}
        </button>
      </div>

      {error && <div className="hw-error">{error}</div>}

      {anyAgent && (
        <div className="hw-agents hw-fadein">
          {AGENTS.map(a => {
            const st = agentStates[a.id] || 'waiting';
            return (
              <div key={a.id} className={`hw-agent hw-agent-${st}`}>
                <div className="hw-agent-header">
                  <div className="hw-agent-dot" style={{ background: a.color }} />
                  <span className="hw-agent-name">{a.label}</span>
                  <span className="hw-agent-status">
                    {st === 'waiting' && <span className="hw-agent-tag waiting">Waiting</span>}
                    {st === 'running' && <><span className="hw-spin hw-spin-sm" /><span className="hw-agent-tag running">Running</span></>}
                    {st === 'done'    && <span className="hw-agent-tag done">Done ✓</span>}
                    {st === 'error'   && <span className="hw-agent-tag err">Error</span>}
                  </span>
                </div>
                <div className="hw-agent-desc">{a.desc}</div>
                {st === 'running' && <div className="hw-agent-progress" style={{ '--c': a.color }} />}
              </div>
            );
          })}
        </div>
      )}

      {result && allDone && (
        <div className="hw-fadein">
          <div className="hw-swarm-complete">
            <span className="hw-swarm-ok">✓ All agents completed</span>
            <span className="hw-swarm-time">{result.totalMs}ms total</span>
          </div>
          <div className="hw-stats-row">
            <div className="hw-stat"><span>{result.row_count ?? 0}</span>Rows</div>
            <div className="hw-stat"><span>{result.agents_run ?? AGENTS.length}</span>Agents run</div>
            <div className="hw-stat"><span className="hw-stat-ok">✓</span>Parallel</div>
          </div>
          <SqlBlock sql={result.sql} copied={copied}
            onCopy={() => { navigator.clipboard.writeText(result.sql || ''); setC(true); setTimeout(()=>setC(false),2000); }} />
          <ResultTable data={result.data} columns={result.columns} />
          {result.summary ? (
            <div className="hw-insight">
              <div className="hw-insight-label">💡 AI Insight</div>
              <div className="hw-insight-text">{String(result.summary)}</div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function HelloWorldPage() {
  return (
    <div className="hw-page">
      <div className="hw-hero">
        <div className="hw-hero-grid" />
        <div className="hw-hero-glow" />
        <div className="hw-hero-body">
          <div className="hw-hero-eyebrow">
            <span className="hw-hero-dot" />
            Live Demo · SJSU CMPE 295B
          </div>
          <h1 className="hw-hero-title">AI Agent Architecture</h1>
          <p className="hw-hero-sub">
            Three levels of intelligence — from a single agent to a self-correcting ReAct loop
            to a parallel swarm of specialized agents.
          </p>
        </div>
        <div className="hw-hero-levels">
          {['01 Single Agent', '02 ReAct Loop', '03 Swarm'].map((l, i) => (
            <div key={i} className="hw-hero-level">
              <div className="hw-hero-level-dot" style={{ background: ['#818cf8','#60a5fa','#34d399'][i] }} />
              {l}
            </div>
          ))}
        </div>
      </div>

      <Level1 />
      <Level2 />
      <Level3 />
    </div>
  );
}
