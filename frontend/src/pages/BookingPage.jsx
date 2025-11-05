import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './BookingPage.css';
import Modal from '../components/Modal';
import '../components/Modal.css';
import { useAuth } from '../context/AuthContext'; // 1. Import useAuth
import { FiSearch, FiSend, FiArrowUp, FiArrowDown, FiMinus } from 'react-icons/fi'; // 1. Import icons

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
    // Small helper to safely parse JSON responses (returns null on empty/invalid body)
    const safeParseResponse = async (res) => {
        const text = await res.text();
        if (!text) return null;
        try { return JSON.parse(text); } catch (e) { console.warn('safeParseResponse: invalid JSON', e); return null; }
    };

    // --- State Declarations ---
    const { user } = useAuth(); // 2. Call useAuth() INSIDE the component

    const [rooms, setRooms] = useState([]);
    const [filterType, setFilterType] = useState('all');
    const [filterFloor, setFilterFloor] = useState('all');

    // State for dates
    const [checkIn, setCheckIn] = useState(getToday());
    const [checkOut, setCheckOut] = useState(getTomorrow());

    const [loading, setLoading] = useState(false);
    const [roomError, setRoomError] = useState(null);
    const [hasSearched, setHasSearched] = useState(false);
    const [dynamicPrices, setDynamicPrices] = useState({});

    // State for modals
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [roomToBook, setRoomToBook] = useState(null);
    const [modalContent, setModalContent] = useState({ title: '', body: '' });
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [infoModalContent, setInfoModalContent] = useState({ title: '', body: '' });
    const [bookingLoading, setBookingLoading] = useState(false);

    // --- Data Fetching ---

    // Fetch available rooms
