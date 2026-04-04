import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface ParticleSphereProps {
  isScanning: boolean;
}

export function ParticleSphere({ isScanning }: ParticleSphereProps) {
  const pointsRef = useRef<THREE.Points>(null!)
  
  const particleCount = 2000
  const positions = useMemo(() => {
    const pos = new Float32Array(particleCount * 3)
    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * 2 * Math.PI
      const phi = Math.acos(Math.random() * 2 - 1)
      const r = 2.5 + Math.random() * 0.8
      
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      pos[i * 3 + 2] = r * Math.cos(phi)
    }
    return pos
  }, [particleCount])

  useFrame((_, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y -= delta * (isScanning ? 0.8 : 0.1)
      pointsRef.current.rotation.x -= delta * 0.05
    }
  })

  const color = isScanning ? "#39ff14" : "#b026ff" // Neon Green vs Neon Purple

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.03} color={color} transparent opacity={0.7} sizeAttenuation={true} />
    </points>
  )
}
