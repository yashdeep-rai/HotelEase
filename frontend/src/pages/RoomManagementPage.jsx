import { useState, useEffect } from 'react';
import './RoomManagementPage.css';
import { useAuth } from '../context/AuthContext';

// NEW: Get all unique room types from the rooms data
const getRoomTypes = (rooms) => {
    const types = rooms.map(room => room.room_type);
    return ['All', ...new Set(types)];
}

export default function RoomManagementPage() {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { token } = useAuth();
    
    // NEW: State for filters
    const [statusFilter, setStatusFilter] = useState('All');
    const [typeFilter, setTypeFilter] = useState('All');
    const [roomTypes, setRoomTypes] = useState(['All']);

    // Fetch all rooms on component mount
    useEffect(() => {
        async function fetchRooms() {
            try {
                setLoading(true);
                const response = await fetch('/api/rooms', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Failed to fetch rooms');
                const data = await response.json();
                setRooms(data);
                setRoomTypes(getRoomTypes(data)); // NEW: Set the room types for the filter
                setError(null);
            } catch (err) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        if (token) fetchRooms();
    }, [token]);

    // Handler for status dropdown
    const handleStatusChange = async (roomId, newStatus) => {
        // ... (This function remains exactly the same as before) ...
        try {
            const response = await fetch(`/api/rooms/${roomId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus }),
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to update status');
            }
            setRooms(prevRooms =>
                prevRooms.map(room =>
                    room.room_id === roomId ? { ...room, status: newStatus } : room
                )
            );
        } catch (err) {
            console.error('Update Error:', err);
            alert(`Error: ${err.message}`);
        }
    };

    // NEW: Create the filtered list of rooms
    const filteredRooms = rooms.filter(room => {
        const statusMatch = statusFilter === 'All' || room.status === statusFilter;
        const typeMatch = typeFilter === 'All' || room.room_type === typeFilter;
        return statusMatch && typeMatch;
    });

    return (
        <div className="room-management-page">
            <h1>Room Management</h1>
            <p>View all rooms and update their current status.</p>
            
            {/* NEW: Filter Bar */}
            <div className="filter-bar card">
                <div className="filter-group">
                    <label htmlFor="status-filter">Filter by Status</label>
                    <select 
                        id="status-filter"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="All">All</option>
                        <option value="Available">Available</option>
                        <option value="Occupied">Occupied</option>
                        <option value="Maintenance">Maintenance</option>
                    </select>
                </div>
                <div className="filter-group">
                    <label htmlFor="type-filter">Filter by Room Type</label>
                    <select 
                        id="type-filter"
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                    >
                        {roomTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                </div>
            </div>
            
            {loading && <p>Loading rooms...</p>}
            {error && <p className="error-message">{error}</p>}
            
            {!loading && !error && (
                <>
                    {/* NEW: Show a count of filtered rooms */}
                    <p className="filter-results">
                        Showing {filteredRooms.length} of {rooms.length} rooms.
                    </p>
                    <div className="room-grid">
                        {/* NEW: Map over filteredRooms */}
                        {filteredRooms.length > 0 ? (
                            filteredRooms.map(room => (
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
                            ))
                        ) : (
                            <p>No rooms match your filters.</p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}