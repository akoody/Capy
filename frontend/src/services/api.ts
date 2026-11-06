import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use(config => {
  const initData = window.Telegram?.WebApp?.initData;
  if (initData) {
    config.headers.Authorization = `tma ${initData}`;
  }
  return config;
});

export default api;
