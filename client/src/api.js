import axios from 'axios';
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api' });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('devsync_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 401 && !window.location.pathname.match(/\/login|\/register/)) {
    localStorage.removeItem('devsync_token'); localStorage.removeItem('devsync_user'); window.location.href = '/login';
  }
  return Promise.reject(error);
});
export function errorMessage(error) { return error.response?.data?.message || error.message || 'Something went wrong.'; }
