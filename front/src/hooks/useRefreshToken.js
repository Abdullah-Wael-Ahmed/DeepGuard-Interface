import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const useRefreshToken = () => {
    const { setAuth } = useAuth();

    const refresh = async () => {
        const response = await axios.get(`${import.meta.env.VITE_BACK}/auth/refresh`, {
            withCredentials: true
        });
        
        setAuth(prev => {
            console.log("Session Restored:", response.data.user);
            return { 
                ...prev, 
                accessToken: response.data.accessToken,
                user: response.data.user // This will be populated
            };
        });
        return response.data.accessToken;
    }
    return refresh;
};

export default useRefreshToken;