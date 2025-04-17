import React, { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import style from "./Home.module.css";
import ScannerScene from "./ScannerScene";
import { Link } from "react-router-dom";

gsap.registerPlugin(ScrollTrigger);

export default function Home() {
  const mainRef = useRef(null);
  const titleRef = useRef(null);
  const scannerRef = useRef(null);
  const featuresRef = useRef(null);
  const [isDarkMode, setIsDarkMode] = useState(
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  useEffect(() => {
    // Set initial theme
    document.documentElement.setAttribute(
      "data-theme",
      isDarkMode ? "dark" : "light"
    );

    // Listen for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e) => {
      setIsDarkMode(e.matches);
      document.documentElement.setAttribute(
        "data-theme",
        e.matches ? "dark" : "light"
      );
    };

    mediaQuery.addEventListener("change", handleChange);

    // Initial animation
    gsap.from(titleRef.current, {
      duration: 1.5,
      y: 100,
      opacity: 0,
      ease: "power4.out",
    });

    // Features animation
    const featureCards = gsap.utils.toArray(`.${style.featureCard}`);

    featureCards.forEach((card, index) => {
      gsap.from(card, {
        duration: 0.8,
        y: 50,
        opacity: 0,
        delay: index * 0.2,
        scrollTrigger: {
          trigger: card,
          start: "top 80%",
          toggleActions: "play none none reverse",
        },
        ease: "power2.out",
      });
    });

    // Cleanup
    return () => {
      gsap.killTweensOf([titleRef.current, featureCards]);
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [isDarkMode]);

  return (
    <div className={style.homeContainer} ref={mainRef}>
      {/* Hero Section */}
      <section className={style.heroSection}>
        <div className={style.heroContent}>
          <h1 ref={titleRef} className={style.mainTitle}>
            <span className={style.highlight}>Moktashif</span>
            <br />
            Automated Vulnerability Scanner
          </h1>
          <p className={style.subtitle}>
            Advanced web-based security scanning for modern websites
          </p>
          <div className={style.scannerVisual}>
            <ScannerScene />
          </div>
        </div>
      </section>


      {/* CTA Section */}
      <section className={style.ctaSection}>
        <h2>Ready to Secure Your Website?</h2>
        <Link to="/scanner" className={style.ctaButton}>
          <span className={style.buttonText}>Start Scanning Now</span>
          <span className={style.buttonIcon}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M5 12H19"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12 5L19 12L12 19"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className={style.buttonGlow}></span>
        </Link>
      </section>

      {/* Features Section */}
      <section className={style.featuresSection}>
        <h2 className={style.sectionTitle}>Key Features</h2>
        <div className={style.featuresGrid} ref={featuresRef}>
          <div className={style.featureCard}>
            <div className={style.featureIcon}>🔍</div>
            <h3>Comprehensive Scanning</h3>
            <p>Deep analysis of websites</p>
          </div>
          <div className={style.featureCard}>
            <div className={style.featureIcon}>🛡️</div>
            <h3>Real-time Protection</h3>
            <p>Instant vulnerability detection and alerts</p>
          </div>
          <div className={style.featureCard}>
            <div className={style.featureIcon}>📊</div>
            <h3>Detailed Reports</h3>
            <p>Comprehensive security assessment reports</p>
          </div>
          <div className={style.featureCard}>
            <div className={style.featureIcon}>⚡</div>
            <h3>Fast & Efficient</h3>
            <p>Quick scanning with minimal system impact</p>
          </div>
        </div>
      </section>


    </div>
  );
}
