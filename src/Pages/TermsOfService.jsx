import React from 'react';
import styles from './Legal.module.css';

export default function TermsOfService() {
  return (
    <div className={styles.legalContainer}>
      <div className={styles.legalContent}>
        <h1>Terms of Service</h1>
        <div className={styles.section}>
          <h2>1. Introduction</h2>
          <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
        </div>
        <div className={styles.section}>
          <h2>2. Use License</h2>
          <p>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
        </div>
        <div className={styles.section}>
          <h2>3. Disclaimer</h2>
          <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</p>
        </div>
        <div className={styles.section}>
          <h2>4. Limitations</h2>
          <p>Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
        </div>
      </div>
    </div>
  );
} 