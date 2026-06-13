import { useState, useEffect, useRef, useCallback } from 'react';
import { WS_BASE_URL } from '../config';

export function useAttendanceSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`${WS_BASE_URL}/ws/attendance`);

    ws.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket Connected');
    };

    ws.onmessage = (event) => {
      setLastMessage(event.data);
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket Disconnected, reconnecting in 3s...');
      setTimeout(connect, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket Error:', error);
      ws.close();
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendFrame = useCallback((base64Frame: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(base64Frame);
    }
  }, []);

  return { isConnected, sendFrame, lastMessage };
}
