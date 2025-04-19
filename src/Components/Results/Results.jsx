import axios from "axios";
import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import style from "./Results.module.css";
import VulnerabilityChart from "./VulnerabilityChart";

export default function Results() {
  const [vulns, setVulns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    critical: 3,
    high: 2,
    medium: 4,
    low: 2,
  });
  const location = useLocation();
  const scannedUrl = location.state?.url || "Unknown URL";

  const getVulns = async () => {
    setLoading(true);
    try {
      const { data: res } = await axios.get(
        `http://localhost:3000/vulns/getVuln`
      );
      setVulns(res.data);
      // Calculate statistics based on the vulnerabilities
      const newStats = res.data.reduce(
        (acc, vuln) => {
          const riskLevel = getRiskValue(vuln.riskLevel).toLowerCase();
          acc[riskLevel] = (acc[riskLevel] || 0) + 1;
          return acc;
        },
        {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
        }
      );
      setStats(newStats);
    } catch (error) {
      console.error("Error fetching vulnerabilities:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    getVulns();
  }, []);

  const getRiskLevelColor = (level) => {
    const levels = {
      critical: "#DC3545",
      high: "#E94A35",
      medium: "#FFC107",
      low: "#28A745",
    };
    return levels[level.toLowerCase()] || "#636E97";
  };

  const getRiskValue = (value) => {
    if (value >= 9) return "Critical";
    if (value >= 7) return "High";
    if (value >= 4) return "Medium";
    return "Low";
  };

  return (
    <div className={style.resultsContainer}>
      <div className={style.mainGrid}>
        <div className={style.chartSection}>
          <div className={style.summarySection}>
            <VulnerabilityChart stats={stats} />
          </div>
        </div>

        <div className={`${style.header} `}>
            <div className={style.headerContent}>
                <h1   >Scan Results</h1>
                <div className={style.scanInfo}>
                    <div>
                    <span>Content Type:</span>
                    <span>text/html;charset=UTF-8</span>
                    </div>
                    <div>
                    <span>Last Analysis Date:</span>
                    <span>{new Date().toLocaleString()}</span>
                    </div>
                </div>
                <div className={style.actions}>
                    <button onClick={getVulns} className={style.refreshButton}>
                    <i className="fas fa-sync-alt"></i> Refresh
                    </button>
                    <button className={style.reportButton}>
                    <i className="fas fa-file-export"></i> Report
                    </button>
                </div>  
            </div>
        </div>
      </div>


        <div className={style.contentSection}>
            <div className={style.findingsSection}>
            <div className={style.findingsHeader}>
                <h2>Findings</h2>
                <div className={style.findingsActions}>
                <button className={style.actionButton}>
                    <i className="fas fa-trash"></i> Delete
                </button>
                <button className={style.actionButton}>
                    <i className="fas fa-filter"></i> Filters
                </button>
                <button className={style.actionButton}>
                    <i className="fas fa-file-export"></i> Export
                </button>
                </div>
            </div>

            <div className={style.findingsTable}>
                <table>
                <thead>
                    <tr>
                    <th>Finding</th>
                    <th>Risk Level</th>
                    <th>Description</th>
                    <th>Remediation</th>
                    <th>More Info</th>
                    </tr>
                </thead>
                <tbody>
                    {loading ? (
                    <tr>
                        <td colSpan="5" className={style.loading}>
                        <span className={style.spinner}></span>
                        Loading results...
                        </td>
                    </tr>
                    ) : (
                    vulns.map((vuln) => (
                        <tr key={vuln._id}>
                        <td>{vuln.vulnType}</td>
                        <td>
                            <span
                            className={style.riskBadge}
                            style={{
                                backgroundColor: getRiskLevelColor(
                                getRiskValue(vuln.riskLevel)
                                ),
                            }}
                            >
                            {vuln.riskLevel}
                            </span>
                        </td>
                        <td>
                            {vuln.description || "No description available"}
                        </td>
                        <td>
                            {vuln.remediation || "No remediation available"}
                        </td>
                        <td>
                            <button className={style.learnMoreButton}>
                            Learn More
                            </button>
                        </td>
                        </tr>
                    ))
                    )}
                </tbody>
                </table>
            </div>
            </div>
        </div>



    </div>
  );
}
