import React, { useState, useCallback } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Layout from "./Components/Layout/Layout";
import Home from "./Components/Home/Home";
import NotFound from "./Components/NotFound/NotFound";
import Results from "./Components/Results/Results";
import SignIn_SignUp from "./Components/SignIn_SignUp/SignIn_SignUp";
import ContactSupport from "./Components/ContactSupport/ContactSupport";
import ForgetPassword from './Components/ForgetPassword/ForgetPassword';
import ScannerInput from "./Components/Scanner/ScannerInput";
import UserContextProvider from "./Context/UserContext";
import ProtectedRoute from "./Components/ProtectedRoute/ProtectedRoute";
import TermsOfService from "./Pages/TermsOfService";
import PrivacyPolicy from "./Pages/PrivacyPolicy";
import GlobalContextProvider from "./Context/GlobalContext";
import About from "./Pages/About/About";
import UserProfile from "./Components/UserProfile/UserProfile";
import Chatbot from "./Components/ChatBot/Chatbot";
import { ProfileProvider } from './Context/ProfileContext';

// Create a new context for profile updates
export const ProfileContext = React.createContext();

function AppContent() {
  const [profileData, setProfileData] = useState(null);

  const handleProfileUpdate = useCallback((newProfileData) => {
    setProfileData(newProfileData);
  }, []);

  let routers = createBrowserRouter([
    {
      path: '', 
      element: (
          <Layout />
      ), 
      children: [
        { index: true, element: <Home /> },
        { path: 'home', element: <Home /> },
        { path: 'scanner', element: <ProtectedRoute><ScannerInput /></ProtectedRoute> },
        { path: 'forgetpassword', element: <ForgetPassword /> },
        { path: 'results', element:<ProtectedRoute><Results /></ProtectedRoute>},
        { path: 'signin', element: <SignIn_SignUp /> },
        { path: 'profile', element: <ProtectedRoute><UserProfile onProfileUpdate={handleProfileUpdate} /></ProtectedRoute> },
        { path: '*', element: <NotFound /> },
        { path: 'contactsupport', element: <ContactSupport /> },
        { path: 'terms', element: <TermsOfService /> },
        { path: 'privacy', element: <PrivacyPolicy /> },
        { path: 'about', element: <About /> },
        { path: 'chatbot', element: <ProtectedRoute><Chatbot /></ProtectedRoute> },
      ]
    }
  ]);

  return (
    <ProfileContext.Provider value={{ profileData, setProfileData }}>
      <RouterProvider router={routers} />
    </ProfileContext.Provider>
  );
}

function App() {
  return (
      <UserContextProvider>
        <GlobalContextProvider>
          <ProfileProvider>
              <AppContent />
          </ProfileProvider>
        </GlobalContextProvider>
      </UserContextProvider>
  );
}

export default App;