const fetchAvailableRooms = async (searchCheckIn, searchCheckOut) => {
    try {
        setLoading(true);
        setHasSearched(true);
        setRoomError(null);
        setRooms([]);

        const token = localStorage.getItem('token');

        const response = await fetch(`/api/rooms/available?check_in=${searchCheckIn}&check_out=${searchCheckOut}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const err = await safeParseResponse(response);
            throw new Error((err && (err.error || err.message)) || `HTTP error! status: ${response.status}`);
        }

        const data = await safeParseResponse(response) || {};
        // Normalize room objects to a consistent shape so frontend doesn't depend on DB column casing
        const rawRooms = data.rooms || [];
        const normalized = rawRooms.map((r, i) => ({
            room_id: r.room_id ?? r.RoomID ?? r.RoomId ?? `rid_${i}`,
            room_number: r.room_number ?? r.RoomNumber ?? r.RoomNo ?? r.Room ?? '',
            room_type_id: r.room_type_id ?? r.RoomTypeID ?? r.roomTypeID ?? null,
            room_type: r.room_type ?? r.TypeName ?? r.roomType ?? '',
            rate: r.rate ?? r.CurrentPricePerNight ?? r.BasePricePerNight ?? r.Rate ?? 0,
            status: r.status ?? r.Status ?? 'Available',
            __raw: r
        }));
        setRooms(normalized);
        // Fetch dynamic price suggestions for the room types present (using normalized data)
        try {
            const token = localStorage.getItem('token');
            const types = Array.from(new Set(normalized.map(r => r.room_type_id).filter(Boolean)));
            if (types.length > 0) {
                const promises = types.map(rt => fetch(`/api/forecast/price?roomTypeID=${rt}&from=${searchCheckIn}`, { headers: { 'Authorization': `Bearer ${token}` } }).then(res => res.ok ? res.json() : null).catch(() => null));
                const results = await Promise.all(promises);
                const map = {};
                results.forEach((r, i) => { if (r) map[types[i]] = r; });
                setDynamicPrices(prev => ({ ...prev, ...map }));
            }
        } catch (e) {
            // non-fatal: keep rooms displayed
            console.warn('Failed to fetch dynamic prices', e);
        }

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
        //console.log(user)
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
       
       // //console.log(user_id, room_id, check_in_date, check_out_date)
         if (!roomToBook || !user) return;
//!user_id || !room_id || !check_in_date || !check_out_date
    setIsModalOpen(false);
    setBookingLoading(true);
        //console.log(roomToBook)
        const date1 = new Date(checkIn);
        const date2 = new Date(checkOut);
        const diffTime = Math.abs(date2 - date1);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const ratePerNight = dynamicPrices[roomToBook.room_type_id]?.suggestedPrice || roomToBook.rate;
        const totalAmount = diffDays * ratePerNight;

        // 7. Prepare booking details (server uses authenticated token for user)
        const bookingDetails = {
            room_id: roomToBook.room_id ?? roomToBook.RoomID ?? roomToBook.__raw?.RoomID,
            check_in_date: checkIn,
            check_out_date: checkOut,
            total_amount: totalAmount,
            num_guests: 1,
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
                const err = await safeParseResponse(response);
                throw new Error((err && (err.error || err.message)) || 'Booking failed!');
            }

            const result = await safeParseResponse(response) || {};

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
            // Refresh the available rooms so UI reflects current state (e.g., someone else booked it)
            try { fetchAvailableRooms(checkIn, checkOut); } catch (e) { /* ignore */ }
        } finally {
            setRoomToBook(null);
            setBookingLoading(false);
        }
    };

    // derive filters and grouped floors
    const getFloorFromRoomNumber = (rn) => {
        if (!rn && rn !== 0) return '0';
        const s = String(rn);
        // find first run of digits
        const m = s.match(/\d+/);
        if (!m) return '0';
        const digits = m[0];
        // common hotel numbering: first digit(s) indicate floor (e.g., 101 -> 1)
        return digits.length >= 3 ? digits.slice(0, digits.length - 2) : digits[0];
    };

    // Apply filters
    const filteredRooms = rooms.filter(r => {
        if (filterType !== 'all' && String(r.room_type_id) !== String(filterType)) return false;
        if (filterFloor !== 'all' && String(getFloorFromRoomNumber(r.room_number)) !== String(filterFloor)) return false;
        return true;
    });

    const floorsMap = {};
    filteredRooms.forEach(r => {
        const floor = getFloorFromRoomNumber(r.room_number) ?? '0';
        if (!floorsMap[floor]) floorsMap[floor] = [];
        floorsMap[floor].push(r);
    });

    const sortedFloorKeys = Object.keys(floorsMap).sort((a,b)=> Number(a)-Number(b));

    // Colors for floors
    const floorColors = ['#6EE7B7','#FFD580','#A3E1FF','#F7A8B8','#C7B3FF','#FFDAA5'];

    // --- JSX Return ---
    return (
        <div className="booking-page">
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConfirm={handleConfirmBooking}
                confirmLoading={bookingLoading}
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
                {/* Filters */}
                <div className="date-group">
                    <label htmlFor="filter-type">Room Type</label>
                    <select id="filter-type" value={filterType} onChange={(e)=>setFilterType(e.target.value)}>
                        <option value="all">All</option>
                        {Array.from(new Set(rooms.map(r=>r.room_type_id).filter(Boolean))).map(rt => (
                            <option key={rt} value={rt}>{rooms.find(x=>x.room_type_id===rt)?.room_type || `Type ${rt}`}</option>
                        ))}
                    </select>
                </div>
                <div className="date-group">
                    <label htmlFor="filter-floor">Floor</label>
                    <select id="filter-floor" value={filterFloor} onChange={(e)=>setFilterFloor(e.target.value)}>
                        <option value="all">All</option>
                        {Array.from(new Set(rooms.map(r=>getFloorFromRoomNumber(r.room_number)))).sort((a,b)=>Number(a)-Number(b)).map(f => (
                            <option key={f} value={f}>Floor {f}</option>
                        ))}
                    </select>
                </div>
                <button type="submit" className="search-btn">
                    {loading ? <span className="spinner"/> : <FiSearch className="btn-icon" />} {loading ? 'Searching...' : 'Search Rooms'}
                </button>
            </form>

            {/* 9. REMOVED: The entire "guest-selector-container" div is gone */}

            {/* --- Room List --- */}
            {loading && <p>Searching for available rooms...</p>}
            {roomError && <p className="error-message">{roomError}</p>}
            <div className="room-list">
                {!loading && hasSearched && (
                    rooms.length > 0 ? (
                        // Group by floor and render sections
                        sortedFloorKeys.map((floorKey, fidx) => (
                            <section key={`floor_${floorKey}`} className="floor-section">
                                <h2 className="floor-title">Floor {floorKey}</h2>
                                <div className="floor-rooms">
                                    {floorsMap[floorKey].map((room, idx) => {
                                        const key = room.room_id ?? room.__raw?.RoomID ?? `room_${floorKey}_${idx}`;
                                        const dp = dynamicPrices[room.room_type_id];
                                        // tolerate multiple possible field names from the API
                                        const suggested = dp?.suggestedPrice ?? dp?.suggested_price ?? dp?.price ?? room.__raw?.SuggestedPrice ?? room.rate;
                                        // determine original/base price (prefer suggestion's basePrice if available, otherwise room raw base fields)
                                        const basePrice = dp?.basePrice ?? dp?.base_price ?? room.__raw?.BasePricePerNight ?? room.__raw?.BasePrice ?? room.__raw?.base_price ?? room.__raw?.BaseRate ?? room.__raw?.Rate ?? room.rate;
                                        const delta = suggested - basePrice;
                                        const pct = basePrice ? Math.round((delta / Math.abs(basePrice)) * 100) : 0;
                                        let DeltaIcon = FiMinus;
                                        let deltaColor = '#999';
                                        if (delta > 0) { DeltaIcon = FiArrowUp; deltaColor = '#ff6b6b'; } // price increased
                                        else if (delta < 0) { DeltaIcon = FiArrowDown; deltaColor = '#2ecc71'; } // price decreased

                                        const accent = floorColors[Number(fidx) % floorColors.length];

                                        return (
                                            <div key={key} className="card room-card" style={{ ['--accent-color']: accent }}>
                                                <div className="room-card-header">
                                                    <h3>Room {room.room_number}</h3>
                                                    <span className="room-type">{room.room_type}</span>
                                                </div>
                                                <div className="room-price-info">
                                                    <div className="dynamic-price">
                                                        <p className="suggested-price">
                                                            <strong>Today's Rate:</strong> ₹{suggested} / night
                                                            <span className="price-delta" style={{ color: deltaColor }}>
                                                                <DeltaIcon className="btn-icon" /> {Math.abs(pct)}%
                                                            </span>
                                                        </p>
                                                        {dp?.holiday && (
                                                            <span className="holiday-badge">Holiday Season</span>
                                                        )}
                                                        {dp?.occupancyRate > 0.7 && (
                                                            <span className="high-demand-badge">High Demand</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleBookRoom(room)}
                                                    className="btn-primary"
                                                    disabled={loading || bookingLoading}
                                                >
                                                    {bookingLoading ? <span className="spinner"/> : <FiSend className="btn-icon" />} {bookingLoading ? 'Processing...' : 'Book Now'}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
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