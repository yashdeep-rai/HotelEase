// frontend/src/context/AuthContext.js
import { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => {
    return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
    const [auth, setAuth] = useState({
        token: localStorage.getItem('token'),
        user: JSON.parse(localStorage.getItem('user'))
    });

    const login = (token, user) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        setAuth({ token, user });
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setAuth({ token: null, user: null });
    };

    const value = {
        token: auth.token,
        user: auth.user,
        isAuthenticated: !!auth.token,
        isAdmin: auth.user?.role === 'admin',
        login,
        logout
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};