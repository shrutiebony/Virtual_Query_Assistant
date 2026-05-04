import React, { useState, useEffect, useRef } from 'react';
import { datasetAPI } from '../services/api';
import { splitQuestions } from '../utils/splitQuestions';
import { Alert, Badge, Button } from '../components/ui';
import ResultsPanel from '../components/ui/ResultsPanel';
import { FolderOpen, Send, Sparkles, Upload, Trash2, FileText } from 'lucide-react';
import './ChatQueryPage.css';

const SAMPLES = [
  'Show total sales by category',
  'Top 10 records by revenue',
  'Which rows have missing values?',
  'Average value per group',
  'Show monthly trend',
];

function toTableName(filename) {
  return filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase().slice(0, 60) || 'dataset';
}

export default function DatasetsPage() {
  const [datasets, setDatasets]   = useState([]);
  const [input, setInput]         = useState('');
  const [history, setHistory]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState('');
  const chatEndRef  = useRef(null);
  const textareaRef = useRef(null);
  const fileRef     = useRef(null);

  const load = () => datasetAPI.list().then(r => setDatasets(r.data?.datasets || [])).catch(() => {});
  useEffect(() => { load(); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [history, loading]);

  const upload = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    form.append('table_name', toTableName(file.name));
    setUploading(true); setError('');
    try {
      await datasetAPI.upload(form);
      load();
    } catch (err) {
      const d = err.response?.data?.detail;
      setError(typeof d === 'string' ? d : 'Upload failed.');
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const del = async (tableName, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${tableName}"?`)) return;
    try { await datasetAPI.delete(tableName); load(); }
    catch { setError('Delete failed.'); }
  };

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    if (!datasets.length) return setError('Upload a dataset first.');
    setInput(''); setError('');

    const questions = splitQuestions(q);
    questions.forEach(({ display }) => setHistory(h => [...h, { type: 'user', content: display }]));
    setLoading(true);
    try {
      const allTables = datasets.map(d => d.table_name);
      const responses = await Promise.all(
        questions.map(({ display, query }) =>
          datasetAPI.query({ all_table_names: allTables, question: query, limit: 100 })
            .then(r => ({ ok: true, question: display, data: r.data }))
            .catch(e => ({ ok: false, question: display, error: e.response?.data?.detail || e.message }))
        )
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
          <div className="cqp-section-label">Datasets ({datasets.length})</div>
          <input type="file" ref={fileRef} style={{display:'none'}} accept=".csv,.xlsx,.xls" onChange={upload} />
          <button className="cqp-upload-btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload size={13}/>
            {uploading ? 'Uploading...' : 'Upload CSV / Excel'}
          </button>

          {datasets.length === 0 ? (
            <div className="cqp-empty-note">No datasets yet — upload a file above</div>
          ) : (
            <div className="cqp-checklist" style={{maxHeight:'none'}}>
              {datasets.map(d => (
                <div key={d.table_name} className="cqp-dataset-item">
                  <FileText size={13} style={{flexShrink:0,color:'var(--gray-400)'}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:'0.78rem',fontWeight:600,color:'var(--gray-800)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.table_name}</div>
                    <div style={{fontSize:'0.68rem',color:'var(--gray-400)'}}>
                      {d.row_count ? `${Number(d.row_count).toLocaleString()} rows` : ''}
                      {d.col_count ? ` · ${d.col_count} cols` : ''}
                    </div>
                  </div>
                  <button className="cqp-del-btn" onClick={e => del(d.table_name, e)}><Trash2 size={12}/></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="cqp-section cqp-suggestions">
          <div className="cqp-section-label"><Sparkles size={11}/> Suggestions</div>
          {SAMPLES.map(s => (
            <button key={s} className="cqp-suggestion" onClick={() => { setInput(s); textareaRef.current?.focus(); }}>{s}</button>
          ))}
        </div>
      </div>

      <div className="cqp-right">
        <div className="cqp-chat-header">
          <FolderOpen size={15}/>
          <span>Dataset Chat</span>
          <Badge color="purple" style={{marginLeft:'auto'}}>{datasets.length} table{datasets.length !== 1 ? 's' : ''}</Badge>
        </div>

        <div className="cqp-messages">
          {history.length === 0 && !loading && (
            <div className="cqp-welcome">
              <FolderOpen size={28}/>
              <div className="cqp-welcome-title">Ask your datasets anything</div>
              <div className="cqp-welcome-sub">Gemini auto-selects the right table — upload files on the left to get started</div>
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
            placeholder="Ask anything about your uploaded data... (Enter to send)" />
          <button className="cqp-send-btn" onClick={send} disabled={loading || !input.trim()}>
            <Send size={15}/>
          </button>
        </div>
      </div>
    </div>
  );
}