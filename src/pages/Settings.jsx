import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Camera, Save, User as UserIcon } from 'lucide-react';

export default function Settings() {
  const { user, updateProfile, changePassword } = useAuth();
  const [username, setUsername] = useState(user?.username || '');
  const [profilePic, setProfilePic] = useState(user?.profilePicture || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        setMessage({ text: 'Image size must be less than 2MB', type: 'error' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePic(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ text: '', type: '' });

    try {
      await updateProfile({ username, profilePicture: profilePic });
      setMessage({ text: 'Profile updated successfully!', type: 'success' });
    } catch (error) {
      setMessage({ text: error.message || 'Failed to update profile', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
      e.preventDefault();
      if (newPassword !== confirmNewPassword) {
          setMessage({ text: 'New passwords do not match', type: 'error' });
          return;
      }
      
      setIsPasswordLoading(true);
      setMessage({ text: '', type: '' });
      
      try {
          await changePassword(currentPassword, newPassword);
          setMessage({ text: 'Password updated successfully!', type: 'success' });
          setCurrentPassword('');
          setNewPassword('');
          setConfirmNewPassword('');
      } catch (error) {
          setMessage({ text: error.message || 'Failed to update password', type: 'error' });
      } finally {
          setIsPasswordLoading(false);
      }
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight mb-2">Profile Settings</h2>
        <p className="text-zinc-400">Manage your account details and preferences</p>
      </div>

      <div className="glass-panel p-8 sm:p-10 rounded-[2rem]">
        
        {message.text && (
          <div className={`p-4 rounded-xl mb-8 font-medium text-sm border ${message.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-8">
          
          <div className="flex flex-col items-center sm:flex-row gap-8">
            <div className="relative group">
              {profilePic ? (
                <img src={profilePic} alt="Profile" className="w-32 h-32 rounded-full object-cover border-4 border-white/10 shadow-2xl" />
              ) : (
                <div className="w-32 h-32 rounded-full bg-white/5 border-4 border-white/10 flex items-center justify-center shadow-2xl">
                  <UserIcon size={48} className="text-zinc-500" />
                </div>
              )}
              <label className="absolute bottom-0 right-0 bg-white text-black p-2.5 rounded-full cursor-pointer hover:scale-110 transition-transform shadow-lg">
                <Camera size={20} />
                <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
              </label>
            </div>
            
            <div className="flex-1 w-full space-y-2">
              <h3 className="text-xl font-bold">{user?.username}</h3>
              <p className="text-zinc-400 text-sm">{user?.email}</p>
              <div className="inline-block px-3 py-1 bg-white/10 rounded-full text-xs font-semibold tracking-wider text-zinc-300 mt-2">
                ACTIVE ACCOUNT
              </div>
            </div>
          </div>

          <div className="h-px w-full bg-white/10 my-8" />

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300 ml-1">Display Name</label>
              <input 
                type="text" 
                className="glass-input w-full px-5 py-3.5 rounded-xl"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="How you appear in meetings"
              />
            </div>
          </div>

          <div className="pt-4">
            <button 
              type="submit" 
              disabled={isLoading}
              className="bg-white text-black px-8 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              <Save size={20} />
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>

        <div className="h-px w-full bg-white/10 my-12" />

        <div className="mb-8">
            <h3 className="text-xl font-bold mb-2">Security</h3>
            <p className="text-zinc-400 text-sm">Update your password to keep your account secure</p>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-6">
            <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300 ml-1">Current Password</label>
                <input 
                    type="password" 
                    className="glass-input w-full px-5 py-3.5 rounded-xl"
                    placeholder="••••••••"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300 ml-1">New Password</label>
                    <input 
                        type="password" 
                        className="glass-input w-full px-5 py-3.5 rounded-xl"
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300 ml-1">Confirm New Password</label>
                    <input 
                        type="password" 
                        className="glass-input w-full px-5 py-3.5 rounded-xl"
                        placeholder="••••••••"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        required
                    />
                </div>
            </div>

            <div className="pt-4">
                <button 
                    type="submit" 
                    disabled={isPasswordLoading}
                    className="bg-white/10 text-white border border-white/20 px-8 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-white hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                    {isPasswordLoading ? 'Updating...' : 'Update Password'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
}
