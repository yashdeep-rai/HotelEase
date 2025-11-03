import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
// We can re-use the admin's table CSS
import './BookingsListPage.css'; 
import '../components/Modal.css';

export default function MyBookingsPage() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { token } = useAuth(); // Get token to make authenticated request

    // State for modals
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [bookingToCancel, setBookingToCancel] = useState(null);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [infoModalContent, setInfoModalContent] = useState({ title: '', body: '' });

    // Fetch this user's bookings
    const fetchMyBookings = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/bookings/mybookings', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const safeParseResponse = async (res) => {
                const text = await res.text();
                if (!text) return null;
                try { return JSON.parse(text); } catch (e) { console.warn('safeParseResponse: invalid JSON', e); return null; }
            };
            if (!response.ok) {
                const err = await safeParseResponse(response);
                throw new Error((err && (err.error || err.message)) || 'Failed to fetch your bookings');
            }
            const data = await safeParseResponse(response) || [];
            setBookings(data);
            setError(null);
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMyBookings();
    }, [token]);

    // Open confirmation modal
    const handleCancelClick = (bookingId) => {
        setBookingToCancel(bookingId);
        setIsModalOpen(true);
    };

    // Run the DELETE request
    const handleConfirmCancel = async () => {
        if (!bookingToCancel) return;
        setIsModalOpen(false);

        try {
            const response = await fetch(`/api/bookings/${bookingToCancel}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                let errorMsg = 'Failed to cancel booking';
                try {
                    const text = await response.text();
                    let err = null;
                    try { err = text ? JSON.parse(text) : null; } catch(e) { err = null; }
                    errorMsg = (err && (err.error || err.message)) || errorMsg;
                } catch (parseError) {
                    errorMsg = response.statusText || errorMsg;
                }
                throw new Error(errorMsg);
            }

            // Success: Remove booking from UI
            setBookings(prevBookings => 
                prevBookings.filter(booking => booking.booking_id !== bookingToCancel)
            );
            
            setInfoModalContent({ title: 'Success', body: 'The booking has been successfully cancelled.' });
            setIsInfoModalOpen(true);
        
        } catch (err) {
            console.error('Cancel Error:', err);
            setInfoModalContent({ title: 'Cancellation Failed', body: err.message });
            setIsInfoModalOpen(true);
        } finally {
            setBookingToCancel(null);
        }
    };
    
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString();
    }

    return (
        <div className="bookings-list-page">
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConfirm={handleConfirmCancel}
                title="Cancel Booking"
            >
                <p>Are you sure you want to permanently cancel this booking?</p>
            </Modal>

            <Modal
                isOpen={isInfoModalOpen}
                onClose={() => setIsInfoModalOpen(false)}
                onConfirm={() => setIsInfoModalOpen(false)}
                title={infoModalContent.title}
            >
                <style>{`.modal-footer .btn-primary { display: none; }`}</style>
                <p>{infoModalContent.body}</p>
            </Modal>

            <h1 className="page-title">My Bookings</h1>
            
            {loading && <p>Loading your bookings...</p>}
            {error && <p className="error-message">{error}</p>}
            
            {!loading && !error && (
                <table className="bookings-table">
                    <thead>
                        <tr>
                            <th>Room</th>
                            <th>Type</th>
                            <th>Check-In</th>
                            <th>Check-Out</th>
                            <th>Total</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {bookings.length > 0 ? (
                            bookings.map(booking => (
                                <tr key={booking.booking_id}>
                                    <td>{booking.room_number}</td>
                                    <td>{booking.room_type}</td>
                                    <td>{formatDate(booking.check_in_date)}</td>
                                    <td>{formatDate(booking.check_out_date)}</td>
                                    <td>₹{booking.total_amount}</td>
                                    <td>{booking.status}</td>
                                    <td>
                                        <button 
                                            className="action-btn cancel-btn"
                                            onClick={() => handleCancelClick(booking.booking_id)}
                                        >
                                            Cancel
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="7">You have no bookings.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            )}
        </div>
    );
}