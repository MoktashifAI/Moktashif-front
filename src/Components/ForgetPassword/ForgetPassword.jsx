import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import style from './ForgetPassword.module.css';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';

const ForgetPassword = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const response = await axios.patch('http://localhost:3000/user/forgetPassword', { email });

            if (response?.data?.success) {
                setSuccess('OTP has been sent to your email');
                setStep(2);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordReset = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const response = await axios.patch('http://localhost:3000/user/resetPassword', {
                email,
                OTP: otp,
                newPassword: newPassword
            });
            if (response.data.success) {
                setSuccess('Password has been reset successfully');
                setTimeout(() => {
                    navigate('/signin');
                }, 2000);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return <>
        <Helmet>
            <title>Forgot Password</title>
        </Helmet>
        <div className={style.authContainer}>
            <motion.div
                className={style.authForm}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <h2>Reset Password</h2>
                {error && <div className={style.errorMessage}>{error}</div>}
                {success && <div className={style.successMessage}>{success}</div>}

                {step === 1 ? (
                    <motion.form
                        onSubmit={handleEmailSubmit}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        <div className={style.formGroup}>
                            <label className={style.formLabel} htmlFor="email">Email</label>
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="Enter your email"
                            />
                        </div>
                        <button
                            type="submit"
                            className={style.submitButton}
                            disabled={loading}
                        >
                            {loading ? 'Sending...' : 'Send OTP'}
                        </button>
                    </motion.form>
                ) : (
                    <motion.form
                        onSubmit={handlePasswordReset}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        <div className={style.formGroup}>
                            <label className={style.formLabel}>Email</label>
                            <input
                                type="email"
                                value={email}
                                disabled
                                className={style.disabledInput}
                            />
                        </div>
                        <div className={style.formGroup}>
                            <label className={style.formLabel} htmlFor="otp">OTP</label>
                            <input
                                type="text"
                                id="otp"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                required
                                placeholder="Enter OTP"
                            />
                        </div>
                        <div className={style.formGroup}>
                            <label className={style.formLabel} htmlFor="newPassword">New Password</label>
                            <input
                                type="password"
                                id="newPassword"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                placeholder="Enter new password"
                            />
                        </div>
                        <button
                            type="submit"
                            className={style.submitButton}
                            disabled={loading}
                        >
                            {loading ? 'Resetting...' : 'Reset Password'}
                        </button>
                    </motion.form>
                )}
            </motion.div>
        </div>
    </>
};

export default ForgetPassword;
