import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import style from "./ScannerInput.module.css";

export default function ScannerInput() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const isValidUrl = (url) => {
    try {
      // Simple URL validation
      const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
      return urlPattern.test(url);
    } catch {
      return false;
    }
  };

  const handleChange = (e) => {
    const value = e.target.value.trim();
    setUrl(value);
    if (value && !isValidUrl(value)) {
      setError("Please enter a valid URL");
    } else {
      setError("");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!url) {
      setError("URL is required");
      return;
    }

    if (!isValidUrl(url)) {
      setError("Please enter a valid URL");
      return;
    }

    setIsLoading(true);
    
    // Format URL with https:// if not present
    const formattedUrl = url.startsWith('http') ? url : `https://${url}`;
    
    // Navigate to results page
    navigate("/results", { 
      state: { 
        url: formattedUrl,
        scanData: {
          timestamp: new Date().toISOString(),
          status: "completed"
        }
      }
    });
  };

  return (
    <div className={style.scannerContainer}>
      <div className={style.scannerContent}>
        <h1 className={style.title}>
          <span className={style.highlight}>Scan</span> Your Website
        </h1>
        <p className={style.subtitle}>
          Enter the URL below to start vulnerability scanning
        </p>

        <form onSubmit={handleSubmit} className={style.scannerForm}>
          <div className={style.inputWrapper}>
            <div className={style.inputContainer}>
              <input
                type="text"
                value={url}
                onChange={handleChange}
                placeholder="example.com"
                className={`${style.urlInput} ${error ? style.error : ""}`}
                required
              />
              <div className={style.inputDecoration}>
                <div className={style.pulseDot}></div>
                <div className={style.pulseRing}></div>
              </div>
              {error && <div className={style.errorMessage}>{error}</div>}
            </div>
          </div>

          <button
            type="submit"
            className={`${style.scanButton} ${isLoading ? style.loading : ""}`}
            disabled={isLoading || !!error || !url}
          >
            {isLoading ? (
              <>
                <span className={style.spinner}></span>
                Scanning...
              </>
            ) : (
              <>
                Start Scanning
                <span className={style.buttonArrow}>→</span>
              </>
            )}
          </button>
        </form>

        <div className={style.scannerVisual}>
          <div className={style.scannerBeam}></div>
          <div className={style.scannerGrid}></div>
        </div>
      </div>
    </div>
  );
}
