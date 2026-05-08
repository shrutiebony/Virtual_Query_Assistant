import React, { useState, useEffect, useRef } from 'react';
import { authAPI, pgAPI } from '../services/api';
import { splitQuestions } from '../utils/splitQuestions';
import { Alert, Badge, EmptyState } from '../components/ui';
import ResultsPanel from '../components/ui/ResultsPanel';
import { Database, Send, Sparkles, CheckSquare, Square, ChevronDown, ChevronUp } from 'lucide-react';
import './ChatQueryPage.css';

const SAMPLES = [
  'Show total revenue by region',
  'Top 5 customers by spend',
  'Monthly order trend',
  'Average order value by segment',
  'Orders with pending payment',
];

export default function PostgresPage() {
  const [connections, setConnections] = useState([]);
  const [selectedConn, setSelectedConn] = useState('');
  const [tables, setTables]       = useState([]);
  const [selTables, setSelTables] = useState([]);
  const [showTables, setShowTables] = useState(true);
  const [input, setInput]         = useState('');
  const [history, setHistory]     = useState([]); // [{type:'user'|'result'|'error', content, question}]
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    authAPI.connections()
      .then(r => {
        const pg = (r.data || []).filter(c => c.db_type === 'postgresql');
        setConnections(pg);
        if (pg.length) setSelectedConn(String(pg[0].id));
      }).catch(() => {});
  }, []);

  const conn = connections.find(c => String(c.id) === String(selectedConn));

  // Load tables when connection changes
  useEffect(() => {
    if (!conn) return;
    setTables([]); setSelTables([]);
    authAPI.getUri(conn.id).then(r => {
      const uri = r.data?.uri;
      if (!uri) return;
      pgAPI.listTables({ pg_uri: uri }).then(r2 => {
        const tbls = r2.data?.tables || Object.keys(r2.data?.schemas?.public || {}) || [];
        setTables(tbls);
        setSelTables(tbls);
      }).catch(() => {});
    }).catch(e => {
      const msg = e.response?.data?.detail || '';
      if (msg.includes('decrypted') || msg.includes('encryption')) {
        setError('Connection credentials are invalid — please delete and re-add this connection.');
      }
    });
  }, [selectedConn]);

  const toggleTable = t => setSelTables(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);
  const toggleAll   = () => setSelTables(selTables.length === tables.length ? [] : [...tables]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, loading]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    if (!conn) return setError('Select a connection first.');
    setInput(''); setError('');

    const questions = splitQuestions(q);
    // Add all user messages
    questions.forEach(({ display }) =>
      setHistory(h => [...h, { type: 'user', content: display }])
    );
    setLoading(true);

    try {
      const uriRes = await authAPI.getUri(conn.id);
      const pg_uri = uriRes.data?.uri;
      if (!pg_uri) throw new Error('Could not retrieve connection URI.');

      const responses = await Promise.all(
        questions.map(({ display, query }) =>
          pgAPI.nlQuery({
            pg_uri,
            question: query,
            tables: selTables.length ? selTables : undefined,
            limit: 100,
          })
          .then(r => ({ ok: true, question: display, data: r.data }))
          .catch(e => ({ ok: false, question: display, error: e.response?.data?.detail || e.message }))
        )
      );

      responses.forEach(r => {
        setHistory(h => [...h, r.ok
          ? { type: 'result', question: r.question, content: r.data }
          : { type: 'error',  question: r.question, content: typeof r.error === 'string' ? r.error : JSON.stringify(r.error) }
        ]);
      });
    } catch (err) {
      setHistory(h => [...h, { type: 'error', content: err.message || 'Query failed.' }]);
    } finally {
      setLoading(false);
    }
  };

  const onKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="chat-query-page fade-in">
      {/* ── Left panel ── */}
      <div className="cqp-left">
        <div className="cqp-section">
          <div className="cqp-section-label">Connection</div>
          {connections.length === 0 ? (
            <div className="cqp-empty-note">No PostgreSQL connections saved</div>
          ) : (
            <select className="cqp-select" value={selectedConn} onChange={e => setSelectedConn(e.target.value)}>
              {connections.map(c => <option key={c.id} value={String(c.id)}>{c.name || c.dbname}</option>)}
            </select>
          )}
        </div>

        {tables.length > 0 && (
          <div className="cqp-section">
            <div className="cqp-section-label" style={{cursor:'pointer',display:'flex',justifyContent:'space-between'}}
              onClick={() => setShowTables(s => !s)}>
              <span>Tables ({selTables.length}/{tables.length})</span>
              {showTables ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
            </div>
            {showTables && (
              <>
                <button className="cqp-toggle-all" onClick={toggleAll}>
                  {selTables.length === tables.length ? 'Deselect all' : 'Select all'}
                </button>
                <div className="cqp-checklist">
                  {tables.map(t => (
                    <label key={t} className={`cqp-check-item ${selTables.includes(t) ? 'on' : ''}`}>
                      <input type="checkbox" checked={selTables.includes(t)} onChange={() => toggleTable(t)} />
                      {selTables.includes(t) ? <CheckSquare size={13}/> : <Square size={13}/>}
                      <span>{t}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div className="cqp-section cqp-suggestions">
          <div className="cqp-section-label"><Sparkles size={11}/> Suggestions</div>
          {SAMPLES.map(s => (
            <button key={s} className="cqp-suggestion" onClick={() => { setInput(s); textareaRef.current?.focus(); }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Right chat panel ── */}
      <div className="cqp-right">
        <div className="cqp-chat-header">
          <Database size={15}/>
          <span>PostgreSQL Chat</span>
          <Badge color="blue" style={{marginLeft:'auto'}}>{conn?.name || 'No connection'}</Badge>
        </div>

        <div className="cqp-messages">
          {history.length === 0 && !loading && (
            <div className="cqp-welcome">
              <Database size={28}/>
              <div className="cqp-welcome-title">Ask your database anything</div>
              <div className="cqp-welcome-sub">Type a question below or pick a suggestion on the left</div>
            </div>
          )}

          {history.map((msg, i) => (
            <div key={i} className={`cqp-msg cqp-msg-${msg.type}`}>
              {msg.type === 'user' && (
                <div className="cqp-bubble-user">{msg.content}</div>
              )}
              {msg.type === 'result' && (
                <div className="cqp-bubble-result">
                  <ResultsPanel key={`${i}-${msg.question}`} result={msg.content} question={msg.question} />
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
                <div className="cqp-dot"/><div className="cqp-dot"/><div className="cqp-dot"/>
                <span>Running query...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef}/>
        </div>

        {error && <div className="cqp-input-error"><Alert type="error" onClose={() => setError('')}>{error}</Alert></div>}

        <div className="cqp-input-bar">
          <textarea
            ref={textareaRef}
            className="cqp-textarea"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ask anything about your data... (Enter to send, Shift+Enter for new line)"
            rows={1}
          />
          <button className="cqp-send-btn" onClick={send} disabled={loading || !input.trim()}>
            <Send size={15}/>
          </button>
        </div>
      </div>
    </div>
  );
}