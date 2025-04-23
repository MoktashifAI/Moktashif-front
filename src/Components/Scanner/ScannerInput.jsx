import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import style from "./ScannerInput.module.css";
import axios from "axios";
import { GlobalContext } from "../../Context/GlobalContext";
export default function ScannerInput() {
  const {setVulnsBackendData,setscanDate} = useContext(GlobalContext);
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const isValidUrl = (url) => {
    try {
      // URL validation
      const urlPattern = /^(https?:\/\/)(?:[\w-]+\.)+[a-z]{2,}(?::\d+)?(?:\/[\w\-\.~!$&'()*+,;=:@%]*)*(?:\?[\w\-\.~!$&'()*+,;=:@%/?]*)?(?:#[\w\-\.~!$&'()*+,;=:@%/?]*)?$/;
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

  const handleSubmit = async (e) => {
    
    if (!url) {
      setError("URL is required");
      return;
    }

    if (!isValidUrl(url)) {
      setError("Please enter a valid URL");
      return;
    }

    setIsLoading(true);
    
    try {
      // Send URL to backend
      const response = await axios.post('http://localhost:3000/integration/IntegrationApi', {TargetUrl:url});
      if (response.data.success === true) {
        setVulnsBackendData(response.data?.data.vulnerabilities);
        setscanDate(response.data?.data.createdAt)        
        // Navigate to results page with scan data
        navigate("/results");
      } else {
        setError(response.data.message || "Scan failed. Please try again.");
        setIsLoading(false);
      }
    } catch (error) {
      setError(error.response?.data?.message || "An error occurred. Please try again.");
      setIsLoading(false);
    }
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
                placeholder="https://example.com"
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
            className={`cursor-pointer ${style.scanButton} ${isLoading ? style.loading : ""}`}
            disabled={isLoading}
            onClick={()=>handleSubmit()}
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
