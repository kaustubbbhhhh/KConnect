import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Mail, Key, LogIn } from 'lucide-react';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email) {
      login({ username: email.split('@')[0], email, profilePicture: null });
      navigate('/dashboard');
    }
  };

  const handleGoogleLogin = () => {
    login({ username: 'GoogleUser', email: 'google@example.com', profilePicture: null });
    navigate('/dashboard');
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '48px', height: '48px', background: 'var(--primary-blue)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'white', fontSize: '1.5rem', fontWeight: 'bold' }}>
            K
          </div>
          <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Sign in to continue to KConnect</p>
        </div>

        <button onClick={handleGoogleLogin} className="btn-secondary" style={{ width: '100%', marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
          <img src="https://www.google.com/favicon.ico" alt="Google" style={{ width: '18px', height: '18px', marginRight: '8px' }} />
          Continue with Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', margin: '24px 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--card-border)' }} />
          <span style={{ padding: '0 12px' }}>OR</span>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--card-border)' }} />
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', top: '14px', left: '12px', color: 'var(--text-secondary)' }} />
              <input 
                type="email" 
                className="form-control" 
                style={{ paddingLeft: '40px' }} 
                placeholder="you@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label>Password</label>
            <div style={{ position: 'relative' }}>
              <Key size={18} style={{ position: 'absolute', top: '14px', left: '12px', color: 'var(--text-secondary)' }} />
              <input 
                type="password" 
                className="form-control" 
                style={{ paddingLeft: '40px' }} 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>
          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '8px' }}>
            <LogIn size={18} /> {isLogin ? 'Login' : 'Sign Up'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.9rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>{isLogin ? "Don't have an account? " : "Already have an account? "}</span>
          <button 
            type="button"
            onClick={() => setIsLogin(!isLogin)} 
            style={{ background: 'none', border: 'none', color: 'var(--primary-blue)', cursor: 'pointer', fontWeight: 500, padding: 0 }}
          >
            {isLogin ? 'Sign up' : 'Login'}
          </button>
        </div>
      </div>
    </div>
  );
}
