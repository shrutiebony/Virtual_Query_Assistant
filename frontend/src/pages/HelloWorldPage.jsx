import React, { useState, useEffect, useRef } from 'react';
import { authAPI } from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Zap, Sparkles } from 'lucide-react';
import { Badge } from '../components/ui';
import './ChatQueryPage.css';
import './HelloWorldPage.css';

const API  = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const NEON = 'postgresql://neondb_owner:npg_Rn56FbVsmiQI@ep-wandering-art-amtq6t2m-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require';
const DEF_Q = 'What is the total revenue per employee department?';

const DB_TYPE_MAP = {
  postgres: 'postgresql',
  supabase: 'postgresql',
  mysql:    'mysql',
  mongodb:  'mongodb',
};

const DATA_SOURCES = [
  { id: 'demo',     label: 'Demo Database', color: '#6366f1', needsConn: false },
  { id: 'postgres', label: 'PostgreSQL',    color: '#336791', needsConn: true },
  { id: 'supabase', label: 'Supabase',      color: '#3ECF8E', needsConn: true },
  { id: 'mysql',    label: 'MySQL',         color: '#F29111', needsConn: true },
  { id: 'mongodb',  label: 'MongoDB',       color: '#47A248', needsConn: true },
  { id: 'uploaded', label: 'Upload CSV',    color: '#8b5cf6', needsConn: false },
];

const SUGGESTIONS = [
  'What is the total revenue per department?',
  'Which department has the highest average salary?',
  'Show top 5 orders by revenue',
  'Count employees per department',
];

const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#14b8a6'];

function tok() { return localStorage.getItem('token') || ''; }

function parseMySQLUri(uri) {
  const m = uri.match(/^mysql:\/\/([^:]+):([^@]+)@([^:/]+):?(\d+)?\/(.+)$/);
  if (!m) return null;
  return { username: m[1], password: m[2], host: m[3], port: parseInt(m[4]) || 3306, database: m[5] };
}

// ── Status dot ─────────────────────────────────────────────────────────────

function StatusDot({ status }) {
  return <span className={`hw-dot hw-dot-${status}`} />;
}

// ── Chart ──────────────────────────────────────────────────────────────────

