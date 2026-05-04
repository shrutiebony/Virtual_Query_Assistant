import React, { useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import axios from 'axios';
import { Button, Input, Select, Card, Badge, Alert, PageHeader, EmptyState } from '../components/ui';
import { Link2, Plus, Trash2, Database, Leaf, CheckCircle, XCircle } from 'lucide-react';
import './ConnectionsPage.css';

const EMPTY_FORM = {
  name: '', db_type: 'postgresql',
  host: 'localhost', port: '5432',
  dbname: '', db_username: '', password: '',
  is_default: false,
};

export default function ConnectionsPage() {
  const [connections, setConnections] = useState([]);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [showForm, setShowForm]       = useState(false);
  const [loading, setLoading]         = useState(false);
  const [deleting, setDeleting]       = useState(null);
  const [testing, setTesting]         = useState(false);
  const [testResult, setTestResult]   = useState(null);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');

  const load = () =>
    authAPI.connections().then(r => setConnections(r.data || [])).catch(() => {});

  useEffect(() => { load(); }, []);

  const handle = e => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(f => ({ ...f, [e.target.name]: val }));
    setTestResult(null);
  };

  const handleTypeChange = e => {
    const type = e.target.value;
    const defaultPort = type === 'mongodb' ? '27017' : type === 'mysql' ? '3307' : '5432';
    setForm(f => ({ ...f, db_type: type, port: defaultPort }));
    setTestResult(null);
  };

  const testConn = async () => {
    if (!form.password) return setError('Enter a MongoDB URI first.');
    setTesting(true); setTestResult(null); setError('');
    try {
      const base  = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('token');
      const r = await axios.post(
        `${base}/mongo/ping-uri`,
        { mongo_uri: form.password },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTestResult({ ok: true, dbs: r.data.databases || [] });
    } catch (e) {
      setTestResult({ ok: false, msg: e.response?.data?.detail || e.message });
    } finally { setTesting(false); }
  };

  const testMySQLConn = async () => {
    if (!form.host || !form.dbname || !form.db_username || !form.password) {
      return setError('Please fill in all MySQL connection fields first.');
    }
    setTesting(true); setTestResult(null); setError('');
    try {
      const base  = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('token');
      const r = await axios.post(
        `${base}/mysql/test-connection`,
        {
          host:     form.host,
          port:     parseInt(form.port) || 3307,
          database: form.dbname,
          username: form.db_username,
          password: form.password,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTestResult({ ok: true, msg: r.data.message || 'Connection successful' });
    } catch (e) {
      setTestResult({ ok: false, msg: e.response?.data?.detail || e.message });
    } finally { setTesting(false); }
  };

  const save = async e => {
    e.preventDefault();
    if (!form.name || !form.dbname || !form.password)
      return setError('Name, database name and password/URI are required.');
    if ((form.db_type === 'postgresql' || form.db_type === 'mysql') && (!form.host || !form.db_username))
      return setError('Host and username are required.');
    setLoading(true); setError('');
    try {
      const isMongo = form.db_type === 'mongodb';
      await authAPI.saveConn({
        name:        form.name,
        db_type:     form.db_type,
        host:        isMongo ? 'localhost' : form.host,
        port:        isMongo ? 27017 : parseInt(form.port),
        dbname:      form.dbname,
        db_username: isMongo ? 'mongo' : form.db_username,
        password:    form.password,
        is_default:  form.is_default,
      });
      setSuccess('Connection saved!');
      setForm(EMPTY_FORM);
      setShowForm(false);
      setTestResult(null);
      load();
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail))
        setError(detail.map(d => d.msg || JSON.stringify(d)).join(', '));
      else if (typeof detail === 'string') setError(detail);
      else setError('Failed to save: ' + (err.message || 'Unknown error'));
    } finally { setLoading(false); }
  };

  const del = async id => {
    if (!window.confirm('Delete this connection?')) return;
    setDeleting(id);
    try { await authAPI.deleteConn(id); load(); }
    catch { setError('Failed to delete.'); }
    finally { setDeleting(null); }
  };

  const isMongo = form.db_type === 'mongodb';
  const isMySQL = form.db_type === 'mysql';
  const isPG    = form.db_type === 'postgresql';

  const pg = connections.filter(c => c.db_type === 'postgresql');
  const mg = connections.filter(c => c.db_type === 'mongodb');
  const my = connections.filter(c => c.db_type === 'mysql');

  return (
    <div className="connections-page fade-in">
      <PageHeader
        title="My Connections"
        subtitle="Manage your saved database connections"
        actions={
          <Button
            icon={<Plus size={15}/>}
            onClick={() => { setShowForm(s => !s); setError(''); setTestResult(null); }}
          >
            {showForm ? 'Cancel' : 'Add Connection'}
          </Button>
        }
      />

      {showForm && (
        <Card className="conn-form-card fade-in">
          <div className="conn-form-title">New Connection</div>
          {error   && <Alert type="error"   onClose={() => setError('')}>{error}</Alert>}
          {success && <Alert type="success" onClose={() => setSuccess('')}>{success}</Alert>}
          <form onSubmit={save} className="conn-form">

            {/* Name + Type */}
            <div className="conn-form-row">
              <Input
                label="Connection Name"
                name="name"
                value={form.name}
                onChange={handle}
                placeholder="e.g. Production DB"
              />
              <Select
                label="Database Type"
                name="db_type"
                value={form.db_type}
                onChange={handleTypeChange}
              >
                <option value="postgresql">PostgreSQL</option>
                <option value="mongodb">MongoDB</option>
                <option value="mysql">MySQL</option>
              </Select>
            </div>

            {/* PostgreSQL fields */}
            {isPG && (
              <>
                <div className="conn-form-row">
                  <Input label="Host" name="host" value={form.host} onChange={handle} placeholder="localhost" />
                  <Input label="Port" name="port" value={form.port} onChange={handle} placeholder="5432" type="number" />
                </div>
                <div className="conn-form-row">
                  <Input label="Database Name" name="dbname" value={form.dbname} onChange={handle} placeholder="my_database" />
                  <Input label="Username" name="db_username" value={form.db_username} onChange={handle} placeholder="db_user" />
                </div>
                <Input
                  label="Password"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handle}
                  placeholder="••••••••"
                />
              </>
            )}

            {/* MongoDB fields */}
            {isMongo && (
              <>
                <Input
                  label="Display Name (for your reference)"
                  name="dbname"
                  value={form.dbname}
                  onChange={handle}
                  placeholder="e.g. my_mongo_db"
                  hint="Just a label — MongoDB databases are selected at query time"
                />
                <Input
                  label="MongoDB URI"
                  name="password"
                  value={form.password}
                  onChange={handle}
                  placeholder="mongodb://localhost:27017"
                  hint="Full connection URI including auth if needed"
                />
                <div className="conn-test-row">
                  <Button type="button" variant="secondary" size="sm" loading={testing} onClick={testConn}>
                    Test Connection
                  </Button>
                  {testResult && testResult.ok && (
                    <span className="conn-test-ok">
                      <CheckCircle size={14}/> Connected — {testResult.dbs.length} databases: {testResult.dbs.join(', ')}
                    </span>
                  )}
                  {testResult && !testResult.ok && (
                    <span className="conn-test-fail">
                      <XCircle size={14}/> {testResult.msg}
                    </span>
                  )}
                </div>
              </>
            )}

            {/* MySQL fields */}
            {isMySQL && (
              <>
                <div className="conn-form-row">
                  <Input label="Host" name="host" value={form.host} onChange={handle} placeholder="127.0.0.1" />
                  <Input label="Port" name="port" value={form.port} onChange={handle} placeholder="3307" type="number" />
                </div>
                <div className="conn-form-row">
                  <Input label="Database Name" name="dbname" value={form.dbname} onChange={handle} placeholder="test_db" />
                  <Input label="Username" name="db_username" value={form.db_username} onChange={handle} placeholder="da_user" />
                </div>
                <Input
                  label="Password"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handle}
                  placeholder="••••••••"
                />
                <div className="conn-test-row">
                  <Button type="button" variant="secondary" size="sm" loading={testing} onClick={testMySQLConn}>
                    Test Connection
                  </Button>
                  {testResult && testResult.ok && (
                    <span className="conn-test-ok">
                      <CheckCircle size={14}/> {testResult.msg}
                    </span>
                  )}
                  {testResult && !testResult.ok && (
                    <span className="conn-test-fail">
                      <XCircle size={14}/> {testResult.msg}
                    </span>
                  )}
                </div>
              </>
            )}

            <div className="conn-form-actions">
              <Button type="submit" loading={loading}>Save Connection</Button>
              <Button
                variant="secondary"
                type="button"
                onClick={() => { setShowForm(false); setTestResult(null); }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {!showForm && success && <Alert type="success" onClose={() => setSuccess('')}>{success}</Alert>}
      {!showForm && error   && <Alert type="error"   onClose={() => setError('')}>{error}</Alert>}

      {connections.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Link2 size={24}/>}
            title="No connections yet"
            description="Add your first PostgreSQL, MongoDB or MySQL connection to start querying."
            action={
              <Button onClick={() => setShowForm(true)} icon={<Plus size={14}/>}>
                Add Connection
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="conn-groups">
          {pg.length > 0 && (
            <ConnGroup
              title="PostgreSQL"
              icon={<Database size={16}/>}
              color="blue"
              items={pg}
              onDelete={del}
              deleting={deleting}
            />
          )}
          {mg.length > 0 && (
            <ConnGroup
              title="MongoDB"
              icon={<Leaf size={16}/>}
              color="green"
              items={mg}
              onDelete={del}
              deleting={deleting}
            />
          )}
          {my.length > 0 && (
            <ConnGroup
              title="MySQL"
              icon={<Database size={16}/>}
              color="orange"
              items={my}
              onDelete={del}
              deleting={deleting}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ConnGroup({ title, icon, color, items, onDelete, deleting }) {
  return (
    <div className="conn-group">
      <div className={`conn-group-header conn-group-${color}`}>
        {icon}<span>{title}</span><Badge color={color}>{items.length}</Badge>
      </div>
      <div className="conn-list">
        {items.map(c => (
          <div key={c.id} className="conn-item">
            <div className="conn-item-icon">
              {c.db_type === 'postgresql' ? <Database size={16}/> :
               c.db_type === 'mysql'      ? <Database size={16}/> :
                                            <Leaf size={16}/>}
            </div>
            <div className="conn-item-info">
              <div className="conn-item-name">{c.name}</div>
              <div className="conn-item-meta">
                <Badge color={color} size="sm">{c.db_type}</Badge>
                <span className="conn-item-db">{c.host}:{c.port}/{c.dbname}</span>
              </div>
            </div>
            <button
              className="conn-delete-btn"
              onClick={() => onDelete(c.id)}
              disabled={deleting === c.id}
            >
              {deleting === c.id
                ? <span style={{
                    width: 14, height: 14,
                    border: '2px solid currentColor',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'spin 0.6s linear infinite'
                  }}/>
                : <Trash2 size={15}/>}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}