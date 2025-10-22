import { Routes, Route, NavLink } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import './App.css';

// Page Imports
import Homepage from './pages/Homepage';
import BookingPage from './pages/BookingPage';
import BookingsListPage from './pages/BookingsListPage';
import RoomManagementPage from './pages/RoomManagementPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
// We don't need AddGuestPage, RegisterPage replaced it

// Route Protectors
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';

function App() {
  const { isAuthenticated, isAdmin, logout, user } = useAuth();

  return (
    <>
      <nav className="navbar">
        <NavLink to="/" className="nav-brand">HotelEase</NavLink>
        <div className="nav-links">
          <NavLink to="/">Home</NavLink>
          {isAdmin && (
            <>
              <NavLink to="/bookings">All Bookings</NavLink>
              <NavLink to="/rooms">Room Management</NavLink>
            </>
          )}
          {isAuthenticated && !isAdmin && (
            <NavLink to="/book">Book a Room</NavLink>
          )}
        </div>
        <div className="nav-links">
          {isAuthenticated ? (
            <>
              <span className="nav-user">Welcome, {user.first_name}!</span>
              <button onClick={logout} className="nav-logout-btn">Logout</button>
            </>
          ) : (
            <>
              <NavLink to="/login">Login</NavLink>
              <NavLink to="/register">Register</NavLink>
            </>
          )}
        </div>
      </nav>
      
      <main className="container">
        <Routes>
          {/* --- Public Routes --- */}
          <Route path="/" element={<Homepage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* --- Protected User Routes --- */}
          <Route element={<ProtectedRoute />}>
            <Route path="/book" element={<BookingPage />} />
            {/* You can add a "My Bookings" page here later */}
          </Route>

          {/* --- Protected Admin Routes --- */}
          <Route element={<AdminRoute />}>
            <Route path="/bookings" element={<BookingsListPage />} />
            <Route path="/rooms" element={<RoomManagementPage />} />
            {/* The old 'AddGuestPage' is obsolete, as admins can create users 
                on a new 'User Management' page if needed, or just use the
                register page with a special code. */}
          </Route>

          {/* --- Catch-all (Not Found) --- */}
          <Route path="*" element={<h1>404 Not Found</h1>} />
        </Routes>
      </main>
    </>
  )
}

export default App