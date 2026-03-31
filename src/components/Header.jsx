import { useAuth } from '../context/AuthContext';
import { LogOut, User as UserIcon, Home, Settings as SettingsIcon } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const NavButton = ({ icon: Icon, label, path }) => (
    <button 
      onClick={() => navigate(path)}
      style={{
        background: location.pathname === path ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
        border: 'none',
        color: location.pathname === path ? '#60a5fa' : 'var(--text-primary)',
        padding: '8px 16px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        cursor: 'pointer',
        fontWeight: 500,
        transition: 'all 0.2s ease'
      }}
      onMouseOver={(e) => {
        if(location.pathname !== path) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
      }}
      onMouseOut={(e) => {
        if(location.pathname !== path) e.currentTarget.style.background = 'transparent';
      }}
    >
      <Icon size={18} /> {label}
    </button>
  );

  return (
    <header style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      padding: '16px 32px',
      borderBottom: '1px solid var(--card-border)',
      background: 'rgba(0,0,0,0.2)',
      backdropFilter: 'blur(10px)'
    }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '32px', height: '32px', background: 'var(--primary-blue)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          K
        </div>
        Connect
      </div>
      
      {user && (
        <>
          <nav style={{ display: 'flex', gap: '8px' }}>
            <NavButton icon={Home} label="Dashboard" path="/dashboard" />
            <NavButton icon={SettingsIcon} label="Settings" path="/settings" />
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {user.profilePicture ? (
                <img src={user.profilePicture} alt="Profile" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserIcon size={20} />
                </div>
              )}
              <span style={{ fontWeight: 500 }}>{user.username}</span>
            </div>
            <button onClick={handleLogout} className="btn-secondary" style={{ padding: '8px' }} title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </>
      )}
    </header>
  );
};

export default Header;
