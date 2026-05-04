import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const mysqlAPI = {
  testConnection: (params) =>
    axios.post(`${API_BASE}/mysql/test-connection`, params, { headers: getAuthHeader() }),

  listTables: (params) =>
    axios.post(`${API_BASE}/mysql/list-tables`, params, { headers: getAuthHeader() }),

  nlQuery: (params) =>
    axios.post(`${API_BASE}/mysql/nl-query`, params, { headers: getAuthHeader() }),

  nlQueryJoin: (params) =>
    axios.post(`${API_BASE}/mysql/nl-query-join`, params, { headers: getAuthHeader() }),

  showIndexes: (params) =>
    axios.post(`${API_BASE}/mysql/show-indexes`, params, { headers: getAuthHeader() }),

  showCreateTable: (params) =>
    axios.post(`${API_BASE}/mysql/show-create-table`, params, { headers: getAuthHeader() }),
};