function ResultChart({ data, color = '#6366f1' }) {
  if (!data?.length) return null;
  const cols    = Object.keys(data[0]);
  const numCols = cols.filter(k => typeof data[0][k] === 'number');
  const txtCols = cols.filter(k => typeof data[0][k] !== 'number');
  if (!numCols.length) return null;
  const xKey = txtCols[0] || cols[0];
  return (
    <div style={{
      marginTop: 14, background: '#fafafa',
      border: '1px solid #f1f3f7', borderRadius: 10, padding: '12px 8px 8px',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: '#9ca3af',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        marginBottom: 8, paddingLeft: 4,
      }}>
        Visualization
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data.slice(0, 12)} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f7" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 10, fill: '#6b7591' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#6b7591' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => Number(v).toLocaleString()}
          />
          <Tooltip
            contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }}
            formatter={v => [Number(v).toLocaleString()]}
          />
          {numCols.slice(0, 2).map((k, i) => (
            <Bar key={k} dataKey={k} fill={CHART_COLORS[i] || color} radius={[6, 6, 0, 0]} maxBarSize={48} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── SQL block ──────────────────────────────────────────────────────────────

function SqlBlock({ sql }) {
  const [copied, setCopied] = useState(false);
  if (!sql) return null;
  const copy = () => { navigator.clipboard.writeText(sql); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Generated SQL
        </span>
        <button onClick={copy} style={{ fontSize: 10, color: copied ? '#059669' : '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre style={{
        fontSize: 11, background: '#1e1b4b', color: '#e0e7ff',
        border: '1px solid #312e81', borderRadius: 8,
        padding: '12px 14px', overflow: 'auto', whiteSpace: 'pre-wrap',
        wordBreak: 'break-word', margin: 0, fontFamily: 'monospace', lineHeight: 1.6,
      }}>
        {sql}
      </pre>
    </div>
  );
}

// ── Data table ─────────────────────────────────────────────────────────────

function DataTable({ data, columns }) {
  if (!data?.length) return null;
  const cols = columns?.length ? columns : Object.keys(data[0] || {});
  if (!cols.length) return null;
  return (
    <div style={{ marginTop: 12, overflowX: 'auto', borderRadius: 8, border: '1px solid #e5e7eb', maxHeight: 260, overflowY: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
        <thead style={{ position: 'sticky', top: 0 }}>
          <tr>
            {cols.map(c => (
              <th key={c} style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb', background: '#f9fafb', fontSize: 11, whiteSpace: 'nowrap' }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 10).map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
              {cols.map(c => (
                <td key={c} style={{ padding: '6px 12px', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>
                  {row[c] == null
                    ? <span style={{ color: '#d1d5db' }}>null</span>
                    : typeof row[c] === 'number'
                      ? <strong style={{ color: '#374151' }}>{Number(row[c]).toLocaleString()}</strong>
                      : String(row[c])
                  }
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 10 && (
        <div style={{ textAlign: 'center', padding: '6px', fontSize: 11, color: '#9ca3af', background: '#fafafa' }}>
          {data.length - 10} more rows
        </div>
      )}
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div style={{ padding: '20px 0' }}>
      {[80, 55, 90].map((w, i) => (
        <div key={i} style={{
          height: 12, borderRadius: 6, marginBottom: 10, width: `${w}%`,
          background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
          backgroundSize: '200% 100%', animation: 'hw-shimmer 1.5s infinite',
        }} />
      ))}
    </div>
  );
}

// ── Mini pipeline strip ────────────────────────────────────────────────────

function Pipeline({ steps, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', margin: '10px 0 4px' }}>
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '3px 8px',
            background: `${color}10`, color, border: `1px solid ${color}25`,
            borderRadius: 5, whiteSpace: 'nowrap',
          }}>{s}</span>
          {i < steps.length - 1 && <span style={{ color: '#cbd5e1', fontSize: 11 }}>→</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Level description header ───────────────────────────────────────────────

function LevelHeader({ color, title, sub, steps }) {
  return (
    <div style={{
      borderLeft: `3px solid ${color}`, paddingLeft: 14, marginBottom: 16,
      background: `${color}06`, borderRadius: '0 8px 8px 0', padding: '12px 14px',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6, marginBottom: 6 }}>{sub}</div>
      <Pipeline steps={steps} color={color} />
    </div>
  );
}

// ── Level 1 ───────────────────────────────────────────────────────────────

function Level1({ question, trigger, source, onResult }) {
  const [status, setS] = useState('idle');
  const [result, setR] = useState(null);
  const [error,  setE] = useState('');
  const [ms,     setMs] = useState(null);

  useEffect(() => { if (trigger) run(); }, [trigger]); // eslint-disable-line

  async function run() {
    setS('running'); setE(''); setR(null); setMs(null);
    const t0 = Date.now();
    try {
      const body = { question, db_type: source.id };
      if (source.id !== 'demo') body.connection_string = source.connectionString;
      if (source.id === 'uploaded') { body.tables = source.tables; delete body.connection_string; }
      const res  = await fetch(`${API}/plugin/query`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const elapsed = Date.now() - t0;
      setR(data); setMs(elapsed); setS('done');
      onResult?.({ sql: data.sql, data: data.preview, timing: elapsed });
    } catch (e) { setE(e.message || 'Query failed'); setS('error'); onResult?.({ error: true }); }
  }

  const color = '#2563eb';
  return (
    <div>
      <LevelHeader
        color={color}
        title="Single Agent — one shot, no retry"
        sub="The question goes directly to the AI. It generates SQL, the database runs it, results are returned. No error recovery — if the SQL fails, the agent stops."
        steps={['Question', 'Generate SQL', 'Execute', 'Return results']}
      />
      {status === 'idle' && <div className="cqp-welcome" style={{ padding: '40px 0' }}><Zap size={22} color={color} /><div className="cqp-welcome-title" style={{ fontSize: '1rem' }}>Press Run to execute this agent</div></div>}
      {status === 'running' && <Skeleton />}
      {status === 'error'   && <div className="hw-error">{error}</div>}
      {status === 'done' && result && (
        <div>
          <div className="hw-meta">
            <span className="hw-badge" style={{ background: `${color}12`, color, borderColor: `${color}25` }}>1 attempt</span>
            {ms && <span className="hw-time">{ms < 1000 ? `${ms}ms` : `${(ms/1000).toFixed(1)}s`}</span>}
          </div>
          <SqlBlock sql={result.sql} />
          <ResultChart data={result.preview} color={color} />
          <DataTable data={result.preview} />
        </div>
      )}
    </div>
  );
}

// ── Level 2 ───────────────────────────────────────────────────────────────

function Level2({ question, trigger, source, onResult }) {
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
      let res, data;
      if (source.id === 'mysql') {
        const parsed = parseMySQLUri(source.connectionString);
        if (!parsed) throw new Error('Invalid MySQL URI');
        res = await fetch(`${API}/mysql/nl-query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
          body: JSON.stringify({ ...parsed, question, tables: [] }),
        });
      } else if (source.id === 'mongodb') {
        res = await fetch(`${API}/mongo/nl-query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
          body: JSON.stringify({ mongo_uri: source.connectionString, db_name: source.dbName || 'test', collection: source.connectedTables[0] || 'data', question }),
        });
      } else {
        const pg_uri = source.id === 'demo' ? NEON : source.connectionString;
        res = await fetch(`${API}/pg/nl-query-auto`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pg_uri, question, react: true, limit: 50 }),
        });
      }
      try { data = await res.json(); } catch { throw new Error(`Server error (${res.status})`); }
      if (!res.ok) throw new Error(data?.detail || `Failed (${res.status})`);
      const elapsed = Date.now() - t0;
      setR(data); setMs(elapsed); setS('done');
      onResult?.({ sql: data.sql, data: data.data, timing: elapsed, attempts: data.react_trace?.attempts || 1 });
    } catch (e) { setE(e.message); setS('error'); onResult?.({ error: true }); }
  }

  const color = '#7c3aed';
  const trace = result?.react_trace;
  const attempts = trace?.thoughts?.length || 0;

  return (
    <div>
      <LevelHeader
        color={color}
        title="ReAct Agent — reason, act, observe, retry"
        sub="The agent thinks about the schema, writes SQL, executes it, and reads the result. If it fails it reads the error and tries a corrected query — up to 3 times."
        steps={['Reason', 'Write SQL', 'Execute', 'Observe', '→ retry on error']}
      />

      {status === 'idle' && <div className="cqp-welcome" style={{ padding: '40px 0' }}><Zap size={22} color={color} /><div className="cqp-welcome-title" style={{ fontSize: '1rem' }}>Press Run to execute this agent</div></div>}

      {status === 'running' && !trace && (
        <div style={{ padding: '12px 0' }}>
          <div className="hw-thinking-bar" style={{ '--c': color }} />
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8, fontStyle: 'italic' }}>
            Agent is reasoning about the question and schema…
          </p>
        </div>
      )}

      {status === 'error' && <div className="hw-error">{error}</div>}

      {/* Trace */}
      {trace && (trace.thoughts || []).map((thought, i) => {
        const base = i * 3;
        return (
          <div key={i} style={{ margin: '10px 0', border: `1px solid ${color}20`, borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ background: `${color}08`, padding: '6px 12px', fontSize: 11, fontWeight: 700, color, borderBottom: `1px solid ${color}15` }}>
              Attempt {i + 1}{i > 0 && <span style={{ fontWeight: 500, opacity: 0.7 }}> — correcting error</span>}
            </div>
            {visible > base && (
              <div style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', background: '#faf5ff' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', marginBottom: 4 }}>Reasoning</div>
                <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, fontStyle: 'italic' }}>{thought}</div>
              </div>
            )}
            {visible > base + 1 && trace.actions?.[i] && (
              <div style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', background: '#f8fafc' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', marginBottom: 4 }}>SQL written</div>
                <pre style={{ fontSize: 11, fontFamily: 'monospace', color: '#1e1b4b', margin: 0, whiteSpace: 'pre-wrap' }}>{trace.actions[i]}</pre>
              </div>
            )}
            {visible > base + 2 && trace.observations?.[i] && (
              <div style={{ padding: '8px 12px', background: String(trace.observations[i]).match(/error|fail/i) ? '#fef2f2' : '#f0fdf4' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: String(trace.observations[i]).match(/error|fail/i) ? '#dc2626' : '#059669', textTransform: 'uppercase', marginBottom: 4 }}>Result</div>
                <div style={{ fontSize: 12, color: '#374151' }}>{trace.observations[i]}</div>
              </div>
            )}
          </div>
        );
      })}

      {status === 'done' && result && (
        <div style={{ marginTop: 8 }}>
          <div className="hw-meta">
            <span className="hw-badge" style={{ background: `${color}12`, color, borderColor: `${color}25` }}>
              {attempts} attempt{attempts !== 1 ? 's' : ''}
            </span>
            {ms && <span className="hw-time">{ms < 1000 ? `${ms}ms` : `${(ms/1000).toFixed(1)}s`}</span>}
          </div>
          <SqlBlock sql={result.sql} />
          <ResultChart data={result.data} color={color} />
          <DataTable data={result.data} columns={result.columns} />
        </div>
      )}
    </div>
  );
}

// ── Level 3 ───────────────────────────────────────────────────────────────

const SWARM_AGENTS = [
  { id: 'schema',  label: 'Schema Reader',      desc: 'Reads all tables and column types from the database' },
  { id: 'sql',     label: 'SQL Generator',       desc: 'Writes and self-corrects the SQL query' },
  { id: 'safety',  label: 'Safety Validator',    desc: 'Checks for injection and data-safety issues' },
  { id: 'insight', label: 'Insight Synthesiser', desc: 'Interprets results and writes a plain-English summary' },
];

function Level3({ question, trigger, source, onResult }) {
  const [status, setS] = useState('idle');
  const [result, setR] = useState(null);
  const [error,  setE] = useState('');
  const [ms,     setMs] = useState(null);
  const [ags,    setAgs] = useState({});
  const timers = useRef([]);

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
      let res, data;
      if (source.id === 'mysql') {
        const parsed = parseMySQLUri(source.connectionString);
        if (!parsed) throw new Error('Invalid MySQL URI');
        res = await fetch(`${API}/swarm/mysql-query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
          body: JSON.stringify({ ...parsed, question, limit: 50 }),
        });
      } else if (source.id === 'mongodb') {
        res = await fetch(`${API}/swarm/mongo-query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
          body: JSON.stringify({ mongo_uri: source.connectionString, db_name: source.dbName || 'test', collections: source.connectedTables, question, limit: 50 }),
        });
      } else {
        const pg_uri = source.id === 'demo' ? NEON : source.connectionString;
        res = await fetch(`${API}/swarm/pg-query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
          body: JSON.stringify({ pg_uri, question, limit: 50 }),
        });
      }
      try { data = await res.json(); } catch { throw new Error(`Server error (${res.status})`); }
      if (!res.ok) throw new Error(data?.detail || `Failed (${res.status})`);
      const elapsed = Date.now() - t0;
      SWARM_AGENTS.forEach((a, i) => {
        timers.current.push(setTimeout(() => setAgs(p => ({ ...p, [a.id]: 'done' })), i * 140));
      });
      const firstOk = (data.subtask_results || []).find(r => !r.error) || data.subtask_results?.[0] || {};
      const summary = typeof data.summary === 'string' ? data.summary
        : (data.summary?.text || data.summary?.answer || data.summary?.summary || '');
      timers.current.push(setTimeout(() => {
        setR({ sql: firstOk.sql || '', data: firstOk.data || [], columns: firstOk.columns || [], agentsRun: data.agents_run ?? SWARM_AGENTS.length, summary });
        setMs(elapsed); setS('done');
        onResult?.({ sql: firstOk.sql, data: firstOk.data, timing: elapsed, agents: data.agents_run });
      }, SWARM_AGENTS.length * 140 + 200));
    } catch (e) {
      setE(e.message); setS('error');
      SWARM_AGENTS.forEach(a => setAgs(p => ({ ...p, [a.id]: 'error' })));
      onResult?.({ error: true });
    }
  }

  const color = '#059669';
  const anyAgents = Object.keys(ags).length > 0;

  return (
    <div>
      <LevelHeader
        color={color}
        title="Swarm of Agents — 4 specialists running in parallel"
        sub="Four specialised agents run simultaneously. A coordinator combines their outputs into one coherent answer — faster and more accurate than any single agent."
        steps={['Schema Reader', 'SQL Generator', 'Safety Validator', 'Insight Synthesiser', '→ Combined answer']}
      />

      {status === 'idle' && <div className="cqp-welcome" style={{ padding: '40px 0' }}><Zap size={22} color={color} /><div className="cqp-welcome-title" style={{ fontSize: '1rem' }}>Press Run to execute this agent</div></div>}

      {anyAgents && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {SWARM_AGENTS.map(a => {
            const st = ags[a.id] || 'waiting';
            return (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 8,
                background: st === 'done' ? `${color}06` : st === 'error' ? '#fef2f2' : '#fafafa',
                border: `1px solid ${st === 'done' ? `${color}20` : st === 'error' ? '#fecaca' : '#e5e7eb'}`,
                position: 'relative', overflow: 'hidden',
              }}>
                <StatusDot status={st} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{a.label}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{a.desc}</div>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                  background: st === 'done' ? `${color}15` : st === 'running' ? '#dbeafe' : st === 'error' ? '#fee2e2' : '#f1f5f9',
                  color: st === 'done' ? color : st === 'running' ? '#1d4ed8' : st === 'error' ? '#dc2626' : '#9ca3af',
                }}>
                  {st === 'waiting' ? 'Queued' : st === 'running' ? 'Running' : st === 'done' ? 'Done' : 'Error'}
                </span>
                {st === 'running' && (
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: `linear-gradient(90deg,transparent,${color},transparent)`, animation: 'hw-bar 1.2s ease-in-out infinite' }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {status === 'error' && <div className="hw-error">{error}</div>}

      {result && (
        <div>
          <div className="hw-meta">
            <span className="hw-badge" style={{ background: `${color}12`, color, borderColor: `${color}25` }}>
              {result.agentsRun} agents
            </span>
            {ms && <span className="hw-time">{ms < 1000 ? `${ms}ms` : `${(ms/1000).toFixed(1)}s`}</span>}
          </div>
          <SqlBlock sql={result.sql} />
          <ResultChart data={result.data} color={color} />
          <DataTable data={result.data} columns={result.columns} />
          {result.summary && (
            <div style={{ marginTop: 12, background: `${color}06`, border: `1px solid ${color}20`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>AI Insight</div>
              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>{String(result.summary)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Comparison tab ─────────────────────────────────────────────────────────

function CompareTab({ l1, l2, l3 }) {
  if (!l1 && !l2 && !l3) return (
    <div className="cqp-welcome" style={{ padding: '60px 0' }}>
      <Zap size={24} color="#374151" />
      <div className="cqp-welcome-title" style={{ fontSize: '1rem' }}>Run all three agents to compare</div>
      <div className="cqp-welcome-sub">Switch to L1, L2, L3 tabs and press Run on each, then come back here</div>
    </div>
  );
  const fmt = v => v?.timing ? (v.timing < 1000 ? `${v.timing}ms` : `${(v.timing/1000).toFixed(1)}s`) : '—';
  const rows = [
    { label: 'Agents used',         l1: '1',              l2: '1',          l3: '4' },
    { label: 'Reads own errors',    l1: 'No',             l2: 'Yes',        l3: 'Yes' },
    { label: 'Parallel execution',  l1: 'No',             l2: 'No',         l3: 'Yes' },
    { label: 'Max attempts',        l1: '1',              l2: 'Up to 3',    l3: 'Unlimited' },
    { label: 'Response time',       l1: fmt(l1),          l2: fmt(l2),      l3: fmt(l3) },
    { label: 'AI interpretation',   l1: 'No',             l2: 'No',         l3: 'Yes' },
    { label: 'Best suited for',     l1: 'Simple lookups', l2: 'Might fail', l3: 'Complex analysis' },
  ];
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '10px 14px', background: '#f9fafb', borderBottom: '2px solid #e5e7eb', color: '#374151', fontWeight: 700 }}>
              Feature
            </th>
            {[['L1', 'Single Agent', '#2563eb'], ['L2', 'ReAct Agent', '#7c3aed'], ['L3', 'Swarm', '#059669']].map(([badge, name, color]) => (
              <th key={badge} style={{ textAlign: 'center', padding: '10px 14px', background: '#f9fafb', borderBottom: `3px solid ${color}`, color: '#374151', fontWeight: 700 }}>
                <span style={{ display: 'inline-block', background: `${color}15`, color, borderRadius: 4, padding: '1px 6px', fontSize: 11, marginBottom: 2 }}>{badge}</span>
                <br />{name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ background: i % 2 ? '#fafafa' : '#fff' }}>
              <td style={{ padding: '9px 14px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #f3f4f6' }}>{r.label}</td>
              {[r.l1, r.l2, r.l3].map((v, j) => (
                <td key={j} style={{ padding: '9px 14px', textAlign: 'center', color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── CSV parser ─────────────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { columns: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
    return obj;
  });
  return { columns: headers, rows };
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function HelloWorldPage() {
  const [question, setQ]  = useState(DEF_Q);
  const [trigger,  setT]  = useState(0);
  const [tab,      setTab] = useState('l1');
  const [l1, setL1] = useState(null);
  const [l2, setL2] = useState(null);
  const [l3, setL3] = useState(null);

  const [allConns,       setAllConns]       = useState([]);
  const [selectedConnId, setSelectedConnId] = useState('');
  const [connStatus,     setConnStatus]     = useState('idle');
  const [connMsg,        setConnMsg]        = useState('');
  const [csvInfo,        setCsvInfo]        = useState(null);
  const [suggestions,    setSuggestions]    = useState(SUGGESTIONS);

  const [source, setSource] = useState({
    id: 'demo', connectionString: '', tables: {}, connectedTables: [], dbName: '',
  });

  const textareaRef = useRef(null);
  const sourceInfo  = DATA_SOURCES.find(d => d.id === source.id) || DATA_SOURCES[0];
  const dbTypeKey   = DB_TYPE_MAP[source.id];
  const filteredConns = dbTypeKey ? allConns.filter(c => c.db_type === dbTypeKey) : [];

  useEffect(() => {
    authAPI.connections().then(r => setAllConns(r.data || [])).catch(() => {});
  }, []);

  function selectSource(ds) {
    setSource(s => ({ ...s, id: ds.id, connectionString: '', connectedTables: [], tables: {} }));
    setSelectedConnId('');
    setConnStatus('idle');
    setConnMsg('');
    setCsvInfo(null);
    if (ds.id === 'demo') setSuggestions(SUGGESTIONS);
  }

  async function handleConnSelect(connId) {
    setSelectedConnId(connId);
    if (!connId) { setSource(s => ({ ...s, connectionString: '', connectedTables: [] })); setConnStatus('idle'); return; }
    setConnStatus('loading');
    try {
      const uriRes = await authAPI.getUri(connId);
      const uri = uriRes.data?.uri;
      if (!uri) throw new Error('Could not retrieve connection URI');
      setSource(s => ({ ...s, connectionString: uri }));
      const res = await fetch(`${API}/plugin/connect`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_string: uri, db_type: source.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.detail || 'Connection failed');
      const tables = data.tables_found || [];
      setSource(s => ({ ...s, connectedTables: tables }));
      setConnStatus('connected');
      fetchSuggestions(tables, source.id);
    } catch (e) { setConnStatus('error'); setConnMsg(e.message); }
  }

  async function fetchSuggestions(tables, dbType) {
    try {
      const schema = {};
      tables.forEach(t => { schema[t] = []; });
      const res = await fetch(`${API}/plugin/suggest-questions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tables_schema: schema, db_type: dbType }),
      });
      const data = await res.json();
      if (data.questions?.length) setSuggestions(data.questions);
    } catch (_) {}
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const { columns, rows } = parseCSV(ev.target.result || '');
      const tableName = file.name.replace(/\.csv$/i, '').replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'uploaded';
      setSource(s => ({ ...s, tables: { [tableName]: rows }, connectedTables: [tableName] }));
      setCsvInfo({ columns, rowCount: rows.length, tableName });
      setSuggestions(SUGGESTIONS);
    };
    reader.readAsText(file);
  }

  function runAll() { setL1(null); setL2(null); setL3(null); setT(t => t + 1); }

  const conn      = allConns.find(c => String(c.id) === String(selectedConnId));
  const connLabel = source.id === 'demo' ? 'Demo Database'
    : conn?.name || conn?.dbname || (csvInfo?.tableName ? csvInfo.tableName : 'No connection');

  const l1Status = l1 ? (l1.error ? 'error' : 'done') : (trigger > 0 ? 'running' : 'idle');
  const l2Status = l2 ? (l2.error ? 'error' : 'done') : (trigger > 0 ? 'running' : 'idle');
  const l3Status = l3 ? (l3.error ? 'error' : 'done') : (trigger > 0 ? 'running' : 'idle');

  const tabColors = { l1: '#2563eb', l2: '#7c3aed', l3: '#059669', compare: '#374151' };
  const currentColor = tabColors[tab] || '#374151';

  const LEVEL_TABS = [
    { id: 'l1',      label: 'L1 · Single Agent',  color: '#2563eb', status: l1Status },
    { id: 'l2',      label: 'L2 · ReAct Agent',   color: '#7c3aed', status: l2Status },
    { id: 'l3',      label: 'L3 · Swarm Agents',  color: '#059669', status: l3Status },
    { id: 'compare', label: 'Compare All',         color: '#374151', status: 'idle' },
  ];

  return (
    <div className="chat-query-page fade-in">

      {/* ── Left sidebar ── */}
      <div className="cqp-left">

        {/* Agent Level */}
        <div className="cqp-section">
          <div className="cqp-section-label">Agent Level</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {LEVEL_TABS.map(lv => (
              <button key={lv.id} onClick={() => setTab(lv.id)} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: 8, border: '1.5px solid',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.15s', textAlign: 'left',
                borderColor: tab === lv.id ? lv.color : '#e5e7eb',
                background:  tab === lv.id ? `${lv.color}12` : '#fff',
                color:       tab === lv.id ? lv.color : '#6b7280',
              }}>
                {lv.id !== 'compare' && <StatusDot status={lv.status} />}
                {lv.label}
              </button>
            ))}
          </div>
        </div>

        {/* Data Source */}
        <div className="cqp-section">
          <div className="cqp-section-label">Data Source</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {DATA_SOURCES.map(ds => (
              <button key={ds.id} onClick={() => selectSource(ds)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 10px', borderRadius: 7, border: '1.5px solid',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.15s', textAlign: 'left',
                borderColor: source.id === ds.id ? ds.color : '#e5e7eb',
                background:  source.id === ds.id ? `${ds.color}12` : '#fff',
                color:       source.id === ds.id ? ds.color : '#6b7280',
              }}>
                {ds.label}
              </button>
            ))}
          </div>
        </div>

        {/* Connection dropdown */}
        {sourceInfo.needsConn && (
          <div className="cqp-section">
            <div className="cqp-section-label">Connection</div>
            {filteredConns.length === 0 ? (
              <div className="cqp-empty-note">
                No {sourceInfo.label} connections.{' '}
                <a href="/connections" style={{ color: 'var(--accent)' }}>Add one</a>
              </div>
            ) : (
              <>
                <select
                  className="cqp-select"
                  value={selectedConnId}
                  onChange={e => handleConnSelect(e.target.value)}
                  disabled={connStatus === 'loading'}
                >
                  <option value="">— Select —</option>
                  {filteredConns.map(c => (
                    <option key={c.id} value={String(c.id)}>{c.name || c.dbname}</option>
                  ))}
                </select>
                {connStatus === 'loading'   && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Connecting…</div>}
                {connStatus === 'connected' && <div style={{ fontSize: 11, color: '#059669', marginTop: 4, fontWeight: 600 }}>Connected · {source.connectedTables.length} tables</div>}
                {connStatus === 'error'     && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>{connMsg}</div>}
              </>
            )}
          </div>
        )}

        {/* CSV upload */}
        {source.id === 'uploaded' && (
          <div className="cqp-section">
            <div className="cqp-section-label">CSV File</div>
            <label style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1.5px dashed #cbd5e1', borderRadius: 8, padding: '16px 12px',
              cursor: 'pointer', textAlign: 'center', minHeight: 60, background: '#fafafa',
            }}>
              <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileChange} />
              {csvInfo ? (
                <div style={{ fontSize: 11 }}>
                  <div style={{ fontWeight: 700, color: '#6366f1' }}>{csvInfo.tableName}</div>
                  <div style={{ color: '#64748b', marginTop: 2 }}>{csvInfo.rowCount} rows · {csvInfo.columns.length} cols</div>
                </div>
              ) : <div style={{ fontSize: 11, color: '#94a3b8' }}>Click to upload CSV</div>}
            </label>
          </div>
        )}

        {/* Suggestions */}
        <div className="cqp-section cqp-suggestions">
          <div className="cqp-section-label"><Sparkles size={11} /> Suggestions</div>
          {suggestions.map(s => (
            <button key={s} className="cqp-suggestion"
              onClick={() => { setQ(s); textareaRef.current?.focus(); }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="cqp-right">
        <div className="cqp-chat-header">
          <Zap size={15} color={currentColor} />
          <span>Agent Demos</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: `${currentColor}15`, color: currentColor }}>
              {tab === 'l1' ? 'Single Agent' : tab === 'l2' ? 'ReAct Agent' : tab === 'l3' ? 'Swarm' : 'Comparison'}
            </span>
            <Badge color="blue">{connLabel}</Badge>
          </div>
        </div>

        <div className="cqp-messages" style={{ padding: '20px 24px' }}>
          {tab === 'l1' && <Level1 question={question} trigger={trigger} source={source} onResult={setL1} />}
          {tab === 'l2' && <Level2 question={question} trigger={trigger} source={source} onResult={setL2} />}
          {tab === 'l3' && <Level3 question={question} trigger={trigger} source={source} onResult={setL3} />}
          {tab === 'compare' && <CompareTab l1={l1} l2={l2} l3={l3} />}
        </div>

        <div className="cqp-input-bar">
          <textarea
            ref={textareaRef}
            className="cqp-textarea"
            value={question}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runAll(); } }}
            placeholder="Ask a question about your data… (Enter to run all agents)"
            rows={1}
          />
          <button className="cqp-send-btn" onClick={runAll} disabled={!question.trim()}>
            <Zap size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
