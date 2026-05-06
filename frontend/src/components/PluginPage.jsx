import React, { useState, useRef, useEffect } from 'react';
import { Zap, Plug, Terminal, CheckCircle, Copy, Check, ArrowUpRight, Search } from 'lucide-react';
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
  { label: 'Neon',     value: 'postgresql://user:pass@host.neon.tech/db?sslmode=require' },
  { label: 'Supabase', value: 'postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres' },
  { label: 'Local PG', value: 'postgresql://postgres:password@localhost:5432/mydb' },
];

const CLI_STEPS = [
  { n: 1, title: 'Install Claude Code CLI',    cmd: 'npm install -g @anthropic-ai/claude-code' },
  { n: 2, title: 'Clone the plugin repo',      cmd: 'git clone https://github.com/rutuja-patil24/database-assistant' },
  { n: 3, title: 'Start with plugin loaded',   cmd: 'claude --plugin-dir ./database-assistant/db-assistant-plugin' },
];

const CLI_COMMANDS = [
  { cmd: '/db-assistant:query How many employees per department?', desc: 'Query the demo database' },
  { cmd: '/db-assistant:connect postgresql://user:pass@host/db',   desc: 'Connect your own database' },
  { cmd: '/db-assistant:benchmark',                                desc: 'Show benchmark results' },
];

const TABS = [
  { id: 'demo',    label: 'Demo Database',   Icon: Zap },
  { id: 'connect', label: 'Connect Your DB', Icon: Plug },
  { id: 'cli',     label: 'Claude Code CLI', Icon: Terminal },
];

