import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import './BookingsListPage.css'; // Re-use the table CSS
import './UserManagementPage.css'; // Add new CSS for this page
import '../components/Modal.css';
import { FiTrash2 } from 'react-icons/fi'; // 1. Import icon

export default function UserManagementPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { token, user: authUser } = useAuth(); // Get token AND the logged-in admin's info

    // Modal States
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [userToAction, setUserToAction] = useState(null);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [infoModalContent, setInfoModalContent] = useState({ title: '', body: '' });

    // Fetch all users
    const fetchUsers = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            // safe parse
            const safeParseResponse = async (res) => {
                const text = await res.text();
                if (!text) return null;
                try { return JSON.parse(text); } catch (e) { console.warn('safeParseResponse: invalid JSON', e); return null; }
            };
            if (!response.ok) {
                const err = await safeParseResponse(response);
                throw new Error((err && (err.error || err.message)) || 'Failed to fetch users');
            }
            const data = await safeParseResponse(response) || [];
            setUsers(data);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) fetchUsers();
    }, [token]);

    // Handler to update a user's role
    const handleRoleChange = async (userId, newRole) => {
        try {
            const response = await fetch(`/api/users/${userId}/role`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ role: newRole })
            });

            if (!response.ok) {
                const text = await response.text();
                let errObj = null;
                try { errObj = text ? JSON.parse(text) : null; } catch(e) { errObj = null; }
                throw new Error((errObj && (errObj.error || errObj.message)) || 'Failed to update role');
            }

            // Update local state
            setUsers(prevUsers =>
                prevUsers.map(u => u.user_id === userId ? { ...u, role: newRole } : u)
            );

            setInfoModalContent({ title: 'Success', body: "User role updated." });
            setIsInfoModalOpen(true);

        } catch (err) {
            setInfoModalContent({ title: 'Error', body: err.message });
            setIsInfoModalOpen(true);
            // Re-fetch users to reset dropdown on failure
            fetchUsers();
        }
    };

    // Handler to open the delete confirmation modal
    const handleDeleteClick = (user) => {
        setUserToAction(user);
        setIsDeleteModalOpen(true);
    };

    // Handler to confirm and execute the user deletion
    const handleConfirmDelete = async () => {
        if (!userToAction) return;
        setIsDeleteModalOpen(false);

        try {
            const response = await fetch(`/api/users/${userToAction.user_id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                 const text = await response.text();
                 let errObj = null;
                 try { errObj = text ? JSON.parse(text) : null; } catch(e) { errObj = null; }
                 throw new Error((errObj && (errObj.error || errObj.message)) || 'Failed to delete user');
            }

            // Remove from local state
            setUsers(prevUsers =>
                prevUsers.filter(u => u.user_id !== userToAction.user_id)
            );

            setInfoModalContent({ title: 'Success', body: `User ${userToAction.email} has been deleted.` });
            setIsInfoModalOpen(true);

        } catch (err) {
            setInfoModalContent({ title: 'Error', body: err.message });
            setIsInfoModalOpen(true);
        } finally {
            setUserToAction(null);
        }
    };

    const formatDate = (dateString) => new Date(dateString).toLocaleDateString();

    return (
        <div className="bookings-list-page"> {/* Re-use main class */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Delete User"
            >
                <p>Are you sure you want to delete this user?</p>
                <p><strong>{userToAction?.email}</strong></p>
                <p>All of their bookings will be permanently deleted. This action cannot be undone.</p>
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

            <h1 className="page-title">User Management</h1>

            {loading && <p>Loading users...</p>}
            {error && <p className="error-message">{error}</p>}

            {!loading && !error && (
                <table className="bookings-table">
                    <thead>
                        <tr>
                            <th>User ID</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Role</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.length > 0 ? (
                            users.map(user => {
                                // Check if this row is the currently logged-in admin
                                const isCurrentUser = user.user_id === authUser.id;

                                return (
                                    <tr key={user.user_id}>
                                        <td>{user.user_id}</td>
                                        <td>{user.first_name} {user.last_name}</td>
                                        <td>{user.email}</td>
                                        <td>{user.phone || 'N/A'}</td>
                                        <td>
                                            <select
                                                className="role-select"
                                                value={user.role}
                                                onChange={(e) => handleRoleChange(user.user_id, e.target.value)}
                                                disabled={isCurrentUser} // Disable changing your own role
                                            >
                                                <option value="guest">Guest</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                        </td>
                                        <td>
                                            <button
                                                className="action-btn cancel-btn" // Re-using cancel style for delete
                                                onClick={() => handleDeleteClick(user)}
                                                disabled={isCurrentUser}
                                                title="Delete User" // Add title for clarity
                                            >
                                                <FiTrash2 className="btn-icon" /> {/* 2. Add icon */}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan="6">No users found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            )}
        </div>
    );
}