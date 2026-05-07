import React, { useState, useEffect, useRef } from 'react';
import { authAPI, pgAPI } from '../services/api';
import { splitQuestions } from '../utils/splitQuestions';
import { Alert, Badge, EmptyState } from '../components/ui';
import ResultsPanel from '../components/ui/ResultsPanel';
import { Send, Sparkles, CheckSquare, Square, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import './ChatQueryPage.css';

function SupabaseIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M13.976 22.042c-.371.44-1.101.185-1.101-.393V13.5H3.75c-.76 0-1.17-.895-.688-1.47L10.024 3.458c.371-.44 1.101-.185 1.101.393V10.5h9.125c.76 0 1.17.895.688 1.47l-6.962 10.072z" fill="#3ECF8E"/>
    </svg>
  );
}

const SAMPLES = [
  'Show total revenue by region',
  'Top 5 customers by spend',
  'Monthly order trend',
  'Average order value by segment',
  'Orders with pending payment',
];

export default function SupabasePage() {
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

  // Load both supabase and postgresql connections — Supabase IS PostgreSQL
  useEffect(() => {
    authAPI.connections()
      .then(r => {
        const conns = (r.data || []).filter(c => c.db_type === 'supabase' || c.db_type === 'postgresql');
        setConnections(conns);
        if (conns.length) setSelectedConn(String(conns[0].id));
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
      pgAPI.listTables(uri).then(r2 => {
        const tbls = r2.data?.tables || Object.keys(r2.data?.schemas?.public || {});
        setTables(tbls);
        setSelTables(tbls);
      }).catch(() => {});
    }).catch(() => {});
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

        {/* Info banner */}
        <div style={{
          background: 'rgba(62,207,142,.08)', border: '1px solid rgba(62,207,142,.25)',
          borderRadius: 8, padding: '10px 12px', margin: '10px 10px 0',
          fontSize: '0.75rem', color: '#064e3b', lineHeight: 1.5,
        }}>
          <div style={{ fontWeight: 700, color: '#059669', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
            <SupabaseIcon size={13} /> Supabase
          </div>
          Built on PostgreSQL. Add a Supabase connection in{' '}
          <strong>Connections</strong>, then select it below.
          <br />
          <a
            href="https://supabase.com/dashboard/project/_/settings/database"
            target="_blank"
            rel="noreferrer"
            style={{ color: '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 5 }}
          >
            Get connection details <ExternalLink size={11} />
          </a>
        </div>

        <div className="cqp-section" style={{ marginTop: 8 }}>
          <div className="cqp-section-label">Connection</div>
          {connections.length === 0 ? (
            <div className="cqp-empty-note">
              No Supabase connections saved.{' '}
              <a href="/connections" style={{ color: 'var(--accent)' }}>
                Add one in Connections
              </a>{' '}
              using <strong>Supabase</strong> type.
            </div>
          ) : (
            <select
              className="cqp-select"
              value={selectedConn}
              onChange={e => setSelectedConn(e.target.value)}
            >
              {connections.map(c => (
                <option key={c.id} value={String(c.id)}>
                  {c.name || c.dbname}{c.db_type === 'supabase' ? ' (Supabase)' : ' (PG)'}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Table filter */}
        {tables.length > 0 && (
          <div className="cqp-section">
            <div
              className="cqp-section-label"
              style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
              onClick={() => setShowTables(s => !s)}
            >
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

      {/* ── Right chat panel ── */}
      <div className="cqp-right">
        <div className="cqp-chat-header">
          <SupabaseIcon size={15}/>
          <span>Supabase Chat</span>
          <Badge color="green" style={{ marginLeft: 'auto' }}>{conn?.name || 'No connection'}</Badge>
        </div>

        <div className="cqp-messages">
          {history.length === 0 && !loading && (
            <div className="cqp-welcome">
              <SupabaseIcon size={28}/>
              <div className="cqp-welcome-title">Ask your Supabase database anything</div>
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
            placeholder="Ask anything about your Supabase data... (Enter to send, Shift+Enter for new line)"
            rows={1}
          />
          <button
            className="cqp-send-btn"
            onClick={send}
            disabled={loading || !input.trim()}
          >
            <Send size={15}/>
          </button>
        </div>
      </div>
    </div>
  );
}
