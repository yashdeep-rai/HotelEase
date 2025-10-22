import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './BookingPage.css';
import Modal from '../components/Modal';
import '../components/Modal.css';
import { useAuth } from '../context/AuthContext'; // 1. Import useAuth
import { FiSearch, FiSend } from 'react-icons/fi'; // 1. Import icons

// Helper function to get today's date in 'YYYY-MM-DD' format
const getToday = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
};

// Helper function to get tomorrow's date
const getTomorrow = () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
};

export default function BookingPage() {
    // --- State Declarations ---
    const { user } = useAuth(); // 2. Call useAuth() INSIDE the component

    const [rooms, setRooms] = useState([]);

    // State for dates
    const [checkIn, setCheckIn] = useState(getToday());
    const [checkOut, setCheckOut] = useState(getTomorrow());

    const [loading, setLoading] = useState(false);
    const [roomError, setRoomError] = useState(null);
    const [hasSearched, setHasSearched] = useState(false);

    // State for modals
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [roomToBook, setRoomToBook] = useState(null);
    const [modalContent, setModalContent] = useState({ title: '', body: '' });
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [infoModalContent, setInfoModalContent] = useState({ title: '', body: '' });

    // --- Data Fetching ---

    // Fetch available rooms
    const fetchAvailableRooms = async (searchCheckIn, searchCheckOut) => {
        try {
            setLoading(true);
            setHasSearched(true);
            setRoomError(null);
            setRooms([]);

            // 3. Get token from auth context to send
            const token = localStorage.getItem('token');

            const response = await fetch(`/api/rooms/available?check_in=${searchCheckIn}&check_out=${searchCheckOut}`, {
                headers: {
                    'Authorization': `Bearer ${token}` // 4. Add token to request
                }
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            setRooms(data);

        } catch (err) {
            console.error("Failed to fetch rooms:", err);
            setRoomError("Failed to load available rooms for the selected dates.");
        } finally {
            setLoading(false);
        }
    };

    // 5. REMOVED: The useEffect for fetchGuests is no longer needed.

    // --- Event Handlers ---

    // Handler for the "Search" button
    const handleSearch = (e) => {
        e.preventDefault();
        if (!checkIn || !checkOut) {
            setRoomError("Please select both a Check-in and Check-out date.");
            return;
        }
        if (new Date(checkOut) <= new Date(checkIn)) {
            setRoomError("Check-out date must be after the Check-in date.");
            return;
        }
        fetchAvailableRooms(checkIn, checkOut);
    };

    // This function opens the confirmation modal
    const handleBookRoom = (room) => {
        // 6. Get guest name from the logged-in user
        const guestName = user ? `${user.first_name} ${user.last_name}` : 'Logged-in User';

        setRoomToBook(room);
        setModalContent({
            title: 'Confirm Booking',
            body: (
                <>
                    <p>Are you sure you want to book this room?</p>
                    <p><strong>Guest:</strong> {guestName}</p>
                    <p><strong>Room:</strong> {room.room_number} ({room.room_type})</p>
                    <p><strong>Check-in:</strong> {checkIn}</p>
                    <p><strong>Check-out:</strong> {checkOut}</p>
                </>
            )
        });

        setIsModalOpen(true);
    };

    // This function runs when "Confirm" is clicked
    const handleConfirmBooking = async () => {
        if (!roomToBook || !user) return;

        setIsModalOpen(false);

        const date1 = new Date(checkIn);
        const date2 = new Date(checkOut);
        const diffTime = Math.abs(date2 - date1);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const totalAmount = diffDays * roomToBook.rate;

        // 7. Use the logged-in user's ID
        const bookingDetails = {
            guest_id: user.id, // This is now user_id, but our backend handles it
            room_id: roomToBook.room_id,
            check_in_date: checkIn,
            check_out_date: checkOut,
            total_amount: totalAmount
        };

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` // 8. Add token to POST request
                },
                body: JSON.stringify(bookingDetails),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Booking failed!');
            }

            const result = await response.json();

            setInfoModalContent({
                title: 'Booking Successful!',
                body: `Your booking for Room ${roomToBook.room_number} is confirmed. Booking ID: ${result.booking_id}`
            });
            setIsInfoModalOpen(true);

            fetchAvailableRooms(checkIn, checkOut);

        } catch (err) {
            console.error('Booking Error:', err);
            setInfoModalContent({
                title: 'Booking Failed',
                body: err.message
            });
            setIsInfoModalOpen(true);
        } finally {
            setRoomToBook(null);
        }
    };

    // --- JSX Return ---
    return (
        <div className="booking-page">
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConfirm={handleConfirmBooking}
                title={modalContent.title}
            >
                {modalContent.body}
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

            <h1>Book a Room</h1>

            <form onSubmit={handleSearch} className="date-search-form">
                <div className="date-group">
                    <label htmlFor="check-in">Check-in Date</label>
                    <input
                        type="date"
                        id="check-in"
                        value={checkIn}
                        onChange={(e) => setCheckIn(e.target.value)}
                        min={getToday()}
                        required
                    />
                </div>
                <div className="date-group">
                    <label htmlFor="check-out">Check-out Date</label>
                    <input
                        type="date"
                        id="check-out"
                        value={checkOut}
                        onChange={(e) => setCheckOut(e.target.value)}
                        min={getTomorrow()}
                        required
                    />
                </div>
                <button type="submit" className="search-btn">
                    <FiSearch className="btn-icon" /> Search Rooms {/* 2. Add icon */}
                </button>
            </form>

            {/* 9. REMOVED: The entire "guest-selector-container" div is gone */}

            {/* --- Room List --- */}
            {loading && <p>Searching for available rooms...</p>}
            {roomError && <p className="error-message">{roomError}</p>}

            <div className="room-list">
                {!loading && hasSearched && (
                    rooms.length > 0 ? (
                        rooms.map(room => (
                            <div key={room.room_id} className="card room-card"> {/* Used .card */}
                                <div className="room-card-header">
                                    <h3>Room {room.room_number}</h3>
                                    <span className="room-type">{room.room_type}</span>
                                </div>
                                <p><strong>Rate:</strong> ₹{room.rate} / night</p>
                                <button
                                    onClick={() => handleBookRoom(room)}
                                    className="btn-primary"
                                >
                                    <FiSend className="btn-icon" /> Book Now {/* 3. Add icon */}
                                </button>
                            </div>
                        ))
                    ) : (
                        <p>No available rooms for the selected dates.</p>
                    )
                )}
            </div>

            {!hasSearched && !loading &&
                <p>Please select your dates and click "Search Rooms" to see availability.</p>
            }
        </div>
    );
}