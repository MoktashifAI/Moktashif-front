import React, { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Float, useVideoTexture } from '@react-three/drei';
import './PcShowcaseSection.css';

const VIDEO_URL = 'https://res.cloudinary.com/dnsne0e82/video/upload/v1748289737/Moktashef/USERS/20250526-2057-11.0419378_nebxut.mp4'; // Placeholder video

function PlaceholderRetroPC({ videoUrl, ...props }) {
    // Always call the hook
    const videoTexture = useVideoTexture(videoUrl, { muted: true, loop: true, start: true });
    // Animate the power button color
    const powerButtonRef = useRef();
    useFrame(({ clock }) => {
        if (powerButtonRef.current) {
            powerButtonRef.current.material.emissiveIntensity = 0.5 + Math.sin(clock.getElapsedTime() * 2) * 0.5;
        }
    });

    // Fixed gray colors
    const monitorColor = '#e0e0e3';
    const screenColor = '#23263a';
    const standColor = '#b0b0b3';
    const keyboardColor = '#e0e0e3';
    const key1Color = '#e74c3c';
    const key2Color = '#2980b9';
    const shadowColor = '#23263a';

    return (
        <group {...props}>
            {/* Monitor */}
            <mesh position={[0, 0.5, 0]} castShadow>
                <boxGeometry args={[1.6, 1, 0.4]} />
                <meshStandardMaterial color={monitorColor} metalness={0.5} roughness={0.3} />
            </mesh>
            {/* Screen with video or fallback color */}
            <mesh position={[0, 0.5, 0.23]}>
                <boxGeometry args={[1.3, 0.7, 0.05]} />
                {videoTexture?.image ? (
                    <meshBasicMaterial map={videoTexture} toneMapped={false} />
                ) : (
                    <meshStandardMaterial
                        color={screenColor}
                        metalness={0.2}
                        roughness={0.6}
                        emissive="#7eb6ff"
                        emissiveIntensity={0.18}
                    />
                )}
            </mesh>
            {/* Stand */}
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[0.5, 0.1, 0.3]} />
                <meshStandardMaterial color={standColor} />
            </mesh>
            {/* Keyboard */}
            <mesh position={[0, -0.35, 0.25]}>
                <boxGeometry args={[1.4, 0.15, 0.5]} />
                <meshStandardMaterial color={keyboardColor} />
            </mesh>
            {/* Keys */}
            <mesh position={[-0.4, -0.32, 0.45]}>
                <boxGeometry args={[0.5, 0.05, 0.1]} />
                <meshStandardMaterial color={key1Color} />
            </mesh>
            <mesh position={[0.3, -0.32, 0.45]}>
                <boxGeometry args={[0.5, 0.05, 0.1]} />
                <meshStandardMaterial color={key2Color} />
            </mesh>
            {/* Power button (animated) */}
            <mesh ref={powerButtonRef} position={[0.7, 0.9, 0.23]}>
                <cylinderGeometry args={[0.03, 0.03, 0.02, 32]} />
                <meshStandardMaterial color="#7eb6ff" emissive="#7eb6ff" emissiveIntensity={1} />
            </mesh>
            {/* Shadow */}
            <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <cylinderGeometry args={[0.9, 1.1, 0.08, 32]} />
                <meshStandardMaterial color={shadowColor} transparent opacity={0.18} />
            </mesh>
        </group>
    );
}

export default function PcShowcaseSection() {
    return (
        <section className="pc-showcase-section">
            <div className="pc-showcase-inner">
                {/* Left: 3D Animated Placeholder PC with Video */}
                <div className="pc-illustration-col">
                    <div className="pc-3d-wrapper">
                        <Canvas camera={{ position: [0, 1.2, 3.2], fov: 40 }} style={{ width: '420px', height: '340px', background: 'transparent' }} shadows>
                            <ambientLight intensity={0.7} />
                            <directionalLight position={[2, 4, 2]} intensity={0.7} castShadow />
                            <Suspense fallback={null}>
                                <Float floatIntensity={0.25} rotationIntensity={0.2} speed={1.2}>
                                    <PlaceholderRetroPC scale={1.2} videoUrl={VIDEO_URL} />
                                </Float>
                            </Suspense>
                            <OrbitControls enablePan={false} enableZoom={false} autoRotate={false} />
                        </Canvas>
                    </div>
                </div>
                {/* Right: Description */}
                <div className="pc-description-col">
                    <h2 className="pc-section-title">Your Personal Security Dashboard</h2>
                    <p className="pc-section-desc">
                        Explore Moktashif's features as if you were using it on your own device. Watch as the journey flows from landing to scanning, results, and analytics—showcasing how Moktashif empowers you to secure your digital world with ease and confidence.
                    </p>
                </div>
            </div>
        </section>
    );
} 