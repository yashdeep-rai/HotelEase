import { Routes, Route, Link } from 'react-router-dom'
import './App.css'
import Homepage from './pages/Homepage'
import BookingPage from './pages/BookingPage' // Import the new page

function App() {
  return (
    <>
      <nav className="navbar">
        <Link to="/" className="nav-brand">HotelEase</Link>
        <div className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/book">Book a Room</Link>
        </div>
      </nav>
      
      <main className="container">
        <Routes>
          <Route path="/" element={<Homepage />} />
          <Route path="/book" element={<BookingPage />} />
        </Routes>
      </main>
    </>
  )
}

export default App