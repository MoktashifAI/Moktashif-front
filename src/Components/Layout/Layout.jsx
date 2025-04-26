import React, { useContext, useEffect } from 'react'
import { Outlet } from 'react-router-dom';
import Navbar from '../Navbar/Navbar';
import Footer from '../Footer/Footer';
import { UserContext } from '../../Context/UserContext';
import { Offline , Online } from 'react-detect-offline';
export default function Layout() {
    let { setUserToken } = useContext(UserContext);
    useEffect(() => {
        if (localStorage.getItem('userToken') !== null) {
            setUserToken(localStorage.getItem('userToken'));
        }
    }, [])
    return <>
        <Navbar />
        <Outlet></Outlet>
        <div>
            <Offline>
                <div className={`network`}>
                    <i className='fa-solid fa-wifi'></i>
                    <span> No internet connection</span>
                </div>
            </Offline>
        </div>
        <Footer />
    </>
}
