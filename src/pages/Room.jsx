import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import Peer from 'simple-peer';
import { useAuth } from '../context/AuthContext';
import { Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, Users, UserMinus, MonitorUp, MonitorOff, MessageSquare, Send, PanelRightOpen, PanelRightClose, Info, Copy, Check, X, ShieldCheck, ShieldX, Clock } from 'lucide-react';

export default function Room() {
  const { id: roomID } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [peers, setPeers] = useState([]);
  const [stream, setStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [meetingTimer, setMeetingTimer] = useState(0);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [iceServers, setIceServers] = useState([]);
  
  // Chat state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const messagesEndRef = useRef(null);

  // Info Panel State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [copiedField, setCopiedField] = useState('');
  const meetingPassword = localStorage.getItem('activeMeetingPassword') || 'None';
  
  const socketRef = useRef();
  const userVideo = useRef();
  const peersRef = useRef([]);
  const streamRef = useRef(null);
  const screenTrackRef = useRef(null);
  const originalVideoTrackRef = useRef(null);

  // Security and Join State
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isJoinPromptOpen, setIsJoinPromptOpen] = useState(false);
  const [joinPasswordInput, setJoinPasswordInput] = useState('');
  const [joinError, setJoinError] = useState('');
  const [meetingDetails, setMeetingDetails] = useState(null);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const isHostRef = useRef(false);

  // Waiting Room & Admit State
  const [isWaiting, setIsWaiting] = useState(false);
  const [pendingUsers, setPendingUsers] = useState([]);

  // Remote peer media status (mute / video off indicators)
  const [peerMediaStatus, setPeerMediaStatus] = useState({});

  // Security check for direct link joins
  useEffect(() => {
    const timer = setInterval(() => {
      setMeetingTimer(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? hrs + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
      const savedMeetingId = localStorage.getItem('activeMeetingId');
      const savedPassword = localStorage.getItem('activeMeetingPassword') || '';
      
      if (savedMeetingId === roomID) {
          handleDirectJoin(savedPassword);
      } else {
          // Try joining without password first
          handleDirectJoin('');
      }
  }, [roomID, user]);

  const handleDirectJoin = async (passwordToTry) => {
      try {
          const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/meetings/join`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${user?.token}`
              },
              body: JSON.stringify({ meetingId: roomID, password: passwordToTry })
          });
          const data = await res.json();
           if (res.ok) {
              localStorage.setItem('activeMeetingId', roomID);
              if (passwordToTry) localStorage.setItem('activeMeetingPassword', passwordToTry);
              setMeetingDetails(data.meeting);
              const hostStatus = data.meeting.host === user?._id;
              setIsHost(hostStatus);
              isHostRef.current = hostStatus;
              localStorage.setItem('activeMeetingIsHost', hostStatus ? 'true' : 'false');
              setIsJoinPromptOpen(false);
              setIsAuthorized(true);
          } else if (res.status === 403) {
              alert(data.message || 'This meeting has ended.');
              navigate('/dashboard');
          } else if (res.status === 401) {
              setIsJoinPromptOpen(true);
              if (passwordToTry) setJoinError(data.message || 'Incorrect password.');
          } else {
              alert(data.message || 'Meeting not found or failed to join.');
              navigate('/dashboard');
          }
      } catch (err) {
          navigate('/dashboard');
      }
  };

  useEffect(() => {
    if (!isAuthorized) return;

    let isMounted = true;
    const backendUrl = import.meta.env.VITE_BACKEND_URL || window.location.origin;
    const socket = io(backendUrl);
    socketRef.current = socket;

    // Chat listener
    socket.on('new message', (message) => {
        if (isMounted) setMessages((prev) => [...prev, message]);
    });

    // Participants list updates
    socket.on('participants list', list => {
        if (!isMounted) return;
        const sorted = [...list].sort((a, b) => (b.isHost ? 1 : -1));
        setParticipants(sorted);
    });

    // Pending users list (host only)
    socket.on('pending list', list => {
        if (isMounted) setPendingUsers(list || []);
    });

    // Meeting ended by host
    socket.on('meeting ended', () => {
        alert('This meeting has been ended by the host.');
        navigate('/dashboard');
    });

    // Kicked by host
    socket.on('you were kicked', () => {
        alert('You have been removed from the meeting by the host.');
        navigate('/dashboard');
    });

    // Denied admission
    socket.on('denied', () => {
        alert('The host denied your request to join.');
        navigate('/dashboard');
    });

    const initializeCall = async () => {
      // 1. Fetch TURN servers
      let currentIceServers = [];
      try {
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/turn`);
        if(res.ok) {
           const servers = await res.json();
           if (Array.isArray(servers) && servers.length > 0) {
             currentIceServers = servers;
             if (isMounted) setIceServers(currentIceServers);
           } else {
             console.warn('TURN server list empty — symmetric NAT users may fail to connect');
           }
        } else {
          console.warn('TURN fetch failed with status', res.status, '— falling back to STUN only');
        }
      } catch (err) {
        console.warn('TURN load failed — falling back to STUN only:', err.message);
      }

      if (!isMounted) return;

      function getLatestConfig() {
        return {
          iceServers: currentIceServers.length > 0 ? currentIceServers : [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        };
      }

      // 2. Get media
      try {
          const currentStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          
          if (!isMounted) {
              currentStream.getTracks().forEach(track => track.stop());
              return;
          }

          setStream(currentStream);
          streamRef.current = currentStream;
          originalVideoTrackRef.current = currentStream.getVideoTracks()[0];

          if (userVideo.current) {
            userVideo.current.srcObject = currentStream;
          }
          
          // 3. Attach WebRTC signaling listeners
          socket.on('all users', (usersInRoom) => {
            console.log("All users in room:", usersInRoom);
            
            // Clean up stale peers not in the new list
            const serverIds = new Set(usersInRoom.map(u => u.socketId));
            const stalePeers = peersRef.current.filter(p => !serverIds.has(p.peerID));
            stalePeers.forEach(sp => { try { sp.peer.destroy(); } catch(e){} });
            peersRef.current = peersRef.current.filter(p => serverIds.has(p.peerID));
            
            const newPeers = [];
            usersInRoom.forEach((userObj) => {
                if (peersRef.current.find(p => p.peerID === userObj.socketId)) return;

                const peer = new Peer({
                    initiator: true,
                    trickle: true,
                    stream: streamRef.current,
                    config: getLatestConfig()
                });
                
                // NOTE: Do NOT add a stream listener here — let VideoStream handle it to avoid race condition.
                peer.on('signal', (signal) => {
                  socket.emit('sending signal', { userToSignal: userObj.socketId, callerID: socket.id, signal });
                });
                peer.on('error', (err) => console.error("Peer error:", err));
                
                peersRef.current.push({ peerID: userObj.socketId, peer, username: userObj.username });
                newPeers.push({ peerID: userObj.socketId, peer, username: userObj.username });
            });
            
            if (newPeers.length > 0) {
                setPeers(prev => [...prev, ...newPeers]);
            } else {
                // Force re-render to remove stale peers from UI
                setPeers([...peersRef.current]);
            }
          });

          socket.on('user joined', (payload) => {
            console.log("User joined / Signal received:", payload.callerID);
            
            const existingPeer = peersRef.current.find(p => p.peerID === payload.callerID);
            if (existingPeer) {
                existingPeer.peer.signal(payload.signal);
                return;
            }

            const peer = new Peer({
                initiator: false,
                trickle: true,
                stream: streamRef.current,
                config: getLatestConfig()
            });

            // NOTE: Do NOT add a stream listener here — let VideoStream handle it to avoid race condition.
            peer.on('signal', (signal) => {
              socket.emit('returning signal', { signal, callerID: payload.callerID });
            });
            peer.on('error', (err) => console.error("Peer error:", err));
            peer.signal(payload.signal);

            peersRef.current.push({ peerID: payload.callerID, peer, username: payload.callerName });
            setPeers(prev => [...prev, { peerID: payload.callerID, peer, username: payload.callerName }]);
          });

          socket.on('receiving returned signal', (payload) => {
            const item = peersRef.current.find((p) => p.peerID === payload.id);
            if(item) {
               item.peer.signal(payload.signal);
               if (payload.responderName) {
                  item.username = payload.responderName;
                  setPeers(users => users.map(u => u.peerID === payload.id ? { ...u, username: payload.responderName } : u));
               }
            }
          });
          
          socket.on('user left', (id) => {
            const peerObj = peersRef.current.find(p => p.peerID === id);
            if(peerObj) { try { peerObj.peer.destroy(); } catch(e){} }
            peersRef.current = peersRef.current.filter(p => p.peerID !== id);
            setPeers(peers => peers.filter(p => p.peerID !== id));
          });

          // 4. Join flow: Host joins directly, non-host requests admission
          if (isHostRef.current) {
              socket.emit('join room', { 
                  roomId: roomID, 
                  username: user?.username || user?.firstName || 'Anonymous',
                  userId: user?._id,
                  isHost: true
              });
          } else {
              // Request admission — wait for host to approve
              setIsWaiting(true);
              socket.emit('request admission', {
                  roomId: roomID,
                  username: user?.username || user?.firstName || 'Anonymous',
                  userId: user?._id
              });

              socket.on('admitted', () => {
                  setIsWaiting(false);
                  socket.emit('join room', {
                      roomId: roomID,
                      username: user?.username || user?.firstName || 'Anonymous',
                      userId: user?._id,
                      isHost: false
                  });
              });
          }

          // 5. Safe auto-rejoin on socket RECONNECT (not initial connect)
          // The old handler fired on initial connect too, causing ghost duplicates.
          // This one uses a flag to skip the first connect event.
          let hasInitiallyConnected = false;
          socket.on('connect', () => {
              if (!hasInitiallyConnected) {
                  hasInitiallyConnected = true;
                  return; // Skip initial connect — join is handled above
              }
              
              console.log("Socket reconnected, rejoining room:", socket.id);
              
              // Destroy all stale peer connections (they're dead anyway)
              peersRef.current.forEach(({ peer }) => { try { peer.destroy(); } catch(e){} });
              peersRef.current = [];
              if (isMounted) {
                  setPeers([]);
                  setPeerMediaStatus({});
              }
              
              // Rejoin the room directly — already admitted, skip admission flow
              socket.emit('join room', {
                  roomId: roomID,
                  username: user?.username || user?.firstName || 'Anonymous',
                  userId: user?._id,
                  isHost: isHostRef.current
              });
          });

          // Listen for remote peer mute/video status changes
          socket.on('user toggled mute', ({ socketId, isMuted: muted }) => {
              if (isMounted) setPeerMediaStatus(prev => ({ ...prev, [socketId]: { ...prev[socketId], isMuted: muted } }));
          });
          socket.on('user toggled video', ({ socketId, isVideoOff: vidOff }) => {
              if (isMounted) setPeerMediaStatus(prev => ({ ...prev, [socketId]: { ...prev[socketId], isVideoOff: vidOff } }));
          });

      } catch (err) {
          console.error("Failed to get media devices:", err);
          alert("Could not access your camera or microphone. Please ensure permissions are granted and no other app is using them.");
      }
    };

    initializeCall();

    return () => {
      isMounted = false;
      // Emit explicit leave so server cleans up immediately
      if (socketRef.current) {
          socketRef.current.emit('leave room');
          socketRef.current.disconnect();
      }
      // Destroy all peer connections
      peersRef.current.forEach(({ peer }) => { try { peer.destroy(); } catch(e){} });
      peersRef.current = [];
      if(streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if(screenTrackRef.current) {
          screenTrackRef.current.stop();
      }
    };
  }, [roomID, isAuthorized]);

  useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatOpen]);

  // Host admit/deny/kick functions
  const admitUser = (targetSocketId) => {
      if (socketRef.current) {
          socketRef.current.emit('admit user', { roomId: roomID, targetSocketId });
      }
  };

  const denyUser = (targetSocketId) => {
      if (socketRef.current) {
          socketRef.current.emit('deny user', { roomId: roomID, targetSocketId });
      }
  };

  const kickUser = (targetSocketId) => {
      if (!window.confirm('Remove this participant from the meeting?')) return;
      if (socketRef.current) {
          socketRef.current.emit('kick user', { roomId: roomID, targetSocketId });
      }
  };


  const toggleMute = () => {
    if (streamRef.current) {
      const newMuted = !isMuted;
      streamRef.current.getAudioTracks()[0].enabled = !newMuted;
      setIsMuted(newMuted);
      // Broadcast to peers
      if (socketRef.current) socketRef.current.emit('toggle mute', { isMuted: newMuted });
    }
  };

  const toggleVideo = () => {
    if (streamRef.current) {
      const newVideoOff = !isVideoOff;
      streamRef.current.getVideoTracks()[0].enabled = !newVideoOff;
      setIsVideoOff(newVideoOff);
      // Broadcast to peers
      if (socketRef.current) socketRef.current.emit('toggle video', { isVideoOff: newVideoOff });
    }
  };

  const endMeeting = async () => {
      if (!window.confirm('Are you sure you want to end this meeting for everyone?')) return;
      
      try {
          const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/meetings/${roomID}/end`, {
              method: 'POST',
              headers: {
                  Authorization: `Bearer ${user?.token}`
              }
          });
          if (res.ok) {
              socketRef.current.emit('end meeting', roomID);
              navigate('/dashboard');
          }
      } catch (err) {
          console.error('Failed to end meeting');
      }
  };

  const toggleScreenShare = async () => {
      if (!isScreenSharing) {
          try {
              const screenStream = await navigator.mediaDevices.getDisplayMedia({ cursor: true });
              const newScreenTrack = screenStream.getVideoTracks()[0];
              
              // Replace track in all existing peers
              peersRef.current.forEach(({ peer }) => {
                  peer.replaceTrack(
                      streamRef.current.getVideoTracks()[0],
                      newScreenTrack,
                      streamRef.current
                  );
              });

              // Replace track in local stream so we see our own screen
              streamRef.current.removeTrack(streamRef.current.getVideoTracks()[0]);
              streamRef.current.addTrack(newScreenTrack);
              
              screenTrackRef.current = newScreenTrack;
              setIsScreenSharing(true);
              setIsVideoOff(false);

              // Listen for the user clicking "Stop sharing" on the browser popup
              newScreenTrack.onended = () => {
                  stopScreenShare();
              };

          } catch (err) {
              console.error("Error sharing screen", err);
          }
      } else {
          stopScreenShare();
      }
  };

  const stopScreenShare = () => {
      if (screenTrackRef.current) {
          screenTrackRef.current.stop();
      }
      
      const oldVideoTrack = originalVideoTrackRef.current;
      
      peersRef.current.forEach(({ peer }) => {
          peer.replaceTrack(
              streamRef.current.getVideoTracks()[0],
              oldVideoTrack,
              streamRef.current
          );
      });

      streamRef.current.removeTrack(streamRef.current.getVideoTracks()[0]);
      streamRef.current.addTrack(oldVideoTrack);

      setIsScreenSharing(false);
  };

  const sendMessage = (e) => {
      e.preventDefault();
      if(currentMessage.trim()) {
          const payload = {
              sender: user?.username || 'Guest',
              text: currentMessage,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
          socketRef.current.emit('send message', payload);
          setCurrentMessage('');
      }
  };

  const leaveRoom = () => {
    // Tell server immediately so ghost doesn't linger
    if (socketRef.current) {
        socketRef.current.emit('leave room');
    }
    // Destroy all peer connections
    peersRef.current.forEach(({ peer }) => { try { peer.destroy(); } catch(e){} });
    peersRef.current = [];
    if(streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
    }
    if(screenTrackRef.current) {
        screenTrackRef.current.stop();
    }
    localStorage.removeItem('activeMeetingId');
    localStorage.removeItem('activeMeetingPassword');
    localStorage.removeItem('activeMeetingIsHost');
    navigate('/dashboard');
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(''), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black flex flex-col sm:flex-row overflow-hidden pt-16 sm:pt-20">
      
      {/* Top Left Room ID Pill */}
      <div className="absolute top-4 left-4 z-20 glass-panel px-4 py-2 rounded-full flex items-center gap-3">
        <Users size={18} className="text-white" />
        <span className="font-medium text-sm text-white tracking-widest">{roomID}</span>
      </div>
      {/* Top Middle Timer Pill */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <div className="glass-panel px-4 py-2 rounded-full flex items-center gap-3 border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.4)]">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
          <span className="font-bold text-sm text-white font-mono tracking-wider">{formatTime(meetingTimer)}</span>
        </div>
      </div>
      {/* Inline Join Prompt Modal for Links */}
      {isJoinPromptOpen && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
              <div className="glass-panel max-w-md w-full p-8 rounded-[2rem] relative shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200 text-center">
                  <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Users size={32} className="text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Join Meeting</h3>
                  <p className="text-zinc-400 text-sm mb-6">This meeting is protected. Please enter the password to join.</p>
                  
                  <form onSubmit={(e) => { e.preventDefault(); handleDirectJoin(joinPasswordInput); }} className="space-y-4">
                      {joinError && (
                          <div className="bg-red-500/10 text-red-400 p-3 rounded-xl text-sm font-medium border border-red-500/20">
                              {joinError}
                          </div>
                      )}
                      <input 
                          type="password" 
                          placeholder="Meeting Password" 
                          className="glass-input w-full px-5 py-3.5 rounded-xl font-medium text-center tracking-widest"
                          value={joinPasswordInput}
                          onChange={(e) => { setJoinPasswordInput(e.target.value); setJoinError(''); }}
                          autoFocus
                      />
                      <button 
                          type="submit"
                          className="w-full bg-white text-black font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] mt-4"
                      >
                          Join Now
                      </button>
                      <button 
                          type="button"
                          onClick={() => navigate('/dashboard')}
                          className="w-full bg-transparent text-zinc-400 font-medium py-2 hover:text-white transition-colors text-sm mt-2"
                      >
                          Cancel and return to Dashboard
                      </button>
                  </form>
              </div>
          </div>
      )}

      {/* Invite Modal */}
      {isInviteModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="glass-panel max-w-md w-full p-8 rounded-[2rem] relative shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200">
                  <button 
                    onClick={() => setIsInviteModalOpen(false)}
                    className="absolute top-6 right-6 text-zinc-400 hover:text-white"
                  >
                      <PanelRightClose size={24} />
                  </button>

                  <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
                      <Users size={24} /> Invite Participants
                  </h3>

                  <div className="space-y-4">
                      {/* Meeting ID */}
                      <div className="bg-black/40 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                          <div>
                              <p className="text-xs text-zinc-400 mb-1">Meeting ID</p>
                              <p className="font-mono font-medium">{roomID}</p>
                          </div>
                          <button 
                              onClick={() => copyToClipboard(roomID, 'id')}
                              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                          >
                              {copiedField === 'id' ? <Check size={18} className="text-green-400" /> : <Copy size={18} className="text-zinc-400" />}
                          </button>
                      </div>

                      {/* Password */}
                      <div className="bg-black/40 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                          <div>
                              <p className="text-xs text-zinc-400 mb-1">Meeting Password</p>
                              <p className="font-mono font-medium">{meetingPassword}</p>
                          </div>
                          <button 
                              onClick={() => copyToClipboard(meetingPassword, 'password')}
                              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                          >
                              {copiedField === 'password' ? <Check size={18} className="text-green-400" /> : <Copy size={18} className="text-zinc-400" />}
                          </button>
                      </div>

                      {/* Invite Link */}
                      <div className="bg-black/40 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                          <div className="overflow-hidden pr-4">
                              <p className="text-xs text-zinc-400 mb-1">Invite Link</p>
                              <p className="font-mono font-medium text-sm truncate w-full text-blue-400">
                                  {`${window.location.origin}/room/${roomID}`}
                              </p>
                          </div>
                          <button 
                              onClick={() => copyToClipboard(`${window.location.origin}/room/${roomID}`, 'link')}
                              className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
                          >
                              {copiedField === 'link' ? <Check size={18} className="text-green-400" /> : <Copy size={18} className="text-zinc-400" />}
                          </button>
                      </div>
                  </div>

                  <button 
                      onClick={() => setIsInviteModalOpen(false)}
                      className="w-full bg-white text-black font-bold py-3.5 rounded-xl flex items-center justify-center hover:bg-zinc-200 transition-all shadow-lg mt-8"
                  >
                      Done
                  </button>
              </div>
          </div>
      )}

      {/* Waiting Room Overlay (non-host waiting for admission) */}
      {isWaiting && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[90] flex items-center justify-center p-4">
              <div className="text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
                  <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/10">
                      <Clock size={40} className="text-white animate-pulse" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">Waiting Room</h2>
                  <p className="text-zinc-400 max-w-sm">Please wait while the host lets you in. You'll be connected automatically once admitted.</p>
                  <div className="flex items-center justify-center gap-2 text-zinc-500 text-sm">
                      <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                      <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                      <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
                  </div>
                  <button onClick={() => navigate('/dashboard')} className="text-zinc-500 hover:text-white text-sm transition-colors mt-4">
                      Cancel and return to Dashboard
                  </button>
              </div>
          </div>
      )}

      {/* Main Video Area — Mobile PiP + Desktop Grid */}
      {(() => {
        const totalPanels = 1 + peers.length;
        const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640;

        // Desktop grid style (unchanged behavior)
        const getGridStyle = (count) => {
            if (count === 1) return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' };
            if (count === 2) return { gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: '1fr' };
            if (count <= 4) return { gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' };
            if (count <= 6) return { gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' };
            if (count <= 9) return { gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)' };
            if (count <= 12) return { gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(3, 1fr)' };
            if (count <= 16) return { gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(4, 1fr)' };
            return { gridTemplateColumns: 'repeat(5, 1fr)', gridTemplateRows: 'repeat(5, 1fr)' };
        };

        // Mobile grid style for remote videos only
        const getMobileGridStyle = (remoteCount) => {
            if (remoteCount === 0) return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' };
            if (remoteCount === 1) return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' };
            if (remoteCount === 2) return { gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: '1fr' };
            if (remoteCount <= 4) return { gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' };
            return { gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: `repeat(${Math.ceil(remoteCount / 2)}, 1fr)` };
        };

        // ─── MOBILE LAYOUT ───
        if (isMobile) {
          return (
            <div className={`flex-1 w-full h-full pb-28 transition-all duration-300 relative`}>
              {/* Draggable PiP — Local Video */}
              <MobilePiP
                  userVideo={userVideo}
                  isVideoOff={isVideoOff}
                  isScreenSharing={isScreenSharing}
                  isMuted={isMuted}
                  username={user?.username}
              />

              {/* Remote Videos — Full area */}
              {peers.length === 0 ? (
                  // No remote peers — show "waiting" state
                  <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 gap-4">
                      <Users size={48} className="opacity-30" />
                      <p className="text-sm font-medium">Waiting for others to join...</p>
                  </div>
              ) : (
                  <div
                      className="w-full h-full grid gap-2 p-2"
                      style={getMobileGridStyle(peers.length)}
                  >
                      {peers.map((peer) => (
                          <div
                              key={peer.peerID}
                              className="relative bg-zinc-900 rounded-2xl overflow-hidden border border-white/10 shadow-xl flex items-center justify-center h-full w-full transition-all duration-500 animate-in fade-in zoom-in-95"
                          >
                              <VideoStream peer={peer.peer} username={peer.username} mediaStatus={peerMediaStatus[peer.peerID]} />
                          </div>
                      ))}
                  </div>
              )}
            </div>
          );
        }

        // ─── DESKTOP LAYOUT (unchanged) ───
        return (
          <div className={`flex-1 w-full h-full p-4 pb-28 transition-all duration-300 ${isChatOpen ? 'mr-[320px] sm:mr-[380px]' : ''} ${isParticipantsOpen ? 'mr-[320px]' : ''}`}>
            <div 
                className="w-full h-full grid gap-4"
                style={getGridStyle(totalPanels)}
            >
                {/* Local Video */}
                <div className="relative bg-zinc-900 rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex items-center justify-center h-full w-full transition-all duration-500">
                    {/* Video-off overlay for local user */}
                    {isVideoOff && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-zinc-900">
                            <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center text-3xl font-bold text-white border border-white/10 mb-3">
                                {(user?.username || 'A').charAt(0).toUpperCase()}
                            </div>
                            <VideoOff size={20} className="text-zinc-500" />
                        </div>
                    )}
                    <video ref={userVideo} autoPlay muted playsInline className={`w-full h-full object-cover ${isScreenSharing ? 'object-contain' : ''} ${!isScreenSharing && !isVideoOff ? '-scale-x-100' : ''}`} />
                    <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-sm font-medium text-white border border-white/10 flex items-center gap-2">
                        {user?.username} (You) {isScreenSharing && <MonitorUp size={14} className="text-blue-400" />}
                        {isMuted && <MicOff size={14} className="text-red-400" />}
                    </div>
                </div>
                
                {/* Remote Videos */}
                {peers.map((peer) => (
                    <div key={peer.peerID} className="relative bg-zinc-900 rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex items-center justify-center h-full w-full transition-all duration-500 animate-in fade-in zoom-in-95">
                        <VideoStream peer={peer.peer} username={peer.username} mediaStatus={peerMediaStatus[peer.peerID]} />
                    </div>
                ))}
            </div>
          </div>
        );
      })()}

      {/* Chat Sidebar */}
      <div className={`fixed top-0 right-0 h-full bg-zinc-950 border-l border-white/10 w-[320px] sm:w-[380px] flex flex-col transition-transform duration-300 z-30 ${isChatOpen ? 'translate-x-0 shadow-[-20px_0_40px_rgba(0,0,0,0.5)]' : 'translate-x-full'}`}>
          <div className="p-4 border-b border-white/10 mt-16 sm:mt-0 flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center gap-2">
                  <MessageSquare size={18} /> In-Call Chat
              </h3>
              <button className="text-zinc-400 hover:text-white transition-colors" onClick={() => setIsChatOpen(false)}>
                <PanelRightClose size={20} />
              </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                  <p className="text-zinc-500 text-center text-sm mt-10">No messages yet. Say hello!</p>
              )}
              {messages.map((msg, idx) => (
                  <div key={idx} className={`flex flex-col ${msg.sender === user?.username ? 'items-end' : 'items-start'}`}>
                      <span className="text-xs text-zinc-500 mb-1">{msg.sender} • {msg.timestamp}</span>
                      <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${msg.sender === user?.username ? 'bg-white text-black rounded-tr-sm' : 'bg-white/10 text-white rounded-tl-sm'}`}>
                          {msg.text}
                      </div>
                  </div>
              ))}
              <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="p-4 border-t border-white/10 bg-zinc-950 flex gap-2">
              <input 
                  type="text" 
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 glass-input px-4 py-2.5 rounded-xl text-sm outline-none focus:border-white"
              />
              <button type="submit" disabled={!currentMessage.trim()} className="bg-white text-black p-2.5 rounded-xl disabled:opacity-50 hover:bg-zinc-200 transition-colors">
                  <Send size={18} />
              </button>
          </form>
      </div>

      {/* Floating Control Dock */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 glass-panel px-6 py-3 rounded-full flex gap-4 sm:gap-6 items-center shadow-2xl border border-white/20 z-40">
        <button 
          onClick={toggleMute} 
          className={`p-3 sm:p-4 rounded-full transition-all duration-300 ${isMuted ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'bg-white/10 hover:bg-white/20 text-white'}`}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>
        
        <button 
          onClick={toggleVideo} 
          className={`p-3 sm:p-4 rounded-full transition-all duration-300 ${isVideoOff ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'bg-white/10 hover:bg-white/20 text-white'}`}
          title={isVideoOff ? "Turn on camera" : "Turn off camera"}
        >
          {isVideoOff ? <VideoOff size={22} /> : <VideoIcon size={22} />}
        </button>

        <button 
          onClick={toggleScreenShare} 
          className={`p-3 sm:p-4 rounded-full transition-all duration-300 ${isScreenSharing ? 'bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.4)]' : 'bg-white/10 hover:bg-white/20 text-white'}`}
          title={isScreenSharing ? "Stop sharing screen" : "Share screen"}
        >
          {isScreenSharing ? <MonitorOff size={22} /> : <MonitorUp size={22} />}
        </button>

        <button 
          onClick={() => { setIsParticipantsOpen(!isParticipantsOpen); setIsChatOpen(false); }} 
          className={`p-3 sm:p-4 rounded-full transition-all duration-300 relative ${isParticipantsOpen ? 'bg-white text-black' : 'bg-white/10 hover:bg-white/20 text-white'}`}
          title="Participants"
        >
          <Users size={22} />
          {pendingUsers.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white animate-pulse">
              {pendingUsers.length}
            </span>
          )}
        </button>

        <button 
          onClick={() => { setIsChatOpen(!isChatOpen); setIsParticipantsOpen(false); }}
          className={`p-3 sm:p-4 rounded-full transition-all duration-300 ${isChatOpen ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'bg-white/10 hover:bg-white/20 text-white'}`}
          title="Toggle Chat"
        >
          {isChatOpen ? <PanelRightClose size={22} /> : <PanelRightOpen size={22} />}
        </button>

        <button 
          onClick={() => setIsInviteModalOpen(true)} 
          className="bg-white/10 hover:bg-white/20 text-white p-3 sm:p-4 rounded-full transition-all duration-300 relative"
          title="Invite via Link"
        >
          <Info size={22} />
        </button>
        
        <div className="w-px h-8 bg-white/20 mx-1 sm:mx-2" />
        
        <button 
          onClick={isHost ? endMeeting : leaveRoom} 
          className="bg-red-600 hover:bg-red-500 text-white p-3 sm:p-4 rounded-full transition-all duration-300 shadow-[0_0_30px_rgba(220,38,38,0.5)] hover:scale-105"
          title={isHost ? "End Meeting for All" : "Leave Call"}
        >
          <PhoneOff size={22} />
        </button>
      </div>

      {/* Participants Sidebar */}
      <div className={`fixed right-0 top-0 bottom-0 w-full sm:w-80 bg-zinc-950 border-l border-white/10 z-[60] flex flex-col transition-transform duration-300 ${isParticipantsOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2">
                  <Users size={20} /> Participants ({participants.length})
              </h3>
              <button onClick={() => setIsParticipantsOpen(false)} className="text-zinc-400 hover:text-white">
                  <X size={24} />
              </button>
          </div>

          {/* Pending Users (Host Only) */}
          {isHost && pendingUsers.length > 0 && (
              <div className="p-4 border-b border-white/10 space-y-2">
                  <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Clock size={14} /> Waiting to Join ({pendingUsers.length})
                  </p>
                  {pendingUsers.map((p) => (
                      <div key={p.socketId} className="flex items-center gap-3 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
                          <div className="w-9 h-9 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center text-sm font-bold">
                              {(p.username || 'A').charAt(0).toUpperCase()}
                          </div>
                          <p className="flex-1 font-medium text-sm truncate">{p.username || 'Anonymous'}</p>
                          <button onClick={() => admitUser(p.socketId)} className="p-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors" title="Admit">
                              <ShieldCheck size={16} />
                          </button>
                          <button onClick={() => denyUser(p.socketId)} className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors" title="Deny">
                              <ShieldX size={16} />
                          </button>
                      </div>
                  ))}
              </div>
          )}

          {/* Active Participants */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {participants.map((p) => (
                  <div key={p.socketId} className={`flex items-center gap-3 p-3 rounded-xl border ${p.isHost ? 'bg-white/5 border-white/20' : 'bg-transparent border-transparent hover:bg-white/5'}`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${p.isHost ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                          {(p.username || 'A').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">
                              {p.username || 'Anonymous'} {p.userId === user?._id && '(You)'}
                          </p>
                          {p.isHost && (
                              <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Host</span>
                          )}
                      </div>
                      {isHost && !p.isHost && p.userId !== user?._id && (
                          <button onClick={() => kickUser(p.socketId)} className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Remove">
                              <UserMinus size={16} />
                          </button>
                      )}
                  </div>
              ))}
          </div>
      </div>
    </div>
  );
}

const VideoStream = ({ peer, username, mediaStatus }) => {
  const ref = useRef();
  const [remoteStream, setRemoteStream] = useState(null);
  // Buffer streams that arrive before this component mounts
  const bufferedStream = useRef(null);

  useEffect(() => {
    // If a stream was buffered before mount, use it immediately
    if (bufferedStream.current) {
      setRemoteStream(bufferedStream.current);
      bufferedStream.current = null;
    }

    const handleStream = (stream) => {
      setRemoteStream(stream);
    };

    const handleTrack = (track, stream) => {
      if (stream) setRemoteStream(stream);
    };

    peer.on('stream', handleStream);
    peer.on('track', handleTrack);

    return () => {
      peer.off('stream', handleStream);
      peer.off('track', handleTrack);
    };
  }, [peer]);

  // Attach the stream and explicitly call .play() to bypass autoplay policy
  useEffect(() => {
    if (ref.current && remoteStream) {
      ref.current.srcObject = remoteStream;
      ref.current.play().catch((err) => {
        // Autoplay blocked — retry on next user gesture (browser handles it)
        console.warn('Remote video autoplay blocked:', err.message);
      });
    }
  }, [remoteStream]);

  const peerMuted = mediaStatus?.isMuted;
  const peerVideoOff = mediaStatus?.isVideoOff;

  return (
    <div className="relative w-full h-full min-h-[300px] bg-zinc-900 rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
      {/* No stream yet — show connecting indicator */}
      {!remoteStream && !peerVideoOff && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-zinc-900 gap-3">
          <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center text-3xl font-bold text-white border border-white/10">
            {(username || 'P').charAt(0).toUpperCase()}
          </div>
          <span className="text-xs text-zinc-500 animate-pulse">Connecting…</span>
        </div>
      )}
      {/* Video-off overlay */}
      {peerVideoOff && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-zinc-900">
              <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center text-3xl font-bold text-white border border-white/10 mb-3">
                  {(username || 'P').charAt(0).toUpperCase()}
              </div>
              <VideoOff size={20} className="text-zinc-500" />
          </div>
      )}
      <video
        ref={ref}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-sm font-medium text-white border border-white/10 flex items-center gap-2">
        {username || 'Participant'}
        {peerMuted && <MicOff size={14} className="text-red-400" />}
      </div>
    </div>
  );
};

// ─── Mobile Draggable PiP Component ───
const MobilePiP = ({ userVideo, isVideoOff, isScreenSharing, isMuted, username }) => {
  const pipRef = useRef(null);
  const dragState = useRef({ isDragging: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0 });
  const [position, setPosition] = useState({ x: -1, y: -1 }); // -1 = not initialized

  // Initialize position to top-right on mount
  useEffect(() => {
    if (position.x === -1 && position.y === -1) {
      const safeX = window.innerWidth - 130 - 12; // 130 = pip width, 12 = margin
      setPosition({ x: safeX, y: 72 }); // below the top pills
    }
  }, []);

  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    dragState.current = {
      isDragging: true,
      startX: touch.clientX - position.x,
      startY: touch.clientY - position.y,
      offsetX: position.x,
      offsetY: position.y
    };
  }, [position]);

  const handleTouchMove = useCallback((e) => {
    if (!dragState.current.isDragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    const newX = touch.clientX - dragState.current.startX;
    const newY = touch.clientY - dragState.current.startY;

    // Clamp within viewport
    const maxX = window.innerWidth - 130;
    const maxY = window.innerHeight - 100;
    setPosition({
      x: Math.max(4, Math.min(newX, maxX)),
      y: Math.max(4, Math.min(newY, maxY))
    });
  }, []);

  const handleTouchEnd = useCallback(() => {
    dragState.current.isDragging = false;
  }, []);

  // Mouse drag support (for testing on desktop)
  const handleMouseDown = useCallback((e) => {
    dragState.current = {
      isDragging: true,
      startX: e.clientX - position.x,
      startY: e.clientY - position.y,
      offsetX: position.x,
      offsetY: position.y
    };
    const handleMouseMove = (ev) => {
      if (!dragState.current.isDragging) return;
      const newX = ev.clientX - dragState.current.startX;
      const newY = ev.clientY - dragState.current.startY;
      const maxX = window.innerWidth - 130;
      const maxY = window.innerHeight - 100;
      setPosition({
        x: Math.max(4, Math.min(newX, maxX)),
        y: Math.max(4, Math.min(newY, maxY))
      });
    };
    const handleMouseUp = () => {
      dragState.current.isDragging = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [position]);

  return (
    <div
      ref={pipRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      className="fixed rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.6)] border-2 border-white/20 cursor-grab active:cursor-grabbing select-none"
      style={{
        width: 130,
        height: 97, // 16:9 aspect ratio
        left: position.x,
        top: position.y,
        zIndex: 50,
        touchAction: 'none',
        transition: dragState.current.isDragging ? 'none' : 'left 0.2s ease, top 0.2s ease',
      }}
    >
      {/* Video-off overlay */}
      {isVideoOff && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-zinc-900">
          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-lg font-bold text-white border border-white/10">
            {(username || 'A').charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      <video
        ref={userVideo}
        autoPlay
        muted
        playsInline
        className={`w-full h-full object-cover ${isScreenSharing ? 'object-contain' : ''} ${!isScreenSharing && !isVideoOff ? '-scale-x-100' : ''}`}
      />
      {/* Mute indicator badge */}
      {isMuted && (
        <div className="absolute bottom-1 right-1 bg-red-500/80 backdrop-blur-sm rounded-full p-1">
          <MicOff size={10} className="text-white" />
        </div>
      )}
    </div>
  );
};
