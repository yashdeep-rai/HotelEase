import { useState, useEffect } from 'react';
import './BookingPage.css';

export default function BookingPage() {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Hardcoding dates for this example.
    const checkIn = '2025-01-01';
    const checkOut = '2025-01-05';

    useEffect(() => {
        async function fetchAvailableRooms() {
            try {
                setLoading(true);
                // Use relative path due to Vite proxy
                const response = await fetch(`/api/rooms/available?check_in=${checkIn}&check_out=${checkOut}`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                setRooms(data);
                setError(null);
            } catch (err) {
                console.error("Failed to fetch rooms:", err);
                setError("Failed to load available rooms. Please try again later.");
                setRooms([]);
            } finally {
                setLoading(false);
            }
        }

        fetchAvailableRooms();
    }, [checkIn, checkOut]);

    return (
        <div className="booking-page">
            <h1>Book a Room</h1>
            <p>Showing available rooms from <strong>{checkIn}</strong> to <strong>{checkOut}</strong></p>

            {loading && <p>Loading available rooms...</p>}
            {error && <p className="error-message">{error}</p>}
            
            {!loading && !error && (
                <div className="room-list">
                    {rooms.length > 0 ? (
                        rooms.map(room => (
                            <div key={room.room_id} className="room-card">
                                <h3>Room {room.room_number}</h3>
                                <p><strong>Type:</strong> {room.room_type}</p>
                                <p><strong>Rate:</strong> ${room.rate} / night</p>
                                <button>Book Now</button>
                            </div>
                        ))
                    ) : (
                        <p>No available rooms for the selected dates.</p>
                    )}
                </div>
            )}
        </div>
    );
}