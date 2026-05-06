import React, { useState, useRef } from 'react';
import {
  Zap, Plug, Terminal, CheckCircle, Copy, Check,
  ArrowUpRight, Database, BarChart2,
} from 'lucide-react';
import './PluginPage.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const DEMO_QUESTIONS = [
  'How many employees are in each department?',
  'What is the average salary by department?',
  'Show top 5 orders by revenue',
  'Which department has the highest budget?',
  'Total revenue by product',
  'List all employees in Engineering',
];

const SAMPLE_CONNECTIONS = [
  { label: 'Neon',       value: 'postgresql://user:pass@host.neon.tech/db?sslmode=require' },
  { label: 'Supabase',   value: 'postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres' },
  { label: 'Local PG',   value: 'postgresql://postgres:password@localhost:5432/mydb' },
];

const CLI_STEPS = [
  { comment: 'Install Claude Code CLI', cmd: 'npm install -g @anthropic-ai/claude-code' },
  { comment: 'Clone the plugin repo',   cmd: 'git clone https://github.com/rutuja-patil24/database-assistant' },
  { comment: 'Start with plugin loaded', cmd: 'claude --plugin-dir ./database-assistant/db-assistant-plugin' },
];

const CLI_COMMANDS = [
  { cmd: '/db-assistant:query How many employees per department?', desc: 'Query the demo database' },
  { cmd: '/db-assistant:connect postgresql://user:pass@host/db',   desc: 'Connect your own database' },
  { cmd: '/db-assistant:benchmark',                                desc: 'Show accuracy benchmark results' },
];

const DEMO_TABLES = ['employees — 50 rows', 'departments — 10 rows', 'orders — 200 rows', 'sales_performance — 40 rows'];

