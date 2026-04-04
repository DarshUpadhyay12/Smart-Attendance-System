const serverHost = window.location.hostname;
const serverPort = window.location.port ? `:${window.location.port}` : '';
const protocol = window.location.protocol;
const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';

const isProduction = serverHost.includes('vercel.app');

export const API_BASE_URL = isProduction 
  ? 'https://smart-attendance-system-61st.onrender.com' 
  : (import.meta.env.VITE_API_URL || `/api`);

export const WS_BASE_URL = isProduction
  ? 'wss://smart-attendance-system-61st.onrender.com/ws/attendance'
  : (import.meta.env.VITE_WS_URL || `${wsProtocol}//${serverHost}${serverPort}/ws/attendance`);
