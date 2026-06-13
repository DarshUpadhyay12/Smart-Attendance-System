import { useState, useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { ParticleSphere } from './components/3d/ParticleSphere'
import { Camera, AlertCircle, UserCheck, UserPlus, Database, BarChart3 } from 'lucide-react'
import { useWebRTC } from './hooks/useWebRTC'
import { useAttendanceSocket } from './hooks/useAttendanceSocket'
import { EnrollModal } from './components/EnrollModal'
import { StudentManagement } from './components/StudentManagement'
import { AnalyticsDashboard } from './components/AnalyticsDashboard'

function App() {
  const [isScanning, setIsScanning] = useState(false)
  const [activeTab, setActiveTab] = useState<'attendance' | 'enroll' | 'manage' | 'analytics'>('attendance')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const { videoRef, isStreaming, startStream, stopStream, error } = useWebRTC()
  const { isConnected, sendFrame, lastMessage } = useAttendanceSocket()
  const captureCanvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (isScanning) {
      startStream()
    } else {
      stopStream()
    }
    return () => stopStream()
  }, [isScanning, startStream, stopStream])

  useEffect(() => {
    let animationFrameId: number;

    const captureFrame = () => {
      if (isScanning && isStreaming && isConnected && videoRef.current && captureCanvasRef.current) {
        const video = videoRef.current;
        const canvas = captureCanvasRef.current;
        
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        const ctx = canvas.getContext('2d');
        if (ctx && video.videoWidth > 0) {
          // Draw video on hidden canvas to extract base64 frame
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const base64Frame = canvas.toDataURL('image/jpeg', 0.5);
          sendFrame(base64Frame);
        }
      }
      
      setTimeout(() => {
        animationFrameId = requestAnimationFrame(captureFrame);
      }, 100); // ~10 FPS
    };

    if (isScanning && isStreaming) {
      captureFrame();
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isScanning, isStreaming, isConnected, sendFrame, videoRef]);

  // Handle Box Overlay rendering from WebSocket metadata
  useEffect(() => {
    if (!lastMessage || !overlayCanvasRef.current || !videoRef.current) return;
    
    try {
      const data = JSON.parse(lastMessage);
      const canvas = overlayCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx || !isStreaming) return;
      
      // Sync overlay dimensions with the video dimensions to align boxes
      canvas.width = videoRef.current.offsetWidth;
      canvas.height = videoRef.current.offsetHeight;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (data.status === 'identifying' && data.faces) {
        const videoWidth = videoRef.current.videoWidth;
        const videoHeight = videoRef.current.videoHeight;
        const scaleX = canvas.width / videoWidth;
        const scaleY = canvas.height / videoHeight;

        data.faces.forEach((face: any) => {
          // Scale coordinates from original frame size to UI display size
          const x = face.box.x * scaleX;
          const y = face.box.y * scaleY;
          const w = face.box.w * scaleX;
          const h = face.box.h * scaleY;

          const isKnown = face.type === 'known';
          const isLive = face.box.is_live !== false; // handle legacy or missing data gracefully
          
          if (face.just_marked) {
            setIsScanning(false);
            setSuccessMessage(`Attendance successfully marked for ${face.student.name}`);
            setTimeout(() => setSuccessMessage(null), 5000);
          }
          
          // Determine Box Color Based on Liveness and Known State
          let boxColor = '#ff3333'; // Default Red (Unknown)
          if (isKnown && isLive) boxColor = '#39ff14'; // Green (Present & Live)
          else if (isKnown && !isLive) boxColor = '#FFA500'; // Orange (Spoof Detected)
          
          // Draw Box
          ctx.lineJoin = "round";
          ctx.lineWidth = 3;
          ctx.strokeStyle = boxColor;
          
          // Fix mirroring logic (UI video is scale-x: -1, so we flip the X bounds of the box)
          ctx.strokeRect(canvas.width - x - w, y, w, h);
          
          // Draw Label Bg
          ctx.fillStyle = boxColor;
          const labelHeight = 38; 
          ctx.fillRect(canvas.width - x - w, y - labelHeight, isKnown ? 160 : 100, labelHeight);
          
          // Draw Label Text
          ctx.fillStyle = '#000000';
          ctx.font = "bold 12px sans-serif";
          if (isKnown && isLive) {
             ctx.fillText(face.student.name, canvas.width - x - w + 6, y - 22);
             ctx.fillText(`Conf: ${face.confidence}%`, canvas.width - x - w + 6, y - 6);
          } else if (isKnown && !isLive) {
             ctx.fillText(`[ SPOOF DETECTED ]`, canvas.width - x - w + 6, y - 22);
             ctx.fillText(`Liveness Failed`, canvas.width - x - w + 6, y - 6);
          } else {
             ctx.fillText('UNKNOWN', canvas.width - x - w + 6, y - 22);
             ctx.fillText('Unregistered', canvas.width - x - w + 6, y - 6);
          }
        });
      }
    } catch (e) {
      // Not JSON or parse error, ignore quietly
    }
  }, [lastMessage, isStreaming]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-dark flex flex-col">

      {/* Main UI Layout */}
      <div className="relative z-10 flex flex-col w-full h-full p-0 md:p-4 lg:p-8">
        
        {/* Main Application Container */}
        <div className="flex-1 flex flex-col items-center justify-center w-full h-full">
          <div className="glass-panel rounded-none md:rounded-2xl pt-4 px-4 pb-0 md:pt-6 md:px-6 md:pb-2 lg:pt-8 lg:px-8 w-full h-full md:h-auto md:max-h-full md:max-w-4xl flex flex-col items-center text-center shadow-[0_0_50px_rgba(176,38,255,0.15)] relative overflow-hidden">
            
            {/* 3D Background - perfectly bounded inside the panel */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-80">
              <Canvas camera={{ position: [0, 0, 5] }}>
                <ambientLight intensity={0.5} />
                <ParticleSphere isScanning={isScanning} />
              </Canvas>
            </div>

            {/* Responsive Scrollable Tabs */}
            <div className="flex bg-black/40 p-1 rounded-lg w-full mb-2 relative z-20 overflow-x-auto hide-scrollbar snap-x shrink-0">
              <button 
                className={`flex-none md:flex-1 px-4 py-3 md:py-2 text-sm font-semibold rounded-md transition-all outline-none snap-start whitespace-nowrap ${activeTab === 'attendance' ? 'bg-neonPurple text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                onClick={() => setActiveTab('attendance')}
              >
                <div className="flex items-center justify-center gap-2"><UserCheck className="w-4 h-4" /> Attendance</div>
              </button>
              <button 
                className={`flex-none md:flex-1 px-4 py-3 md:py-2 text-sm font-semibold rounded-md transition-all outline-none snap-start whitespace-nowrap ${activeTab === 'enroll' ? 'bg-neonPurple text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                onClick={() => { setActiveTab('enroll'); setIsScanning(false); }}
              >
                <div className="flex items-center justify-center gap-2"><UserPlus className="w-4 h-4" /> Registration</div>
              </button>
              <button 
                className={`flex-none md:flex-1 px-4 py-3 md:py-2 text-sm font-semibold rounded-md transition-all outline-none snap-start whitespace-nowrap ${activeTab === 'manage' ? 'bg-neonPurple text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                onClick={() => { setActiveTab('manage'); setIsScanning(false); }}
              >
                <div className="flex items-center justify-center gap-2"><Database className="w-4 h-4" /> Database</div>
              </button>
              <button 
                className={`flex-none md:flex-1 px-4 py-3 md:py-2 text-sm font-semibold rounded-md transition-all outline-none snap-start whitespace-nowrap ${activeTab === 'analytics' ? 'bg-neonPurple text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                onClick={() => { setActiveTab('analytics'); setIsScanning(false); }}
              >
                <div className="flex items-center justify-center gap-2"><BarChart3 className="w-4 h-4" /> Analytics</div>
              </button>
            </div>

            {/* Scrollable Content Wrapper */}
            <div className="w-full flex-1 overflow-y-auto custom-scrollbar flex flex-col items-center relative z-10 pt-4 pb-8 space-y-4 md:space-y-6">
              {activeTab === 'attendance' ? (
              <>
                <div className="flex items-center justify-center w-20 h-20 rounded-full bg-white/10 border border-white/20">
                  <Camera className={`w-10 h-10 ${isScanning ? 'text-neonGreen animate-pulse' : 'text-neonPurple'}`} />
                </div>
          
          <div className="relative w-full flex flex-col items-center">
            {successMessage && (
              <div className="mb-4 bg-neonGreen/20 border border-neonGreen text-neonGreen px-6 py-3 rounded-lg backdrop-blur-md font-bold shadow-[0_0_15px_rgba(57,255,20,0.5)] animate-bounce w-max z-50">
                {successMessage}
              </div>
            )}
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-neonPurple to-neonCyan">
              Smart Attendance
            </h1>
            <p className="text-gray-400 mt-2 text-sm">Biometric verification portal</p>
            <div className="mt-2 text-xs font-mono">
              {isConnected ? (
                <span className="text-neonGreen px-2 py-1 bg-neonGreen/10 rounded-full border border-neonGreen/30">● System Online</span>
              ) : (
                <span className="text-red-400 px-2 py-1 bg-red-500/10 rounded-full border border-red-500/30">○ Offline</span>
              )}
            </div>
            {lastMessage && (
              <p className="text-xs text-neonCyan mt-2 font-mono bg-black/30 w-max mx-auto px-2 py-1 rounded inline-block truncate max-w-[200px]">
                {lastMessage}
              </p>
            )}
          </div>

          <div className="w-full max-w-3xl mx-auto rounded-xl overflow-hidden bg-black/50 border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)] relative">
             <canvas ref={captureCanvasRef} className="hidden" />
             {error ? (
                <div className="flex flex-col items-center text-red-400 gap-2 p-10">
                  <AlertCircle className="w-8 h-8" />
                  <p className="text-sm">{error}</p>
                </div>
             ) : (
                <div className="relative w-full aspect-video">
                  <video 
                    ref={videoRef}
                    className={`absolute top-0 left-0 w-full h-full object-cover transition-opacity duration-500 scale-x-[-1] ${isStreaming ? 'opacity-100' : 'opacity-0'}`}
                    muted 
                    playsInline 
                  />
                  {!isStreaming && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 text-sm gap-3">
                      <Camera className="w-8 h-8 opacity-40" />
                      <span className="tracking-[0.2em] font-mono text-xs uppercase">[ System Ready ]</span>
                    </div>
                  )}
                  {/* Bounding Box Drawing Layer */}
                  <canvas 
                    ref={overlayCanvasRef} 
                    className="absolute inset-0 w-full h-full pointer-events-none z-20"
                  />
                  {isScanning && isStreaming && (
                    <div className="absolute inset-0 border-2 border-neonGreen/80 animate-[pulse_2s_ease-in-out_infinite] opacity-50 pointer-events-none rounded-xl z-30"></div>
                  )}
                </div>
             )}
          </div>

                <button 
                  onClick={() => setIsScanning(!isScanning)}
                  className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                    isScanning 
                    ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/50' 
                    : 'bg-neonPurple hover:bg-neonPurple/80 text-white shadow-[0_0_15px_rgba(176,38,255,0.5)]'
                  }`}
                >
                  {isScanning ? (
                    <>Stop Scan</>
                  ) : (
                    'Initiate Scan'
                  )}
                </button>
              </>
            ) : activeTab === 'enroll' ? (
              <EnrollModal />
            ) : activeTab === 'manage' ? (
              <StudentManagement />
            ) : (
              <AnalyticsDashboard />
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
