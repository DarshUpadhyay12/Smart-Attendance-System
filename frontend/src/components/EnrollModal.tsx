import { useState, useEffect } from 'react';
import { UserPlus } from 'lucide-react';
import { useWebRTC } from '../hooks/useWebRTC';
import { API_BASE_URL } from '../config';

export function EnrollModal() {
  const [formData, setFormData] = useState({ name: '', enrollment: '', branch: '' });
  const [status, setStatus] = useState<{ type: 'error' | 'success', msg: string } | null>(null);
  const { videoRef, isStreaming, startStream, stopStream, error } = useWebRTC();

  useEffect(() => {
    // Ensure we stop the camera when this component unmounts (user switches tabs)
    return () => {
      stopStream();
    };
  }, [stopStream]);

  const handleCapture = async () => {
    if (!videoRef.current) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(videoRef.current, 0, 0);
    const imageBase64 = canvas.toDataURL('image/jpeg');

    try {
      const res = await fetch(`${API_BASE_URL}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, image_base64: imageBase64 })
      });
      const data = await res.json();
      
      if (data.status === 'success') {
        setStatus({ type: 'success', msg: data.message });
        setTimeout(() => {
          stopStream();
          setFormData({ name: '', enrollment: '', branch: '' });
          setStatus(null);
        }, 2000);
      } else {
        setStatus({ type: 'error', msg: data.message });
      }
    } catch (e) {
      setStatus({ type: 'error', msg: 'Failed to communicate with server.' });
    }
  };

  const handleOpenStream = () => {
    if (!formData.name || !formData.enrollment) {
      setStatus({ type: 'error', msg: 'Name and Enrollment required.' });
      return;
    }
    setStatus(null);
    startStream();
  };

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center justify-center gap-2">
        <UserPlus className="text-neonPurple" /> Register New Student
      </h2>

      <div className={`space-y-4 ${!isStreaming ? 'block' : 'hidden'}`}>
        <div>
          <label className="text-sm text-gray-400">Full Name</label>
          <input type="text" className="w-full bg-black/50 border border-white/10 rounded p-2 text-white outline-none focus:border-neonPurple" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
        </div>
        <div>
          <label className="text-sm text-gray-400">Enrollment Number</label>
          <input type="text" className="w-full bg-black/50 border border-white/10 rounded p-2 text-white outline-none focus:border-neonPurple" value={formData.enrollment} onChange={e => setFormData({...formData, enrollment: e.target.value})} />
        </div>
        <div>
          <label className="text-sm text-gray-400">Branch / Major</label>
          <input type="text" className="w-full bg-black/50 border border-white/10 rounded p-2 text-white outline-none focus:border-neonPurple" value={formData.branch} onChange={e => setFormData({...formData, branch: e.target.value})} />
        </div>
        
        {status && <div className={`text-sm p-2 rounded ${status.type === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-neonGreen/20 text-neonGreen'}`}>{status.msg}</div>}

        <button onClick={handleOpenStream} className="w-full py-2 bg-neonPurple hover:bg-neonPurple/80 text-white rounded font-medium transition-colors">
          Continue to Face Capture
        </button>
      </div>

      <div className={`space-y-4 flex flex-col items-center ${isStreaming ? 'flex' : 'hidden'}`}>
        <div className="w-full aspect-video bg-black rounded-lg overflow-hidden relative border border-white/10 shadow-inner">
           {error ? (
              <div className="text-red-400 text-sm text-center p-4 absolute inset-0 flex items-center justify-center">{error}</div>
           ) : (
              <video ref={videoRef} className="absolute top-0 left-0 w-full h-full object-cover scale-x-[-1]" autoPlay muted playsInline />
           )}
        </div>
        <p className="text-sm text-gray-400">Look directly into the camera.</p>
        {status && <div className={`text-sm p-2 rounded w-full text-center ${status.type === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-neonGreen/20 text-neonGreen'}`}>{status.msg}</div>}
        
        <div className="flex gap-2 w-full">
          <button onClick={() => stopStream()} className="flex-1 py-2 bg-gray-500/20 text-gray-300 hover:bg-gray-500/40 rounded font-medium transition-colors">
            Cancel
          </button>
          <button 
            onClick={handleCapture} 
            disabled={!!error}
            className="flex-1 py-2 bg-neonGreen/20 text-neonGreen border border-neonGreen hover:bg-neonGreen/30 rounded font-medium transition-colors disabled:opacity-50"
          >
            Capture & Enroll
          </button>
        </div>
      </div>
    </div>
  );
}
