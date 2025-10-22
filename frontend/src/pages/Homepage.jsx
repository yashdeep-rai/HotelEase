import './Homepage.css'
import { Link } from 'react-router-dom';

export default function Homepage() {
    return (
        <div className="homepage">
            <h1>Welcome to HotelEase</h1>
            <p>Your comfort is our priority. Manage your bookings, check-in, and explore our services all in one place.</p>
            <Link to="/book" className="cta-button">
                Find a Room
            </Link>
        </div>
    );
}