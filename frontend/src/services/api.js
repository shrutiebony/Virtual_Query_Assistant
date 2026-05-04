import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  timeout: 60000,
});

// Response interceptor — auto-logout on 401
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);


// ── Auth ─────────────────────────────────────────────────────
export const authAPI = {
  login:       (u, p)  => api.post('/auth/login', new URLSearchParams({ username: u, password: p }),
                            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }),
  register:    (u, p)  => api.post('/auth/register', { email: u, password: p }),
  me:          ()      => api.get('/auth/me'),
  connections: ()      => api.get('/auth/connections'),
  getUri:      (id)    => api.post('/auth/connections/get-uri', { connection_id: id }),
  saveConn:    (data)  => api.post('/auth/connections', data),
  deleteConn:  (id)    => api.delete(`/auth/connections/${id}`),
  getPassword: (id) =>
  api.post('/auth/connections/get-password', { connection_id: id }),
};

// ── PostgreSQL ────────────────────────────────────────────────
export const pgAPI = {
  nlQuery:     (data)  => api.post('/pg/nl-query-auto', data),
  nlQueryJoin: (data)  => api.post('/pg/nl-query-join', data),
  directQuery: (data)  => api.post('/pg/direct-query', data),
  multiQuery:  (data)  => api.post('/pg/nl-query-multi', data),
  listTables:  (uri)   => api.post('/pg/list-tables', { pg_uri: uri }),
};

// ── MongoDB ───────────────────────────────────────────────────
export const mongoAPI = {
  nlQuery:     (data)        => api.post('/mongo/nl-query', data),
  nlQueryJoin: (data)        => api.post('/mongo/nl-query-join', data),
  directQuery: (data)        => api.post('/mongo/query', data),
  listDbs:     (uri)         => api.get('/mongo/databases',   { params: { mongo_uri: uri } }),
  listColls:   (uri, db)     => api.get('/mongo/collections', { params: { mongo_uri: uri, db_name: db } }),
};

// ── Datasets ──────────────────────────────────────────────────
export const datasetAPI = {
  list:        ()      => api.get('/my-datasets/list'),
  upload:      (form)  => api.post('/my-datasets/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } }),
  query:       (data)  => api.post('/my-datasets/nl-query-auto', data),
  delete:      (id)    => api.delete(`/my-datasets/${id}`),
};

export default api;

// ── Generative UI ─────────────────────────────────────────────
export const genuiAPI = {
  generate: (data) => api.post('/genui/generate', data),
};