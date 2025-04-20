'use client'
import React, { useState, useEffect } from 'react'
import style from './ContactSupport.module.css'
import { FaEnvelope, FaPhone, FaMapMarkerAlt, FaPaperPlane, FaHeadset } from 'react-icons/fa'

const ContactSupport = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        subject: '',
        message: ''
    })

    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        setIsVisible(true)
    }, [])

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: value
        }))
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        // Handle form submission here
        console.log('Form submitted:', formData)
    }

    return (
        <div className={`${style.contactContainer}`}>
            <div className={style.heroSection}>
                <div className={`${style.heroContent} ${isVisible ? style.fadeIn : ''}`}>
                    <h1 className={style.heroTitle}>Get in Touch</h1>
                    <p className={style.heroSubtitle}>
                        We're here to help and answer any questions you might have. 
                        We look forward to hearing from you!
                    </p>
                </div>
            </div>

            <div className={` ${style.contactGrid}`}>
                <div className={`mb-10 ${style.contactForm} ${isVisible ? style.slideInLeft : ''}`}>
                    <div className={style.formHeader}>
                        <FaHeadset className={style.formIcon} />
                        <h2>Send us a Message</h2>
                    </div>
                    <form onSubmit={handleSubmit}>
                        <div className={style.formGroup}>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className={style.formInput}
                                placeholder="Your Name"
                                required
                            />
                        </div>

                        <div className={style.formGroup}>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className={style.formInput}
                                placeholder="Your Email"
                                required
                            />
                        </div>

                        <div className={style.formGroup}>
                            <input
                                type="text"
                                id="subject"
                                name="subject"
                                value={formData.subject}
                                onChange={handleChange}
                                className={style.formInput}
                                placeholder="Subject"
                                required
                            />
                        </div>

                        <div className={style.formGroup}>
                            <textarea
                                id="message"
                                name="message"
                                value={formData.message}
                                onChange={handleChange}
                                className={style.formTextarea}
                                placeholder="Your Message"
                                required
                            />
                        </div>

                        <button 
                            type="submit" 
                            className={style.submitButton}
                        >
                            <FaPaperPlane className={style.buttonIcon} />
                            Send Message
                        </button>
                    </form>
                </div>

                <div className={`mb-10 ${style.contactInfo}`}>
                    <div className={`${style.infoCard} ${isVisible ? style.slideInRight : ''}`}>
                        <div className={style.infoIconWrapper}>
                            <FaEnvelope className={style.infoIcon} />
                        </div>
                        <h3 className={style.infoTitle}>Email Us</h3>
                        <p className={style.infoText}>
                            support@moktashif.com
                        </p>
                        <p className={style.infoSubtext}>
                            We typically respond within 24 hours
                        </p>
                    </div>

                    <div className={`${style.infoCard} ${isVisible ? style.slideInRight : ''}`} style={{ animationDelay: '0.2s' }}>
                        <div className={style.infoIconWrapper}>
                            <FaPhone className={style.infoIcon} />
                        </div>
                        <h3 className={style.infoTitle}>Call Us</h3>
                        <p className={style.infoText}>
                            +1 (555) 123-4567
                        </p>
                        <p className={style.infoSubtext}>
                            Monday - Friday, 9:00 AM - 5:00 PM EST
                        </p>
                    </div>

                    <div className={`${style.infoCard} ${isVisible ? style.slideInRight : ''}`} style={{ animationDelay: '0.4s' }}>
                        <div className={style.infoIconWrapper}>
                            <FaMapMarkerAlt className={style.infoIcon} />
                        </div>
                        <h3 className={style.infoTitle}>Visit Us</h3>
                        <p className={style.infoText}>
                            123 Tech Street
                        </p>
                        <p className={style.infoSubtext}>
                            Innovation City, IC 12345<br />
                            United States
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ContactSupport
