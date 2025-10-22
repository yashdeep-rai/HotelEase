// frontend/src/components/AdminRoute.jsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AdminRoute = () => {
    const { isAuthenticated, isAdmin } = useAuth();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }
    
    if (!isAdmin) {
        // Redirect to home page if not an admin
        return <Navigate to="/" replace />;
    }

    return <Outlet />; // Render the admin child route
};

export default AdminRoute;