import axios from 'axios';
import { useEffect, useRef, useState, useContext } from 'react';
import { createContext } from 'react';
import { UserContext } from './UserContext';

export let GlobalContext = createContext();

export default function GlobalContextProvider({ children }) {
    const userContext = useContext(UserContext);
    const [vulnsBackendData, setVulnsBackendData] = useState(null);
    const [scanDate, setscanDate] = useState([]);
    const [headers, setHeaders] = useState(null);

    useEffect(() => {
        // Only update headers if userContext is available
        if (userContext?.userToken) {
            const token = 'accessToken_' + userContext.userToken;
            setHeaders({
                accesstoken: token
            });
        } else {
            setHeaders(null);
        }
    }, [userContext?.userToken]);

    return (
        <GlobalContext.Provider 
            value={{ 
                vulnsBackendData, 
                setVulnsBackendData, 
                scanDate, 
                setscanDate, 
                headers,
                setHeaders 
            }}
        >
            {children}
        </GlobalContext.Provider>
    );
}
