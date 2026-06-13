import { useState, useEffect } from 'react';
import { Users, UserCheck, Clock, Activity } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface Analytics {
  total_students: number;
  present_today: number;
  recent_logs: Array<{
    student_id: string;
    name: string;
    timestamp: string;
  }>;
}

export function AnalyticsDashboard() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/analytics`);
        const result = await res.json();
        if (result.status === 'success') {
          setData(result);
        }
      } catch (e) {
        console.error("Failed to fetch analytics", e);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!data) {
    return <div className="text-white animate-pulse">Loading analytics...</div>;
  }

  const attendanceRate = data.total_students > 0 
    ? Math.round((data.present_today / data.total_students) * 100) 
    : 0;

  return (
    <div className="w-full text-white animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-bold mb-6 flex items-center justify-center gap-2">
        <Activity className="text-neonCyan" /> System Analytics
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-black/40 border border-neonPurple/30 rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <Users className="w-8 h-8 text-neonPurple mb-2" />
          <p className="text-gray-400 text-sm">Total Registered</p>
          <p className="text-3xl font-bold text-white">{data.total_students}</p>
        </div>
        
        <div className="bg-black/40 border border-neonGreen/30 rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <UserCheck className="w-8 h-8 text-neonGreen mb-2" />
          <p className="text-gray-400 text-sm">Present Today</p>
          <p className="text-3xl font-bold text-white">{data.present_today}</p>
        </div>

        <div className="bg-black/40 border border-neonCyan/30 rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <Activity className="w-8 h-8 text-neonCyan mb-2" />
          <p className="text-gray-400 text-sm">Attendance Rate</p>
          <p className="text-3xl font-bold text-white">{attendanceRate}%</p>
        </div>
      </div>

      <div className="bg-black/40 border border-white/10 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-400" /> Recent Activity
        </h3>
        {data.recent_logs.length > 0 ? (
          <div className="space-y-3">
            {data.recent_logs.map((log, i) => (
              <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                <span className="font-medium text-neonGreen">{log.name}</span>
                <span className="text-xs text-gray-400 font-mono">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm text-center italic py-4">No attendance recorded today.</p>
        )}
      </div>
    </div>
  );
}
