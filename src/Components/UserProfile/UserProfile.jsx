import React, { useContext, useEffect, useState, useCallback, useRef } from 'react';
import styles from './UserProfile.module.css';
import { UserContext } from '../../Context/UserContext';
import { Helmet } from 'react-helmet';
import axios from 'axios';
import { FaEdit, FaCamera, FaPen, FaSpinner, FaCheck, FaTimes } from 'react-icons/fa';
import { GlobalContext } from '../../Context/GlobalContext';
import { useProfile } from '../../Context/ProfileContext';

const DEFAULT_AVATAR = `https://ui-avatars.com/api/?name=User&background=${encodeURIComponent(getComputedStyle(document.documentElement).getPropertyValue('black'))}&color=FFFFFF&size=256`;

function maskEmail(email) {
    if (!email) return '';
    const [user, domain] = email.split('@');
    if (user.length <= 3) return '*'.repeat(user.length) + '@' + domain;
    return user.slice(0, 3) + '*'.repeat(user.length - 3) + '@' + domain;
}

function truncateText(text, maxLength = 60) {
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
}

function UserProfileContent({ userToken, headers, onProfileUpdate }) {
    const [loading, setLoading] = useState(true);
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState('');
    const [photo, setPhoto] = useState('');
    const [publicId, setPublicId] = useState('');
    const [photoPreview, setPhotoPreview] = useState('');
    const [photoSaving, setPhotoSaving] = useState(false);
    const [profileData, setProfileData] = useState(null);
    const fileInputRef = useRef(null);
    const { setProfileData: setProfileDataContext } = useProfile();
    const [nameSaving, setNameSaving] = useState(false);
    const nameInputWrapperRef = useRef(null);
    const [scanHistory, setScanHistory] = useState([]);
    const [scanLoading, setScanLoading] = useState(false);
    const [showScanHistory, setShowScanHistory] = useState(false);
    const [expandedCard, setExpandedCard] = useState(null);
    const [modalContent, setModalContent] = useState(null);

    const resetProfileState = useCallback(() => {
        setProfileData(null);
        setPhoto('');
        setPublicId('');
        setPhotoPreview('');
        setTempName('');
        setIsEditingName(false);
    }, []);

    const getUserProfile = useCallback(async () => {
        if (!userToken || !headers) {
            resetProfileState();
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            resetProfileState();
            const fetchedUserProfile = await axios.get(`http://localhost:3000/user/getProfile`, { 
                headers,
                validateStatus: (status) => status < 500
            });
            if (fetchedUserProfile.status === 401) {
                resetProfileState();
                return;
            }
            if (fetchedUserProfile.data?.success) {
                const newProfileData = fetchedUserProfile.data?.data;
                setProfileData(newProfileData);
                setPhoto(newProfileData?.userImg?.secure_url || '');
                setPublicId(newProfileData?.userImg?.public_id || '');
                onProfileUpdate?.(newProfileData);
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
            resetProfileState();
        } finally {
            setLoading(false);
        }
    }, [headers, userToken, resetProfileState, onProfileUpdate]);

    useEffect(() => {
        getUserProfile();
    }, [getUserProfile]);

    useEffect(() => {
        return () => {
            if (photoPreview) {
                URL.revokeObjectURL(photoPreview);
            }
        };
    }, [photoPreview]);

    // Close name input on outside click
    useEffect(() => {
        if (!isEditingName) return;
        function handleClickOutside(event) {
            if (nameInputWrapperRef.current && !nameInputWrapperRef.current.contains(event.target)) {
                setIsEditingName(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isEditingName]);

    const handleNameEdit = () => {
        if (isEditingName && tempName.trim() && tempName !== profileData?.userName) {
            handleNameSave();
        } else {
            setIsEditingName(!isEditingName);
            setTempName(profileData?.userName || '');
        }
    };

    const handleNameSave = async () => {
        if (!tempName.trim() || tempName === profileData?.userName) {
            setIsEditingName(false);
            return;
        }
        setNameSaving(true);
        try {
            const response = await axios.put('http://localhost:3000/user/updateUserProfile', {
                userName: tempName.trim()
            }, { headers });
            console.log('PUT /user/updateUserProfile response:', response);
            if (response.data?.success) {
                const updatedProfile = await axios.get('http://localhost:3000/user/getProfile', { headers });
                console.log('GET /user/getProfile response:', updatedProfile);
                if (updatedProfile.data?.success) {
                    const newProfileData = updatedProfile.data?.data;
                    setProfileDataContext(newProfileData);
                    setProfileData(newProfileData);
                    onProfileUpdate?.(newProfileData);
                }
            }
        } catch (error) {
            console.error('Error updating user name:', error?.response?.data?.errors?.[0] || error);
        } finally {
            setNameSaving(false);
            setIsEditingName(false);
        }
    };

    const handlePhotoClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handlePhotoChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const previewUrl = URL.createObjectURL(file);
        setPhotoPreview(previewUrl);
        setPhotoSaving(true);
        try {
            const formData = new FormData();
            formData.append('img', file);
            let response;
            if (publicId) {
                formData.append('oldPublicId', profileData?.userImg?.public_id);
                response = await axios.patch('http://localhost:3000/user/updateImg', formData, {
                    headers: {
                        ...headers,
                        'Content-Type': 'multipart/form-data'
                    }
                });
            } else {
                response = await axios.post('http://localhost:3000/user/uploadImg', formData, {
                    headers: {
                        ...headers,
                        'Content-Type': 'multipart/form-data'
                    }
                });
            }
            if (response.data?.success) {
                const updatedProfile = await axios.get(`http://localhost:3000/user/getProfile`, { 
                    headers,
                    validateStatus: (status) => status < 500
                });
                if (updatedProfile.data?.success) {
                    const newProfileData = updatedProfile.data?.data;
                    setProfileDataContext(newProfileData);
                    setProfileData(newProfileData);
                    setPhoto(newProfileData?.userImg?.secure_url || '');
                    setPublicId(newProfileData?.userImg?.public_id || '');
                    onProfileUpdate?.(newProfileData);
                }
                setPhotoPreview('');
            } else {
                setPhotoPreview('');
            }
        } catch (error) {
            console.error('Error uploading photo:', error);
            setPhotoPreview('');
        } finally {
            setPhotoSaving(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const fetchScanHistory = async () => {
        setScanLoading(true);
        try {
            const response = await axios.get('http://localhost:3000/vulns/getScanHistoryForSpecificUser', {
                headers: { ...headers, Authorization: `Bearer ${userToken}` },
            });
            if (response.data?.success) {
                setScanHistory(response.data.data || []);
                setShowScanHistory(true);
            }
        } catch (error) {
            setScanHistory([]);
            setShowScanHistory(true);
        } finally {
            setScanLoading(false);
        }
    };

    return (
        <div className={styles.profilePageBg}>
            <div className={styles.animatedBg} />
            <div className={`${styles.profileContainer} mt-20`}>
                <Helmet><title>Profile</title></Helmet>
                {loading ? (
                    <div className={styles.loading}>Loading profile...</div>
                ) : profileData ? (
                    <>
                        <div className={styles.profileHeader}>
                            <div className={styles.profilePicWrapper}>
                                <img
                                    src={photoPreview || photo || DEFAULT_AVATAR}
                                    alt="Profile"
                                    className={`${styles.profilePic} ${photoSaving ? styles.uploading : ''}`}
                                />
                                <button
                                    onClick={handlePhotoClick}
                                    className={`${styles.editPicBtn} ${photoSaving ? styles.uploading : ''}`}
                                    disabled={photoSaving}
                                    title={photo ? "Change profile picture" : "Upload profile picture"}
                                >
                                    {photoSaving ? (
                                        <FaSpinner className={styles.spinningIcon} />
                                    ) : photo ? (
                                        <FaPen />
                                    ) : (
                                        <FaCamera />
                                    )}
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handlePhotoChange}
                                    style={{ display: 'none' }}
                                    disabled={photoSaving}
                                />
                            </div>
                            <div className={styles.userInfo}>
                                {isEditingName ? (
                                    <div className={styles.animatedNameInputWrapper} ref={nameInputWrapperRef}>
                                        <input
                                            type="text"
                                            value={tempName}
                                            onChange={e => setTempName(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') handleNameSave();
                                                if (e.key === 'Escape') setIsEditingName(false);
                                            }}
                                            autoFocus
                                            className={styles.animatedNameInput}
                                            placeholder="Enter your new name..."
                                            disabled={nameSaving}
                                        />
                                        <button
                                            className={styles.saveNameBtn}
                                            onClick={handleNameSave}
                                            disabled={nameSaving || !tempName.trim() || tempName === profileData?.userName}
                                            title="Save name"
                                            type="button"
                                        >
                                            {nameSaving ? <FaSpinner className={styles.spinningIcon} /> : <FaCheck />}
                                        </button>
                                    </div>
                                ) : (
                                    <div className={styles.userName}>
                                        {profileData?.userName}
                                        <button className={styles.editNameBtn} onClick={handleNameEdit} title="Edit name">
                                            <FaEdit />
                                        </button>
                                    </div>
                                )}
                                <div className={styles.userEmail}>
                                    {maskEmail(profileData?.email)}
                                </div>
                                <div className={styles.creationDate}>
                                    Member since: {new Date(profileData?.createdAt).toLocaleDateString()}
                                </div>
                            </div>
                        </div>
                        <div className={styles.scanHistorySection}>
                            <h3 className={styles.historyTitle}>Scan History</h3>
                            <button className={styles.historyBtn} onClick={fetchScanHistory} disabled={scanLoading}>
                                {scanLoading ? 'Loading...' : 'Review Scan History'}
                            </button>
                            {showScanHistory && (
                                <div className={styles.scanHistoryGrid}>
                                    {scanHistory.length === 0 && !scanLoading && (
                                        <div style={{ gridColumn: '1/-1', color: 'var(--text_color)', opacity: 0.7, textAlign: 'center', padding: '2rem' }}>
                                            No scan history found.
                                        </div>
                                    )}
                                    {scanHistory.map((scan, idx) => (
                                        <div
                                            className={styles.scanCard}
                                            key={scan._id || idx}
                                            onClick={() => setExpandedCard(expandedCard === idx ? null : idx)}
                                            style={{ boxShadow: expandedCard === idx ? '0 8px 32px rgba(var(--fourth_color_rgb), 0.18)' : undefined }}
                                        >
                                            <div className={styles.scanCardHeader}>Scan #{scanHistory.length - idx}</div>
                                            <div className={styles.scanCardDate}>{new Date(scan.createdAt).toLocaleString()}</div>
                                            {expandedCard === idx && (
                                                <div className={styles.vulnList}>
                                                    {scan.vulnerabilities.map((vuln, vIdx) => (
                                                        <div className={styles.vulnItem} key={vIdx}>
                                                            <div className={styles.vulnItemRow}>
                                                                <span className={styles.vulnLabel}>Category:</span>
                                                                <span className={styles.vulnValue}>{vuln.category}</span>
                                                                <span className={styles.vulnSeverity}>{vuln.severity}</span>
                                                            </div>
                                                            <div className={styles.vulnItemRow}>
                                                                <span className={styles.vulnLabel}>Description:</span>
                                                                <span
                                                                    className={styles.vulnValue}
                                                                    onClick={e => { e.stopPropagation(); setModalContent({ title: 'Description', text: vuln.description }); }}
                                                                >
                                                                    {truncateText(vuln.description)}
                                                                </span>
                                                            </div>
                                                            <div className={styles.vulnItemRow}>
                                                                <span className={styles.vulnLabel}>Remediation:</span>
                                                                <span
                                                                    className={styles.vulnValue}
                                                                    onClick={e => { e.stopPropagation(); setModalContent({ title: 'Remediation', text: vuln.remediation }); }}
                                                                >
                                                                    {truncateText(vuln.remediation)}
                                                                </span>
                                                            </div>
                                                            <div className={styles.vulnItemRow}>
                                                                <span className={styles.vulnLabel}>Learn More:</span>
                                                                <a
                                                                    className={styles.vulnLearnMore}
                                                                    href={vuln.learn_more_url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    onClick={e => e.stopPropagation()}
                                                                >
                                                                    Link
                                                                </a>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {modalContent && (
                                <div className={styles.vulnModalBackdrop} onClick={() => setModalContent(null)}>
                                    <div className={styles.vulnModal} onClick={e => e.stopPropagation()}>
                                        <button className={styles.vulnModalClose} onClick={() => setModalContent(null)}><FaTimes /></button>
                                        <h2 style={{ color: 'var(--fourth_color)', marginBottom: '1rem' }}>{modalContent.title}</h2>
                                        <div style={{ color: 'var(--text_color)', fontSize: '1.1rem', lineHeight: 1.6 }}>{modalContent.text}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className={styles.errorMessage}>No profile data available</div>
                )}
            </div>
        </div>
    );
}

export default function UserProfile() {
    const { headers } = useContext(GlobalContext);
    const { userToken } = useContext(UserContext);
    const [profileKey, setProfileKey] = useState(0);

    useEffect(() => {
        setProfileKey(prev => prev + 1);
    }, [userToken, headers]);

    const handleProfileUpdate = useCallback((newProfileData) => {
        // This will be called after successful profile updates
    }, []);

    return (
        <UserProfileContent
            key={profileKey}
            userToken={userToken}
            headers={headers}
            onProfileUpdate={handleProfileUpdate}
        />
    );
}
