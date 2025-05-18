'use client'

import React, { useContext, useEffect } from 'react'
import { Outlet } from 'react-router-dom';
import Navbar from '../Navbar/Navbar';
import Footer from '../Footer/Footer';
import { UserContext } from '../../Context/UserContext';
import Lenis from 'lenis';
export default function Layout() {
    let { setUserToken } = useContext(UserContext);
    useEffect(() => {
        if (localStorage.getItem('userToken') !== null) {
            setUserToken(localStorage.getItem('userToken'));
        }
    }, [])

    useEffect(() => {
        const lenis = new Lenis();
        function raf(time) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);
    }, []);
    return <>
        <Navbar />
        <Outlet></Outlet>
        <Footer />
    </>
}
