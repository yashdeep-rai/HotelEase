import { Routes, Route, Link } from 'react-router-dom'
import './App.css'
import Homepage from './pages/Homepage'
import BookingPage from './pages/BookingPage'
import BookingsListPage from './pages/BookingsListPage'
import AddGuestPage from './pages/AddGuestPage' // 1. IMPORT new page

function App() {
  return (
    <>
      <nav className="navbar">
        <Link to="/" className="nav-brand">HotelEase</Link>
        <div className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/add-guest">Add Guest</Link> {/* 2. ADD new link */}
          <Link to="/book">Book a Room</Link>
          <Link to="/bookings">All Bookings</Link>
        </div>
      </nav>
      
      <main className="container">
        <Routes>
          <Route path="/" element={<Homepage />} />
          <Route path="/add-guest" element={<AddGuestPage />} /> {/* 3. ADD new route */}
          <Route path="/book" element={<BookingPage />} />
          <Route path="/bookings" element={<BookingsListPage />} />
        </Routes>
      </main>
    </>
  )
}

export default App