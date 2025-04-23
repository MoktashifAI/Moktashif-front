import { useState } from 'react';
import { createContext } from 'react';

export let GlobalContext = createContext();

export default function GlobalContextProvider(props) {
    const [vulnsBackendData, setVulnsBackendData] = useState(null);
    const [scanDate, setscanDate] = useState([]);
    return <GlobalContext.Provider value={{vulnsBackendData,setVulnsBackendData,scanDate, setscanDate}}>
        {props.children}
    </GlobalContext.Provider>
}
