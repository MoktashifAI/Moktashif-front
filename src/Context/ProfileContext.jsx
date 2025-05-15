import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useContext as useReactContext } from 'react';
import { GlobalContext } from './GlobalContext';
import { UserContext } from './UserContext';

const ProfileContext = createContext();

export const useProfile = () => useContext(ProfileContext);

export const ProfileProvider = ({ children }) => {
  const [profileData, setProfileData] = useState(null);
  const { headers } = useReactContext(GlobalContext);
  const { userToken } = useReactContext(UserContext);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!userToken || !headers) {
        setProfileData(null);
        return;
      }
      try {
        const response = await axios.get('http://localhost:3000/user/getProfile', { headers });
        if (response.data?.success) {
          setProfileData(response.data.data);
        }
      } catch (err) {
        setProfileData(null);
      }
    };
    fetchProfile();
  }, [userToken, headers]);

  return (
    <ProfileContext.Provider value={{ profileData, setProfileData }}>
      {children}
    </ProfileContext.Provider>
  );
}; 