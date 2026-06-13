const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export const API_BASE_URL = isLocalhost ? '/api' : 'https://smart-attendance-backend-qj2r.onrender.com';
export const WS_BASE_URL = isLocalhost ? `wss://${window.location.host}` : 'wss://smart-attendance-backend-qj2r.onrender.com';
