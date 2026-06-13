import { useState, useRef, useEffect } from 'react';
import { Camera, UserPlus, CheckCircle2, Loader2, RefreshCcw } from 'lucide-react';
import { useWebRTC } from '../hooks/useWebRTC';
import { API_BASE_URL } from '../config';

export function EnrollModal() {
  const [formData, setFormData] = useState({ name: '', enrollment: '', branch: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  
  const { videoRef, isStreaming, startStream, stopStream } = useWebRTC();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    startStream();
    return () => stopStream();
  }, [startStream, stopStream]);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(base64);
        stopStream();
      }
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startStream();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!capturedImage) {
      setError('Please capture a photo first.');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, image: capturedImage })
      });
      
      const data = await res.json();
      
      if (res.ok && data.status === 'success') {
        setSuccess(true);
        setFormData({ name: '', enrollment: '', branch: '' });
        setCapturedImage(null);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(data.detail || 'Enrollment failed');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto glass-panel p-8 rounded-2xl animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-center gap-3 mb-6">
        <UserPlus className="w-8 h-8 text-neonPurple" />
        <h2 className="text-2xl font-bold text-white">Student Registration</h2>
      </div>

      {success && (
        <div className="mb-6 bg-neonGreen/20 border border-neonGreen text-neonGreen p-4 rounded-lg flex items-center justify-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          <p className="font-semibold">Student enrolled successfully!</p>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-500/20 border border-red-500 text-red-400 p-4 rounded-lg text-center text-sm font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Full Name</label>
              <input 
                required
                type="text" 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-neonPurple focus:ring-1 focus:ring-neonPurple transition-all"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Enrollment No.</label>
              <input 
                required
                type="text" 
                value={formData.enrollment}
                onChange={(e) => setFormData({...formData, enrollment: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-neonPurple focus:ring-1 focus:ring-neonPurple transition-all"
                placeholder="ENR123456"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Branch/Department</label>
              <input 
                required
                type="text" 
                value={formData.branch}
                onChange={(e) => setFormData({...formData, branch: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-neonPurple focus:ring-1 focus:ring-neonPurple transition-all"
                placeholder="Computer Science"
              />
            </div>
          </div>

          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-black/60 border-2 border-dashed border-white/20 flex flex-col items-center justify-center group">
              {capturedImage ? (
                <>
                  <img src={capturedImage} alt="Captured" className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />
                  <button type="button" onClick={retakePhoto} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-2">
                    <RefreshCcw className="w-8 h-8" />
                    <span>Retake Photo</span>
                  </button>
                </>
              ) : (
                <>
                  <video 
                    ref={videoRef} 
                    className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] ${isStreaming ? 'opacity-100' : 'opacity-0'}`}
                    muted playsInline 
                  />
                  {!isStreaming && <Camera className="w-10 h-10 text-gray-500 animate-pulse" />}
                  <canvas ref={canvasRef} className="hidden" />
                </>
              )}
            </div>
            {!capturedImage && (
              <button 
                type="button" 
                onClick={handleCapture}
                disabled={!isStreaming}
                className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white rounded-lg transition-colors border border-white/10 flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" /> Capture Face
              </button>
            )}
          </div>
        </div>

        <button 
          type="submit" 
          disabled={isSubmitting || !capturedImage}
          className="w-full py-3.5 px-6 bg-gradient-to-r from-neonPurple to-neonCyan text-white font-bold rounded-lg shadow-[0_0_15px_rgba(176,38,255,0.4)] hover:shadow-[0_0_25px_rgba(57,255,20,0.4)] hover:from-neonCyan hover:to-neonGreen transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</> : 'Complete Registration'}
        </button>
      </form>
    </div>
  );
}
