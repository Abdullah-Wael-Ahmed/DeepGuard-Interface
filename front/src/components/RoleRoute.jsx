import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const RoleRoute = ({ allowedRoles }) => {
    const { auth } = useAuth();
    
    if (!auth?.accessToken) {
        return <Navigate to="/login" replace />;
    }

    const userRole = auth?.user?.role;
    if (!allowedRoles.includes(userRole)) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
};

export default RoleRoute;
