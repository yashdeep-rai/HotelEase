import { useState, useEffect } from 'react';
import './RoomManagementPage.css';
import { useAuth } from '../context/AuthContext';
import { FiTrash2 } from 'react-icons/fi';

export default function RoomManagementPage() {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { token } = useAuth();

    const [statusFilter, setStatusFilter] = useState('All');
    const [typeFilter, setTypeFilter] = useState('All');

    useEffect(() => {
        async function fetchRooms() {
            try {
                setLoading(true);
                const response = await fetch('/api/rooms', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) {
                    throw new Error('Failed to fetch rooms');
                }
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
        if (token) fetchRooms();
    }, [token]);

    const handleStatusChange = async (roomId, newStatus) => {
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
                throw new Error('Failed to update status');
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

    const handleDeleteRoom = async (roomId) => {
        if (!confirm('Delete this room?')) return;
        try {
            const res = await fetch(`/api/admin/rooms/${roomId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) throw new Error('Failed to delete');
            setRooms(prev => prev.filter(r => r.room_id !== roomId));
            alert('Room deleted');
        } catch (e) { console.error(e); alert(e.message || 'Delete failed'); }
    };

    const filteredRooms = rooms.filter(room => {
        const statusMatch = statusFilter === 'All' || room.status === statusFilter;
        const typeMatch = typeFilter === 'All' || room.room_type === typeFilter;
        return statusMatch && typeMatch;
    });

    const computedRoomTypes = ['All', ...Array.from(new Set(rooms.map(r => r.room_type).filter(Boolean)))];

    const getFloor = (room) => {
        const rn = room && room.room_number;
        if (!rn && rn !== 0) return 'Unknown';
        const asNum = parseInt(String(rn).replace(/[^0-9].*$/, ''), 10);
        if (!isNaN(asNum)) {
            return Math.floor(asNum / 100) || 0;
        }
        return String(rn).charAt(0) || 'Unknown';
    };

    const roomsByFloor = filteredRooms.reduce((acc, room) => {
        const floor = getFloor(room);
        if (!acc[floor]) acc[floor] = [];
        acc[floor].push(room);
        return acc;
    }, {});

    const sortedFloors = Object.keys(roomsByFloor).sort((a, b) => {
        const na = Number(a); const nb = Number(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return String(a).localeCompare(String(b));
    });

    return (
        <div className="room-management-page">
            <main className="room-management-main">
                <h1 className="page-title">Room Management</h1>
                <p className="page-subtitle">Oversee and manage room status and availability across the property.</p>

                <div className="filter-bar">
                    <div className="filter-group">
                        <label htmlFor="type-filter">Filter by Room Type</label>
                        <select id="type-filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                            {computedRoomTypes.map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                    </div>
                    <div className="filter-group">
                        <label htmlFor="status-filter">Filter by Status</label>
                        <select id="status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="All">All</option>
                            <option value="Available">Available</option>
                            <option value="Occupied">Occupied</option>
                            <option value="Maintenance">Maintenance</option>
                        </select>
                    </div>
                </div>

                {loading && <p>Loading rooms...</p>}
                {error && <p className="error-message">{error}</p>}

                {!loading && !error && (
                    <>
                        <p className="filter-results">Showing {filteredRooms.length} of {rooms.length} rooms.</p>

                        {sortedFloors.length === 0 ? (
                            <p>No rooms match your filters.</p>
                        ) : (
                            sortedFloors.map((floorKey) => (
                                <section key={floorKey} className="floor-section">
                                    <h2 className="floor-title">Floor {floorKey}</h2>
                                    <div className="room-grid">
                                        {roomsByFloor[floorKey].map(room => (
                                            <div key={room.room_id} className={`room-status-card ${room.status.toLowerCase()}`}>
                                                <div className="room-card-header">
                                                    <h3>Room {room.room_number}</h3>
                                                    <span className="room-type">{room.room_type}</span>
                                                </div>

                                                <p><strong>Rate:</strong> ₹{room.rate} <span className="muted">/ night</span></p>

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

                                                    <button
                                                        className="delete-btn icon-btn"
                                                        title="Delete room"
                                                        onClick={() => handleDeleteRoom(room.room_id)}
                                                        aria-label={`Delete room ${room.room_number}`}>
                                                        <FiTrash2 size={20} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            ))
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
