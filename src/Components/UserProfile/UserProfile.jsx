import React, { useContext, useEffect, useState, useRef } from 'react';
import styles from './UserProfile.module.css';
import { UserContext } from '../../Context/UserContext';
import { Helmet } from 'react-helmet';
import axios from 'axios';
import { FaEdit, FaCamera, FaPen } from 'react-icons/fa';
import { GlobalContext } from '../../Context/GlobalContext';
const DEFAULT_AVATAR = `https://ui-avatars.com/api/?name=User&background=${encodeURIComponent(getComputedStyle(document.documentElement).getPropertyValue('black'))}&color=FFFFFF&size=256`;

function maskEmail(email) {
    if (!email) return '';
    const [user, domain] = email.split('@');
    if (user.length <= 3) return '*'.repeat(user.length) + '@' + domain;
    return user.slice(0, 3) + '*'.repeat(user.length - 3) + '@' + domain;
}

export default function UserProfile() {
    const {headers} = useContext(GlobalContext);
    // const { userToken } = useContext(UserContext);
    const [loading, setLoading] = useState(true);
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState('');
    const [photo, setPhoto] = useState('');
    const [photoPreview, setPhotoPreview] = useState(null);
    const [photoSaving, setPhotoSaving] = useState(false);
    const [profileData, setProfileData] = useState('');


    // const fileInputRef = useRef();
// if(profile!== null){
//     setLoading(false);
// }
    // useEffect(() => {
    //     setLoading(true);
    //     setTimeout(() => {
    //         // setProfile({
    //         //     userName: 'John Doe',
    //         //     email: 'john.doe@example.com',
    //         //     photo: '',
    //         //     createdAt: '2023-01-01T00:00:00.000Z',
    //         // });
    //         // setTempName('John Doe');
    //         setLoading(false);
    //     }, 1200);
    // }, [userToken]);

    const handleNameEdit = () => {
        if (isEditingName && tempName.trim()) {
            
        }
        setIsEditingName(!isEditingName);
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setPhoto(file);
            setPhotoPreview(URL.createObjectURL(file));
            handlePhotoUpload(file); // Automatically upload when file is selected
        }
    };

    // const handlePhotoUpload = async (photoFile) => {
    //     const fileToUpload = photoFile || photo;
    //     if (!fileToUpload) return;
        
    //     setPhotoSaving(true);
    //     try {
    //         const formData = new FormData();
    //         formData.append('photo', fileToUpload);
            
    //         const response = await axios.post('http://localhost:3000/user/uploadImg', formData, {
    //             headers
    //         });
            
    //         if (response.data?.success) {
    //             // setProfile(prev => ({ ...prev, photo: response.data.photoUrl }));
    //             // setPhoto(null);
    //             // setPhotoPreview(null);
    //         }
    //     } catch (error) {
    //         console.error('Error uploading photo:', error);
    //     } finally {
    //         setPhotoSaving(false);
    //     }
    // };

    const getUserProfile = async () => {
        const fetchedUserProfile = await axios.get(`http://localhost:3000/user/getProfile`,{headers});
        if(fetchedUserProfile.data?.success){
            setProfileData(fetchedUserProfile.data?.data);
            setPhoto(fetchedUserProfile.data?.data?.userImg?.secure_url)
            setLoading(false);
        }
    }
    
    useEffect(()=>{
        getUserProfile(); 
        // console.log(profileData.userImg.secure_url);
    }, []);
    return (
        <div className={styles.profilePageBg}>
            <div className={styles.animatedBg} />
            <div className={styles.profileContainer}>
                <Helmet><title>Profile</title></Helmet>
                <div className={styles.profileHeader}>
                    <div className={styles.profilePicWrapper}>
                        <img
                            src={photo || DEFAULT_AVATAR}
                            alt="Profile"
                            className={styles.profilePic}
                        />
                        <label className={`${styles.editPicBtn} ${photoSaving ? styles.uploading : ''}`}>
                            {photoSaving ? (
                                <FaPen className={styles.spinningIcon} />
                            ) : photo ? (
                                <FaPen />
                            ) : (
                                <FaCamera />
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handlePhotoChange}
                                style={{ display: 'none' }}
                                disabled={photoSaving}
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
                                {profileData?.userName}
                                <button className={styles.editNameBtn} onClick={handleNameEdit}>
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
