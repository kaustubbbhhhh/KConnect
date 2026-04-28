import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, Key, LogIn } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtpStep, setShowOtpStep] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const { login, register, verifyOtp, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    try {
      if (isLogin) {
        await login({ email, password });
        navigate(from, { replace: true });
      } else {
        if (password !== confirmPassword) {
            setErrorMsg('Passwords do not match');
            return;
        }
        await register({ firstName, lastName, email, password });
        setShowOtpStep(true);
      }
    } catch (error) {
      setErrorMsg(error.message || 'Authentication failed');
    }
  };

  const handleVerifyOtp = async (e) => {
      e.preventDefault();
      setErrorMsg('');
      try {
          await verifyOtp(email, otp);
          navigate(from, { replace: true });
      } catch (error) {
          setErrorMsg(error.message || 'Verification failed');
      }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setErrorMsg('');
    try {
        await login({ 
            isGoogle: true,
            credential: credentialResponse.credential
        });
        navigate(from, { replace: true });
    } catch (error) {
        console.error('Google Auth UI Error:', error);
        setErrorMsg(error.message || 'Google Login Failed (Fallback UI)');
    }
  };

  const handleGoogleError = () => {
    setErrorMsg('Google Login was unsuccessful. Try again later.');
  };

  return (
    <div className="flex items-center justify-center w-full min-h-[calc(100vh-100px)] px-4">
      <div className="glass-panel w-full max-w-md p-8 sm:p-10 rounded-[2rem] relative overflow-hidden z-10">
        
        {/* Glow Effects */}
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-white/10 blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-zinc-500/10 blur-[80px] rounded-full pointer-events-none" />

        <div className="relative z-10">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold tracking-tight mb-3">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-zinc-400 text-sm">
              {isLogin ? 'Enter your details to access your meetings' : 'Sign up to start hosting secure meetings'}
            </p>
          </div>

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-xl mb-6 text-sm text-center font-medium">
              {errorMsg}
            </div>
          )}

          {showOtpStep ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="text-center mb-8">
                      <h3 className="text-xl font-bold mb-2">Check your email</h3>
                      <p className="text-zinc-400 text-sm px-4">We've sent a 6-digit verification code to <span className="text-white font-medium">{email}</span></p>
                  </div>
                  
                  <form onSubmit={handleVerifyOtp} className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300 flex justify-center">Enter Verification Code</label>
                        <input 
                            type="text" 
                            maxLength="6"
                            placeholder="000000"
                            className="glass-input w-full text-center text-3xl tracking-[0.5em] font-bold py-4 rounded-xl"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            required
                        />
                      </div>
                      <button type="submit" className="w-full bg-white text-black font-bold py-3.5 rounded-xl hover:bg-zinc-200 transition-all flex justify-center items-center gap-2">
                          Verify & Complete
                      </button>
                      <button 
                        type="button"
                        onClick={() => setShowOtpStep(false)}
                        className="w-full text-zinc-500 text-sm hover:text-white transition-colors"
                      >
                        Back to Sign Up
                      </button>
                  </form>
              </div>
          ) : (
            <>
              <div className="flex justify-center mb-8">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  useOneTap
                  shape="rectangular"
                  theme="filled_black"
                  text="continue_with"
                />
              </div>

              <div className="flex items-center gap-4 mb-8">
                <div className="h-[1px] bg-white/10 flex-1" />
                <span className="text-zinc-500 text-xs font-bold tracking-wider">OR EMAIL</span>
                <div className="h-[1px] bg-white/10 flex-1" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {!isLogin && (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-300 ml-1">First Name</label>
                            <input 
                                type="text" 
                                className="glass-input w-full px-4 py-3 rounded-xl"
                                placeholder="John" 
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                required={!isLogin}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-300 ml-1">Last Name</label>
                            <input 
                                type="text" 
                                className="glass-input w-full px-4 py-3 rounded-xl"
                                placeholder="Doe" 
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                required={!isLogin}
                            />
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300 ml-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute top-3.5 left-3.5 text-zinc-500" size={18} />
                    <input 
                      type="email" 
                      className="glass-input w-full pl-11 pr-4 py-3 rounded-xl"
                      placeholder="you@example.com" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300 ml-1">Password</label>
                  <div className="relative">
                    <Key className="absolute top-3.5 left-3.5 text-zinc-500" size={18} />
                    <input 
                      type="password" 
                      className="glass-input w-full pl-11 pr-4 py-3 rounded-xl"
                      placeholder="••••••••" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {!isLogin && (
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300 ml-1">Confirm Password</label>
                        <div className="relative">
                            <Key className="absolute top-3.5 left-3.5 text-zinc-500" size={18} />
                            <input 
                            type="password" 
                            className="glass-input w-full pl-11 pr-4 py-3 rounded-xl"
                            placeholder="••••••••" 
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required={!isLogin}
                            />
                        </div>
                    </div>
                )}
                
                <button type="submit" className="w-full bg-white text-black font-bold py-3.5 rounded-xl hover:bg-zinc-200 hover:scale-[1.01] transition-all active:scale-[0.99] mt-4 flex justify-center items-center gap-2">
                  <LogIn size={18} /> {isLogin ? 'Sign In' : 'Sign Up'}
                </button>
              </form>

              <p className="text-center mt-8 text-sm text-zinc-400">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button 
                  type="button"
                  onClick={() => { setIsLogin(!isLogin); setErrorMsg(''); setShowOtpStep(false); }} 
                  className="text-white font-medium hover:underline focus:outline-none ml-1"
                >
                  {isLogin ? 'Sign up' : 'Log in'}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
