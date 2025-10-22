import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import './BookingPage.css';

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

    // Handler for the "Book Now" button
    const handleBookRoom = async (room) => {
        if (!selectedGuest) {
            alert('Please select a guest before booking.');
            return;
        }

        // Use dates from state
        const date1 = new Date(checkIn);
        const date2 = new Date(checkOut);
        const diffTime = Math.abs(date2 - date1);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const totalAmount = diffDays * room.rate;

        const bookingDetails = {
            guest_id: selectedGuest, 
            room_id: room.room_id,
            check_in_date: checkIn,   // Use date from state
            check_out_date: checkOut, // Use date from state
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
            alert(`Booking successful! Your Booking ID is: ${result.booking_id}`);
            
            // Refresh the room list for the same dates
            fetchAvailableRooms(checkIn, checkOut);

        } catch (err) {
            console.error('Booking Error:', err);
            alert(`Booking failed: ${err.message}`);
        }
    };

    // --- JSX Return ---
    return (
        <div className="booking-page">
            <h1>Book a Room</h1>
            
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