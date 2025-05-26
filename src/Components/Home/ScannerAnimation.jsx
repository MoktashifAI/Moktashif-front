import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { motion } from 'framer-motion';

const ScannerAnimation = () => {
    const containerRef = useRef(null);
    const sceneRef = useRef(null);
    const rendererRef = useRef(null);
    const cameraRef = useRef(null);
    const particlesRef = useRef([]);
    const scanLineRef = useRef(null);
    const clockRef = useRef(new THREE.Clock());
    const [isDarkMode, setIsDarkMode] = useState(
        document.documentElement.getAttribute('data-theme') === 'dark'
    );

    // Listen for theme changes
    useEffect(() => {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'data-theme') {
                    const newTheme = document.documentElement.getAttribute('data-theme');
                    setIsDarkMode(newTheme === 'dark');

                    // Update particle colors
                    if (particlesRef.current.length > 0) {
                        const newColor = newTheme === 'dark' ? 0x8B95B9 : 0x636E97;
                        particlesRef.current.forEach(particle => {
                            particle.material.color.setHex(newColor);
                        });
                    }

                    // Update scan line color
                    if (scanLineRef.current) {
                        const newColor = newTheme === 'dark' ? 0x636E97 : 0x8B95B9;
                        scanLineRef.current.material.color.setHex(newColor);
                    }
                }
            });
        });

        observer.observe(document.documentElement, { attributes: true });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!containerRef.current) return;

        // Scene setup
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        // Camera setup
        const camera = new THREE.PerspectiveCamera(
            75,
            containerRef.current.clientWidth / containerRef.current.clientHeight,
            0.1,
            1000
        );
        camera.position.z = 5;
        cameraRef.current = camera;

        // Renderer setup
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        renderer.setClearColor(0x000000, 0);
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Create particles
        const particleGeometry = new THREE.SphereGeometry(0.02, 8, 8);
        const particleMaterial = new THREE.MeshBasicMaterial({
            color: isDarkMode ? 0x8B95B9 : 0x636E97,
            transparent: true,
            opacity: 0.6
        });

        // Create a grid of particles
        for (let i = 0; i < 100; i++) {
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            particle.position.x = (Math.random() - 0.5) * 8;
            particle.position.y = (Math.random() - 0.5) * 8;
            particle.position.z = (Math.random() - 0.5) * 8;
            particle.userData = {
                originalY: particle.position.y,
                speed: Math.random() * 0.5 + 0.5,
                phase: Math.random() * Math.PI * 2
            };
            scene.add(particle);
            particlesRef.current.push(particle);
        }

        // Create scan line
        const scanLineGeometry = new THREE.PlaneGeometry(8, 0.1);
        const scanLineMaterial = new THREE.MeshBasicMaterial({
            color: isDarkMode ? 0x636E97 : 0x8B95B9,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        const scanLine = new THREE.Mesh(scanLineGeometry, scanLineMaterial);
        scanLine.position.z = 0;
        scene.add(scanLine);
        scanLineRef.current = scanLine;

        // Handle resize
        const handleResize = () => {
            if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;

            cameraRef.current.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        };

        window.addEventListener('resize', handleResize);

        // Animation loop
        const animate = () => {
            if (!sceneRef.current || !cameraRef.current || !rendererRef.current) return;

            const delta = clockRef.current.getDelta();
            const time = clockRef.current.getElapsedTime();

            // Animate particles
            particlesRef.current.forEach(particle => {
                particle.position.y = particle.userData.originalY +
                    Math.sin(time * particle.userData.speed + particle.userData.phase) * 0.2;
                particle.rotation.x += delta * 0.5;
                particle.rotation.y += delta * 0.5;
            });

            // Animate scan line
            if (scanLineRef.current) {
                scanLineRef.current.position.y = Math.sin(time * 2) * 3;
                scanLineRef.current.material.opacity = 0.3 + Math.sin(time * 4) * 0.1;
            }

            // Rotate scene
            scene.rotation.y += delta * 0.2;

            rendererRef.current.render(sceneRef.current, cameraRef.current);
            requestAnimationFrame(animate);
        };

        animate();

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            if (containerRef.current && rendererRef.current) {
                containerRef.current.removeChild(rendererRef.current.domElement);
            }
            particlesRef.current.forEach(particle => {
                scene.remove(particle);
                particle.geometry.dispose();
                particle.material.dispose();
            });
            if (scanLineRef.current) {
                scene.remove(scanLineRef.current);
                scanLineRef.current.geometry.dispose();
                scanLineRef.current.material.dispose();
            }
            rendererRef.current?.dispose();
        };
    }, [isDarkMode]);

    return (
        <motion.div
            ref={containerRef}
            className="scanner-animation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '20px',
                background: `linear-gradient(135deg, 
          ${isDarkMode ? 'rgba(139, 149, 185, 0.1)' : 'rgba(99, 110, 151, 0.1)'}, 
          ${isDarkMode ? 'rgba(99, 110, 151, 0.1)' : 'rgba(139, 149, 185, 0.1)'})`,
                transition: 'var(--theme_transition)'
            }}
        />
    );
};

export default ScannerAnimation; 