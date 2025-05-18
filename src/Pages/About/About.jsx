import React from 'react';
import styles from './About.module.css';
import { Link } from 'react-router-dom';
import { FaSearch, FaShieldAlt, FaGlobe, FaRobot, FaFileAlt, FaLock, FaBolt, FaBrain, FaChartLine, FaUserShield, FaRegFilePdf, FaCheckCircle, FaChartPie, FaArrowRight } from 'react-icons/fa';

const About = () => {
    return (
        <div className={styles.aboutContainer}>
            <div className={styles.animatedBg}></div>
            <div className={styles.aboutContent}>
                <h1 className={styles.title}>
                    <span className={styles.logoGlow}>Moktashif</span> <FaSearch className={styles.scanIcon} />
                </h1>
                <div className={styles.heroSection}>
                    <div className={styles.heroText}>
                        <p className={styles.intro}>
                            <span className={styles.highlight}>Moktashif</span> is your AI-powered cybersecurity companion, scanning websites for vulnerabilities using advanced security tools and artificial intelligence. Get comprehensive, actionable insights to secure your digital presence.
                        </p>
                        <div className={styles.heroAnim}>
                            <span className={styles.scanPulse}></span>
                            <FaShieldAlt className={styles.shieldAnim} />
                        </div>
                    </div>
                </div>
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>How Moktashif Works</h2>
                    <div className={styles.stepsGrid}>
                        <div className={styles.stepCard}>
                            <FaGlobe className={styles.stepIcon} />
                            <h3>Website Scanning</h3>
                            <p>Enter your website URL and Moktashif will scan it using industry-leading security tools and AI algorithms.</p>
                        </div>
                        <div className={styles.stepCard}>
                            <FaRobot className={styles.stepIcon} />
                            <h3>AI Analysis</h3>
                            <p>Our AI engine analyzes findings, classifies vulnerabilities, and assesses risk levels for each issue detected.</p>
                        </div>
                        <div className={styles.stepCard}>
                            <FaRegFilePdf className={styles.stepIcon} />
                            <h3>Detailed Reporting</h3>
                            <p>Receive a detailed PDF report with descriptions, remediation steps, vulnerability types, and risk levels.</p>
                        </div>
                        <div className={styles.stepCard}>
                            <FaLock className={styles.stepIcon} />
                            <h3>Actionable Remediation</h3>
                            <p>Get clear, actionable recommendations to fix vulnerabilities and strengthen your website security.</p>
                        </div>
                    </div>
                </div>
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>Key Features</h2>
                    <ul className={styles.featuresList}>
                        <li><FaBolt className={styles.featureIcon} /> Fast, automated vulnerability scanning</li>
                        <li><FaBrain className={styles.featureIcon} /> AI-driven risk assessment</li>
                        <li><FaChartLine className={styles.featureIcon} /> Comprehensive PDF reports</li>
                        <li><FaSearch className={styles.featureIcon} /> Detailed descriptions & remediation</li>
                        <li><FaChartPie className={styles.featureIcon} /> Stunning, interactive dashboard</li>
                        <li><FaUserShield className={styles.featureIcon} /> Privacy-focused & secure</li>
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
                            Start Scanning <FaArrowRight className={styles.ctaArrow} />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default About; 