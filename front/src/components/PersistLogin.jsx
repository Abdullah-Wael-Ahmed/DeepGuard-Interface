import { Outlet } from "react-router-dom";
import { useState, useEffect } from "react";
import useRefreshToken from "../hooks/useRefreshToken";
import { useAuth } from "../context/AuthContext";
import { Loader2 } from "lucide-react";

const PersistLogin = () => {
    const [isLoading, setIsLoading] = useState(true);
    const refresh = useRefreshToken();
    const { auth } = useAuth();

    useEffect(() => {
        const verifyRefreshToken = async () => {
            try {
                // try to get a new access token
                await refresh();
            } catch (err) {
                console.error("Persist login failed:", err);
            } finally {
                setIsLoading(false);
            }
        }

        // only run this if we do not have a token yet (like on page reload)
        !auth?.accessToken ? verifyRefreshToken() : setIsLoading(false);
    }, []);

    return (
        <>
            {isLoading ? (
                <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-main)] text-[var(--text-main)]">
                    <Loader2 className="w-12 h-12 animate-spin text-[var(--color-primary)]" />
                </div>
            ) : (
                <Outlet />
            )}
        </>
    );
};

export default PersistLogin;