export default function PluginPage() {
  const [tab, setTab]                 = useState('demo');
  const [question, setQuestion]       = useState('');
  const [connStr, setConnStr]         = useState('');
  const [loading, setLoading]         = useState(false);
  const [result, setResult]           = useState(null);
  const [connectResult, setConnectResult] = useState(null);
  const [error, setError]             = useState('');
  const [copied, setCopied]           = useState('');
  const inputRef = useRef();

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  async function runQuery(q) {
    if (!q?.trim()) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const resp = await fetch(`${API}/plugin/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, tables: {} }),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      setError(e.message || 'Query failed');
    } finally {
      setLoading(false);
    }
  }

  async function testConnect() {
    if (!connStr.trim()) return;
    setLoading(true); setError(''); setConnectResult(null);
    try {
      const resp = await fetch(`${API}/plugin/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_string: connStr, session_id: 'web-' + Date.now() }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) throw new Error(data.detail || data.error || 'Connection failed');
      setConnectResult(data);
    } catch (e) {
      setError(e.message || 'Connection failed');
    } finally {
      setLoading(false);
    }
  }

  const cols = result?.preview?.[0] ? Object.keys(result.preview[0]) : [];

  return (
    <div className="plugin-page">

      {/* ── Hero ── */}
      <div className="plugin-hero">
        <div className="plugin-hero-text">
          <div className="plugin-eyebrow">
            <span className="plugin-eyebrow-dot" />
            Open Claude Plugin · Live
          </div>
          <h1 className="plugin-hero-title">DB Assistant Plugin</h1>
          <p className="plugin-hero-sub">
            Query any database with natural language — no SQL required
          </p>
        </div>

        <div className="plugin-hero-stats">
          <div className="plugin-stat">
            <div className="plugin-stat-val">4</div>
            <div className="plugin-stat-label">Demo tables</div>
          </div>
          <div className="plugin-stat-div" />
          <div className="plugin-stat">
            <div className="plugin-stat-val green">
              <CheckCircle size={13} /> Live
            </div>
            <div className="plugin-stat-label">API status</div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="plugin-tabs">
        <button className={`plugin-tab ${tab === 'demo'    ? 'active' : ''}`} onClick={() => { setTab('demo');    setError(''); setResult(null); }}>
          <Zap size={14} /> Demo Database
        </button>
        <button className={`plugin-tab ${tab === 'connect' ? 'active' : ''}`} onClick={() => { setTab('connect'); setError(''); setConnectResult(null); }}>
          <Plug size={14} /> Connect Your DB
        </button>
        <button className={`plugin-tab ${tab === 'cli'     ? 'active' : ''}`} onClick={() => { setTab('cli');     setError(''); }}>
          <Terminal size={14} /> Claude Code CLI
        </button>
      </div>

      {/* ══ Demo Tab ══ */}
      {tab === 'demo' && (
        <div className="fade-up">
          <div className="plugin-card">
            <div className="plugin-section-label">Sample questions — click to try</div>
            <div className="plugin-chips">
              {DEMO_QUESTIONS.map(q => (
                <div key={q} className="plugin-chip" onClick={() => { setQuestion(q); inputRef.current?.focus(); }}>
                  {q}
                </div>
              ))}
            </div>

            <div className="plugin-input-box">
              <div className="plugin-input-bar">
                <Database size={12} />
                <span className="plugin-input-bar-label">
                  Demo DB · employees · departments · orders · sales_performance
                </span>
              </div>
              <div className="plugin-input-row">
                <span className="plugin-prompt">›</span>
                <input
                  ref={inputRef}
                  className="plugin-input"
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && runQuery(question)}
                  placeholder="Ask anything about the data…"
                />
                <button
                  className="plugin-run-btn"
                  onClick={() => runQuery(question)}
                  disabled={loading || !question.trim()}
                >
                  {loading
                    ? <><span className="plugin-spinner" /> Running…</>
                    : <>Run <ArrowUpRight size={13} /></>
                  }
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="plugin-error fade-up">
              <span>✕</span> {error}
            </div>
          )}

          {loading && !result && (
            <div className="plugin-loading">
              <span className="plugin-spinner" style={{ borderTopColor: '#6366f1' }} />
              Generating SQL and fetching results…
            </div>
          )}

          {result && (
            <div className="fade-up">
              <div className="plugin-stats-row">
                <div className="plugin-stat-card">
                  <div className="plugin-stat-card-val">{result.row_count}</div>
                  <div className="plugin-stat-card-label">Rows returned</div>
                </div>
                <div className="plugin-stat-card">
                  <div className="plugin-stat-card-val">{cols.length}</div>
                  <div className="plugin-stat-card-label">Columns</div>
                </div>
                <div className="plugin-stat-card">
                  <div className="plugin-stat-card-val" style={{ fontSize: '1rem', fontFamily: "'DM Sans',sans-serif", fontWeight: 600, color: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                    <CheckCircle size={15} /> Success
                  </div>
                  <div className="plugin-stat-card-label">Status</div>
                </div>
              </div>

              {result.sql && (
                <div className="plugin-sql-card">
                  <div className="plugin-sql-header">
                    <span className="plugin-sql-label">Generated SQL</span>
                    <button className={`plugin-copy-btn ${copied === 'sql' ? 'copied' : ''}`} onClick={() => copy(result.sql, 'sql')}>
                      {copied === 'sql' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                    </button>
                  </div>
                  <pre className="plugin-sql">{result.sql}</pre>
                </div>
              )}

              {result.preview?.length > 0 && (
                <div className="plugin-table-card">
                  <div className="plugin-table-header">
                    <span className="plugin-section-label" style={{ margin: 0 }}>
                      Results — first {result.preview.length} rows
                    </span>
                  </div>
                  <div className="plugin-table-wrap">
                    <table className="plugin-table">
                      <thead>
                        <tr>{cols.map(c => <th key={c}>{c}</th>)}</tr>
                      </thead>
                      <tbody>
                        {result.preview.map((row, i) => (
                          <tr key={i}>
                            {cols.map(c => <td key={c}>{String(row[c] ?? '')}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {result.result_url && (
                <div className="plugin-url-banner">
                  <div>
                    <div className="plugin-url-label">Full Results Page</div>
                    <div className="plugin-url-text">{result.result_url}</div>
                  </div>
                  <a href={result.result_url} target="_blank" rel="noreferrer" className="plugin-url-open">
                    Open <ArrowUpRight size={13} />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ Connect Tab ══ */}
      {tab === 'connect' && (
        <div className="fade-up">
          <div className="plugin-card">
            <div className="plugin-section-label">Common connection formats — click to fill</div>
            <div className="plugin-conn-examples">
              {SAMPLE_CONNECTIONS.map(s => (
                <div key={s.label} className="plugin-conn-example" onClick={() => setConnStr(s.value)}>
                  <span className="plugin-conn-example-label">{s.label}</span>
                  <span className="plugin-conn-example-val">{s.value}</span>
                </div>
              ))}
            </div>

            <div className="plugin-section-label" style={{ marginTop: 16 }}>Your connection string</div>
            <textarea
              className="plugin-textarea"
              rows={2}
              value={connStr}
              onChange={e => setConnStr(e.target.value)}
              placeholder="postgresql://username:password@host:5432/database"
            />

            <button
              className="plugin-connect-btn"
              onClick={testConnect}
              disabled={loading || !connStr.trim()}
            >
              {loading
                ? <><span className="plugin-spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /> Testing connection…</>
                : <><Plug size={15} /> Test &amp; Connect</>
              }
            </button>
          </div>

          {error && (
            <div className="plugin-error fade-up"><span>✕</span> {error}</div>
          )}

          {connectResult && (
            <div className="plugin-success fade-up">
              <div className="plugin-success-title">
                <CheckCircle size={16} /> Connected successfully
              </div>
              <div className="plugin-section-label" style={{ margin: '10px 0 8px' }}>Tables found</div>
              <div className="plugin-tables-found">
                {connectResult.tables_found?.map(t => (
                  <span key={t} className="plugin-table-tag">{t}</span>
                ))}
              </div>
              <div className="plugin-success-sub">
                Switch to the <strong>Demo DB</strong> tab and enter your question — it will query your connected database when you pass a connection string.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ CLI Tab ══ */}
      {tab === 'cli' && (
        <div className="fade-up">
          <div className="plugin-card">
            <div className="plugin-section-label">Setup — run these three commands</div>
            {CLI_STEPS.map((s, i) => (
              <div key={i} className="plugin-cli-step">
                <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginBottom: 6 }}>
                  {i + 1}. {s.comment}
                </div>
                <div className="plugin-code-block">
                  <span className="plugin-code-text">{s.cmd}</span>
                  <button
                    className={`plugin-code-copy ${copied === `cli-${i}` ? 'copied' : ''}`}
                    onClick={() => copy(s.cmd, `cli-${i}`)}
                  >
                    {copied === `cli-${i}` ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="plugin-card">
            <div className="plugin-section-label">Available slash commands</div>
            <div className="plugin-commands">
              {CLI_COMMANDS.map((c, i) => (
                <div key={i} className="plugin-command-row">
                  <div className="plugin-command-main">
                    <code className="plugin-command-code">{c.cmd}</code>
                    <span className="plugin-command-desc">{c.desc}</span>
                  </div>
                  <button
                    className={`plugin-code-copy ${copied === `cmd-${i}` ? 'copied' : ''}`}
                    onClick={() => copy(c.cmd, `cmd-${i}`)}
                  >
                    {copied === `cmd-${i}` ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="plugin-card">
            <div className="plugin-section-label">Demo database tables</div>
            <div className="plugin-demo-tables">
              {DEMO_TABLES.map(t => <span key={t} className="plugin-demo-table-tag">{t}</span>)}
            </div>
            <p style={{ fontSize: '0.78rem', color: '#71717a', marginTop: 10, marginBottom: 0 }}>
              Pre-loaded Neon PostgreSQL — no setup needed to start querying.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
