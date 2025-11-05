import { useState, useEffect, useRef } from 'react';
import { Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import './App.css';

// Icons (remain the same)
import { 
    FiGrid, FiList, FiSettings, FiUsers, FiLogOut, FiLogIn, FiUserPlus, FiBookOpen, FiCalendar, FiHome, FiUser, FiBriefcase // 1. Added FiUser
} from 'react-icons/fi';

// Page Imports (remain the same)
import Homepage from './pages/Homepage';
import BookingPage from './pages/BookingPage';
import BookingsListPage from './pages/BookingsListPage';
import MyBookingsPage from './pages/MyBookingsPage';
import RoomManagementPage from './pages/RoomManagementPage';
import HotelManagementPage from './pages/HotelManagementPage';
import DashboardPage from './pages/DashboardPage';
import UserManagementPage from './pages/UserManagementPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

import ForecastDashboard from './pages/ForecastDashboard';

// Route Protectors (remain the same)
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';

function App() {
    const { isAuthenticated, isAdmin, logout, user } = useAuth();
    const [isAdminDropdownOpen, setIsAdminDropdownOpen] = useState(false);
    const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false); // 2. State for user dropdown
    const navigate = useNavigate();
    const location = useLocation();
    const adminDropdownRef = useRef(null); // Renamed ref for clarity
    const userDropdownRef = useRef(null);  // 3. Ref for user dropdown

    // Effect to close dropdowns on navigation
    useEffect(() => {
        setIsAdminDropdownOpen(false);
        setIsUserDropdownOpen(false); // Close user dropdown too
    }, [location]);

    // Effect to handle clicks outside BOTH dropdowns
    useEffect(() => {
        const handleClickOutside = (event) => {
            // Close admin dropdown if click is outside
            if (adminDropdownRef.current && !adminDropdownRef.current.contains(event.target)) {
                setIsAdminDropdownOpen(false);
            }
            // Close user dropdown if click is outside
            if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
                setIsUserDropdownOpen(false);
            }
        };

        // Add listener if either dropdown is open
        if (isAdminDropdownOpen || isUserDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isAdminDropdownOpen, isUserDropdownOpen]); // Depend on both states

    const handleLogout = () => {
        logout();
        setIsAdminDropdownOpen(false);
        setIsUserDropdownOpen(false); // Close user dropdown on logout
        navigate('/');
    };

    const toggleAdminDropdown = () => setIsAdminDropdownOpen(prev => !prev);
    const toggleUserDropdown = () => setIsUserDropdownOpen(prev => !prev); // 4. Toggle function for user dropdown

    return (
        <>
            <nav className="navbar">
                <NavLink 
                    to={isAuthenticated ? (isAdmin ? "/dashboard" : "/") : "/"} // Guest home is now "/"
                    className="nav-brand"
                >
                    <img src='assets/logo.svg'  style={{width:'256px' , height:'40px'}}></img>  
                </NavLink>
                
                {/* --- Main Links (Now empty for guests, handled by dropdown) --- */}
                <div className="nav-links">
                   {/* This section is intentionally empty now for guests */}
                </div>

                {/* --- Auth & User/Admin Links --- */}
                <div className="nav-auth">
                    {isAuthenticated ? (
                        <>
                           {/* --- User Dropdown --- */}
                           {!isAdmin && (
                                <div className="nav-user-dropdown" ref={userDropdownRef}> {/* 5. User dropdown structure */}
                                    <button className="nav-user-btn" onClick={toggleUserDropdown}>
                                        <FiUser className="nav-icon"/> Welcome, {user.first_name}!
                                    </button>
                                    {isUserDropdownOpen && (
                                        <div className="dropdown-content">
                                            <NavLink to="/book"><FiCalendar className="nav-icon" /> Book a Room</NavLink>
                                            <NavLink to="/my-bookings"><FiBookOpen className="nav-icon" /> My Bookings</NavLink>
                                            {/* You could add a "Profile" link here later */}
                                            <button onClick={handleLogout} className="dropdown-logout-btn">
                                                <FiLogOut className="nav-icon" /> Logout
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* --- Admin Dropdown --- */}
                            {isAdmin && (
                                <>
                                    <span className="nav-user">Admin: {user.first_name}</span> {/* Identify admin */}
                                    <div className="nav-admin-dropdown" ref={adminDropdownRef}>
                                        <button className="nav-admin-btn" onClick={toggleAdminDropdown}>
                                            <FiSettings className="nav-icon" /> Admin Menu
                                        </button>
                                        {isAdminDropdownOpen && (
                                            <div className="dropdown-content">
                                                <NavLink to="/dashboard"><FiGrid className="nav-icon" /> Dashboard</NavLink>
                                                <NavLink to="/bookings"><FiList className="nav-icon" /> All Bookings</NavLink>
                                                <NavLink to="/rooms"><FiSettings className="nav-icon" /> Room Management</NavLink>
                                                <NavLink to="/hotel-management"><FiBriefcase className="nav-icon" /> Hotel Management</NavLink>
                                                <NavLink to="/users"><FiUsers className="nav-icon" /> User Management</NavLink>
                                                <button onClick={handleLogout} className="dropdown-logout-btn">
                                                    <FiLogOut className="nav-icon" /> Logout
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </>
                    ) : (
                        // Login/Register links remain the same
                        <>
                            <NavLink to="/login" className="nav-auth-link">
                                <FiLogIn className="nav-icon"/> Login
                            </NavLink>
                            <NavLink to="/register" className="nav-auth-link register-btn">
                                <FiUserPlus className="nav-icon"/> Register
                            </NavLink>
                        </>
                    )}
                </div>
            </nav>
            
            <main className="container">
                 {/* Routes remain exactly the same */}
                 <Routes>
                    <Route path="/" element={<Homepage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route element={<ProtectedRoute />}>
                        <Route path="/book" element={<BookingPage />} />
                        <Route path="/my-bookings" element={<MyBookingsPage />} />
                    </Route>
                    <Route element={<AdminRoute />}>
                        <Route path="/dashboard" element={<DashboardPage />} />
                        <Route path="/bookings" element={<BookingsListPage />} />
                        <Route path="/rooms" element={<RoomManagementPage />} />
                        <Route path="/hotel-management" element={<HotelManagementPage />} />
                        <Route path="/users" element={<UserManagementPage />} />
                        <Route path="/forecast" element={<ForecastDashboard />} />
                    </Route>
                    <Route path="*" element={<h1>404 Not Found</h1>} />
                </Routes>
            </main>
        </>
    )
}

export default App;