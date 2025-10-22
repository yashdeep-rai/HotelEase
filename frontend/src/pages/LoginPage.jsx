import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import './RegisterPage.css'; // We'll reuse the register page's CSS

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to login');
            }
            
            // Call login from AuthContext
            login(data.token, data.user);
            
            // --- THIS IS THE FIX ---
            if (data.user.role === 'admin') {
                navigate('/dashboard'); // Redirect admin to Dashboard
            } else {
                navigate('/book'); // Redirect guest to Book a Room
            }
            // --- END OF FIX ---

        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="add-guest-page"> {/* Reusing this class for styling */}
            <h1>Login</h1>
            <form onSubmit={handleSubmit} className="guest-form">
                <div className="form-group">
                    <label htmlFor="email">Email</label>
                    <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                
                <button type="submit" className="submit-btn">Login</button>
                {error && <p className="error-message">{error}</p>}
                
                <p style={{textAlign: 'center', marginTop: '1rem'}}>
                    Don't have an account? <Link to="/register">Register here</Link>
                </p>
            </form>
        </div>
    );
}