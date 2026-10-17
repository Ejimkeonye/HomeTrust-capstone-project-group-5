import axios from 'axios';

// Automatically pulls your live Render URL from the .env file, or defaults to local backend
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
console.log("CHECKING VITE_API_URL:", API_URL);

const api = axios.create({
  baseURL: `${API_URL}/api`, // Appends /api to the live Render backend URL
  headers: {
    'Content-Type': 'application/json',
  },
});

// Automatically attach the JWT token to requests if the user is logged in
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token'); // Gets the JWT stored after login
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;