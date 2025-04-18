import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from "@headlessui/react";
import { Bars3Icon, BellIcon, XMarkIcon } from "@heroicons/react/24/outline";
import style from "./Navbar.module.css";
import { Link, useLocation } from "react-router-dom";
import "../../assets/GlobalStyle.css";
import ThemeMode from "../ThemeMode/ThemeMode";
import { useContext, useState, useRef, useEffect } from "react";
import { UserContext } from "../../Context/UserContext.jsx";
import { useNavigate } from "react-router-dom";

const navigation = [
  { name: "Home", href: "/", current: false },
  { name: "Scan", href: "/scanner", current: false },
  { name: "Results", href: "/results", current: false },
];

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function Navbar() {
  const { userToken, setUserToken } = useContext(UserContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  const logOut = () => {
    localStorage.setItem('userToken', null);
    setUserToken(null);
    navigate('/signin');
  };

  // Close profile menu when clicking outside
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

  return (
    <Disclosure as="nav" className={style.navBarStyle}>
      <div className="mx-10 px-2 sm:px-6 lg:px-8">
        <div className="relative flex h-16 items-center justify-between">
          {/* Mobile menu button */}
          <div className="absolute inset-y-0 left-0 flex items-center sm:hidden">
            <DisclosureButton className="group relative inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-700 hover:text-white focus:ring-2 focus:ring-white focus:outline-hidden focus:ring-inset">
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
            </DisclosureButton>
          </div>

          {/* Logo and Desktop Navigation */}
          <div className="flex flex-1 items-center justify-center sm:items-stretch sm:justify-start">
            <div className="flex shrink-0 items-center">
              <i className={`fa-solid fa-bug ${style.navLogo} `} />
            </div>
            {userToken !== null && (
              <div className="hidden sm:ml-6 sm:block">
                <div className="flex space-x-4">
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={classNames(
                        location.pathname === item.href
                          ? `${style.navLinksStyle} ${style.aHover}`
                          : style.navLinksStyle
                      )}
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right side items */}
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0">
            <div className={style.RightLeftBorder}>
              <ThemeMode />
              <button type="button">
                <BellIcon
                  aria-hidden="true"
                  className={`${style.notification} size-6`}
                />
              </button>
            </div>

            {/* Profile dropdown */}
            {userToken !== null && (
              <div className={style.profileMenuContainer} ref={profileMenuRef}>
                <button
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="relative flex rounded-full text-sm focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800 focus:outline-hidden"
                >
                  <span className="absolute -inset-1.5" />
                  <span className="sr-only">Open user menu</span>
                  <img
                    alt=""
                    src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                    className="size-8 rounded-full"
                  />
                </button>
                {isProfileMenuOpen && (
                  <div className={style.profileMenu}>
                    <Link
                      to="profile"
                      className={style.profileMenuItem}
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      Your Profile
                    </Link>
                    <Link
                      to=""
                      className={style.profileMenuItem}
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      Settings
                    </Link>
                  </div>
                )}
              </div>
            )}
            
            {/* signIn button */}
            <div className={style.signInContainerStyle}>
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

      {/* Mobile menu */}
      <DisclosurePanel className="sm:hidden">
        <div className="space-y-1 px-2 pt-2 pb-3">
          {navigation.map((item) => (
            <DisclosureButton
              key={item.name}
              as={Link}
              to={item.href}
              className={classNames(
                location.pathname === item.href
                  ? `${style.mobileMenuItem} ${style.aHover}`
                  : style.mobileMenuItem
              )}
            >
              {item.name}
            </DisclosureButton>
          ))}
        </div>
      </DisclosurePanel>
    </Disclosure>
  );
}
