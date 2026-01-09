import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const useRefreshToken = () => {
    const { setAuth } = useAuth();

    const refresh = async () => {
        const response = await axios.get(`${import.meta.env.VITE_BACK}/auth/refresh`, {
            withCredentials: true
        });
        
        setAuth(prev => {
            console.log("Old Auth:", JSON.stringify(prev));
            console.log("New Access Token:", response.data.accessToken);
            return { 
                ...prev, 
                accessToken: response.data.accessToken,
                user: response.data.user
            };
        });
        return response.data.accessToken;
    }
    return refresh;
};

export default useRefreshToken;