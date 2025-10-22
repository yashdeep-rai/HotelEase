import { useState, useEffect } from 'react';
import './RoomManagementPage.css';

export default function RoomManagementPage() {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch all rooms on component mount
    useEffect(() => {
        async function fetchRooms() {
            try {
                setLoading(true);
                const response = await fetch('/api/rooms');
                if (!response.ok) throw new Error('Failed to fetch rooms');
                const data = await response.json();
                setRooms(data);
                setError(null);
            } catch (err) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        fetchRooms();
    }, []);

    // Handler for when the status dropdown is changed
    const handleStatusChange = async (roomId, newStatus) => {
        try {
            const response = await fetch(`/api/rooms/${roomId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: newStatus }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to update status');
            }

            // Update the status in our local state to match the database
            setRooms(prevRooms =>
                prevRooms.map(room =>
                    room.room_id === roomId ? { ...room, status: newStatus } : room
                )
            );

        } catch (err) {
            console.error('Update Error:', err);
            // In a real app, you'd show a modal here
            alert(`Error: ${err.message}`);
        }
    };

    return (
        <div className="room-management-page">
            <h1>Room Management</h1>
            <p>View all rooms and update their current status.</p>
            
            {loading && <p>Loading rooms...</p>}
            {error && <p className="error-message">{error}</p>}
            
            {!loading && !error && (
                <div className="room-grid">
                    {rooms.map(room => (
                        <div key={room.room_id} className={`room-status-card ${room.status.toLowerCase()}`}>
                            <div className="room-card-header">
                                <h3>Room {room.room_number}</h3>
                                <span className="room-type">{room.room_type}</span>
                            </div>
                            <p><strong>Rate:</strong> ${room.rate} / night</p>
                            <div className="status-control">
                                <label htmlFor={`status-${room.room_id}`}>Status:</label>
                                <select
                                    id={`status-${room.room_id}`}
                                    value={room.status}
                                    onChange={(e) => handleStatusChange(room.room_id, e.target.value)}
                                    className="status-select"
                                >
                                    <option value="Available">Available</option>
                                    <option value="Occupied">Occupied</option>
                                    <option value="Maintenance">Maintenance</option>
                                </select>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}