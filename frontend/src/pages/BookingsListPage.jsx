import { useState, useEffect } from 'react';
import './BookingsListPage.css';
import Modal from '../components/Modal'; // Already imported
import '../components/Modal.css'; // Already imported

export default function BookingsListPage() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // State for our confirmation modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [bookingToCancel, setBookingToCancel] = useState(null);

    // NEW: State for the success/error info modal
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [infoModalContent, setInfoModalContent] = useState({ title: '', body: '' });

    // Fetch all bookings (runs once)
    useEffect(() => {
        async function fetchBookings() {
            try {
                setLoading(true);
                const response = await fetch('/api/bookings');
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

    // This function just opens the confirmation modal
    const handleCancelClick = (bookingId) => {
        setBookingToCancel(bookingId);
        setIsModalOpen(true);
    };

    // This function runs when the user clicks "Confirm"
    const handleConfirmCancel = async () => {
        if (!bookingToCancel) return;
        
        // Close the confirmation modal
        setIsModalOpen(false);

        try {
            const response = await fetch(`/api/bookings/${bookingToCancel}`, {
                method: 'DELETE'
            });
            
            // NEW: Robust error handling
            if (!response.ok) {
                let errorMsg = 'Failed to cancel booking';
                try {
                    // Try to parse JSON error first
                    const err = await response.json();
                    errorMsg = err.error || errorMsg;
                } catch (parseError) {
                    // If parsing fails, use the response status text
                    errorMsg = response.statusText || errorMsg;
                }
                throw new Error(errorMsg);
            }

            // Success!
            setBookings(prevBookings => 
                prevBookings.filter(booking => booking.booking_id !== bookingToCancel)
            );
            
            // NEW: Show success modal
            setInfoModalContent({
                title: 'Success',
                body: 'The booking has been successfully cancelled.'
            });
            setIsInfoModalOpen(true);
        
        } catch (err) {
            console.error('Cancel Error:', err);
            // NEW: Show error modal
            setInfoModalContent({
                title: 'Cancellation Failed',
                body: err.message
            });
            setIsInfoModalOpen(true);
        } finally {
            setBookingToCancel(null);
        }
    };
    
    // Helper to format the date
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString();
    }

    return (
        <div className="bookings-list-page">
            {/* Confirmation Modal (for "Are you sure?") */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConfirm={handleConfirmCancel}
                title="Cancel Booking"
            >
                <p>Are you sure you want to permanently cancel this booking?</p>
                <p>This action cannot be undone.</p>
            </Modal>

            {/* NEW: Info Modal (for success or error messages) */}
            <Modal
                isOpen={isInfoModalOpen}
                onClose={() => setIsInfoModalOpen(false)}
                onConfirm={() => setIsInfoModalOpen(false)} // Confirm just closes it
                title={infoModalContent.title}
            >
                {/* This CSS trick hides the "Confirm" button */}
                <style>{`.modal-footer .btn-primary { display: none; }`}</style>
                <p>{infoModalContent.body}</p>
            </Modal>

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
                            <th>Actions</th>
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
                                <td colSpan="9">No bookings found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            )}
        </div>
    );
}