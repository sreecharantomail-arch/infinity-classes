const API_BASE = import.meta.env.VITE_API_URL || '/api';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

const handleResponse = async (res) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = data.message || `Request failed with status ${res.status}`;
    throw new Error(errorMsg);
  }
  return data;
};

export const api = {
  // Auth
  register: (body) =>
    fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(handleResponse),

  login: (body) =>
    fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(handleResponse),

  getMe: () =>
    fetch(`${API_BASE}/auth/me`, {
      headers: getHeaders(),
    }).then(handleResponse),

  // Test & Questions
  getTestQuestions: () =>
    fetch(`${API_BASE}/questions/test`, {
      headers: getHeaders(),
    }).then(handleResponse),

  submitTest: (body) =>
    fetch(`${API_BASE}/attempts/submit`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    }).then(handleResponse),

  // History & Attempts
  getMyHistory: () =>
    fetch(`${API_BASE}/attempts/my-history`, {
      headers: getHeaders(),
    }).then(handleResponse),

  getAttemptDetails: (id) =>
    fetch(`${API_BASE}/attempts/${id}`, {
      headers: getHeaders(),
    }).then(handleResponse),

  // Admin
  getAllQuestions: () =>
    fetch(`${API_BASE}/questions/all`, {
      headers: getHeaders(),
    }).then(handleResponse),

  createQuestion: (body) =>
    fetch(`${API_BASE}/questions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    }).then(handleResponse),

  deleteQuestion: (id) =>
    fetch(`${API_BASE}/questions/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    }).then(handleResponse),

  resetQuestions: () =>
    fetch(`${API_BASE}/questions/reset-seed`, {
      method: 'POST',
      headers: getHeaders(),
    }).then(handleResponse),
};

export default api;
