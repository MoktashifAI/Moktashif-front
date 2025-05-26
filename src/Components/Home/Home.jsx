import React, { useEffect, useRef, useState, useLayoutEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { TextPlugin } from "gsap/TextPlugin";
import style from "./Home.module.css";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { motion } from "framer-motion";
import { FaShieldAlt, FaSearch, FaChartLine, FaBolt, FaCheckCircle, FaChartBar, FaArrowLeft, FaArrowRight } from "react-icons/fa";
import ScannerAnimation from "./ScannerAnimation";
import PcShowcaseSection from './PcShowcaseSection';

gsap.registerPlugin(ScrollTrigger, TextPlugin);

export default function Home() {
  const mainRef = useRef(null);
  const titleRef = useRef(null);
  const animatedTextRef = useRef(null);
  const featuresRef = useRef(null);
  const [isDarkMode, setIsDarkMode] = useState(
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  const subtitleTexts = [
    "Scan websites for vulnerabilities",
    "Detect security threats",
    "Analyze web applications",
  ];

  const reviews = [
    {
      text: "Moktashif gave us peace of mind before launching our new platform. The vulnerability reports were clear and actionable!",
      name: "Alex Johnson",
      title: "CTO at SecureWeb Inc.",
      location: "USA",
      img: "https://randomuser.me/api/portraits/men/32.jpg"
    },
    {
      text: "The best automated scanner we've used. Fast, reliable, and the analytics dashboard is a game changer.",
      name: "Priya Sharma",
      title: "Lead DevOps at Cloudify",
      location: "India",
      img: "https://randomuser.me/api/portraits/women/44.jpg"
    },
    {
      text: "Moktashif's proof-based validation helped us eliminate false positives and focus on real threats.",
      name: "Liam O'Connor",
      title: "Security Engineer at FinTechPro",
      location: "Ireland",
      img: "https://randomuser.me/api/portraits/men/65.jpg"
    },
    {
      text: "Highly recommend Moktashif for any team that takes web security seriously.",
      name: "Sara Lee",
      title: "Product Manager at AppGuard",
      location: "Singapore",
      img: "https://randomuser.me/api/portraits/women/68.jpg"
    }
  ];

  const [currentReview, setCurrentReview] = useState(0);
  const reviewTimeout = useRef();

  useLayoutEffect(() => {
    // Theme setup
    document.documentElement.setAttribute(
      "data-theme",
      isDarkMode ? "dark" : "light"
    );

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e) => {
      setIsDarkMode(e.matches);
      document.documentElement.setAttribute(
        "data-theme",
        e.matches ? "dark" : "light"
      );
    };

    mediaQuery.addEventListener("change", handleChange);

    // Hero section animations
    const tl = gsap.timeline();
    if (titleRef.current) {
      tl.fromTo(titleRef.current, {
        y: 100,
        opacity: 0,
      }, {
        duration: 1.2,
        y: 0,
        opacity: 1,
        ease: "power3.out",
      });
    }

    // Animated text sequence
    let currentIndex = 0;
    const animateText = () => {
      if (!animatedTextRef.current) return;
      const text = subtitleTexts[currentIndex];
      const nextIndex = (currentIndex + 1) % subtitleTexts.length;
      gsap.to(animatedTextRef.current, {
        duration: 0.5,
        opacity: 0,
        y: -20,
        ease: "power2.in",
        onComplete: () => {
          gsap.set(animatedTextRef.current, {
            text: text,
            opacity: 0,
            y: 20
          });
          gsap.to(animatedTextRef.current, {
            duration: 0.5,
            opacity: 1,
            y: 0,
            ease: "power2.out",
            onComplete: () => {
              setTimeout(() => {
                currentIndex = nextIndex;
                animateText();
              }, 2000);
            }
          });
        }
      });
    };
    setTimeout(animateText, 1000);

    // Features animation
    const featureCards = gsap.utils.toArray(`.${style.featureCard}`);
    gsap.set(featureCards, {
      opacity: 0,
      y: 50
    });
    featureCards.forEach((card, index) => {
      gsap.to(card, {
        duration: 0.8,
        opacity: 1,
        y: 0,
        delay: index * 0.2,
        ease: "power2.out",
        scrollTrigger: {
          trigger: card,
          start: "top 85%",
          toggleActions: "play none none reverse",
        }
      });
    });

    return () => {
      gsap.killTweensOf([titleRef.current, animatedTextRef.current, featureCards]);
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [isDarkMode]);

  // Auto-slide logic
  useEffect(() => {
    clearTimeout(reviewTimeout.current);
    reviewTimeout.current = setTimeout(() => {
      setCurrentReview((prev) => (prev + 1) % reviews.length);
    }, 6000);
    return () => clearTimeout(reviewTimeout.current);
  }, [currentReview, reviews.length]);

  const goToReview = (idx) => {
    setCurrentReview(idx);
  };
  const prevReview = () => {
    setCurrentReview((prev) => (prev - 1 + reviews.length) % reviews.length);
  };
  const nextReview = () => {
    setCurrentReview((prev) => (prev + 1) % reviews.length);
  };

  return (
    <>
      <Helmet>
        <title>Moktashif </title>
      </Helmet>

      <div className={style.homeContainer} ref={mainRef}>
        {/* Hero Section */}
        <section className={style.heroSection}>
          <div className={style.heroContent}>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={style.logoContainer}
            >
              {/* <FaShieldAlt className={style.logoIcon} /> */}
            </motion.div>
            
            <h1 ref={titleRef} className={style.mainTitle}>
              <span className={style.highlight}>Moktashif</span>
              <br />
              <div className={style.animatedSubtitleContainer}>
                <span ref={animatedTextRef} className={style.animatedText}></span>
              </div>
            </h1>

            <div className={style.scannerVisual}>
              <ScannerAnimation />
            </div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1, duration: 0.8 }}
              className={style.ctaContainer}
            >
              <Link to="/scanner" className={style.ctaButton}>
                <span className={style.buttonText}>Start Security Scan</span>
                <span className={style.buttonIcon}>
                  <FaSearch />
                </span>
                <span className={style.buttonGlow}></span>
              </Link>
            </motion.div>
          </div>
        </section>
      <div className="container-fluid">
        {/* Features Section */}
        <section className={`${style.featuresSectionModern} ${style.alignLeft}`}>
          <div className={`${style.featuresInnerModern}`}>
            {/* Left: Icon and Glow */}
            <motion.div
              className={style.featuresIconCol}
              initial={{ opacity: 0, x: -60 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              <div className={style.glowAccent}></div>
              <FaShieldAlt className={style.featuresShieldIcon} />
            </motion.div>
            {/* Right: Headline and Text */}
            <motion.div
              className={style.featuresTextCol}
              initial={{ opacity: 0, x: 60 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
            >
              <h2 className={style.featuresHeadline}>
                Unlock <span className={style.gradientText}>Advanced Security</span> with Moktashif
              </h2>
              <p className={style.featuresDesc}>
                <b>Moktashif</b> empowers you to <span className={style.highlightText}>scan any website for vulnerabilities</span> with the precision and depth of a real attacker. Simulate <b>authenticated</b> and <b>unauthenticated</b> attacks, uncover <span className={style.gradientText}>hidden threats</span>, and receive <b>actionable, proof-based reports</b>.<br /><br />
                Our advanced engine detects <span className={style.highlightText}>OWASP Top 10</span> issues, misconfigurations, and more—helping you secure your digital assets before attackers do. <span className={style.gradientText}>Stay ahead</span> with real-time protection, detailed analytics, and continuous updates from the Moktashif team.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Second Section: Icon Right, Text Left */}
        <section className={`${style.featuresSectionModern} ${style.alignRight}`}>
          <div className={style.featuresInnerModernReverse}>
            <motion.div
              className={style.featuresTextCol}
              initial={{ opacity: 0, x: -60 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              <h2 className={style.featuresHeadline}>
                <span className={style.gradientText}>Proof-Based Validation</span> & Trusted Results
              </h2>
              <p className={style.featuresDesc}>
                Moktashif doesn't just find vulnerabilities—it <b>proves</b> them. Every finding is backed by <span className={style.highlightText}>payload execution results</span> and <b>evidence</b> such as HTTP requests, screenshots, and extracted data. <br /><br />
                <span className={style.gradientText}>Minimize false positives</span> and gain confidence in your security posture with <b>clear, actionable reports</b> designed for both technical and business audiences.
              </p>
            </motion.div>
            <motion.div
              className={style.featuresIconCol}
              initial={{ opacity: 0, x: 60 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
            >
              <div className={style.glowAccent}></div>
              <FaCheckCircle className={style.featuresShieldIcon} style={{ color: '#4ec9b0' }} />
            </motion.div>
          </div>
        </section>

        {/* Third Section: Icon Left, Text Right */}
        <section className={`mb-20 ${style.featuresSectionModern} ${style.alignLeft}`}>
          <div className={style.featuresInnerModern}>
            <motion.div
              className={style.featuresIconCol}
              initial={{ opacity: 0, x: -60 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              <div className={style.glowAccent}></div>
              <FaChartBar className={style.featuresShieldIcon} style={{ color: '#8B95B9' }} />
            </motion.div>
            <motion.div
              className={style.featuresTextCol}
              initial={{ opacity: 0, x: 60 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
            >
              <h2 className={style.featuresHeadline}>
                <span className={style.gradientText}>Analytics & Continuous Improvement</span>
              </h2>
              <p className={style.featuresDesc}>
                Moktashif provides <span className={style.highlightText}>detailed analytics</span> and <b>historical trends</b> so you can track your security progress over time. <br /><br />
                Our platform is <span className={style.gradientText}>constantly updated</span> with the latest threat intelligence, ensuring you're always protected against emerging vulnerabilities and attack techniques.
              </p>
            </motion.div>
          </div>
        </section>
      </div>
     {/* customer reviews */}
        <section className={`${style.reviewsSectionBig}`}>
          <div className={style.reviewsGrid}>
            {/* Left: Title and Paragraph */}
            <div className={style.reviewsInfoCol}>
              <h2 className={style.reviewsTitleBig}>Customer reviews</h2>
              <p className={style.reviewsSubtitle}>
                See what security professionals and teams say about Moktashif. Our platform is trusted by organizations worldwide for its accuracy, ease of use, and actionable results.
              </p>
            </div>
            {/* Right: Slider */}
            <div className={style.reviewsSliderWrapBig}>
              <motion.div
                key={currentReview}
                className={style.reviewCardBig}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -40 }}
                transition={{ duration: 0.7, ease: "easeInOut" }}
              >
                <div className={style.reviewTextColBig}>
                  <p className={style.reviewTextBig}>{reviews[currentReview].text}</p>
                  <div className={style.reviewMetaBig}>
                    <b>{reviews[currentReview].name}</b><br />
                    <span className={style.reviewTitleBig}>{reviews[currentReview].title}</span><br />
                    <span className={style.reviewLocationBig}>{reviews[currentReview].location}</span>
                  </div>
                </div>
                <div className={style.reviewImgColBig}>
                  <img src={reviews[currentReview].img} alt={reviews[currentReview].name} className={style.reviewImgBig} />
                </div>
              </motion.div>
              <div className={style.reviewsNavBig}>
                <button className={style.reviewsArrowBig} onClick={prevReview} aria-label="Previous review">
                  <FaArrowLeft />
                </button>
                <div className={style.reviewsDotsBig}>
                  {reviews.map((_, idx) => (
                    <button
                      key={idx}
                      className={idx === currentReview ? style.activeDotBig : style.dotBig}
                      onClick={() => goToReview(idx)}
                      aria-label={`Go to review ${idx + 1}`}
                    />
                  ))}
                </div>
                <button className={style.reviewsArrowBig} onClick={nextReview} aria-label="Next review">
                  <FaArrowRight />
                </button>
              </div>
            </div>
          </div>
        </section>
        {/* contact support */}
        <Link to="/contactsupport" className={style.floatingContactSupport}>
          <i className="fa-solid fa-headset"></i>
        </Link>
      </div>
      <PcShowcaseSection />
    </>
  );
}
