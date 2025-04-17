import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";

function ScanningCube() {
  const cubeRef = useRef();
  const wireframeRef = useRef();

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    cubeRef.current.rotation.y = t * 0.5;
    wireframeRef.current.rotation.y = t * 0.5;
  });

  return (
    <group>
      {/* Main Cube */}
      <mesh ref={cubeRef} position={[0, 0, 0]}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial
          color="#636E97"
          transparent
          opacity={0.5}
          metalness={0.5}
          roughness={0.2}
        />
      </mesh>

      {/* Wireframe Cube */}
      <mesh ref={wireframeRef} position={[0, 0, 0]}>
        <boxGeometry args={[2.1, 2.1, 2.1]} />
        <meshBasicMaterial
          color="#636E97"
          wireframe
          transparent
          opacity={0.8}
        />
      </mesh>
    </group>
  );
}

function ScannerBeam() {
  const beamRef = useRef();

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    beamRef.current.position.y = Math.sin(t * 2) * 1.5;
  });

  return (
    <mesh ref={beamRef} position={[0, 0, 0]}>
      <boxGeometry args={[3, 0.1, 0.1]} />
      <meshStandardMaterial
        color="#636E97"
        emissive="#636E97"
        emissiveIntensity={1}
      />
    </mesh>
  );
}

function ScanningGrid() {
  const gridRef = useRef();

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    gridRef.current.position.y = Math.sin(t * 0.5) * 0.2;
  });

  return (
    <mesh ref={gridRef} position={[0, 0, 0]}>
      <gridHelper
        args={[5, 20, "#636E97", "#636E97"]}
        rotation={[Math.PI / 2, 0, 0]}
      />
    </mesh>
  );
}

export default function ScannerScene() {
  return (
    <div style={{ width: "100%", height: "400px" }}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
        <pointLight position={[-10, -10, -10]} />

        <ScanningCube />
        <ScannerBeam />
        <ScanningGrid />

        <Environment preset="city" />
        <OrbitControls enableZoom={false} />
      </Canvas>
    </div>
  );
}
