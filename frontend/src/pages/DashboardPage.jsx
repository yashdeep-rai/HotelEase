import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './DashboardPage.css'; // We will create this next
import { Link } from 'react-router-dom';
import { FiUsers, FiCheckSquare, FiKey, FiTrendingUp, FiSettings, FiList } from 'react-icons/fi'; // 1. Add relevant icons

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
            <h1 className="page-title">Admin Dashboard</h1>
            
            <div className="dashboard-grid">
                <div className="stat-card">
                    {/* 2. Add Icons to Stat Cards */}
                    <FiKey className="stat-icon occupied" />
                    <span className="stat-value">{stats.occupiedRooms}</span>
                    <span className="stat-title">Rooms Occupied</span>
                </div>
                
                <div className="stat-card">
                    <FiCheckSquare className="stat-icon available" />
                    <span className="stat-value">{stats.availableRooms}</span>
                    <span className="stat-title">Rooms Available</span>
                </div>

                <div className="stat-card">
                    <FiTrendingUp className="stat-icon check-ins" />
                    <span className="stat-value">{stats.checkInsToday}</span>
                    <span className="stat-title">Check-ins Today</span>
                </div>

                <div className="stat-card">
                    <FiUsers className="stat-icon guests" />
                    <span className="stat-value">{stats.totalGuests}</span>
                    <span className="stat-title">Total Guests</span>
                </div>
            </div>

            <div className="quick-links">
                <h2>Quick Links</h2>
                 {/* 3. Add Icons to Quick Links */}
                <Link to="/rooms" className="quick-link-btn">
                    <FiSettings className="nav-icon"/> Manage Rooms
                </Link>
                <Link to="/bookings" className="quick-link-btn">
                    <FiList className="nav-icon"/> View All Bookings
                </Link>
            </div>
        </div>
    );
}