import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { gsap } from 'gsap';

export default function CyberBackground() {
  const containerRef = useRef(null);
  const themeRef = useRef(document.documentElement.getAttribute('data-theme') || 'light');

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, containerRef.current.offsetWidth / containerRef.current.offsetHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    
    renderer.setSize(containerRef.current.offsetWidth, containerRef.current.offsetHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);

    // Create particles
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 2000;
    const posArray = new Float32Array(particlesCount * 3);
    
    for(let i = 0; i < particlesCount * 3; i++) {
      posArray[i] = (Math.random() - 0.5) * 5;
    }
    
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

    // Create material based on theme
    const updateMaterialColor = () => {
      const theme = document.documentElement.getAttribute('data-theme') || 'light';
      const color = theme === 'dark' ? '#636e97' : '#5c6bc0';
      return new THREE.PointsMaterial({
        size: 0.005,
        color: color,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
      });
    };

    let particlesMaterial = updateMaterialColor();
    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);

    // Add scanning effect
    const scanningGeometry = new THREE.RingGeometry(0.2, 0.3, 32);
    const scanningMaterial = new THREE.MeshBasicMaterial({
      color: '#636e97',
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    });
    const scanningRing = new THREE.Mesh(scanningGeometry, scanningMaterial);
    scene.add(scanningRing);

    // Camera position
    camera.position.z = 2;

    // Animation
    const clock = new THREE.Clock();

    // GSAP animations
    gsap.to(scanningRing.scale, {
      x: 10,
      y: 10,
      z: 10,
      duration: 2,
      repeat: -1,
      ease: "power1.out",
      yoyo: true
    });

    gsap.to(scanningRing.material, {
      opacity: 0,
      duration: 2,
      repeat: -1,
      ease: "power1.out",
      yoyo: true
    });

    // Theme observer
    const themeObserver = new MutationObserver(() => {
      const newTheme = document.documentElement.getAttribute('data-theme') || 'light';
      if (themeRef.current !== newTheme) {
        themeRef.current = newTheme;
        particlesMesh.material = updateMaterialColor();
      }
    });

    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    // Animation loop
    const animate = () => {
      const elapsedTime = clock.getElapsedTime();
      
      particlesMesh.rotation.y = elapsedTime * 0.1;
      scanningRing.rotation.x = elapsedTime * 0.5;
      scanningRing.rotation.y = elapsedTime * 0.7;
      
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return;
      camera.aspect = containerRef.current.offsetWidth / containerRef.current.offsetHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.offsetWidth, containerRef.current.offsetHeight);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
      window.removeEventListener('resize', handleResize);
      themeObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        opacity: 0.7,
      }}
    />
  );
} 