import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_BACKEND_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    // Handle inactive user
    if (error.response?.status === 403 && error.response?.data?.detail?.includes('inactive')) {
      localStorage.removeItem('token');
      alert('Your account has been deactivated. Please contact administrator.');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
