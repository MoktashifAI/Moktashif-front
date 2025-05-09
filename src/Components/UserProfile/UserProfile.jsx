import React, { useContext, useEffect, useState, useRef } from 'react';
import styles from './UserProfile.module.css';
import { UserContext } from '../../Context/UserContext';
import { Helmet } from 'react-helmet';
import axios from 'axios';
import { FaEdit, FaCamera } from 'react-icons/fa';

const DEFAULT_AVATAR = 'https://ui-avatars.com/api/?name=User&background=random&size=256';

function maskEmail(email) {
    if (!email) return '';
    const [user, domain] = email.split('@');
    if (user.length <= 3) return '*'.repeat(user.length) + '@' + domain;
    return user.slice(0, 3) + '*'.repeat(user.length - 3) + '@' + domain;
}

export default function UserProfile() {
    const { userToken } = useContext(UserContext);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState('');
    const [photo, setPhoto] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [photoSaving, setPhotoSaving] = useState(false);
    const fileInputRef = useRef();

    const PLACEHOLDER = {
        userName: 'Loading... ',
        email: 'loading@email.com',
        photo: '',
        createdAt: new Date().toISOString(),
    };

    useEffect(() => {
        setLoading(true);
        setTimeout(() => {
            setProfile({
                userName: 'John Doe',
                email: 'john.doe@example.com',
                photo: '',
                createdAt: '2023-01-01T00:00:00.000Z',
            });
            setTempName('John Doe');
            setLoading(false);
        }, 1200);
    }, [userToken]);

    const handleNameEdit = () => {
        if (isEditingName && tempName.trim()) {
            setProfile(prev => ({ ...prev, userName: tempName }));
        }
        setIsEditingName(!isEditingName);
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setPhoto(file);
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

    const handlePhotoUpload = async () => {
        if (!photo) return;
        setPhotoSaving(true);
        setTimeout(() => {
            setProfile(prev => ({ ...prev, photo: photoPreview }));
            setPhoto(null);
            setPhotoPreview(null);
            setPhotoSaving(false);
        }, 1000);
    };

    const displayProfile = loading ? PLACEHOLDER : profile;

    return (
        <div className={styles.profilePageBg}>
            <div className={styles.animatedBg} />
            <div className={styles.profileContainer}>
                <Helmet><title>Profile</title></Helmet>
                <div className={styles.profileHeader}>
                    <div className={styles.profilePicWrapper}>
                        <img
                            src={photoPreview || displayProfile.photo || DEFAULT_AVATAR}
                            alt="Profile"
                            className={styles.profilePic}
                        />
                        <label className={styles.editPicBtn}>
                            <FaCamera />
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handlePhotoChange}
                                style={{ display: 'none' }}
                            />
                        </label>
                    </div>
                    <div className={styles.userInfo}>
                        {isEditingName ? (
                            <input
                                type="text"
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                                onBlur={handleNameEdit}
                                autoFocus
                                className={styles.nameInput}
                            />
                        ) : (
                            <div className={styles.userName}>
                                {displayProfile.userName}
                                <button className={styles.editNameBtn} onClick={handleNameEdit}>
                                    <FaEdit />
                                </button>
                            </div>
                        )}
                        <div className={styles.userEmail}>{maskEmail(displayProfile.email)}</div>
                        <div className={styles.creationDate}>
                            Member since: {new Date(displayProfile.createdAt).toLocaleDateString()}
                        </div>
                    </div>
                </div>

                {photoPreview && (
                    <button
                        className={styles.uploadBtn}
                        onClick={handlePhotoUpload}
                        disabled={photoSaving}
                    >
                        {photoSaving ? 'Uploading...' : 'Upload Photo'}
                    </button>
                )}

                <div className={styles.scanHistorySection}>
                    <h3 className={styles.historyTitle}>Scan History</h3>
                    <button className={styles.historyBtn}>
                        Review Scan History
                    </button>
                </div>
            </div>
        </div>
    );
}
