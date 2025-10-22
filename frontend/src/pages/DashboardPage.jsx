import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './DashboardPage.css'; // We will create this next
import { Link } from 'react-router-dom';

export default function DashboardPage() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { token } = useAuth();

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setLoading(true);
                const response = await fetch('/api/dashboard/stats', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (!response.ok) {
                    throw new Error('Failed to fetch dashboard stats');
                }
                const data = await response.json();
                setStats(data);
                setError(null);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (token) {
            fetchStats();
        }
    }, [token]);

    if (loading) {
        return <p>Loading dashboard...</p>;
    }
    if (error) {
        return <p className="error-message">{error}</p>;
    }
    if (!stats) {
        return null;
    }

    return (
        <div className="dashboard-page">
            <h1>Admin Dashboard</h1>
            
            <div className="dashboard-grid">
                <div className="stat-card">
                    <span className="stat-value">{stats.occupiedRooms}</span>
                    <span className="stat-title">Rooms Occupied</span>
                </div>
                
                <div className="stat-card">
                    <span className="stat-value">{stats.availableRooms}</span>
                    <span className="stat-title">Rooms Available</span>
                </div>

                <div className="stat-card">
                    <span className="stat-value">{stats.checkInsToday}</span>
                    <span className="stat-title">Check-ins Today</span>
                </div>

                <div className="stat-card">
                    <span className="stat-value">{stats.totalGuests}</span>
                    <span className="stat-title">Total Guests</span>
                </div>
            </div>

            <div className="quick-links">
                <h2>Quick Links</h2>
                <Link to="/rooms" className="quick-link-btn">
                    Manage Rooms
                </Link>
                <Link to="/bookings" className="quick-link-btn">
                    View All Bookings
                </Link>
            </div>
        </div>
    );
}