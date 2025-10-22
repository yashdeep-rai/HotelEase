import { useState, useEffect, useRef } from 'react'; // 1. Import useEffect, useRef
import { Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom'; // 2. Import useLocation
import { useAuth } from './context/AuthContext';
import './App.css';

// 3. Import Icons from react-icons
import { 
    FiGrid, FiList, FiSettings, FiUsers, FiLogOut, FiLogIn, FiUserPlus, FiBookOpen, FiCalendar, FiHome 
} from 'react-icons/fi'; // Example icons from Feather Icons set

// Page Imports (remain the same)
import Homepage from './pages/Homepage';
import BookingPage from './pages/BookingPage';
import BookingsListPage from './pages/BookingsListPage';
import MyBookingsPage from './pages/MyBookingsPage';
import RoomManagementPage from './pages/RoomManagementPage';
import DashboardPage from './pages/DashboardPage';
import UserManagementPage from './pages/UserManagementPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// Route Protectors (remain the same)
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';

function App() {
    const { isAuthenticated, isAdmin, logout, user } = useAuth();
    const [isAdminDropdownOpen, setIsAdminDropdownOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation(); // 4. Get current location
    const dropdownRef = useRef(null); // 5. Ref to detect clicks outside dropdown

    // 6. Effect to close dropdown on navigation
    useEffect(() => {
        setIsAdminDropdownOpen(false); // Close dropdown whenever the route changes
    }, [location]);

    // 7. Effect to handle clicks outside the dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsAdminDropdownOpen(false);
            }
        };
        // Add listener if dropdown is open
        if (isAdminDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            // Remove listener if dropdown is closed
            document.removeEventListener('mousedown', handleClickOutside);
        }
        // Cleanup listener on component unmount or when dropdown closes
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isAdminDropdownOpen]);

    const handleLogout = () => {
        logout();
        setIsAdminDropdownOpen(false); // Ensure dropdown is closed on logout
        navigate('/');
    };

    const toggleAdminDropdown = () => {
        setIsAdminDropdownOpen(prev => !prev); // Toggle on click
    };

    return (
        <>
            <nav className="navbar">
                {/* Brand now links to Admin Dashboard or Guest Booking page if logged in */}
                <NavLink 
                    to={isAuthenticated ? (isAdmin ? "/dashboard" : "/book") : "/"} 
                    className="nav-brand"
                >
                    <FiHome className="nav-icon" /> HotelEase 
                </NavLink>
                
                {/* --- Main Links (No Home button anymore) --- */}
                <div className="nav-links">
                    {/* Only show these if logged in as guest */}
                    {isAuthenticated && !isAdmin && (
                        <>
                            <NavLink to="/book"><FiCalendar className="nav-icon" /> Book a Room</NavLink>
                            <NavLink to="/my-bookings"><FiBookOpen className="nav-icon" /> My Bookings</NavLink>
                        </>
                    )}
                </div>

                {/* --- Auth & Admin Links --- */}
                <div className="nav-auth">
                    {isAuthenticated ? (
                        <>
                            <span className="nav-user">Welcome, {user.first_name}!</span>
                            
                            {/* --- Admin Dropdown (Click-based) --- */}
                            {isAdmin && (
                                <div className="nav-admin-dropdown" ref={dropdownRef}> {/* Added ref */}
                                    <button className="nav-admin-btn" onClick={toggleAdminDropdown}>
                                        <FiSettings className="nav-icon" /> Admin Menu
                                    </button>
                                    {isAdminDropdownOpen && (
                                        <div className="dropdown-content">
                                            <NavLink to="/dashboard"><FiGrid className="nav-icon" /> Dashboard</NavLink>
                                            <NavLink to="/bookings"><FiList className="nav-icon" /> All Bookings</NavLink>
                                            <NavLink to="/rooms"><FiSettings className="nav-icon" /> Room Management</NavLink>
                                            <NavLink to="/users"><FiUsers className="nav-icon" /> User Management</NavLink>
                                            {/* Logout moved inside */}
                                            <button onClick={handleLogout} className="dropdown-logout-btn">
                                                <FiLogOut className="nav-icon" /> Logout
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Show logout button directly for guests */}
                            {!isAdmin && (
                                <button onClick={handleLogout} className="nav-logout-btn">
                                    <FiLogOut className="nav-icon"/> Logout
                                </button>
                            )}
                        </>
                    ) : (
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
                <Routes>
                    {/* Routes remain exactly the same */}
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
                        <Route path="/users" element={<UserManagementPage />} />
                    </Route>
                    <Route path="*" element={<h1>404 Not Found</h1>} />
                </Routes>
            </main>
        </>
    )
}

export default App;