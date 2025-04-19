'use client'
import React, { useState } from 'react'
import style from './ContactSupport.module.css'
import { FaEnvelope, FaPhone, FaMapMarkerAlt } from 'react-icons/fa'

const ContactSupport = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        subject: '',
        message: ''
    })

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
        <div className={style.contactContainer}>
            <div className={style.contactHeader}>
                <h1 className={style.contactTitle}>Contact Support</h1>
                <p className={style.contactSubtitle}>
                    Have questions or need assistance? We're here to help! Fill out the form below and we'll get back to you as soon as possible.
                </p>
            </div>

            <div className={style.contactGrid}>
                <div className={style.contactForm}>
                    <form onSubmit={handleSubmit}>
                        <div className={style.formGroup}>
                            <label className={style.formLabel} htmlFor="name">Name</label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className={style.formInput}
                                required
                            />
                        </div>

                        <div className={style.formGroup}>
                            <label className={style.formLabel} htmlFor="email">Email</label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className={style.formInput}
                                required
                            />
                        </div>

                        <div className={style.formGroup}>
                            <label className={style.formLabel} htmlFor="subject">Subject</label>
                            <input
                                type="text"
                                id="subject"
                                name="subject"
                                value={formData.subject}
                                onChange={handleChange}
                                className={style.formInput}
                                required
                            />
                        </div>

                        <div className={style.formGroup}>
                            <label className={style.formLabel} htmlFor="message">Message</label>
                            <textarea
                                id="message"
                                name="message"
                                value={formData.message}
                                onChange={handleChange}
                                className={style.formTextarea}
                                required
                            />
                        </div>

                        <button type="submit" className={style.submitButton}>
                            Send Message
                        </button>
                    </form>
                </div>

                <div className={style.contactInfo}>
                    <div className={style.infoCard}>
                        <FaEnvelope className={style.infoIcon} />
                        <h3 className={style.infoTitle}>Email Us</h3>
                        <p className={style.infoText}>
                            support@moktashif.com<br />
                            We typically respond within 24 hours
                        </p>
                    </div>

                    <div className={style.infoCard}>
                        <FaPhone className={style.infoIcon} />
                        <h3 className={style.infoTitle}>Call Us</h3>
                        <p className={style.infoText}>
                            +1 (555) 123-4567<br />
                            Monday - Friday, 9:00 AM - 5:00 PM EST
                        </p>
                    </div>

                    <div className={style.infoCard}>
                        <FaMapMarkerAlt className={style.infoIcon} />
                        <h3 className={style.infoTitle}>Visit Us</h3>
                        <p className={style.infoText}>
                            123 Tech Street<br />
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
