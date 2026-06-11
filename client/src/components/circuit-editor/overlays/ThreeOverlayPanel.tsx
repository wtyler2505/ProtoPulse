import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useRef } from 'react';
import type { Mesh } from 'three';

function RotatingBoard() {
  const meshRef = useRef<Mesh | null>(null);
  useFrame((_state, delta) => {
    if (!meshRef.current) {
      return;
    }
    meshRef.current.rotation.y += delta * 0.75;
    meshRef.current.rotation.x += delta * 0.25;
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <boxGeometry args={[2.6, 0.12, 1.8]} />
      <meshStandardMaterial color="#34d399" roughness={0.5} metalness={0.1} />
    </mesh>
  );
}

export default function ThreeOverlayPanel() {
  if (import.meta.env.MODE === 'test') {
    return (
      <div
        className="mt-2 h-44 rounded border border-dashed border-cyan-400/40 bg-cyan-400/5"
        data-testid="tscircuit-three-overlay"
      />
    );
  }

  return (
    <div
      className="mt-2 h-44 overflow-hidden rounded border border-dashed border-cyan-400/40 bg-cyan-400/5"
      data-testid="tscircuit-three-overlay"
    >
      <Canvas camera={{ position: [0, 1.4, 4.5], fov: 48 }}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 3, 2]} intensity={1.1} />
        <RotatingBoard />
        <OrbitControls enablePan={false} />
      </Canvas>
    </div>
  );
}
