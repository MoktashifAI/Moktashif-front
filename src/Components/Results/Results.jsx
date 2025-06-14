import axios from "axios";
import React, { useContext, useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import style from "./Results.module.css";
import VulnerabilityChart from "./VulnerabilityChart";
import { GlobalContext } from "../../Context/GlobalContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Helmet } from "react-helmet";

export default function Results() {
  const { vulnsBackendData, setVulnsBackendData, scanDate, headers, setscanDate } = useContext(GlobalContext);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  });
  const [modalContent, setModalContent] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState(null);
  const [sortByRisk, setSortByRisk] = useState(false);
  const [filterRisk, setFilterRisk] = useState("all");

  // Load from localStorage on mount if available
  useEffect(() => {
    const stored = localStorage.getItem("vulnsBackendData");
    const storedScanDate = localStorage.getItem("scanDate");
    if (!vulnsBackendData && stored) {
      try {
        const parsed = JSON.parse(stored);
        setVulnsBackendData(parsed);
        updateVulnerabilities(parsed);
        setLoading(false);
      } catch (e) {
        // ignore parse error
      }
    }
    // If scanDate is not set in context but exists in localStorage, set it
    if (!scanDate && storedScanDate) {
      try {
        // Only set if not already set
        if (!scanDate) {
          // setscanDate is from context
          setscanDate(storedScanDate);
        }
      } catch (e) {
        // ignore parse error
      }
    }
  }, []);

  // Store to localStorage whenever vulnsBackendData or scanDate changes
  useEffect(() => {
    if (vulnsBackendData) {
      localStorage.setItem("vulnsBackendData", JSON.stringify(vulnsBackendData));
      updateVulnerabilities(vulnsBackendData);
      setLoading(false);
      // Dispatch custom event so Navbar updates results button immediately
      window.dispatchEvent(new Event("vulnsBackendDataUpdated"));
    }
    if (scanDate) {
      localStorage.setItem("scanDate", scanDate);
    }
  }, [vulnsBackendData, scanDate]);

  const updateVulnerabilities = (data) => {
    const newStats = data.reduce(
      (acc, vuln) => {
        const severity = vuln.severity?.toLowerCase();
        if (severity && acc[severity] !== undefined) {
          acc[severity] = (acc[severity] || 0) + 1;
        }
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

  // Helper to get the best scan date
  const getBestScanDate = () => {
    if (scanDate && !Array.isArray(scanDate) && !isNaN(Date.parse(scanDate))) {
      return scanDate;
    }
    // Fallback: try to get createdAt from vulnerabilities data
    if (vulnsBackendData && vulnsBackendData.length > 0) {
      const firstVuln = vulnsBackendData[0];
      if (firstVuln.createdAt && !isNaN(Date.parse(firstVuln.createdAt))) {
        return firstVuln.createdAt;
      }
    }
    return null;
  };

  const generatePDFReport = async () => {
    const doc = new jsPDF();

    // Centered header
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('Vulnerability Scan Report', 105, 20, { align: 'center' });

    // Add scan date
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    const bestDate = getBestScanDate();
    doc.text(`Scan Date: ${bestDate ? new Date(bestDate).toLocaleString() : new Date().toLocaleString()}`, 14, 30);

    // Add summary section
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary', 14, 45);

    // Add vulnerability counts
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Critical: ${stats.critical}`, 14, 55);
    doc.text(`High: ${stats.high}`, 14, 65);
    doc.text(`Medium: ${stats.medium}`, 14, 75);
    doc.text(`Low: ${stats.low}`, 14, 85);

    // Add findings table
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Detailed Findings', 14, 105);

    // Prepare table data
    const tableData = vulnsBackendData.map(vuln => [
      vuln.category,
      vuln.severity,
      vuln.description || 'No description available',
      vuln.remediation || 'No remediation available'
    ]);

    // Add table using autoTable
    autoTable(doc, {
      startY: 115,
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

    // Add image watermark at the bottom center
    try {
      const imageUrl = 'https://res.cloudinary.com/dnsne0e82/image/upload/v1749924553/Moktashef/USERS/WhatsApp_Image_2025-06-14_at_21.05.49_e4383adc_vbhtxs.jpg';
      
      // Create a new image element to load the image
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Handle CORS
      
      // Convert image to base64 and add to PDF
      await new Promise((resolve, reject) => {
        img.onload = () => {
          try {
            // Create a canvas to convert image to base64
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas size to image size
            canvas.width = img.width;
            canvas.height = img.height;
            
            // Draw image on canvas
            ctx.drawImage(img, 0, 0);
            
            // Get base64 data
            const imgData = canvas.toDataURL('image/jpeg', 0.8);
            
            // Calculate image dimensions for watermark (larger size with proper margins)
            const maxWidth = 100; // Larger width for better visibility
            const maxHeight = 50; // Larger height for better visibility
            
            let imgWidth = img.width;
            let imgHeight = img.height;
            
            // Scale down the image proportionally
            if (imgWidth > maxWidth || imgHeight > maxHeight) {
              const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
              imgWidth = imgWidth * ratio;
              imgHeight = imgHeight * ratio;
            }
            
            // Add image watermark with proper bottom margin to ensure visibility
            const x = (doc.internal.pageSize.getWidth() - imgWidth) / 2; // Center horizontally
            const y = 260; // Moved higher up from bottom with proper margin
            
            doc.addImage(imgData, 'JPEG', x, y, imgWidth, imgHeight);
            resolve();
          } catch (error) {
            console.error('Error processing image:', error);
            // Fallback to text watermark if image fails
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(92, 135, 255); // #5c87ff
            doc.text('Moktashif', 105, 285, { align: 'center' });
            doc.setTextColor(0, 0, 0); // Reset color
            resolve();
          }
        };
        
        img.onerror = () => {
          console.error('Error loading watermark image');
          // Fallback to text watermark if image fails to load
          doc.setFontSize(18);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(92, 135, 255); // #5c87ff
          doc.text('Moktashif', 105, 285, { align: 'center' });
          doc.setTextColor(0, 0, 0); // Reset color
          resolve();
        };
        
        img.src = imageUrl;
      });
      
    } catch (error) {
      console.error('Error adding image watermark:', error);
      // Fallback to text watermark if anything goes wrong
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(92, 135, 255); // #5c87ff
      doc.text('Moktashif', 105, 285, { align: 'center' });
      doc.setTextColor(0, 0, 0); // Reset color
    }

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

  // Get displayed vulnerabilities based on sort and filter
  const getDisplayedVulns = useCallback(() => {
    let data = vulnsBackendData || [];
    if (filterRisk !== "all") {
      data = data.filter(v => v.severity && v.severity.toLowerCase() === filterRisk);
    }
    if (sortByRisk) {
      const order = { critical: 4, high: 3, medium: 2, low: 1 };
      data = [...data].sort((a, b) => (order[b.severity?.toLowerCase()] || 0) - (order[a.severity?.toLowerCase()] || 0));
    }
    return data;
  }, [vulnsBackendData, sortByRisk, filterRisk]);

  // Export findings as CSV
  const exportCSV = () => {
    if (!vulnsBackendData || !vulnsBackendData.length) return;
    const headers = ['Finding', 'Risk Level', 'Description', 'Remediation'];
    const rows = vulnsBackendData.map(vuln => [
      vuln.category,
      vuln.severity,
      (vuln.description || '').replace(/\n/g, ' '),
      (vuln.remediation || '').replace(/\n/g, ' ')
    ]);
    const csvContent = [headers, ...rows].map(e => e.map(cell => '"' + (cell || '').replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'vulnerability-scan-results.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy findings table as plain text to clipboard
  const copyTable = () => {
    if (!vulnsBackendData || !vulnsBackendData.length) return;
    const headers = ['Finding', 'Risk Level', 'Description', 'Remediation'];
    const rows = vulnsBackendData.map(vuln => [
      vuln.category,
      vuln.severity,
      (vuln.description || '').replace(/\n/g, ' '),
      (vuln.remediation || '').replace(/\n/g, ' ')
    ]);
    const tableText = [headers, ...rows].map(row => row.join('\t')).join('\n');
    navigator.clipboard.writeText(tableText);
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
            <h1>Scan Operations</h1>
            <div className={style.scanInfo}>
              <div>
                <span>Scan Date:</span>
                <span>{(() => { const d = getBestScanDate(); return d ? new Date(d).toLocaleString() : 'N/A'; })()}</span>
              </div>
            </div>
            <div className={style.actions}>
              <button
                className={style.actionButton}
                onClick={() => setSortByRisk(s => !s)}
                disabled={loading || !vulnsBackendData?.length}
                title="Sort by Risk Level (Highest to Lowest)"
              >
                <i className="fas fa-sort-amount-down-alt"></i> Sort by Risk
              </button>
              <select
                className={style.actionButton}
                value={filterRisk}
                onChange={e => setFilterRisk(e.target.value)}
                disabled={loading || !vulnsBackendData?.length}
                title="Filter by Risk Level"
                style={{ minWidth: 120 }}
              >
                <option value="all">All Risks</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <button
                className={style.reportButton}
                onClick={async () => await generatePDFReport()}
                disabled={loading || !vulnsBackendData?.length}
              >
                <i className="fas fa-file-export"></i> Report
              </button>
              <button
                className={style.actionButton}
                onClick={exportCSV}
                disabled={loading || !vulnsBackendData?.length}
                title="Export as CSV"
              >
                <i className="fas fa-file-csv"></i> Export as CSV
              </button>
              <button
                className={style.actionButton}
                onClick={copyTable}
                disabled={loading || !vulnsBackendData?.length}
                title="Copy Table to Clipboard"
              >
                <i className="fas fa-copy"></i> Copy Table
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
                {error ? (
                  <tr>
                    <td colSpan="5" className={style.error}>
                      <i className="fas fa-exclamation-triangle"></i> {error}
                    </td>
                  </tr>
                ) : loading ? (
                  <tr>
                    <td colSpan="5" className={style.loading}>
                      <span className={style.spinner}></span>
                      Loading results...
                    </td>
                  </tr>
                ) : !getDisplayedVulns()?.length ? (
                  <tr>
                    <td colSpan="5" className={style.loading}>
                      No vulnerabilities found
                    </td>
                  </tr>
                ) : (
                  getDisplayedVulns().map((vuln) => (
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
                          to={vuln.link}
                          className={style.learnMoreButton}
                        >
                          {vuln.link ? "Learn More" : "N/A"}
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