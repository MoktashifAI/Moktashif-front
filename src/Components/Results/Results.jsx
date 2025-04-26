import axios from "axios";
import React, { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import style from "./Results.module.css";
import VulnerabilityChart from "./VulnerabilityChart";
import { GlobalContext } from "../../Context/GlobalContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Helmet } from "react-helmet";

export default function Results() {
  const { vulnsBackendData, setVulnsBackendData, scanDate } = useContext(GlobalContext);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  });
  const [modalContent, setModalContent] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (vulnsBackendData) {
      updateVulnerabilities(vulnsBackendData);
    }
  }, [vulnsBackendData]);

  const updateVulnerabilities = (data) => {
    setLoading(false);
    const newStats = data.reduce(
      (acc, vuln) => {
        const severity = vuln.severity.toLowerCase();
        acc[severity] = (acc[severity] || 0) + 1;
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
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:3000/integration/IntegrationApi');
      if (response.data.success === true) {
        setVulnsBackendData(response.data?.data.vulnerabilities);
        updateVulnerabilities(response.data?.data.vulnerabilities);
      }
    } catch (error) {
      console.error("Error refreshing data:", error);
      setLoading(false);
    }
  };

  const generatePDFReport = () => {
    const doc = new jsPDF();

    // Add title
    doc.setFontSize(20);
    doc.text("Vulnerability Scan Report", 14, 15);

    // Add scan date
    doc.setFontSize(12);
    doc.text(`Scan Date: ${new Date().toLocaleString()}`, 14, 25);

    // Add summary section
    doc.setFontSize(16);
    doc.text("Summary", 14, 40);

    // Add vulnerability counts
    doc.setFontSize(12);
    doc.text(`Critical: ${stats.critical}`, 14, 50);
    doc.text(`High: ${stats.high}`, 14, 60);
    doc.text(`Medium: ${stats.medium}`, 14, 70);
    doc.text(`Low: ${stats.low}`, 14, 80);

    // Add findings table
    doc.setFontSize(16);
    doc.text("Detailed Findings", 14, 100);

    // Prepare table data
    const tableData = vulnsBackendData.map(vuln => [
      vuln.category,
      vuln.severity,
      vuln.description || "No description available",
      vuln.remediation || "No remediation available"
    ]);

    // Add table using autoTable
    autoTable(doc, {
      startY: 110,
      head: [['Finding', 'Risk Level', 'Description', 'Remediation']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [99, 110, 151] },
      styles: { fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 20 },
        2: { cellWidth: 70 },
        3: { cellWidth: 70 }
      }
    });

    // Save the PDF
    doc.save('vulnerability-scan-report.pdf');
  };

  const getRiskLevelColor = (level) => {
    const levels = {
      critical: "#DC3545",
      high: "#E94A35",
      medium: "#FFC107",
      low: "#28A745",
    };
    return levels[level.toLowerCase()] || "#636E97";
  };

  const handleCellClick = (content, title) => {
    if (!content) return;
    setModalContent({ content, title });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalContent(null);
  };

  const renderModal = () => {
    if (!showModal || !modalContent) return null;

    return (
      <div className={style.modalOverlay} onClick={closeModal}>
        <div className={style.modalContent} onClick={e => e.stopPropagation()}>
          <div className={style.modalHeader}>
            <h3>{modalContent.title}</h3>
            <button className={style.closeButton} onClick={closeModal}>
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className={style.modalBody}>
            {modalContent.content}
          </div>
        </div>
      </div>
    );
  };

  return <>
    <Helmet>
      <title>Results</title>
    </Helmet>
    <div className={style.resultsContainer}>
      <div className={style.mainGrid}>
        <div className={style.chartSection}>
          <div className={style.summarySection}>
            <VulnerabilityChart stats={stats} />
          </div>
        </div>

        <div className={`${style.header} `}>
          <div className={style.headerContent}>
            <h1>Scan Results</h1>
            <div className={style.scanInfo}>
              <div>
                <span>Content Type:</span>
                <span>text/html;charset=UTF-8</span>
              </div>
              <div>
                <span>Last Analysis Date:</span>
                <span>{scanDate}</span>
              </div>
            </div>
            <div className={style.actions}>
              <button
                className={style.refreshButton}
                onClick={handleRefresh}
                disabled={loading}
              >
                <i className="fas fa-sync-alt"></i> Refresh
              </button>
              <button
                className={style.reportButton}
                onClick={generatePDFReport}
                disabled={loading || !vulnsBackendData?.length}
              >
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
                ) : !vulnsBackendData?.length ? (
                  <tr>
                    <td colSpan="5" className={style.loading}>
                      No vulnerabilities found
                    </td>
                  </tr>
                ) : (
                  vulnsBackendData.map((vuln) => (
                    <tr key={vuln._id}>
                      <td>{vuln.category}</td>
                      <td>
                        <span
                          className={style.riskBadge}
                          style={{
                            backgroundColor: getRiskLevelColor(vuln.severity),
                          }}
                        >
                          {vuln.severity}
                        </span>
                      </td>
                      <td
                        className={style.descriptionCell}
                        onClick={() => handleCellClick(vuln.description, 'Description')}
                        title={vuln.description || "No description available"}
                      >
                        {vuln.description || "No description available"}
                      </td>
                      <td
                        className={style.remediationCell}
                        onClick={() => handleCellClick(vuln.remediation, 'Remediation')}
                        title={vuln.remediation || "No remediation available"}
                      >
                        {vuln.remediation || "No remediation available"}
                      </td>
                      <td>
                        <Link
                          target="_blank"
                          to={vuln.learn_more_url}
                          className={style.learnMoreButton}
                        >
                          {vuln.learn_more_url ? "Learn More" : "N/A"}
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {renderModal()}
    </div>
  </>
}
