import { useState, useEffect } from 'react';
import Modal from '../components/Modal';
import './BookingsListPage.css';
import '../components/Modal.css';
import { useAuth } from '../context/AuthContext';
import { FiTrash2, FiLogIn, FiLogOut } from 'react-icons/fi'; // 1. Import Check-in/out icons

export default function BookingsListPage() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { token } = useAuth();

    // Modal States (Add state for Check-Out Confirmation)
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [isCheckOutModalOpen, setIsCheckOutModalOpen] = useState(false); // 2. New modal state
    const [bookingToAction, setBookingToAction] = useState(null); // Renamed for clarity
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [infoModalContent, setInfoModalContent] = useState({ title: '', body: '' });

    // Fetch all bookings (remains the same)
    const fetchBookings = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/bookings', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch bookings');
            const data = await response.json();
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
        if (token) fetchBookings();
    }, [token]);


    // --- Action Handlers ---

    // Open Cancel confirmation modal
    const handleCancelClick = (booking) => {
        setBookingToAction(booking);
        setIsCancelModalOpen(true);
    };

    // Confirm and execute Cancellation
    const handleConfirmCancel = async () => {
        if (!bookingToAction) return;
        setIsCancelModalOpen(false);
        try {
            const response = await fetch(`/api/bookings/${bookingToAction.booking_id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) { /* ... error handling ... */
                let errorMsg = 'Failed to cancel booking'; try { const err = await response.json(); errorMsg = err.error || errorMsg; } catch (parseError) { errorMsg = response.statusText || errorMsg; } throw new Error(errorMsg);
            }
            // Success: Update UI and show info modal
            setBookings(prev => prev.filter(b => b.booking_id !== bookingToAction.booking_id));
            setInfoModalContent({ title: 'Success', body: 'Booking cancelled.' });
            setIsInfoModalOpen(true);
        } catch (err) { /* ... error handling ... */
            console.error('Cancel Error:', err); setInfoModalContent({ title: 'Cancellation Failed', body: err.message }); setIsInfoModalOpen(true);
        } finally {
            setBookingToAction(null);
        }
    };

    // 3. NEW: Handle Check-In Click (No modal needed for check-in)
    const handleCheckIn = async (booking) => {
        updateBookingStatus(booking.booking_id, 'Checked-In');
    };

    // 4. NEW: Handle Check-Out Click (Opens confirmation modal)
    const handleCheckOutClick = (booking) => {
        setBookingToAction(booking);
        setIsCheckOutModalOpen(true);
    };

    // 5. NEW: Confirm and execute Check-Out
    const handleConfirmCheckOut = async () => {
        if (!bookingToAction) return;
        setIsCheckOutModalOpen(false);
        updateBookingStatus(bookingToAction.booking_id, 'Checked-Out');
        setBookingToAction(null); // Reset after calling update
    };

    // 6. NEW: Reusable function to update booking status via API
    const updateBookingStatus = async (bookingId, newStatus) => {
        try {
            const response = await fetch(`/api/bookings/${bookingId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || `Failed to update status to ${newStatus}`);
            }

            // Success: Update UI and show info modal
            setBookings(prevBookings =>
                prevBookings.map(b =>
                    b.booking_id === bookingId ? { ...b, status: newStatus } : b
                )
            );
            setInfoModalContent({ title: 'Success', body: `Booking status updated to ${newStatus}.` });
            setIsInfoModalOpen(true);

        } catch (err) {
            console.error(`Update Status Error (${newStatus}):`, err);
            setInfoModalContent({ title: 'Update Failed', body: err.message });
            setIsInfoModalOpen(true);
        }
    };

    const formatDate = (dateString) => new Date(dateString).toLocaleDateString();

    return (
        <div className="bookings-list-page">
            {/* --- Modals --- */}
            <Modal // Cancel Confirmation
                isOpen={isCancelModalOpen}
                onClose={() => setIsCancelModalOpen(false)}
                onConfirm={handleConfirmCancel}
                title="Cancel Booking"
            >
                <p>Are you sure you want to permanently cancel booking #{bookingToAction?.booking_id}?</p>
                <p>This action cannot be undone.</p>
            </Modal>

            {/* 7. NEW: Check-Out Confirmation Modal */}
            <Modal
                isOpen={isCheckOutModalOpen}
                onClose={() => setIsCheckOutModalOpen(false)}
                onConfirm={handleConfirmCheckOut}
                title="Confirm Check-Out"
            >
                <p>Are you sure you want to check out booking #{bookingToAction?.booking_id}?</p>
                <p>Room: {bookingToAction?.room_number} ({bookingToAction?.room_type})</p>
                <p>Guest: {bookingToAction?.first_name} {bookingToAction?.last_name}</p>
                <p>(The room status will be set to 'Available'.)</p>
            </Modal>

            <Modal // Info Modal (Success/Error)
                isOpen={isInfoModalOpen}
                onClose={() => setIsInfoModalOpen(false)}
                onConfirm={() => setIsInfoModalOpen(false)}
                title={infoModalContent.title}
            >
                <style>{`.modal-footer .btn-primary { display: none; }`}</style>
                <p>{infoModalContent.body}</p>
            </Modal>

            <h1 className="page-title">All Bookings</h1>

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
                                    <td>
                                        {/* Convert to number, check if valid, then format */}
                                        {typeof booking.total_amount === 'number' || !isNaN(parseFloat(booking.total_amount))
                                            ? `₹${parseFloat(booking.total_amount).toFixed(2)}`
                                            : 'N/A'}
                                    </td>
                                    <td><span className={`status-badge status-${booking.status.toLowerCase().replace(' ', '-')}`}>{booking.status}</span></td>
                                    {/* 8. NEW: Conditional Action Buttons */}
                                    <td className="action-cell">
                                        {booking.status === 'Confirmed' && (
                                            <button
                                                className="action-btn check-in-btn"
                                                onClick={() => handleCheckIn(booking)}
                                                title="Check In Guest"
                                            >
                                                <FiLogIn className="btn-icon" /> Check In
                                            </button>
                                        )}
                                        {booking.status === 'Checked-In' && (
                                            <button
                                                className="action-btn check-out-btn"
                                                onClick={() => handleCheckOutClick(booking)}
                                                title="Check Out Guest"
                                            >
                                                <FiLogOut className="btn-icon" /> Check Out
                                            </button>
                                        )}
                                        {/* Show Cancel unless already Checked-Out or Cancelled */}
                                        {(booking.status !== 'Checked-Out' && booking.status !== 'Cancelled') && (
                                            <button
                                                className="action-btn cancel-btn"
                                                onClick={() => handleCancelClick(booking)}
                                                title="Cancel Booking"
                                            >
                                                <FiTrash2 className="btn-icon" />
                                            </button>
                                        )}
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