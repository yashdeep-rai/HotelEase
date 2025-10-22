import { useState, useEffect } from 'react';
import './BookingsListPage.css'; // We will create this file next

export default function BookingsListPage() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchBookings() {
            try {
                setLoading(true);
                const response = await fetch('/api/bookings'); // Fetch from our new endpoint
                if (!response.ok) {
                    throw new Error('Failed to fetch bookings');
                }
                const data = await response.json();
                setBookings(data);
                setError(null);
            } catch (err) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        fetchBookings();
    }, []);

    // Helper to format the date
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString();
    }

    return (
        <div className="bookings-list-page">
            <h1>All Bookings</h1>
            {loading && <p>Loading bookings...</p>}
            {error && <p className="error-message">{error}</p>}
            
            {!loading && !error && (
                <table className="bookings-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Guest</th>
                            <th>Email</th>
                            <th>Room</th>
                            <th>Check-In</th>
                            <th>Check-Out</th>
                            <th>Total</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {bookings.length > 0 ? (
                            bookings.map(booking => (
                                <tr key={booking.booking_id}>
                                    <td>{booking.booking_id}</td>
                                    <td>{booking.first_name} {booking.last_name}</td>
                                    <td>{booking.email}</td>
                                    <td>{booking.room_number} ({booking.room_type})</td>
                                    <td>{formatDate(booking.check_in_date)}</td>
                                    <td>{formatDate(booking.check_out_date)}</td>
                                    <td>${booking.total_amount}</td>
                                    <td>{booking.status}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="8">No bookings found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            )}
        </div>
    );
}