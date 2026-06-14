import React, { useState } from 'react';
import { 
    Mail, 
    Lock, 
    ArrowRight, 
    Eye, 
    EyeOff
} from 'lucide-react';
import { toast } from 'react-toastify'; 
import axios from 'axios'; // Import axios
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Import your Auth Context

const LoginPage = () => {
    const { setAuth } = useAuth(); // Get the setter from context
    
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from?.pathname || "/"; // Where to send them after login

    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // 1. Make the API Call
            const response = await axios.post(`${import.meta.env.VITE_BACK}/auth/login`, 
                JSON.stringify(formData),
                {
                    headers: { 'Content-Type': 'application/json' },
                    withCredentials: true // Crucial: This allows the server to set the HTTP-Only cookie
                }
            );

            // 2. Extract Data
            const accessToken = response?.data?.accessToken;
            const user = response?.data?.user;

            // 3. Save to Context (Memory)
            setAuth({ user, accessToken });

            // 4. Success UI
            setLoading(false);
            toast.success(`Welcome back, ${user?.name || "Operator"}.`);
            
            // 5. Redirect (Go to Dashboard or the page they tried to visit)
            navigate(from, { replace: true });

        } catch (err) {
            setLoading(false);
            
            // Handle specific error codes
            if (!err?.response) {
                toast.error('No Server Response');
            } else if (err.response?.status === 400) {
                toast.error('Missing Username or Password');
            } else if (err.response?.status === 401) {
                toast.error('Unauthorized: Invalid Credentials');
            } else {
                toast.error('Login Failed');
            }
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background font-display relative overflow-hidden p-4" style={{backgroundColor: "#030e14", backgroundImage: "radial-gradient(circle at center,#0b2a33 0%,   /* Darker, muted teal */#020b10 100%  /* Almost black */)"}}>
            
            {/* Background Atmosphere */}
            {/* <div className="absolute inset-0 opacity-10 pointer-events-none">
                <svg
                    fill="none"
                    preserveAspectRatio="none"
                    viewBox="0 0 472 150"
                    width="100%"
                    height="100%"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        d="M0 109C18.1538 109 18.1538 21 36.3077 21C54.4615 21 54.4615 41 72.6154 41C90.7692 41 90.7692 93 108.923 93C127.077 93 127.077 33 145.231 33C163.385 33 163.385 101 181.538 101C199.692 101 199.692 61 217.846 61C236 61 236 45 254.154 45C272.308 45 272.308 121 290.462 121C308.615 121 308.615 149 326.769 149C344.923 149 344.923 1 363.077 1C381.231 1 381.231 81 399.385 81C417.538 81 417.538 129 435.692 129C453.846 129 453.846 25 472 25"
                        stroke="var(--color-primary)"
                        strokeLinecap="round"
                        strokeWidth="2"
                    ></path>
                </svg>
            </div> */}

            {/* Main Card */}
            <div className="w-full max-w-md bg-card-dark border border-gray-700 rounded-2xl p-8 shadow-2xl relative z-10 card-lift animate-fade-in">
                
                {/* Header */}
                <div className="text-center mb-8 flex flex-col items-center">
                    <svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 136.788 171.25" className="w-14 h-16 mb-4">
                        <g fill="#64FFDA">
                            <path d="M107.71,137.94c-9.13,11.65-22.21,24.63-39.55,33.31-18.88-9.44-32.59-24.05-41.68-36.51-2.05-2.82-3.88-5.53-5.47-8.04,10.01-2.78,24.77-3.79,42.06,4.58,6.6,3.2,13.6,5.56,20.86,6.68,6.84,1.04,15.24,1.52,23.77-.02h0Z"/>
                            <path d="M122.01,115.87s-.03.06-.05.09c-1.46,2.82-3.67,6.76-6.65,11.34-10.65,3.31-21.67,2.9-30.25,1.59-7.26-1.12-14.26-3.48-20.86-6.68-20.74-10.05-37.84-6.59-47.48-2.78-1.68-3.03-2.84-5.41-3.49-6.83h0c-.28-.64-.48-1.07-.57-1.29,8.2-4.14,28.16-11.22,53.38.69,6.77,3.2,13.95,5.56,21.39,6.68,9.75,1.45,22.6,1.8,34.57-2.81h.01Z"/>
                            <path d="M28.47,57.84c40.83,51.03,80.52,0,80.52,0-45.36-48.77-80.52,0-80.52,0ZM68.73,73.71c-8.46,0-15.31-6.85-15.31-15.31s6.85-15.31,15.31-15.31,15.31,6.85,15.31,15.31-6.85,15.31-15.31,15.31Z"/>
                            <circle cx="68.73" cy="58.4" r="6.24"/>
                            <path d="M136.71,19.81c-.02-.82-.61-1.51-1.42-1.64-6.93-1.2-38.86-7.11-65.99-18.17h-1.13C41.03,11.06,8.53,16.77,1.5,17.92c-.81.14-1.41.83-1.42,1.64-.2,8.96-.84,58.11,9.61,85.2,4.99-3.07,27.08-14.75,56.24-.95,6.76,3.2,13.92,5.56,21.34,6.67,11.16,1.68,26.39,1.89,39.7-5.17.1-.24.19-.49.28-.73,10.29-27.2,9.65-75.9,9.45-84.77h.01ZM17.13,57.84s47.63-68.04,103.2,0c0,0-51.03,70.31-103.2,0Z"/>
                            <path d="M28.47,57.84c40.83,51.03,80.52,0,80.52,0-45.36-48.77-80.52,0-80.52,0ZM68.73,73.71c-8.46,0-15.31-6.85-15.31-15.31s6.85-15.31,15.31-15.31,15.31,6.85,15.31,15.31-6.85,15.31-15.31,15.31Z"/>
                            <circle cx="68.73" cy="58.4" r="6.24"/>
                            <path d="M28.47,57.84c40.83,51.03,80.52,0,80.52,0-45.36-48.77-80.52,0-80.52,0ZM68.73,73.71c-8.46,0-15.31-6.85-15.31-15.31s6.85-15.31,15.31-15.31,15.31,6.85,15.31,15.31-6.85,15.31-15.31,15.31Z"/>
                            <circle cx="68.73" cy="58.4" r="6.24"/>
                            <circle cx="68.73" cy="58.4" r="6.24"/>
                            <circle cx="68.73" cy="58.4" r="6.24"/>
                        </g>
                    </svg>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
                        Welcome Back
                    </h1>
                    <p className="text-text-secondary">
                        Enter your credentials to access the DeepGuard network.
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-text-secondary ml-1">Email</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Mail className="h-5 w-5 text-gray-500 group-focus-within:text-primary transition-colors" />
                            </div>
                            <input
                                type="email"
                                name="email"
                                required
                                className="block w-full pl-10 pr-3 py-2.5 bg-background-dark border border-gray-700 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary text-text-main placeholder-gray-600 transition-all outline-none"
                                placeholder="name@deepguard.sec"
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-text-secondary ml-1">Password</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Lock className="h-5 w-5 text-gray-500 group-focus-within:text-primary transition-colors" />
                            </div>
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                required
                                className="block w-full pl-10 pr-10 py-2.5 bg-background-dark border border-gray-700 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary text-text-main placeholder-gray-600 transition-all outline-none"
                                placeholder="••••••••••••"
                                onChange={handleChange}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-text-main transition-colors"
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>
                    {/* Action Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-primary/10 border border-primary text-primary hover:bg-primary hover:text-black font-bold rounded-lg transition-all duration-300 transform active:scale-[0.98] group"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>
                                <span>Login</span>
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;