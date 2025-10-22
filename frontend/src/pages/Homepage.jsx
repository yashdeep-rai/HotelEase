import { Link } from 'react-router-dom';
import './Homepage.css';

export default function Homepage() {
    return (
        <div className="homepage-container">
            {/* --- Hero Section --- */}
            <header className="hero-section">
                <div className="hero-content">
                    <h1>Welcome to HotelEase</h1>
                    <p className="hero-subtitle">
                        Your comfort is our priority. Manage bookings, explore services,
                        and relax in style.
                    </p>
                    <Link to="/book" className="cta-button">
                        Book Your Stay
                    </Link>
                </div>
            </header>

            {/* --- Features Section --- */}
            <section className="features-section">
                <h2>Experience Our Quality</h2>
                <div className="features-grid">
                    <div className="feature-card">
                        <h3>Luxury Rooms</h3>
                        <p>Spacious, elegant rooms with modern amenities and stunning views.</p>
                    </div>
                    <div className="feature-card">
                        <h3>24/7 Support</h3>
                        <p>Our concierge and front desk are available around the clock to assist you.</p>
                    </div>
                    <div className="feature-card">
                        <h3>Easy Booking</h3>
                        <p>A fast and secure management system for all your reservations.</p>
                    </div>
                </div>
            </section>
        </div>
    );
}