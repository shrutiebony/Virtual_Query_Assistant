import React, { useState, useEffect, useRef } from 'react';
import { authAPI, mongoAPI } from '../services/api';
import { splitQuestions } from '../utils/splitQuestions';
import { Alert, Badge, EmptyState } from '../components/ui';
import ResultsPanel from '../components/ui/ResultsPanel';
import { Leaf, Send, Sparkles, CheckSquare, Square, ChevronDown, ChevronUp } from 'lucide-react';
import './ChatQueryPage.css';

const SAMPLES = [
  'Top 10 customers by total spent',
  'Orders from Asia Pacific region',
  'Monthly revenue trend',
  'Customers with most orders',
  'Orders not completed in 90 days',
];

export default function MongoPage() {
  const [connections, setConnections]     = useState([]);
  const [selectedConn, setSelectedConn]   = useState('');
  const [databases, setDatabases]         = useState([]);
  const [dbName, setDbName]               = useState('');
  const [collections, setCollections]     = useState([]);
  const [selColls, setSelColls]           = useState([]);
  const [showColls, setShowColls]         = useState(true);
  const [mongoUri, setMongoUri]           = useState('');
  const [input, setInput]                 = useState('');
  const [history, setHistory]             = useState([]);
  const [loading, setLoading]             = useState(false);
  const [loadingDbs, setLoadingDbs]       = useState(false);
  const [loadingColls, setLoadingColls]   = useState(false);
  const [error, setError]                 = useState('');
  const chatEndRef  = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    authAPI.connections()
      .then(r => {
        const mg = (r.data || []).filter(c => c.db_type === 'mongodb');
        setConnections(mg);
        if (mg.length) setSelectedConn(String(mg[0].id));
      }).catch(() => {});
  }, []);

  const conn = connections.find(c => String(c.id) === String(selectedConn));

  useEffect(() => {
    if (!conn) return;
    setDatabases([]); setDbName(''); setCollections([]); setSelColls([]);
    setMongoUri(''); setLoadingDbs(true);
    authAPI.getUri(conn.id)
      .then(r => {
        const uri = r.data?.uri || '';
        if (!uri) { setError('Could not get MongoDB URI.'); return; }
        setMongoUri(uri);
        return mongoAPI.listDbs(uri);
      })
      .then(r => {
        const dbs = r?.data?.databases || [];
        setDatabases(dbs);
        if (dbs.length === 1) setDbName(dbs[0]);
      })
      .catch(e => setError('Failed to load databases: ' + (e.response?.data?.detail || e.message)))
      .finally(() => setLoadingDbs(false));
  }, [selectedConn]);

  useEffect(() => {
    if (!mongoUri || !dbName) return;
    setCollections([]); setSelColls([]); setLoadingColls(true);
    mongoAPI.listColls(mongoUri, dbName)
      .then(r => {
        const colls = r?.data?.collections || [];
        setCollections(colls);
        setSelColls(colls);
      })
      .catch(e => setError('Failed to load collections: ' + (e.response?.data?.detail || e.message)))
      .finally(() => setLoadingColls(false));
  }, [dbName, mongoUri]);

  const toggleColl = c => setSelColls(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]);
  const toggleAll  = () => setSelColls(selColls.length === collections.length ? [] : [...collections]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [history, loading]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    if (!conn)   return setError('Select a connection first.');
    if (!dbName) return setError('Select a database first.');
    if (!selColls.length) return setError('Select at least one collection.');
    setInput(''); setError('');

    const questions = splitQuestions(q);
    questions.forEach(({ display }) => setHistory(h => [...h, { type: 'user', content: display }]));
    setLoading(true);
    try {
      const responses = await Promise.all(
        questions.map(({ display, query }) => {
          const apiCall = selColls.length > 1
            ? mongoAPI.nlQueryJoin({ mongo_uri: mongoUri, db_name: dbName, collections: selColls, question: query, limit: 100 })
            : mongoAPI.nlQuery({ mongo_uri: mongoUri, db_name: dbName, collection: selColls[0], question: query, limit: 100 });
          return apiCall
            .then(r => ({ ok: true, question: display, data: r.data }))
            .catch(e => ({ ok: false, question: display, error: e.response?.data?.detail || e.message }));
        })
      );
      responses.forEach(r => setHistory(h => [...h, r.ok
        ? { type: 'result', question: r.question, content: r.data }
        : { type: 'error',  question: r.question, content: typeof r.error === 'string' ? r.error : JSON.stringify(r.error) }
      ]));
    } catch (err) {
      setHistory(h => [...h, { type: 'error', content: err.message || 'Query failed.' }]);
    } finally { setLoading(false); }
  };

  const onKey = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  return (
    <div className="chat-query-page fade-in">
      <div className="cqp-left">
        <div className="cqp-section">
          <div className="cqp-section-label">Connection</div>
          {connections.length === 0
            ? <div className="cqp-empty-note">No MongoDB connections saved</div>
            : <select className="cqp-select" value={selectedConn} onChange={e => setSelectedConn(e.target.value)}>
                {connections.map(c => <option key={c.id} value={String(c.id)}>{c.name || `Connection ${c.id}`}</option>)}
              </select>
          }
        </div>

        {databases.length > 0 && (
          <div className="cqp-section">
            <div className="cqp-section-label">Database</div>
            <select className="cqp-select" value={dbName} onChange={e => setDbName(e.target.value)} disabled={loadingDbs}>
              <option value="">{loadingDbs ? 'Loading...' : 'Select database'}</option>
              {databases.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}

        {dbName && (
          <div className="cqp-section">
            <div className="cqp-section-label" style={{cursor:'pointer',display:'flex',justifyContent:'space-between'}}
              onClick={() => setShowColls(s => !s)}>
              <span>Collections ({selColls.length}/{collections.length})</span>
              {showColls ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
            </div>
            {showColls && (
              <>
                <button className="cqp-toggle-all" onClick={toggleAll}>
                  {selColls.length === collections.length ? 'Deselect all' : 'Select all'}
                </button>
                <div className="cqp-checklist">
                  {loadingColls
                    ? <div className="cqp-empty-note">Loading...</div>
                    : collections.map(c => (
                        <label key={c} className={`cqp-check-item ${selColls.includes(c) ? 'on' : ''}`}>
                          <input type="checkbox" checked={selColls.includes(c)} onChange={() => toggleColl(c)} />
                          {selColls.includes(c) ? <CheckSquare size={13}/> : <Square size={13}/>}
                          <span>{c}</span>
                        </label>
                      ))
                  }
                </div>
                {selColls.length > 1 && (
                  <div style={{fontSize:'0.68rem',color:'var(--green-600,#16a34a)',fontWeight:600,padding:'3px 0'}}>
                    {selColls.length} collections — auto $lookup joins
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="cqp-section cqp-suggestions">
          <div className="cqp-section-label"><Sparkles size={11}/> Suggestions</div>
          {SAMPLES.map(s => (
            <button key={s} className="cqp-suggestion" onClick={() => { setInput(s); textareaRef.current?.focus(); }}>{s}</button>
          ))}
        </div>
      </div>

      <div className="cqp-right">
        <div className="cqp-chat-header">
          <Leaf size={15}/>
          <span>MongoDB Chat</span>
          {selColls.length > 0 && <Badge color="green" style={{marginLeft:'auto'}}>{selColls.length} collection{selColls.length > 1 ? 's' : ''}</Badge>}
        </div>

        <div className="cqp-messages">
          {history.length === 0 && !loading && (
            <div className="cqp-welcome">
              <Leaf size={28}/>
              <div className="cqp-welcome-title">Ask your MongoDB anything</div>
              <div className="cqp-welcome-sub">Select collections on the left, then ask your question</div>
            </div>
          )}
          {history.map((msg, i) => (
            <div key={i} className={`cqp-msg cqp-msg-${msg.type}`}>
              {msg.type === 'user'   && <div className="cqp-bubble-user">{msg.content}</div>}
              {msg.type === 'result' && <div className="cqp-bubble-result"><ResultsPanel key={`${i}-${msg.question}`} result={msg.content} question={msg.question} /></div>}
              {msg.type === 'error'  && <div className="cqp-bubble-result"><Alert type="error">{msg.content}</Alert></div>}
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
          <textarea ref={textareaRef} className="cqp-textarea" value={input}
            onChange={e => setInput(e.target.value)} onKeyDown={onKey} rows={1}
            placeholder="Ask anything about your collections... (Enter to send)" />
          <button className="cqp-send-btn" onClick={send} disabled={loading || !input.trim()}>
            <Send size={15}/>
          </button>
        </div>
      </div>
    </div>
  );
}