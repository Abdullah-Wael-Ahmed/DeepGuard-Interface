import { createContext, useState, useContext } from "react";

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
    const [auth, setAuth] = useState({}); 
    const [sessionTimeout, setSessionTimeout] = useState(() => {
        const saved = localStorage.getItem('deepguard-session-timeout');
        return saved || '15 minutes';
    });

    const logout = () => {
        setAuth({});
    };

    return (
        <AuthContext.Provider value={{ auth, setAuth, logout, sessionTimeout, setSessionTimeout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);

export default AuthContext;