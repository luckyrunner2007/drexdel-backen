import axios from 'axios';
import { API_BASE_URL } from '../config/env';

// Uses the shared environment config. Set EXPO_PUBLIC_API_BASE_URL in .env
// to point at the correct backend for each environment.
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;