export default function PluginPage() {
  const [tab, setTab]           = useState('demo');
  const [question, setQuestion] = useState('');
  const [connStr, setConnStr]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [connResult, setConn]   = useState(null);
  const [error, setError]       = useState('');
  const [copied, setCopied]     = useState('');
  const inputRef = useRef();

  useEffect(() => { if (tab === 'demo') inputRef.current?.focus(); }, [tab]);

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  async function runQuery(q) {
    const q2 = (q || '').trim();
    if (!q2) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await fetch(`${API}/plugin/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q2, tables: {} }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      setError(e.message || 'Query failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function testConnect() {
    if (!connStr.trim()) return;
    setLoading(true); setError(''); setConn(null);
    try {
      const res = await fetch(`${API}/plugin/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_string: connStr, session_id: 'web-' + Date.now() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.detail || data.error || 'Connection failed');
      setConn(data);
    } catch (e) {
      setError(e.message || 'Connection failed');
    } finally {
      setLoading(false);
    }
  }

  const cols = result?.preview?.[0] ? Object.keys(result.preview[0]) : [];

  return (
    <div className="plugin-page">

      {/* ── Hero — matches DashboardPage pattern ── */}
      <div className="plugin-hero">
        <div className="plugin-hero-bg" />
        <div className="plugin-hero-glow" />
        <div className="plugin-hero-body">
          <div className="plugin-hero-eyebrow">
            <span className="plugin-hero-dot" />
            Open Claude Plugin · Live
          </div>
          <h1 className="plugin-hero-title">DB Assistant Plugin</h1>
          <p className="plugin-hero-sub">
            Query any database with natural language — no SQL knowledge required.
          </p>
        </div>
        <div className="plugin-hero-stats">
          <div className="plugin-hstat">
            <div className="plugin-hstat-val plugin-hstat-live">
              <CheckCircle size={13} /> Live
            </div>
            <div className="plugin-hstat-key">API status</div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="plugin-tabs">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`plugin-tab ${tab === id ? 'active' : ''}`}
            onClick={() => { setTab(id); setError(''); setResult(null); setConn(null); }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ══ DEMO TAB ══ */}
      {tab === 'demo' && (
        <div className="plugin-panel fade-in">

          <div className="plugin-card">
            <div className="plugin-card-label">Sample questions — click to run</div>
            <div className="plugin-chips">
              {DEMO_QUESTIONS.map(q => (
                <button key={q} className="plugin-chip" disabled={loading}
                  onClick={() => { setQuestion(q); runQuery(q); }}>
                  {q}
                </button>
              ))}
            </div>

            <div className="plugin-input-box">
              <Search size={15} className="plugin-input-icon" />
              <input
                ref={inputRef}
                className="plugin-input"
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !loading && runQuery(question)}
                placeholder="Ask anything about employees, departments, orders, sales…"
                disabled={loading}
              />
              <button
                className="plugin-run-btn"
                onClick={() => runQuery(question)}
                disabled={loading || !question.trim()}
              >
                {loading ? <><span className="plugin-spinner" /> Running…</> : 'Run query'}
              </button>
            </div>
            <div className="plugin-input-hint">
              Demo DB · employees · departments · orders · sales_performance
            </div>
          </div>

          {error && (
            <div className="plugin-error fade-in">{error}</div>
          )}

          {result && !loading && (
            <div className="fade-in">
              {/* Stats */}
              <div className="plugin-result-stats">
                <div className="plugin-rstat">
                  <div className="plugin-rstat-val">{result.row_count}</div>
                  <div className="plugin-rstat-key">Rows returned</div>
                </div>
                <div className="plugin-rstat-sep" />
                <div className="plugin-rstat">
                  <div className="plugin-rstat-val">{cols.length}</div>
                  <div className="plugin-rstat-key">Columns</div>
                </div>
                <div className="plugin-rstat-sep" />
                <div className="plugin-rstat">
                  <div className="plugin-rstat-val plugin-rstat-ok">
                    <CheckCircle size={13} /> Success
                  </div>
                  <div className="plugin-rstat-key">Query status</div>
                </div>
              </div>

              {/* SQL */}
              {result.sql && (
                <div className="plugin-card plugin-sql-wrap">
                  <div className="plugin-sql-bar">
                    <span className="plugin-card-label" style={{ margin: 0 }}>Generated SQL</span>
                    <button
                      className={`plugin-copy-btn ${copied === 'sql' ? 'ok' : ''}`}
                      onClick={() => copy(result.sql, 'sql')}
                    >
                      {copied === 'sql' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy SQL</>}
                    </button>
                  </div>
                  <pre className="plugin-sql">{result.sql}</pre>
                </div>
              )}

              {/* Table */}
              {result.preview?.length > 0 && (
                <div className="plugin-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div className="plugin-table-bar">
                    <span className="plugin-card-label" style={{ margin: 0 }}>
                      Results — {result.preview.length} of {result.row_count} rows
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

              {/* Full results CTA */}
              {result.result_url && (
                <a href={result.result_url} target="_blank" rel="noreferrer" className="plugin-cta">
                  <div>
                    <div className="plugin-cta-title">View Full Results Page</div>
                    <div className="plugin-cta-url">{result.result_url}</div>
                  </div>
                  <span className="plugin-cta-icon"><ArrowUpRight size={16} /></span>
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ CONNECT TAB ══ */}
      {tab === 'connect' && (
        <div className="plugin-panel fade-in">
          <div className="plugin-card">
            <div className="plugin-card-label">Common formats — click to fill</div>
            <div className="plugin-examples">
              {SAMPLE_CONNECTIONS.map(s => (
                <button key={s.label} className="plugin-example" onClick={() => setConnStr(s.value)}>
                  <span className="plugin-example-label">{s.label}</span>
                  <span className="plugin-example-val">{s.value}</span>
                </button>
              ))}
            </div>

            <label className="plugin-field-label">Connection string</label>
            <textarea
              className="plugin-textarea"
              rows={2}
              value={connStr}
              onChange={e => setConnStr(e.target.value)}
              placeholder="postgresql://username:password@host:5432/database"
            />

            <button className="plugin-primary-btn" onClick={testConnect}
              disabled={loading || !connStr.trim()}>
              {loading
                ? <><span className="plugin-spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.3)' }} /> Testing…</>
                : <><Plug size={15} /> Test &amp; Connect</>}
            </button>
          </div>

          {error && <div className="plugin-error fade-in">{error}</div>}

          {connResult && (
            <div className="plugin-success fade-in">
              <div className="plugin-success-title">
                <CheckCircle size={16} /> Connected — {connResult.tables_found?.length} tables found
              </div>
              <div className="plugin-table-tags">
                {connResult.tables_found?.map(t => (
                  <span key={t} className="plugin-table-tag">{t}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ CLI TAB ══ */}
      {tab === 'cli' && (
        <div className="plugin-panel fade-in">
          <div className="plugin-card">
            <div className="plugin-card-label">Setup — 3 steps</div>
            {CLI_STEPS.map((s, i) => (
              <div key={i} className="plugin-step">
                <div className="plugin-step-hdr">
                  <span className="plugin-step-num">{s.n}</span>
                  <span className="plugin-step-title">{s.title}</span>
                </div>
                <div className="plugin-code-block">
                  <code className="plugin-code-text">{s.cmd}</code>
                  <button
                    className={`plugin-code-copy ${copied === `step-${i}` ? 'ok' : ''}`}
                    onClick={() => copy(s.cmd, `step-${i}`)}
                  >
                    {copied === `step-${i}` ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="plugin-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px 0' }}>
              <div className="plugin-card-label">Available commands</div>
            </div>
            {CLI_COMMANDS.map((c, i) => (
              <div key={i} className="plugin-command">
                <div className="plugin-command-body">
                  <code className="plugin-command-code">{c.cmd}</code>
                  <span className="plugin-command-desc">{c.desc}</span>
                </div>
                <button
                  className={`plugin-code-copy ${copied === `cmd-${i}` ? 'ok' : ''}`}
                  onClick={() => copy(c.cmd, `cmd-${i}`)}
                >
                  {copied === `cmd-${i}` ? '✓' : 'Copy'}
                </button>
              </div>
            ))}
          </div>

          <div className="plugin-card">
            <div className="plugin-card-label">Demo database</div>
            <div className="plugin-demo-tags">
              {['employees — 50 rows', 'departments — 10 rows', 'orders — 200 rows', 'sales_performance — 40 rows'].map(t => (
                <span key={t} className="plugin-demo-tag">{t}</span>
              ))}
            </div>
            <p className="plugin-note">Pre-loaded Neon PostgreSQL — no setup needed.</p>
          </div>
        </div>
      )}
    </div>
  );
}
