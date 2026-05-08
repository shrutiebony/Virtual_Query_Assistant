import React, { useState, useEffect, useRef } from 'react';
import { authAPI } from '../services/api';
import { mysqlAPI } from '../services/mysqlApi';
import { Alert, Badge } from '../components/ui';
import ResultsPanel from '../components/ui/ResultsPanel';
import { Database, Send, Sparkles, CheckSquare, Square, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import './ChatQueryPage.css';

const SAMPLES = [
  'Show all customers',
  'Show total orders by region',
  'Top 5 customers by total spend',
  'Show all confirmed orders',
  'Count orders by status',
  'Show orders joined with customer names',
  'Average order amount by region',
  'Show customers from North America',
];

export default function MySQLPage() {
  const [connections, setConnections] = useState([]);
  const [selectedConn, setSelectedConn] = useState('');
  const [tables, setTables]       = useState([]);
  const [selTables, setSelTables] = useState([]);
  const [showTables, setShowTables] = useState(true);
  const [input, setInput]         = useState('');
  const [history, setHistory]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const chatEndRef  = useRef(null);
  const textareaRef = useRef(null);

  // Load MySQL connections on mount
  useEffect(() => {
    authAPI.connections()
      .then(r => {
        const mysql = (r.data || []).filter(c => c.db_type === 'mysql');
        setConnections(mysql);
        if (mysql.length) setSelectedConn(String(mysql[0].id));
      }).catch(() => {});
  }, []);

  const conn = connections.find(c => String(c.id) === String(selectedConn));

  // Load tables when connection changes
  useEffect(() => {
    if (!conn) return;
    setTables([]); setSelTables([]);

    // Get decrypted password via get-uri endpoint
    // then use conn fields for host/port/database/username
    authAPI.getUri(conn.id).then(r => {
      const uri = r.data?.uri || '';
      // Extract password from postgresql URI that backend builds
      // URI format: postgresql://username:password@host:port/dbname
      let password = '';
      try {
        const url = new URL(uri.replace('postgresql://', 'http://'));
        password = decodeURIComponent(url.password);
      } catch {
        password = uri;
      }

      mysqlAPI.listTables({
        host:     conn.host,
        port:     conn.port,
        database: conn.dbname,
        username: conn.db_username,
        password: password,
      }).then(r2 => {
        const tbls = r2.data?.tables || [];
        setTables(tbls);
        setSelTables(tbls);
      }).catch(e => {
        setError(e.response?.data?.detail || 'Failed to load tables');
      });
    }).catch(() => {});
  }, [selectedConn]);

  const toggleTable = t =>
    setSelTables(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);

  const toggleAll = () =>
    setSelTables(selTables.length === tables.length ? [] : [...tables]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, loading]);

  // Extract password from the URI the backend returns for MySQL connections
  const extractPassword = (uri) => {
    try {
      const url = new URL(uri.replace(/^[a-z]+:\/\//, 'http://'));
      return decodeURIComponent(url.password);
    } catch {
      return uri;
    }
  };

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    if (!conn) return setError('Select a MySQL connection first.');
    setInput(''); setError('');
    setHistory(h => [...h, { type: 'user', content: q }]);
    setLoading(true);

    try {
      let uriRes;
      try {
        uriRes = await authAPI.getUri(conn.id);
      } catch (e) {
        const msg = e.response?.data?.detail || '';
        throw new Error(msg.includes('decrypted') || msg.includes('encryption')
          ? 'Connection credentials are invalid — please delete and re-add this connection in Connections.'
          : (msg || 'Could not retrieve connection URI.'));
      }
      const password = extractPassword(uriRes.data?.uri || '');

      const connParams = {
        host:     conn.host,
        port:     conn.port,
        database: conn.dbname,
        username: conn.db_username,
        password,
      };

      // Always use nl-query-auto — it fetches full schema and handles joins via AI.
      // This ensures react_trace is always present in the response.
      const res = await mysqlAPI.nlQueryAuto({
        ...connParams,
        question: q,
        tables: selTables.length ? selTables : undefined,
        react: true,
        limit: 100,
      });

      setHistory(h => [...h, { type: 'result', question: q, content: res.data }]);
    } catch (e) {
      setHistory(h => [...h, {
        type: 'error', question: q,
        content: e.response?.data?.detail || e.message || 'Query failed.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const onKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="chat-query-page fade-in">

      {/* ── Left Panel ── */}
      <div className="cqp-left">
        <div className="cqp-section">
          <div className="cqp-section-label">Connection</div>
          {connections.length === 0 ? (
            <div className="cqp-empty-note">
              No MySQL connections saved.{' '}
              <a href="/connections" style={{ color: 'var(--accent)' }}>Add one</a>
            </div>
          ) : (
            <select
              className="cqp-select"
              value={selectedConn}
              onChange={e => setSelectedConn(e.target.value)}
            >
              {connections.map(c => (
                <option key={c.id} value={String(c.id)}>
                  {c.name || c.dbname}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Table Selector */}
        {tables.length > 0 && (
          <div className="cqp-section">
            <div
              className="cqp-section-label"
              style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
              onClick={() => setShowTables(s => !s)}
            >
              <span>Tables ({selTables.length}/{tables.length})</span>
              {showTables ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </div>
            {showTables && (
              <>
                <button className="cqp-toggle-all" onClick={toggleAll}>
                  {selTables.length === tables.length ? 'Deselect all' : 'Select all'}
                </button>
                <div className="cqp-checklist">
                  {tables.map(t => (
                    <label
                      key={t}
                      className={`cqp-check-item ${selTables.includes(t) ? 'on' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={selTables.includes(t)}
                        onChange={() => toggleTable(t)}
                      />
                      {selTables.includes(t)
                        ? <CheckSquare size={13} />
                        : <Square size={13} />}
                      <span>{t}</span>
                    </label>
                  ))}
                </div>
                {selTables.length > 1 && (
                  <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4, paddingLeft: 4 }}>
                    ⚡ {selTables.length} tables — auto JOIN enabled
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Suggestions */}
        <div className="cqp-section cqp-suggestions">
          <div className="cqp-section-label">
            <Sparkles size={11} /> Suggestions
          </div>
          {SAMPLES.map(s => (
            <button
              key={s}
              className="cqp-suggestion"
              onClick={() => { setInput(s); textareaRef.current?.focus(); }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Right Chat Panel ── */}
      <div className="cqp-right">
        <div className="cqp-chat-header">
          <Database size={15} />
          <span>MySQL Chat</span>
          {conn && (
            <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#10b981', fontWeight:600 }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:'#10b981', display:'inline-block', animation:'cqp-pulse 1.5s infinite' }} />
              Live
            </span>
          )}
          <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'#7c3aed', fontWeight:600, background:'#f5f3ff', padding:'2px 8px', borderRadius:10, border:'1px solid #ddd6fe' }}>
            <Zap size={11} /> ReAct
          </span>
          <Badge color="blue" style={{ marginLeft: 'auto' }}>
            {conn?.name || 'No connection'}
          </Badge>
        </div>

        <div className="cqp-messages">
          {history.length === 0 && !loading && (
            <div className="cqp-welcome">
              <Database size={28} />
              <div className="cqp-welcome-title">Ask your MySQL database anything</div>
              <div className="cqp-welcome-sub">
                Type a question below or pick a suggestion on the left
              </div>
            </div>
          )}

          {history.map((msg, i) => (
            <div key={i} className={`cqp-msg cqp-msg-${msg.type}`}>
              {msg.type === 'user' && (
                <div className="cqp-bubble-user">{msg.content}</div>
              )}
              {msg.type === 'result' && (
                <div className="cqp-bubble-result">
                  <ResultsPanel
                    key={`${i}-${msg.question}`}
                    result={msg.content}
                    question={msg.question}
                  />
                </div>
              )}
              {msg.type === 'error' && (
                <div className="cqp-bubble-result">
                  <Alert type="error">{msg.content}</Alert>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="cqp-msg cqp-msg-result">
              <div className="cqp-bubble-result cqp-typing">
                <div className="cqp-dot" />
                <div className="cqp-dot" />
                <div className="cqp-dot" />
                <span>Running MySQL query...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {error && (
          <div className="cqp-input-error">
            <Alert type="error" onClose={() => setError('')}>{error}</Alert>
          </div>
        )}

        <div className="cqp-input-bar">
          <textarea
            ref={textareaRef}
            className="cqp-textarea"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ask anything about your MySQL data... (Enter to send, Shift+Enter for new line)"
            rows={1}
          />
          <button
            className="cqp-send-btn"
            onClick={send}
            disabled={loading || !input.trim()}
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}