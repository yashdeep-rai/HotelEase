// frontend/src/pages/RegisterPage.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './RegisterPage.css'; // Reuse form CSS
import { FiUserPlus } from 'react-icons/fi'; // 1. Import icon

export default function RegisterPage() {
    const safeParseResponse = async (res) => {
        const text = await res.text();
        if (!text) return null;
        try { return JSON.parse(text); } catch (e) { console.warn('safeParseResponse: invalid JSON', e); return null; }
    };
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');

    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setMessage(null);

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    first_name: firstName,
                    last_name: lastName,
                    email,
                    phone,
                    password,
                    role: 'guest' // Default role
                }),
            });
            const result = await safeParseResponse(response) || {};
            if (!response.ok) {
                throw new Error(result.error || result.message || 'Failed to register');
            }

            setMessage('Registration successful! Please login.');
            setTimeout(() => navigate('/login'), 2000);

        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="add-guest-page">
            <h1>Register</h1>
            <form onSubmit={handleSubmit} className="guest-form">
                {/* ... (first_name, last_name, email, phone form-groups) ... */}
                <div className="form-group">
                    <label htmlFor="firstName">First Name</label>
                    <input id="firstName" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                </div>
                <div className="form-group">
                    <label htmlFor="lastName">Last Name</label>
                    <input id="lastName" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </div>
                <div className="form-group">
                    <label htmlFor="email">Email</label>
                    <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="form-group">
                    <label htmlFor="phone">Phone (Optional)</label>
                    <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>

                <button type="submit" className="submit-btn">
                    <FiUserPlus className="btn-icon" /> Register {/* 2. Add icon */}
                </button>
                {message && <p className="success-message">{message}</p>}
                {error && <p className="error-message">{error}</p>}

                <p style={{ textAlign: 'center', marginTop: '1rem' }}>
                    Already have an account? <Link to="/login">Login here</Link>
                </p>
            </form>
        </div>
    );
}