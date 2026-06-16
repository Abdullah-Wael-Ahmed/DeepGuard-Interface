import React, { useEffect, useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

const SessionManager = () => {
    const { auth, logout, sessionTimeout } = useAuth();
    const navigate = useNavigate();
    const timerRef = useRef(null);

    // 1. Axios Response Interceptor to catch 401/403 errors
    useEffect(() => {
        const responseInterceptor = axios.interceptors.response.use(
            (response) => response,
            async (error) => {
                if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                    const isLoginRequest = error.config?.url?.includes('/auth/login');
                    const isRefreshRequest = error.config?.url?.includes('/auth/refresh');

                    if (!isLoginRequest && !isRefreshRequest) {
                        // Clear client credentials state immediately
                        logout();

                        // Fire-and-forget server cookie clear
                        try {
                            await axios.post(`${import.meta.env.VITE_BACK}/auth/logout`, {}, {
                                withCredentials: true
                            });
                        } catch (logoutErr) {
                            console.warn("Server logout request failed:", logoutErr);
                        }

                        // Redirect user to login page
                        navigate('/login');

                        // Show toaster message
                        if (!toast.isActive('session-expired-toast')) {
                            toast.error('Your session has ended. Please log in again.', {
                                toastId: 'session-expired-toast'
                            });
                        }
                    }
                }
                return Promise.reject(error);
            }
        );

        return () => {
            axios.interceptors.response.eject(responseInterceptor);
        };
    }, [logout, navigate]);

    // 2. Inactivity Auto-logout Timer
    useEffect(() => {
        // If not logged in, clean up any running timer and return
        if (!auth?.accessToken) {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            return;
        }

        const parseTimeout = (timeoutStr) => {
            if (!timeoutStr || timeoutStr === 'Never') return null;
            const num = parseInt(timeoutStr, 10);
            if (isNaN(num)) return null;

            if (timeoutStr.includes('hour')) {
                return num * 60 * 60 * 1000;
            }
            return num * 60 * 1000; // minutes
        };

        const timeoutMs = parseTimeout(sessionTimeout);

        // If 'Never' or invalid timeout value, clear timer and don't schedule
        if (!timeoutMs) {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            return;
        }

        const handleInactivityTimeout = async () => {
            logout();

            try {
                await axios.post(`${import.meta.env.VITE_BACK}/auth/logout`, {}, {
                    withCredentials: true
                });
            } catch (err) {
                console.warn("Inactivity logout request failed:", err);
            }

            navigate('/login');

            if (!toast.isActive('session-expired-toast')) {
                toast.error('Your session has ended due to inactivity.', {
                    toastId: 'session-expired-toast'
                });
            }
        };

        const resetTimer = () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(handleInactivityTimeout, timeoutMs);
        };

        // Initialize timer
        resetTimer();

        // Listen for activity events
        const events = ['mousemove', 'keydown', 'click', 'scroll', 'mousedown', 'touchstart'];
        events.forEach((event) => {
            window.addEventListener(event, resetTimer);
        });

        // Cleanup function
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            events.forEach((event) => {
                window.removeEventListener(event, resetTimer);
            });
        };
    }, [auth?.accessToken, sessionTimeout, logout, navigate]);

    return <Outlet />;
};

export default SessionManager;
