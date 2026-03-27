import { useEffect, useState } from 'react';
import { Clock, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface LogEntry {
  student_id: string;
  name: string;
  enrollment: string;
  branch: string;
  timestamp: string;
}

export function AttendanceLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    // Poll the backend for new logs every 3 seconds for MVP simplicity
    const fetchLogs = async () => {
      try {
        const [logsRes, sessionRes] = await Promise.all([
          fetch(`${API_BASE_URL}/attendance_logs`),
          fetch(`${API_BASE_URL}/current_session`)
        ]);
        const data = await logsRes.json();
        const sessionData = await sessionRes.json();

        if (data.status === 'success' && sessionData.status === 'success') {
          const activeSession = sessionData.active_session;
          const todayLocal = new Date();
          const year = todayLocal.getFullYear();
          const month = String(todayLocal.getMonth() + 1).padStart(2, '0');
          const day = String(todayLocal.getDate()).padStart(2, '0');
          const todayStr = `${year}-${month}-${day}`;
          
          const filteredLogs = data.logs.filter((log: any) => 
              log.session_id === activeSession && log.timestamp.startsWith(todayStr)
          );
          setLogs(filteredLogs);
        }
      } catch (e) {
        console.error("Failed to fetch logs");
      }
    };
    
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-sm h-[calc(100vh-4rem)] glass-panel rounded-2xl p-4 flex flex-col hidden lg:flex">
      <h3 className="text-xl font-bold flex items-center gap-2 mb-4 text-white pb-4 border-b border-white/10">
        <Clock className="text-neonCyan" /> Live Session Log
      </h3>
      
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
        {logs.length === 0 ? (
          <div className="text-gray-500 text-center mt-10 text-sm">Waiting for captures...</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="bg-white/5 border border-white/10 p-3 rounded-lg flex items-start gap-3 transform transition-all animate-in slide-in-from-right-4">
              <CheckCircle2 className="text-neonGreen w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-200">{log.name}</p>
                <div className="text-xs text-gray-400 mt-1 flex gap-2">
                  <span>{log.enrollment}</span>
                  <span>•</span>
                  <span>{log.branch}</span>
                </div>
                <p className="text-[10px] text-neonCyan mt-2 font-mono">{log.timestamp}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
