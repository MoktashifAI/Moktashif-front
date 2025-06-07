import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import style from "./Navbar.module.css";
import { Link } from "react-router-dom";
import "../../assets/GlobalStyle.css";
import ThemeMode from "../ThemeMode/ThemeMode";
import { useContext, useState, useRef, useEffect, useCallback } from "react";
import { UserContext } from "../../Context/UserContext.jsx";
import { useNavigate } from "react-router-dom";
import axios from 'axios';
import { GlobalContext } from "../../Context/GlobalContext.jsx";
import { useProfile } from '../../Context/ProfileContext';
import gsap from "gsap";

const DEFAULT_AVATAR = `https://ui-avatars.com/api/?name=User&background=${encodeURIComponent(getComputedStyle(document.documentElement).getPropertyValue('black'))}&color=FFFFFF&size=256`;

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function Navbar() {
  const { userToken, setUserToken } = useContext(UserContext);
  const { headers } = useContext(GlobalContext);
  const navigate = useNavigate();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const [chatInput, setChatInput] = useState("");
  const { profileData } = useProfile();
  const profilePhoto = profileData?.userImg?.secure_url || DEFAULT_AVATAR;
  const [loading, setLoading] = useState(false);
  const [showResultsButton, setShowResultsButton] = useState(false);
  const logoIconRef = useRef(null);

  const getUserProfile = useCallback(async () => {
    if (!userToken || !headers) {
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get(`http://localhost:3000/user/getProfile`, { 
        headers,
        validateStatus: (status) => status < 500
      });

      if (response.data?.success) {
        // This block is now empty as the profile data is handled by useProfile
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  }, [headers, userToken]);

  // Fetch profile when userToken or headers change
  useEffect(() => {
    getUserProfile();
  }, [getUserProfile]);

  useEffect(() => {
    // Check localStorage for results
    const stored = localStorage.getItem("vulnsBackendData");
    setShowResultsButton(!!(stored && JSON.parse(stored)?.length));
    // Listen for storage changes (in case results are added/removed in another tab)
    const handleStorage = () => {
      const stored = localStorage.getItem("vulnsBackendData");
      setShowResultsButton(!!(stored && JSON.parse(stored)?.length));
    };
    window.addEventListener("storage", handleStorage);
    // Listen for custom event to update results button immediately in this tab
    const handleCustomResultsUpdate = () => handleStorage();
    window.addEventListener("vulnsBackendDataUpdated", handleCustomResultsUpdate);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("vulnsBackendDataUpdated", handleCustomResultsUpdate);
    };
  }, []);

  const logOut = () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('vulnsBackendData');
    setUserToken(null);
    setIsProfileMenuOpen(false);
    setShowResultsButton(false);
    navigate('/home', { replace: true });
  };

  const handleChatInputKeyDown = (e) => {
    if (e.key === "Enter" && chatInput.trim() !== "") {
      navigate(`/chatbot?message=${encodeURIComponent(chatInput)}`);
      setChatInput("");
    }
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (logoIconRef.current) {
      // Entrance and wiggle animation
      gsap.fromTo(
        logoIconRef.current,
        { scale: 0.7, rotate: -60, opacity: 0 },
        {
          scale: 1,
          rotate: -20,
          opacity: 1,
          duration: 1,
          ease: "elastic.out(1, 0.5)",
          onComplete: () => {
            gsap.to(logoIconRef.current, {
              rotate: -10,
              duration: 1.2,
              repeat: -1,
              yoyo: true,
              ease: "sine.inOut"
            });
          }
        }
      );
    }
  }, []);

  return (
    <section as="nav" className={style.navBarStyle}>
      <div className="mx-10 px-2 sm:px-6 lg:px-8">
        <div className="relative flex h-16 items-center justify-between">
          {/* Mobile menu button */}
          <div className="absolute inset-y-0 left-0 flex items-center sm:hidden">
            <button className="group relative inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-700 hover:text-white focus:ring-2 focus:ring-white focus:outline-hidden focus:ring-inset">
              <span className="absolute -inset-0.5" />
              <span className="sr-only">Open main menu</span>
              <Bars3Icon
                aria-hidden="true"
                className="block size-6 group-data-open:hidden"
              />
              <XMarkIcon
                aria-hidden="true"
                className="hidden size-6 group-data-open:block"
              />
            </button>
          </div>

          {/* Logo and Desktop Navigation */}
          <div className="flex flex-1 items-center justify-center sm:items-stretch sm:justify-start">
            <div className="flex shrink-0 items-center">
              <Link to="/" className={style.navLogo}>
                <span ref={logoIconRef} className={style.logoIcon}>
                  <i 
                    className="fa-solid fa-bug" 
                    style={{
                      fontSize: "2.1rem",
                      color: "var(--fourth_color)",
                      transform: "rotate(-20deg)",
                      display: "inline-block"
                    }}
                  ></i>
                </span>
              </Link>
            </div>
            {/* Wide Chat Input */}
            <div className={style.chatInputWrapper}>
              <input
                type="text"
                className={style.chatInput}
                placeholder="Ask Moktashif Anything About Security ..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={handleChatInputKeyDown}
              />
            </div>
          </div>

          {/* Right side items */}
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0">
            <div className={style.RightLeftBorder}>
              <Link to={'/about'} className={`${style.about} fa-solid fa-info`}></Link>
              <ThemeMode />
              {showResultsButton && (
                <Link to="/results" className={style.resultsNavButton} title="View Results">
                  <i className="fa-solid fa-list-check"></i>
                </Link>
              )}
            </div>
            {/* Profile dropdown */}
            {userToken !== null ? <div className={style.profileMenuContainer} ref={profileMenuRef}>
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="relative flex rounded-full text-sm focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800 focus:outline-hidden"
              >
                <span className="absolute -inset-1.5" />
                <span className="sr-only">Open user menu</span>
                <Link to="/profile">
                <img
                  alt="Profile"
                  src={profilePhoto}
                  className={`size-9 rounded-full ${loading ? style.loadingImage : ''}`}
                />
                </Link>
              </button>
            </div> : ''}
            {/* signIn button */}
            <div className={`${style.signInContainerStyle}`}>
              {userToken !== null ? (
                <span onClick={logOut} className={`cursor-pointer ${style.signInStyle}`}>
                  Logout
                </span>
              ) : (
                <Link className={style.signInStyle} to="/signin">
                  SignIn
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
