import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const swarmAPI = {
  pgQuery: (params) =>
    axios.post(`${API_BASE}/swarm/pg-query`, params, { headers: getAuthHeader() }),

  mysqlQuery: (params) =>
    axios.post(`${API_BASE}/swarm/mysql-query`, params, { headers: getAuthHeader() }),

  mongoQuery: (params) =>
    axios.post(`${API_BASE}/swarm/mongo-query`, params, { headers: getAuthHeader() }),

  datasetQuery: (params) =>
    axios.post(`${API_BASE}/swarm/dataset-query`, params, { headers: getAuthHeader() }),
};