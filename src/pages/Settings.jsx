import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Camera, Lock, Check } from 'lucide-react';

export default function Settings() {
  const { user, updateProfile } = useAuth();
  const [username, setUsername] = useState(user?.username || '');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const fileInputRef = useRef(null);

  const handleSaveProfile = (e) => {
    e.preventDefault();
    updateProfile({ username });
    showSuccess("Profile updated successfully!");
  };

  const handleSavePassword = (e) => {
    e.preventDefault();
    setPassword('');
    setNewPassword('');
    showSuccess("Password changed successfully!");
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateProfile({ profilePicture: reader.result });
        showSuccess("Profile picture updated!");
      };
      reader.readAsDataURL(file);
    }
  };

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  return (
    <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '32px' }}>Profile Settings</h1>

      {successMsg && (
        <div style={{ 
          background: 'rgba(16, 185, 129, 0.2)', 
          border: '1px solid #10b981', 
          color: '#10b981', 
          padding: '12px 16px', 
          borderRadius: '8px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Check size={20} />
          {successMsg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '24px' }}>
        <div className="glass-card">
          <h2 style={{ fontSize: '1.2rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={20} /> Public Profile
          </h2>
          
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px', marginBottom: '24px' }}>
            <div style={{ position: 'relative' }}>
              {user?.profilePicture ? (
                <img src={user.profilePicture} alt="Profile" style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={40} color="var(--text-secondary)" />
                </div>
              )}
              <button 
                onClick={() => fileInputRef.current.click()}
                style={{ 
                  position: 'absolute', bottom: 0, right: 0, 
                  background: 'var(--primary-blue)', border: 'none', borderRadius: '50%', 
                  width: '32px', height: '32px', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
                }}
              >
                <Camera size={16} />
              </button>
              <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" style={{ display: 'none' }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
                Upload a new avatar. JPG, GIF or PNG. Max size of 2MB.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile}>
            <div className="form-group" style={{ maxWidth: '400px' }}>
              <label>Username</label>
              <input 
                type="text" 
                className="form-control" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-primary">Save Profile</button>
          </form>
        </div>

        <div className="glass-card">
          <h2 style={{ fontSize: '1.2rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={20} /> Change Password
          </h2>
          
          <form onSubmit={handleSavePassword} style={{ maxWidth: '400px' }}>
            <div className="form-group">
              <label>Current Password</label>
              <input 
                type="password" 
                className="form-control" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>New Password</label>
              <input 
                type="password" 
                className="form-control" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-primary">Update Password</button>
          </form>
        </div>
      </div>
    </div>
  );
}
