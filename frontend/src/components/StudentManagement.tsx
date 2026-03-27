import { useState, useEffect } from 'react';
import { Database, Trash2, Edit2, Check, X } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface Student {
  id: string;
  name: string;
  enrollment: string;
  branch: string;
}

export function StudentManagement() {
  const [students, setStudents] = useState<Student[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', enrollment: '', branch: '' });

  const fetchStudents = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/students`);
      const data = await res.json();
      if (data.status === 'success') {
        setStudents(data.students);
      }
    } catch(e) { console.error(e) }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this student permanently?")) return;
    try {
      await fetch(`${API_BASE_URL}/students/${id}`, { method: 'DELETE' });
      fetchStudents();
    } catch(e) {}
  };

  const startEdit = (st: Student) => {
    setEditingId(st.id);
    setEditForm({ name: st.name, enrollment: st.enrollment, branch: st.branch });
  };

  const saveEdit = async (id: string) => {
    try {
      await fetch(`${API_BASE_URL}/students/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      setEditingId(null);
      fetchStudents();
    } catch(e) {}
  };

  return (
    <div className="w-full text-white animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-bold mb-6 flex items-center justify-center gap-2">
        <Database className="text-neonPurple" /> Manage Students
      </h2>
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10 text-gray-400 text-sm">
              <th className="p-2 font-medium">Name</th>
              <th className="p-2 font-medium text-center">Enr. No</th>
              <th className="p-2 font-medium text-center">Branch</th>
              <th className="p-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map(st => (
              <tr key={st.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="p-2">
                  {editingId === st.id ? 
                    <input className="bg-black/50 border border-white/10 rounded px-2 py-1 w-full text-sm outline-none focus:border-neonPurple" value={editForm.name} onChange={e=>setEditForm({...editForm, name: e.target.value})} /> 
                    : st.name}
                </td>
                <td className="p-2">
                   {editingId === st.id ? 
                    <input className="bg-black/50 border border-white/10 rounded px-2 py-1 w-full text-sm outline-none focus:border-neonPurple text-center" value={editForm.enrollment} onChange={e=>setEditForm({...editForm, enrollment: e.target.value})} /> 
                    : <div className="text-center">{st.enrollment}</div>}
                </td>
                <td className="p-2">
                   {editingId === st.id ? 
                    <input className="bg-black/50 border border-white/10 rounded px-2 py-1 w-full text-sm outline-none focus:border-neonPurple text-center" value={editForm.branch} onChange={e=>setEditForm({...editForm, branch: e.target.value})} /> 
                    : <div className="text-center">{st.branch}</div>}
                </td>
                <td className="p-2 flex gap-3 justify-end items-center h-full">
                   {editingId === st.id ? (
                     <>
                      <button onClick={() => saveEdit(st.id)} className="text-neonGreen hover:text-green-400 transition-colors" title="Save"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-white transition-colors" title="Cancel"><X className="w-4 h-4" /></button>
                     </>
                   ) : (
                     <>
                      <button onClick={() => startEdit(st)} className="text-neonCyan hover:text-cyan-400 transition-colors" title="Edit"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(st.id)} className="text-red-400 hover:text-red-300 transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                     </>
                   )}
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr><td colSpan={4} className="text-center p-8 text-gray-500 text-sm">No students registered yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
