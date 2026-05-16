import { useAuth } from '../context/AuthContext';
import { LogOut, User as UserIcon, Home, Settings as SettingsIcon, Video } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

const NavButton = ({ icon: Icon, label, path }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = location.pathname === path;
  return (
    <button 
      onClick={() => navigate(path)}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${
        isActive 
          ? 'bg-white text-black shadow-lg shadow-white/10' 
          : 'text-zinc-400 hover:text-white hover:bg-white/10'
      }`}
    >
      <Icon size={18} className={isActive ? 'text-black' : 'text-zinc-400'} /> 
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
};

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isMeeting = location.pathname.startsWith('/room/');

  return (
    <header className={`sticky top-0 z-50 w-full border-b border-white/10 bg-black/50 backdrop-blur-xl ${isMeeting ? 'hidden sm:block' : ''}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          
          <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-3 hover:opacity-80 transition-opacity group">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
              <Video size={24} className="text-black" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white hidden sm:block">
              KConnect
            </h1>
          </Link>
        
          {user ? (
            <div className="flex items-center gap-4 sm:gap-6">
              <nav className="flex gap-2">
                <NavButton icon={Home} label="Dashboard" path="/dashboard" />
                <NavButton icon={SettingsIcon} label="Settings" path="/settings" />
              </nav>

              <div className="w-px h-8 bg-white/10 hidden sm:block" />

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  {user.profilePicture ? (
                    <img src={user.profilePicture} alt="Profile" className="w-10 h-10 rounded-full object-cover border-2 border-white/20 shadow-lg" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border-2 border-white/20 shadow-lg">
                      <UserIcon size={20} className="text-zinc-400" />
                    </div>
                  )}
                  <span className="font-bold text-sm hidden md:block">{user.username}</span>
                </div>
                <button 
                  onClick={handleLogout} 
                  className="p-2.5 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-colors" 
                  title="Logout"
                >
                  <LogOut size={20} />
                </button>
              </div>
            </div>
          ) : (
            <Link to="/login" className="bg-white text-black px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-zinc-200 transition-colors shadow-lg">
              Sign In
            </Link>
          )}

        </div>
      </div>
    </header>
  );
};

export default Header;
