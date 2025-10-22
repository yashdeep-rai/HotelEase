import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import './BookingPage.css';
import Modal from '../components/Modal'; // NEW: Import Modal
import '../components/Modal.css'; // NEW: Import Modal CSS

// NEW: Helper function to get today's date in 'YYYY-MM-DD' format
const getToday = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
};

// NEW: Helper function to get tomorrow's date
const getTomorrow = () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
};

export default function BookingPage() {
    // --- State Declarations ---
    const [rooms, setRooms] = useState([]);
    const [guests, setGuests] = useState([]);
    const [selectedGuest, setSelectedGuest] = useState('');
    
    // NEW: State for dates, defaulting to today and tomorrow
    const [checkIn, setCheckIn] = useState(getToday());
    const [checkOut, setCheckOut] = useState(getTomorrow());

    const [loading, setLoading] = useState(false); // Rooms are not loaded by default
    const [roomError, setRoomError] = useState(null);
    const [guestError, setGuestError] = useState(null);
    
    // NEW: State to track if a search has been performed
    const [hasSearched, setHasSearched] = useState(false);

    // NEW: State for confirmation modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [roomToBook, setRoomToBook] = useState(null); 
    const [modalContent, setModalContent] = useState({ title: '', body: '' });

    // NEW: State for a *success/error* modal (a one-button modal)
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [infoModalContent, setInfoModalContent] = useState({ title: '', body: '' });

    // --- Data Fetching ---

    // Fetch available rooms - NOW accepts dates as parameters
    // We removed useCallback because it's now called by a user event (Search)
    const fetchAvailableRooms = async (searchCheckIn, searchCheckOut) => {
        try {
            setLoading(true);
            setHasSearched(true); // Mark that a search has been done
            setRoomError(null);
            setRooms([]); // Clear old results

            const response = await fetch(`/api/rooms/available?check_in=${searchCheckIn}&check_out=${searchCheckOut}`);
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

    // Fetch all guests (only runs once on page load)
    useEffect(() => {
        const fetchGuests = async () => {
            try {
                setGuestError(null);
                const response = await fetch('/api/guests');
                if (!response.ok) throw new Error('Failed to fetch guests');
                const data = await response.json();
                setGuests(data);
                if (data.length > 0) {
                    setSelectedGuest(data[0].guest_id);
                }
            } catch (err) {
                console.error(err);
                setGuestError(err.message);
            }
        };

        // Note: We no longer fetch rooms here, only guests
        fetchGuests(); 
    }, []); // Empty dependency array means this runs only once

    // --- Event Handlers ---

    // NEW: Handler for the "Search" button
    const handleSearch = (e) => {
        e.preventDefault();
        // Validate dates
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

    const handleBookRoom = (room) => {
        if (!selectedGuest) {
            // This is a simple validation, alert is fine
            alert('Please select a guest before booking.');
            return;
        }
        
        // Find guest name for the modal
        const guest = guests.find(g => g.guest_id.toString() === selectedGuest.toString());
        const guestName = guest ? `${guest.first_name} ${guest.last_name}` : 'Selected Guest';

        // 1. Set the room and modal content
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
        
        // 2. Open the modal
        setIsModalOpen(true);
    };

    // NEW: This function runs when "Confirm" is clicked in the booking modal
    const handleConfirmBooking = async () => {
        if (!roomToBook || !selectedGuest) return; 

        // Close the confirmation modal
        setIsModalOpen(false);

        const date1 = new Date(checkIn);
        const date2 = new Date(checkOut);
        const diffTime = Math.abs(date2 - date1);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const totalAmount = diffDays * roomToBook.rate;

        const bookingDetails = {
            guest_id: selectedGuest, 
            room_id: roomToBook.room_id,
            check_in_date: checkIn,
            check_out_date: checkOut,
            total_amount: totalAmount
        };

        try {
            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookingDetails),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Booking failed!');
            }

            const result = await response.json();
            
            // NEW: Show a SUCCESS info-modal
            setInfoModalContent({
                title: 'Booking Successful!',
                body: `Your booking for Room ${roomToBook.room_number} is confirmed. Booking ID: ${result.booking_id}`
            });
            setIsInfoModalOpen(true);
            
            // Refresh the room list
            fetchAvailableRooms(checkIn, checkOut);

        } catch (err) {
            console.error('Booking Error:', err);
            // NEW: Show an ERROR info-modal
            setInfoModalContent({
                title: 'Booking Failed',
                body: err.message
            });
            setIsInfoModalOpen(true);
        } finally {
            // Reset the room to book
            setRoomToBook(null);
        }
    };

    // --- JSX Return ---
    return (
        <div className="booking-page">
            <h1>Book a Room</h1>
            
            {/* NEW: Add the Confirmation Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConfirm={handleConfirmBooking}
                title={modalContent.title}
            >
                {modalContent.body}
            </Modal>

            {/* NEW: Add the Info Modal (uses a trick by hiding the 'Confirm' button) */}
            <Modal
                isOpen={isInfoModalOpen}
                onClose={() => setIsInfoModalOpen(false)}
                onConfirm={() => setIsInfoModalOpen(false)} // Confirm just closes it
                title={infoModalContent.title}
            >
                <style>{`.modal-footer .btn-primary { display: none; }`}</style>
                <p>{infoModalContent.body}</p>
            </Modal>


            {/* --- NEW: Date Selection Form --- */}
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
                <button type="submit" className="search-btn">Search Rooms</button>
            </form>

            {/* --- Guest selection section (remains the same) --- */}
            <div className="guest-selector-container">
                {guestError && <p className="error-message">{guestError}</p>}
                {guests.length > 0 ? (
                    <>
                        <label htmlFor="guest-select">Select Guest to Book For:</label>
                        <select
                            id="guest-select"
                            value={selectedGuest}
                            onChange={(e) => setSelectedGuest(e.target.value)}
                        >
                            {guests.map(guest => (
                                <option key={guest.guest_id} value={guest.guest_id}>
                                    {guest.first_name} {guest.last_name} ({guest.email})
                                </option>
                            ))}
                        </select>
                    </>
                ) : (
                    <p>Loading guests...</p>
                )}
                <Link to="/add-guest" className="add-guest-link">
                    + Add New Guest
                </Link>
            </div>

            {/* --- Room List (now conditional on search) --- */}
            {loading && <p>Searching for available rooms...</p>}
            {roomError && <p className="error-message">{roomError}</p>}
            
            <div className="room-list">
                {/* Only show results if not loading AND a search has been made */}
                {!loading && hasSearched && (
                    rooms.length > 0 ? (
                        rooms.map(room => (
                            <div key={room.room_id} className="room-card">
                                <h3>Room {room.room_number}</h3>
                                <p><strong>Type:</strong> {room.room_type}</p>
                                <p><strong>Rate:</strong> ${room.rate} / night</p>
                                <button onClick={() => handleBookRoom(room)}>
                                    Book Now
                                </button>
                            </div>
                        ))
                    ) : (
                        // Show "No rooms" only if a search was done
                        <p>No available rooms for the selected dates.</p>
                    )
                )}
            </div>
            
            {/* Show this message before the first search */}
            {!hasSearched && !loading &&
                <p>Please select your dates and click "Search Rooms" to see availability.</p>
            }
        </div>
    );
}