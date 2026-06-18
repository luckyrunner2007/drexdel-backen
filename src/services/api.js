import axios from 'axios';

// Dynamically toggles baseline paths between development and your AWS Lightsail static IP address
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://34.193.20.206:5050';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
