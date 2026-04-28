import { useState, useEffect } from 'react';
import { Video, Users, ArrowRight, X, Play, LogIn, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Join Meeting States
  const [meetingCode, setMeetingCode] = useState('');
  const [meetingPassword, setMeetingPassword] = useState('');
  const [joinError, setJoinError] = useState('');
  
  // Create Meeting States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newMeetingId, setNewMeetingId] = useState('');
  const [newMeetingPassword, setNewMeetingPassword] = useState('');
  const [createError, setCreateError] = useState('');
  
  // Active Meeting Return State
  const [activeMeetingId, setActiveMeetingId] = useState(null);
  const [scheduledMeetings, setScheduledMeetings] = useState([]);
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(false);

  useEffect(() => {
    // Check if coming from an invite link
    const searchParams = new URLSearchParams(location.search);
    const joinId = searchParams.get('join');
    if (joinId) {
        setMeetingCode(joinId);
    }
  }, [location.search]);

  useEffect(() => {
    // Check if there is an active meeting in localStorage
    const savedMeeting = localStorage.getItem('activeMeetingId');
    if (savedMeeting) {
        setActiveMeetingId(savedMeeting);
    }
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    setIsLoadingMeetings(true);
    try {
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/meetings`, {
            headers: {
                Authorization: `Bearer ${user?.token}`
            }
        });
        const data = await res.json();
        if (res.ok) {
            setScheduledMeetings(data);
        }
    } catch (err) {
        console.error('Failed to fetch meetings');
    } finally {
        setIsLoadingMeetings(false);
    }
  };

  const openCreateModal = () => {
    setNewMeetingId(Math.random().toString(36).substring(2, 9)); // Auto-generate random ID
    setNewMeetingPassword(''); // Optional password
    setIsCreateModalOpen(true);
  };

  const handleCreateMeeting = async (e, startNow = true) => {
    if (e) e.preventDefault();
    setCreateError('');
    
    try {
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/meetings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${user?.token}`
            },
            body: JSON.stringify({
                meetingId: newMeetingId.trim(),
                password: newMeetingPassword.trim(),
                title: `${user?.username}'s Meeting`,
                isScheduled: !startNow
            })
        });

        const data = await res.json();
        
        if (res.ok) {
            if (startNow) {
                localStorage.setItem('activeMeetingId', data.meetingId);
                localStorage.setItem('activeMeetingPassword', newMeetingPassword.trim());
                navigate(`/room/${data.meetingId}`);
            } else {
                setScheduledMeetings(prev => [data, ...prev]);
                setIsCreateModalOpen(false);
            }
        } else if (res.status === 401) {
            // Token expired or invalid — force re-login
            logout();
            navigate('/login');
        } else {
            setCreateError(data.message || 'Failed to create meeting.');
        }
    } catch (err) {
        setCreateError('Server error while creating meeting.');
    }
  };

  const handleJoinMeeting = async (e) => {
    e.preventDefault();
    const code = meetingCode.trim();
    if (!code) {
      setJoinError('Please enter a meeting code.');
      return;
    }
    
    setJoinError('');

    try {
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/meetings/join`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${user?.token}`
            },
            body: JSON.stringify({
                meetingId: code,
                password: meetingPassword.trim()
            })
        });

        const data = await res.json();

        if (res.ok) {
            localStorage.setItem('activeMeetingId', code);
            // If they joined, they don't necessarily get the password to share, but let's store it if they have it
            if(meetingPassword) localStorage.setItem('activeMeetingPassword', meetingPassword.trim());
            navigate(`/room/${code}`);
        } else {
            setJoinError(data.message || 'Failed to join meeting.');
        }
    } catch (err) {
        setJoinError('Server error while joining meeting.');
    }
  };

  const returnToMeeting = () => {
      navigate(`/room/${activeMeetingId}`);
  };

  const handleDeleteMeeting = async (meetingId) => {
    if (!window.confirm('Are you sure you want to delete this meeting?')) return;
    
    try {
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/meetings/${meetingId}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${user?.token}`
            }
        });
        if (res.ok) {
            setScheduledMeetings(prev => prev.filter(m => m.meetingId !== meetingId));
        }
    } catch (err) {
        console.error('Failed to delete meeting');
    }
  };

  const handleEndMeeting = async (meetingId) => {
    if (!window.confirm('Are you sure you want to end this active meeting for everyone?')) return;
    
    try {
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/meetings/${meetingId}/end`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${user?.token}`
            }
        });
        if (res.ok) {
            // Update local state to reflect ended status. It might disappear on next fetch if not scheduled.
            setScheduledMeetings(prev => prev.map(m => m.meetingId === meetingId ? { ...m, status: 'ended' } : m));
            if (activeMeetingId === meetingId) {
                localStorage.removeItem('activeMeetingId');
                localStorage.removeItem('activeMeetingPassword');
                setActiveMeetingId(null);
            }
        }
    } catch (err) {
        console.error('Failed to end meeting');
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto py-8 lg:py-16 px-4 relative">
      
      {/* Header Section */}
      <div className="mb-12 text-center md:text-left flex flex-col md:flex-row md:items-center justify-between">
        <div>
            <h2 className="text-4xl font-extrabold tracking-tight mb-2">Dashboard</h2>
            <p className="text-zinc-400 text-lg">
            Welcome back, <span className="text-white font-semibold">{user?.username}</span>
            </p>
        </div>
        
        {/* Go Back To Meeting Button */}
        {activeMeetingId && scheduledMeetings.some(m => m.meetingId === activeMeetingId && m.status === 'active') && (
            <button 
                onClick={returnToMeeting}
                className="mt-6 md:mt-0 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all hover:scale-105"
            >
                <Video size={18} />
                Return to Active Meeting
            </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Start Meeting Card */}
        <div 
          onClick={openCreateModal}
          className="glass-panel p-10 rounded-[2rem] flex flex-col items-center text-center group cursor-pointer hover:bg-white/10 hover:-translate-y-2 transition-all duration-300"
        >
          <div className="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-xl">
            <Video size={36} fill="currentColor" />
          </div>
          <h3 className="text-2xl font-bold mb-3">New Meeting</h3>
          <p className="text-zinc-400 text-base mb-8 max-w-[250px]">Start an instant, secure video meeting and set a custom ID and Password</p>
          <button className="bg-white text-black px-8 py-3.5 rounded-xl font-bold w-full max-w-[250px] shadow-lg">
            Create Meeting
          </button>
        </div>

        {/* Join Meeting Card */}
        <div className="glass-panel p-10 rounded-[2rem] flex flex-col items-center text-center group hover:bg-white/[0.07] transition-colors duration-300">
          <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-xl">
            <Users size={36} className="text-white" />
          </div>
          <h3 className="text-2xl font-bold mb-3">Join Meeting</h3>
          <p className="text-zinc-400 text-base mb-8 max-w-[250px]">Enter meeting details to connect securely</p>
          
          <form onSubmit={handleJoinMeeting} className="w-full max-w-[300px] flex flex-col gap-3">
            {joinError && (
              <p className="text-red-400 text-sm font-medium">{joinError}</p>
            )}
            <input 
                type="text" 
                placeholder="Meeting ID" 
                className="glass-input w-full px-5 py-3 rounded-xl font-medium"
                value={meetingCode}
                onChange={(e) => {setMeetingCode(e.target.value); setJoinError('');}}
            />
            <input 
                type="password" 
                placeholder="Password (if any)" 
                className="glass-input w-full px-5 py-3 rounded-xl font-medium"
                value={meetingPassword}
                onChange={(e) => {setMeetingPassword(e.target.value); setJoinError('');}}
            />
            <button 
                type="submit"
                className="glass-button w-full px-6 py-3.5 mt-2 rounded-xl flex items-center justify-center gap-2 hover:bg-white hover:text-black shadow-lg font-bold transition-all"
            >
                <LogIn size={18} /> Join Now
            </button>
          </form>
        </div>
      </div>

      {/* Scheduled Meetings Section */}
      <div className="mt-16">
        <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-bold">Your Meetings</h3>
            <span className="bg-white/10 px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase">
                {scheduledMeetings.length} Total
            </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoadingMeetings ? (
                <div className="col-span-full py-12 flex justify-center">
                    <div className="w-8 h-8 border-4 border-white/10 border-t-white rounded-full animate-spin" />
                </div>
            ) : scheduledMeetings.length > 0 ? (
                scheduledMeetings.map((meeting) => (
                    <div key={meeting._id} className="glass-panel p-6 rounded-2xl group hover:border-white/30 transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Video size={20} className="text-zinc-400 group-hover:text-white" />
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => {
                                        localStorage.setItem('activeMeetingId', meeting.meetingId);
                                        localStorage.setItem('activeMeetingPassword', meeting.password);
                                        navigate(`/room/${meeting.meetingId}`);
                                    }}
                                    className="bg-white text-black px-4 py-2 rounded-lg text-sm font-bold opacity-0 group-hover:opacity-100 transition-all hover:bg-zinc-200"
                                >
                                    Start
                                </button>
                                {meeting.status === 'active' ? (
                                    <button 
                                        onClick={() => handleEndMeeting(meeting.meetingId)}
                                        className="bg-orange-500/10 text-orange-500 px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-orange-500 hover:text-white text-sm font-bold"
                                        title="End Meeting"
                                    >
                                        End
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => handleDeleteMeeting(meeting.meetingId)}
                                        className="bg-red-500/10 text-red-500 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white"
                                        title="Delete Meeting"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                        <h4 className="font-bold text-lg mb-1 truncate">
                            {meeting.title}
                            {meeting.status === 'active' && (
                                <span className="ml-2 inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Active" />
                            )}
                        </h4>
                        <div className="flex flex-col gap-1">
                            <span className="text-zinc-500 text-xs font-medium uppercase tracking-wider">ID: {meeting.meetingId}</span>
                            {meeting.password && (
                                <span className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Pass: ••••••••</span>
                            )}
                        </div>
                        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                            <span className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">Created {new Date(meeting.createdAt).toLocaleDateString()}</span>
                            <div className="flex -space-x-2">
                                <div className="w-6 h-6 rounded-full bg-zinc-800 border border-white/10" />
                                <div className="w-6 h-6 rounded-full bg-zinc-700 border border-white/10" />
                            </div>
                        </div>
                    </div>
                ))
            ) : (
                <div className="col-span-full py-20 text-center glass-panel rounded-[2rem] border-dashed">
                    <Video size={40} className="mx-auto text-zinc-700 mb-4" />
                    <p className="text-zinc-500 font-medium">No meetings scheduled yet.</p>
                    <button onClick={openCreateModal} className="text-white text-sm font-bold mt-2 hover:underline">Create your first meeting</button>
                </div>
            )}
        </div>
      </div>

      {/* Pre-Meeting Modal */}
      {isCreateModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="glass-panel max-w-md w-full p-8 rounded-[2rem] relative shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200">
                  <button 
                    onClick={() => setIsCreateModalOpen(false)}
                    className="absolute top-6 right-6 text-zinc-400 hover:text-white"
                  >
                      <X size={24} />
                  </button>

                  <h3 className="text-2xl font-bold mb-2">Meeting Details</h3>
                  <p className="text-zinc-400 text-sm mb-6">Customize your meeting ID and set an optional password.</p>

                  <form onSubmit={handleCreateMeeting} className="space-y-5">
                      {createError && (
                          <div className="bg-red-500/10 text-red-400 p-3 rounded-xl text-sm font-medium border border-red-500/20">
                              {createError}
                          </div>
                      )}
                      
                      <div className="space-y-2">
                          <label className="text-sm font-medium text-zinc-300 ml-1">Meeting ID</label>
                          <input 
                              type="text" 
                              required
                              className="glass-input w-full px-4 py-3 rounded-xl font-medium tracking-wider"
                              value={newMeetingId}
                              onChange={(e) => setNewMeetingId(e.target.value)}
                          />
                      </div>
                      
                      <div className="space-y-2">
                          <label className="text-sm font-medium text-zinc-300 ml-1">Meeting Password (Optional)</label>
                          <input 
                              type="text" 
                              className="glass-input w-full px-4 py-3 rounded-xl"
                              placeholder="Leave blank for open meeting"
                              value={newMeetingPassword}
                              onChange={(e) => setNewMeetingPassword(e.target.value)}
                          />
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 mt-8">
                        <button 
                            type="button"
                            onClick={(e) => handleCreateMeeting(null, false)}
                            className="flex-1 glass-button px-6 py-3.5 rounded-xl font-bold transition-all border border-white/10 hover:bg-white/5"
                        >
                            Schedule Later
                        </button>
                        <button 
                            type="submit"
                            className="flex-1 bg-white text-black font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                        >
                            <Play fill="currentColor" size={16} /> Start Now
                        </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

    </div>
  );
}
