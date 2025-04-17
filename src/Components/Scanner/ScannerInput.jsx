import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Yup from "yup";
import style from "./ScannerInput.module.css";

const urlSchema = Yup.object().shape({
  url: Yup.string()
    .url("Please enter a valid URL")
    .required("URL is required")
    .matches(
      /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
      "Please enter a valid URL format"
    ),
});

export default function ScannerInput() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const validateUrl = async (value) => {
    try {
      await urlSchema.validate({ url: value });
      setError("");
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  const handleChange = async (e) => {
    const value = e.target.value;
    setUrl(value);
    await validateUrl(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url) return;

    const isValid = await validateUrl(url);
    if (!isValid) return;

    setIsLoading(true);
    // Simulate scanning process
    setTimeout(() => {
      setIsLoading(false);
      navigate("/results", { state: { url } });
    }, 2000);
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
                type="url"
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
            className={`${style.scanButton} ${isLoading ? style.loading : ""}`}
            disabled={isLoading || !!error}
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
