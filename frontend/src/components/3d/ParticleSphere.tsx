import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function ParticleSphere({ isScanning }: { isScanning: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);

  // Generate random points on a sphere
  const particlesCount = 2000;
  const positions = new Float32Array(particlesCount * 3);
  
  for(let i = 0; i < particlesCount * 3; i+=3) {
    // Math to spread points on a sphere
    const r = 2.5;
    const theta = 2 * Math.PI * Math.random();
    const phi = Math.acos(2 * Math.random() - 1);
    
    positions[i] = r * Math.sin(phi) * Math.cos(theta);
    positions[i+1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i+2] = r * Math.cos(phi);
  }

  useFrame((state, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * (isScanning ? 0.5 : 0.05);
      pointsRef.current.rotation.x += delta * (isScanning ? 0.2 : 0.02);
      
      if (isScanning) {
        const material = pointsRef.current.material as THREE.PointsMaterial;
        // Pulse color
        const s = Math.sin(state.clock.elapsedTime * 5) * 0.5 + 0.5;
        material.color.setHSL(0.3 + (s * 0.1), 1, 0.5); // Green-ish pulse
      } else {
        const material = pointsRef.current.material as THREE.PointsMaterial;
        material.color.setHex(0xb026ff); // neon purple
      }
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particlesCount}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial 
        size={0.02} 
        color="#b026ff" 
        transparent 
        opacity={0.6}
        sizeAttenuation 
      />
    </points>
  );
}
