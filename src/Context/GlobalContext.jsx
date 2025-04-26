import { useState } from 'react';
import { createContext } from 'react';

export let GlobalContext = createContext();
let userToken = 'accessToken_'+localStorage.getItem('userToken');

let headers = {
    accesstoken:userToken
}

export default function GlobalContextProvider(props) {
    const [vulnsBackendData, setVulnsBackendData] = useState(null);
    const [scanDate, setscanDate] = useState([]);
    return <GlobalContext.Provider value={{vulnsBackendData,setVulnsBackendData,scanDate, setscanDate , headers}}>
        {props.children}
    </GlobalContext.Provider>
}
