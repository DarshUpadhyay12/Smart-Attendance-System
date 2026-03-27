import { useState, useEffect } from 'react';
import { Download, Users, UserCheck, UserX, BarChart3 } from 'lucide-react';
import { API_BASE_URL } from '../config';

export function AnalyticsDashboard() {
  const [logs, setLogs] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionName, setSessionName] = useState("Morning Class");
  const [isChangingSession, setIsChangingSession] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [logsRes, studentsRes, sessionRes] = await Promise.all([
          fetch(`${API_BASE_URL}/attendance_logs`),
          fetch(`${API_BASE_URL}/students`),
          fetch(`${API_BASE_URL}/current_session`)
        ]);
        const logsData = await logsRes.json();
        const studentsData = await studentsRes.json();
        const sessionData = await sessionRes.json();
        
        if (logsData.status === 'success') {
            setLogs(logsData.logs);
        }
        if (sessionData.status === 'success' && sessionData.active_session) {
            setSessionName(sessionData.active_session);
        }
        if (studentsData.status === 'success') setStudents(studentsData.students);
      } catch (err) {
        console.error("Failed to fetch analytics data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleExport = () => {
    window.open(`${API_BASE_URL}/export_attendance`, '_blank');
  };
  
  const handleUpdateSession = async () => {
      setIsChangingSession(true);
      try {
          await fetch(`${API_BASE_URL}/set_session`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ session_name: sessionName })
          });
          alert(`Session is now actively logging to: ${sessionName}`);
          // Refetch to clear the missing list relative to the new empty session
          setLogs([]);
      } catch (e) {
          console.error(e);
      } finally {
          setIsChangingSession(false);
      }
  };

  // Calculate Metrics
  // Get today's date in local time, formatted as "YYYY-MM-DD"
  const todayLocal = new Date();
  const year = todayLocal.getFullYear();
  const month = String(todayLocal.getMonth() + 1).padStart(2, '0');
  const day = String(todayLocal.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  // Filter logs strictly by the current active session AND today's exact date
  const sessionLogs = logs.filter(log => log.session_id === sessionName && log.timestamp.startsWith(todayStr));
  
  const presentIds = new Set(sessionLogs.map(l => l.student_id));
  const totalStudents = students.length;
  const presentCount = presentIds.size;
  const absentCount = totalStudents - presentCount;
  
  const attendanceRate = totalStudents === 0 ? 0 : Math.round((presentCount / totalStudents) * 100);

  const absentStudentsList = students.filter(s => !presentIds.has(s.id));

  if (loading) return <div className="text-neonCyan animate-pulse p-8 text-center">Loading Analytics Engine...</div>;

  return (
    <div className="w-full text-white space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-white/10 pb-4">
        <div className="w-full md:w-auto">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <BarChart3 className="text-neonPurple w-8 h-8" /> 
            Live Analytics Dashboard
          </h2>
          <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <span className="text-gray-400 text-sm whitespace-nowrap">Active Session:</span>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input 
                type="text" 
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                className="bg-black/50 border border-white/20 rounded px-3 py-1.5 text-sm outline-none focus:border-neonPurple transition-colors flex-1 sm:w-48"
              />
              <button 
                onClick={handleUpdateSession}
                disabled={isChangingSession}
                className="bg-neonPurple/20 text-neonPurple hover:bg-neonPurple hover:text-white px-4 py-1.5 rounded text-sm transition-colors border border-neonPurple/50 disabled:opacity-50 whitespace-nowrap"
              >
                {isChangingSession ? 'Updating...' : 'Set Active'}
              </button>
            </div>
          </div>
        </div>
        <button 
          onClick={handleExport}
          className="w-full md:w-auto bg-neonGreen/20 text-neonGreen hover:bg-neonGreen hover:text-black border border-neonGreen/50 transition-all font-mono px-4 py-3 md:py-2 rounded-lg flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(57,255,20,0.2)] hover:shadow-[0_0_20px_rgba(57,255,20,0.4)]"
        >
          <Download className="w-4 h-4" /> Download CSV
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
        <div className="bg-gradient-to-br from-white/5 to-white/0 border border-white/10 p-5 rounded-xl flex flex-col gap-3 shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:border-white/20 transition-all">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-neonPurple/20 text-neonPurple rounded-lg shadow-inner">
              <Users className="w-5 h-5" />
            </div>
            <p className="text-sm text-gray-400 font-medium">Total Enrolled</p>
          </div>
          <p className="text-3xl font-bold tracking-tight">{totalStudents}</p>
        </div>
        
        <div className="bg-gradient-to-br from-neonGreen/5 to-white/0 border border-white/10 p-5 rounded-xl flex flex-col gap-3 shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:border-neonGreen/30 transition-all">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-neonGreen/20 text-neonGreen rounded-lg shadow-inner">
               <UserCheck className="w-5 h-5" />
            </div>
            <p className="text-sm text-gray-400 font-medium">Present Today</p>
          </div>
          <p className="text-3xl font-bold tracking-tight">{presentCount} <span className="text-lg text-neonGreen font-normal border-l border-white/10 ml-2 pl-2">{attendanceRate}%</span></p>
        </div>

        <div className="bg-gradient-to-br from-red-500/5 to-white/0 border border-white/10 p-5 rounded-xl flex flex-col gap-3 shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:border-red-500/30 transition-all">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-500/20 text-red-500 rounded-lg shadow-inner">
               <UserX className="w-5 h-5" />
            </div>
            <p className="text-sm text-gray-400 font-medium">Absent Today</p>
          </div>
          <p className="text-3xl font-bold tracking-tight">{absentCount}</p>
        </div>
      </div>

      {/* Absent List */}
      <div className="mt-6 bg-red-500/5 border border-red-500/20 rounded-xl p-4 overflow-hidden">
        <h3 className="text-red-400 font-semibold mb-3 flex items-center gap-2">
          <UserX className="w-4 h-4"/> Missing Students 
        </h3>
        <div className="max-h-40 overflow-y-auto pr-2 custom-scrollbar">
          {absentStudentsList.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Perfect attendance!</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {absentStudentsList.map(student => (
                <div key={student.id} className="bg-black/40 border border-white/5 p-2 rounded flex justify-between items-center text-sm">
                  <span>{student.name}</span>
                  <span className="text-gray-500 text-xs font-mono">{student.enrollment}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
