const serverHost = window.location.hostname;
const serverPort = window.location.port ? `:${window.location.port}` : '';
const protocol = window.location.protocol;
const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';

export const API_BASE_URL = import.meta.env.VITE_API_URL || `/api`;
export const WS_BASE_URL = import.meta.env.VITE_WS_URL || `${wsProtocol}//${serverHost}${serverPort}/ws/attendance`;
