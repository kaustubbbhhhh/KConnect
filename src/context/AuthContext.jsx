import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for stored token on initial load
  useEffect(() => {
    const userInfo = localStorage.getItem('userInfo');
    if (userInfo) {
      setUser(JSON.parse(userInfo));
    }
    setLoading(false);
  }, []);

  const login = async (userData) => {
    if (userData.isGoogle) {
      // Google Login route
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: userData.credential }),
        });
        const data = await response.json();
        
        if (response.ok) {
          localStorage.setItem('userInfo', JSON.stringify(data));
          setUser(data);
          return data;
        } else {
          throw new Error(data.message || 'Google Login failed');
        }
      } catch (error) {
        console.error('Google login error:', error.message);
        throw error;
      }
    } else {
      // Local Login route
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: userData.email, password: userData.password }),
        });
        const data = await response.json();
        
        if (response.ok) {
          localStorage.setItem('userInfo', JSON.stringify(data));
          setUser(data);
          return data;
        } else {
          throw new Error(data.message || 'Login failed');
        }
      } catch (error) {
        console.error('Login error:', error.message);
        throw error;
      }
    }
  };

  const register = async (userData) => {
    try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: userData.firstName,
            lastName: userData.lastName,
            email: userData.email,
            password: userData.password
          }),
        });
        const data = await response.json();
        
        if (response.ok) {
          return data;
        } else {
          throw new Error(data.message || 'Registration failed');
        }
      } catch (error) {
        console.error('Registration error:', error.message);
        throw error;
      }
  };

  const verifyOtp = async (email, otp) => {
    try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp }),
        });
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('userInfo', JSON.stringify(data));
            setUser(data);
            return data;
        } else {
            throw new Error(data.message || 'OTP Verification failed');
        }
    } catch (error) {
        console.error('OTP Verification error:', error.message);
        throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('userInfo');
    setUser(null);
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/users/password`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify({ currentPassword, newPassword }),
        });
        
        const data = await response.json();
        
        if (response.ok) {
            return data;
        } else {
            throw new Error(data.message || 'Failed to update password');
        }

    } catch (error) {
        console.error('Password update error:', error.message);
        throw error;
    }
  };

  const updateProfile = async (updates) => {
    try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/users/profile`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify(updates),
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const updatedUser = { ...user, ...data };
            localStorage.setItem('userInfo', JSON.stringify(updatedUser));
            setUser(updatedUser);
            return updatedUser;
        } else {
            throw new Error(data.message || 'Failed to update user profile');
        }

    } catch (error) {
        console.error('Profile update error:', error.message);
        throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, verifyOtp, changePassword, updateProfile, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
