import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './AddGuestPage.css'; // We will create this next

export default function AddGuestPage() {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setMessage(null);

        const guestData = {
            first_name: firstName,
            last_name: lastName,
            email: email,
            phone: phone
        };

        try {
            const response = await fetch('/api/guests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(guestData),
            });

            const result = await response.json();

            if (!response.ok) {
                // Use the error message from the backend
                throw new Error(result.error || 'Failed to create guest');
            }

            // Success!
            setMessage(`Guest created successfully! ID: ${result.guest_id}`);
            
            // Clear the form
            setFirstName('');
            setLastName('');
            setEmail('');
            setPhone('');

            // Optional: Redirect back to the booking page after 2 seconds
            setTimeout(() => {
                navigate('/book');
            }, 2000);

        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="add-guest-page">
            <h1>Add New Guest</h1>
            <p>Create a new guest profile in the system.</p>

            <form onSubmit={handleSubmit} className="guest-form">
                <div className="form-group">
                    <label htmlFor="firstName">First Name</label>
                    <input
                        id="firstName"
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="lastName">Last Name</label>
                    <input
                        id="lastName"
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="email">Email</label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="phone">Phone (Optional)</label>
                    <input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                    />
                </div>
                
                <button type="submit" className="submit-btn">Save Guest</button>

                {message && <p className="success-message">{message}</p>}
                {error && <p className="error-message">{error}</p>}
            </form>
        </div>
    );
}