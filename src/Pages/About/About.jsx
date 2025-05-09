import React from 'react';
import styles from './About.module.css';
import { Link } from 'react-router-dom';

const About = () => {
    return (
        <div className={styles.aboutContainer}>
            <div className={styles.animatedBg}></div>
            <div className={styles.aboutContent}>
                <h1 className={styles.title}>
                    <span className={styles.logoGlow}>Moktashif</span> <span className={styles.scanIcon}>🔍</span>
                </h1>
                <div className={styles.heroSection}>
                    <div className={styles.heroText}>
                        <p className={styles.intro}>
                            <span className={styles.highlight}>Moktashif</span> is your AI-powered cybersecurity companion, scanning websites for vulnerabilities using advanced security tools and artificial intelligence. Get comprehensive, actionable insights to secure your digital presence.
                        </p>
                        <div className={styles.heroAnim}>
                            <span className={styles.scanPulse}></span>
                            <span className={styles.shieldAnim}>🛡️</span>
                        </div>
                    </div>
                </div>
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>How Moktashif Works</h2>
                    <div className={styles.stepsGrid}>
                        <div className={styles.stepCard}>
                            <div className={styles.stepIcon}>🌐</div>
                            <h3>Website Scanning</h3>
                            <p>Enter your website URL and Moktashif will scan it using industry-leading security tools and AI algorithms.</p>
                        </div>
                        <div className={styles.stepCard}>
                            <div className={styles.stepIcon}>🤖</div>
                            <h3>AI Analysis</h3>
                            <p>Our AI engine analyzes findings, classifies vulnerabilities, and assesses risk levels for each issue detected.</p>
                        </div>
                        <div className={styles.stepCard}>
                            <div className={styles.stepIcon}>📝</div>
                            <h3>Detailed Reporting</h3>
                            <p>Receive a detailed PDF report with descriptions, remediation steps, vulnerability types, and risk levels.</p>
                        </div>
                        <div className={styles.stepCard}>
                            <div className={styles.stepIcon}>🔒</div>
                            <h3>Actionable Remediation</h3>
                            <p>Get clear, actionable recommendations to fix vulnerabilities and strengthen your website security.</p>
                        </div>
                    </div>
                </div>
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>Key Features</h2>
                    <ul className={styles.featuresList}>
                        <li><span className={styles.featureIcon}>⚡</span> Fast, automated vulnerability scanning</li>
                        <li><span className={styles.featureIcon}>🧠</span> AI-driven risk assessment</li>
                        <li><span className={styles.featureIcon}>📄</span> Comprehensive PDF reports</li>
                        <li><span className={styles.featureIcon}>🔍</span> Detailed descriptions & remediation</li>
                        <li><span className={styles.featureIcon}>🌈</span> Stunning, interactive dashboard</li>
                        <li><span className={styles.featureIcon}>🔐</span> Privacy-focused & secure</li>
                    </ul>
                </div>
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>Our Mission</h2>
                    <p className={styles.paragraph}>
                        Moktashif empowers organizations and individuals to proactively secure their websites. Our mission is to make advanced cybersecurity accessible, understandable, and actionable for everyone.
                    </p>
                </div>
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>Ready to Secure Your Website?</h2>
                    <div className={styles.ctaWrapper}>
                        <Link to={'/scanner'} className={styles.ctaButton}>
                            Start Scanning <span className={styles.ctaArrow}>→</span>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default About; 