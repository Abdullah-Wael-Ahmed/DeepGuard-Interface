import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const PublicRoute = () => {
    const { auth } = useAuth();

    return (
        auth?.accessToken
            ? <Navigate to="/" replace />
            : <Outlet />
    );
};
export default PublicRoute;