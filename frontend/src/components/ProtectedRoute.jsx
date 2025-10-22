// frontend/src/components/ProtectedRoute.jsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = () => {
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated) {
        // Redirect to login, saving the location they tried to visit
        return <Navigate to="/login" replace />;
    }

    return <Outlet />; // Render the child route
};

export default ProtectedRoute;