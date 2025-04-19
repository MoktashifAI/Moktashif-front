import React from 'react'
import style from './Footer.module.css';
export default function Footer() {
    return (
        <footer className={style.footerContainer}>
            <div className={style.upperBorder}></div>
            <div className={style.footerStyle}>
                <div className={style.copyright}>Copyright © 2022 BRIX | All Rights Reserved</div>
                <div className={style.socialIconsDev}>
                    <div>
                        <i className={`cursor-pointer fa-brands fa-facebook-f ${style.social_icons}`} />
                        <i className={`cursor-pointer fa-brands fa-x-twitter ${style.social_icons}`}/>
                        <i className={`cursor-pointer fa-brands fa-instagram ${style.social_icons}`} />
                        <i className={`cursor-pointer fa-brands fa-linkedin-in ${style.social_icons}`} />
                    </div>
                </div>
            </div>
        </footer>
    )
}
