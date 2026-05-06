import React, { useState, useRef, useEffect } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const DEMO_QUESTIONS = [
  "How many employees are in each department?",
  "What is the average salary by department?",
  "Show me top 5 orders by revenue",
  "Which department has the highest budget?",
  "List all employees in Engineering",
];

const SAMPLE_CONNECTIONS = [
  { label: "Neon PostgreSQL", value: "postgresql://user:pass@host.neon.tech/db?sslmode=require" },
  { label: "Local PostgreSQL", value: "postgresql://postgres:password@localhost:5432/mydb" },
  { label: "Supabase", value: "postgresql://postgres:password@db.xxx.supabase.co:5432/postgres" },
];

export default function PluginPage() {
  const [tab, setTab] = useState('demo'); // demo | connect | cli
  const [question, setQuestion] = useState('');
  const [connStr, setConnStr] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [connectResult, setConnectResult] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const inputRef = useRef();

  useEffect(() => { inputRef.current?.focus(); }, [tab]);

  async function runQuery(q, conn) {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const body = { question: q };
      if (conn) body.connection_string = conn;
      const resp = await fetch(`${API}/plugin/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
    setLoading(true);
    setError('');
    setConnectResult(null);
    try {
      const resp = await fetch(`${API}/plugin/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_string: connStr, session_id: 'web' }),
      });
      const data = await resp.json();
      setConnectResult(data);
    } catch (e) {
      setError(e.message || 'Connection failed');
    } finally {
      setLoading(false);
    }
  }

  function copy(text, key) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  }

  const cols = result?.preview?.[0] ? Object.keys(result.preview[0]) : [];

  return (
    <div style={{
      margin: '-32px',
      minHeight: 'calc(100vh - 62px)',
      background: '#080c18',
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      padding: '32px 24px', color: '#e2e8f0',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e2d45; border-radius: 2px; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .fade-up { animation: fadeUp 0.4s ease forwards; }
        .tab-btn { transition: all 0.2s; cursor: pointer; border: none; outline: none; }
        .tab-btn:hover { opacity: 0.8; }
        .demo-q { transition: all 0.15s; cursor: pointer; }
        .demo-q:hover { background: rgba(99,102,241,0.15) !important; border-color: rgba(99,102,241,0.4) !important; }
        .result-row:hover td { background: rgba(99,102,241,0.06); }
        input:focus { outline: none; }
        textarea:focus { outline: none; }
        .glow { box-shadow: 0 0 20px rgba(99,102,241,0.2); }
      `}</style>

      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 32, animation: 'fadeUp 0.5s ease' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)',
            borderRadius: 6, padding: '5px 12px', marginBottom: 16,
            fontSize: 10, fontWeight: 700, color: '#818cf8',
            textTransform: 'uppercase', letterSpacing: '0.12em',
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%', background: '#818cf8',
              animation: 'pulse 2s infinite',
            }}/>
            Open Claude Plugin · Live
          </div>

          <h1 style={{
            fontSize: 32, fontWeight: 800, margin: '0 0 8px',
            background: 'linear-gradient(135deg, #f1f5f9 30%, #818cf8)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            lineHeight: 1.2,
          }}>
            DB Assistant Plugin
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            Query any database using natural language — no SQL knowledge required
          </p>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 4, marginBottom: 24,
          background: '#0f1520', border: '1px solid #1e2d45',
          borderRadius: 10, padding: 4,
        }}>
          {[
            { id: 'demo', label: '⚡ Demo DB', desc: 'Try instantly' },
            { id: 'connect', label: '🔌 Connect DB', desc: 'Your database' },
            { id: 'cli', label: '💻 Claude Code', desc: 'CLI integration' },
          ].map(t => (
            <button key={t.id} className="tab-btn" onClick={() => setTab(t.id)} style={{
              flex: 1, padding: '10px 16px', borderRadius: 7,
              background: tab === t.id ? '#1e2d45' : 'transparent',
              color: tab === t.id ? '#f1f5f9' : '#64748b',
              fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
              borderTop: tab === t.id ? '2px solid #818cf8' : '2px solid transparent',
            }}>
              {t.label}
              <div style={{ fontSize: 9, color: tab === t.id ? '#818cf8' : '#334155', marginTop: 2 }}>
                {t.desc}
              </div>
            </button>
          ))}
        </div>

        {/* Demo Tab */}
        {tab === 'demo' && (
          <div className="fade-up">
            {/* Sample questions */}
            <div style={{ marginBottom: 20 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: '#334155',
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10,
              }}>
                Sample questions — click to try
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {DEMO_QUESTIONS.map(q => (
                  <div key={q} className="demo-q" onClick={() => setQuestion(q)} style={{
                    fontSize: 11, padding: '6px 12px', borderRadius: 6,
                    background: 'rgba(30,45,69,0.5)',
                    border: '1px solid #1e2d45',
                    color: '#94a3b8', cursor: 'pointer',
                  }}>
                    {q}
                  </div>
                ))}
              </div>
            </div>

            {/* Query input */}
            <div style={{
              background: '#0f1520', border: '1px solid #1e2d45',
              borderRadius: 12, overflow: 'hidden', marginBottom: 16,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '6px 12px',
                borderBottom: '1px solid #1e2d45',
                background: '#080c18',
              }}>
                <div style={{
                  fontSize: 10, color: '#334155', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>
                  Demo DB · employees · departments · orders · sales_performance
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                <span style={{ padding: '14px 16px', color: '#4f46e5', fontSize: 14 }}>›</span>
                <input
                  ref={inputRef}
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && question.trim() && runQuery(question)}
                  placeholder="Ask a question about the data..."
                  style={{
                    flex: 1, background: 'transparent', border: 'none',
                    color: '#e2e8f0', fontSize: 13, padding: '14px 0',
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  onClick={() => question.trim() && runQuery(question)}
                  disabled={loading || !question.trim()}
                  style={{
                    margin: 8, padding: '8px 20px', borderRadius: 6,
                    background: loading || !question.trim() ? '#1e2d45' : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                    border: 'none', color: '#fff', fontSize: 12, fontWeight: 700,
                    cursor: loading || !question.trim() ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {loading ? (
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTop: '2px solid #fff',
                      animation: 'spin 0.7s linear infinite',
                      margin: '0 8px',
                    }}/>
                  ) : 'Run ↵'}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8, padding: '12px 16px', marginBottom: 16,
                fontSize: 12, color: '#fca5a5',
              }}>
                ✗ {error}
              </div>
            )}

            {result && (
              <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                  {[
                    { label: 'Rows', value: result.row_count },
                    { label: 'Source', value: result.source === 'demo_db' ? 'Demo DB' : 'Custom DB' },
                    { label: 'Status', value: '✓ Success' },
                  ].map(s => (
                    <div key={s.label} style={{
                      background: '#0f1520', border: '1px solid #1e2d45',
                      borderRadius: 8, padding: '12px 14px',
                    }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#818cf8' }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: '#334155', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* SQL */}
                {result.sql && (
                  <div style={{
                    background: '#0f1520', border: '1px solid #1e2d45', borderRadius: 10,
                  }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 14px', borderBottom: '1px solid #1e2d45',
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Generated SQL
                      </div>
                      <button onClick={() => copy(result.sql, 'sql')} style={{
                        fontSize: 10, color: copied === 'sql' ? '#10b981' : '#4f46e5',
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}>
                        {copied === 'sql' ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                    <pre style={{
                      margin: 0, padding: '14px 16px', fontSize: 12,
                      color: '#93c5fd', lineHeight: 1.7, overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {result.sql}
                    </pre>
                  </div>
                )}

                {/* Results table */}
                {result.preview?.length > 0 && (
                  <div style={{
                    background: '#0f1520', border: '1px solid #1e2d45', borderRadius: 10,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      padding: '10px 14px', borderBottom: '1px solid #1e2d45',
                      fontSize: 10, fontWeight: 700, color: '#334155',
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                    }}>
                      Results Preview (first {result.preview.length} rows)
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: '#1a2234' }}>
                            {cols.map(c => (
                              <th key={c} style={{
                                padding: '10px 14px', textAlign: 'left',
                                fontSize: 10, fontWeight: 700, color: '#4f46e5',
                                textTransform: 'uppercase', letterSpacing: '0.06em',
                                borderBottom: '1px solid #1e2d45',
                              }}>
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {result.preview.map((row, i) => (
                            <tr key={i} className="result-row">
                              {cols.map(c => (
                                <td key={c} style={{
                                  padding: '9px 14px', color: '#94a3b8',
                                  borderBottom: '1px solid #1e2d4530',
                                }}>
                                  {String(row[c] ?? '')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Result URL */}
                {result.result_url && (
                  <div style={{
                    background: 'rgba(99,102,241,0.08)',
                    border: '1px solid rgba(99,102,241,0.25)',
                    borderRadius: 10, padding: '14px 18px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', marginBottom: 4 }}>
                        👉 Full Results Page
                      </div>
                      <div style={{ fontSize: 11, color: '#475569' }}>
                        {result.result_url}
                      </div>
                    </div>
                    <a href={result.result_url} target="_blank" rel="noreferrer" style={{
                      padding: '8px 16px', borderRadius: 6, textDecoration: 'none',
                      background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                      color: '#fff', fontSize: 11, fontWeight: 700,
                      flexShrink: 0, marginLeft: 12,
                    }}>
                      Open →
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Connect Tab */}
        {tab === 'connect' && (
          <div className="fade-up">
            <div style={{
              background: '#0f1520', border: '1px solid #1e2d45',
              borderRadius: 12, padding: '20px', marginBottom: 16,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#818cf8', marginBottom: 4 }}>
                Connect Your PostgreSQL Database
              </div>
              <div style={{ fontSize: 11, color: '#475569', marginBottom: 16 }}>
                Enter your connection string to query your own data
              </div>

              {/* Format examples */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: '#334155', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Common formats
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {SAMPLE_CONNECTIONS.map(s => (
                    <div key={s.label} onClick={() => setConnStr(s.value)} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px', borderRadius: 6,
                      background: '#080c18', border: '1px solid #1e2d45',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#4f46e5'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = '#1e2d45'}
                    >
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#4f46e5', width: 100, flexShrink: 0 }}>{s.label}</span>
                      <span style={{ fontSize: 10, color: '#334155', fontFamily: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <textarea
                value={connStr}
                onChange={e => setConnStr(e.target.value)}
                placeholder="postgresql://username:password@host:5432/database"
                rows={2}
                style={{
                  width: '100%', background: '#080c18', border: '1px solid #1e2d45',
                  borderRadius: 8, padding: '12px 14px', color: '#e2e8f0',
                  fontSize: 12, fontFamily: 'inherit', resize: 'none',
                  marginBottom: 12,
                }}
              />

              <button onClick={testConnect} disabled={loading || !connStr.trim()} style={{
                width: '100%', padding: '12px', borderRadius: 8, border: 'none',
                background: loading || !connStr.trim() ? '#1e2d45' : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                color: '#fff', fontSize: 13, fontWeight: 700, cursor: loading || !connStr.trim() ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}>
                {loading ? 'Testing Connection...' : '🔌 Test & Connect'}
              </button>
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8, padding: '12px 16px', marginBottom: 16,
                fontSize: 12, color: '#fca5a5',
              }}>
                ✗ {error}
              </div>
            )}

            {connectResult && (
              <div className="fade-up" style={{
                background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
                borderRadius: 10, padding: '16px 18px',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#10b981', marginBottom: 10 }}>
                  ✓ Connected successfully
                </div>
                <div style={{ fontSize: 11, color: '#475569', marginBottom: 10 }}>
                  Tables found:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {connectResult.tables_found?.map(t => (
                    <div key={t} style={{
                      fontSize: 11, padding: '4px 10px', borderRadius: 4,
                      background: 'rgba(16,185,129,0.1)',
                      border: '1px solid rgba(16,185,129,0.2)',
                      color: '#10b981',
                    }}>
                      {t}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: '#475569' }}>
                  Now go to the <strong style={{ color: '#818cf8' }}>Demo DB</strong> tab and ask a question — it will use your connected database.
                </div>
              </div>
            )}
          </div>
        )}

        {/* CLI Tab */}
        {tab === 'cli' && (
          <div className="fade-up">
            <div style={{
              background: '#0f1520', border: '1px solid #1e2d45',
              borderRadius: 12, overflow: 'hidden', marginBottom: 16,
            }}>
              <div style={{
                padding: '12px 16px', borderBottom: '1px solid #1e2d45',
                background: '#080c18', fontSize: 11, color: '#475569',
              }}>
                terminal
              </div>
              {[
                { comment: '# Step 1 — Install Claude Code', cmd: 'npm install -g @anthropic-ai/claude-code' },
                { comment: '# Step 2 — Clone the plugin', cmd: 'git clone https://github.com/rutuja-patil24/database-assistant' },
                { comment: '# Step 3 — Start with plugin loaded', cmd: 'claude --plugin-dir ./database-assistant/db-assistant-plugin' },
              ].map((s, i) => (
                <div key={i} style={{ padding: '12px 16px', borderBottom: '1px solid #1e2d4530' }}>
                  <div style={{ fontSize: 11, color: '#334155', marginBottom: 4 }}>{s.comment}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <code style={{ fontSize: 12, color: '#93c5fd' }}>{s.cmd}</code>
                    <button onClick={() => copy(s.cmd, `cli-${i}`)} style={{
                      fontSize: 10, color: copied === `cli-${i}` ? '#10b981' : '#4f46e5',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: 'inherit', flexShrink: 0, marginLeft: 12,
                    }}>
                      {copied === `cli-${i}` ? '✓' : 'Copy'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              background: '#0f1520', border: '1px solid #1e2d45',
              borderRadius: 12, overflow: 'hidden',
            }}>
              <div style={{
                padding: '12px 16px', borderBottom: '1px solid #1e2d45',
                background: '#080c18', fontSize: 11, color: '#475569',
              }}>
                claude code — available commands
              </div>
              {[
                { cmd: '/db-assistant:query How many employees per department?', desc: 'Query demo database' },
                { cmd: '/db-assistant:connect postgresql://user:pass@host/db', desc: 'Connect your own DB' },
                { cmd: '/db-assistant:benchmark', desc: 'Show KDD Cup 2026: 82% accuracy' },
              ].map((s, i) => (
                <div key={i} style={{
                  padding: '12px 16px', borderBottom: '1px solid #1e2d4530',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                }}>
                  <div>
                    <code style={{ fontSize: 11, color: '#818cf8', display: 'block', marginBottom: 3 }}>{s.cmd}</code>
                    <div style={{ fontSize: 10, color: '#334155' }}>{s.desc}</div>
                  </div>
                  <button onClick={() => copy(s.cmd, `cmd-${i}`)} style={{
                    fontSize: 10, color: copied === `cmd-${i}` ? '#10b981' : '#4f46e5',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'inherit', flexShrink: 0,
                  }}>
                    {copied === `cmd-${i}` ? '✓' : 'Copy'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: 32, paddingTop: 20, borderTop: '1px solid #1e2d45',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: 11, color: '#334155',
        }}>
          <div>SJSU CMPE 295B · KDD Cup 2026 · <span style={{ color: '#818cf8' }}>82% accuracy</span></div>
          <div style={{ display: 'flex', gap: 16 }}>
            <a href="/benchmark" style={{ color: '#4f46e5', textDecoration: 'none' }}>Benchmark</a>
            <a href="https://db-assistant-backend-105401535311.us-central1.run.app/docs" target="_blank" rel="noreferrer" style={{ color: '#4f46e5', textDecoration: 'none' }}>API Docs</a>
            <a href="https://github.com/rutuja-patil24/database-assistant" target="_blank" rel="noreferrer" style={{ color: '#4f46e5', textDecoration: 'none' }}>GitHub</a>
          </div>
        </div>
      </div>
    </div>
  );
}