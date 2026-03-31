import { Video, Plus, Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();

  const ActionCard = ({ icon: Icon, title, description, color, onClick }) => (
    <div 
      className="glass-card" 
      onClick={onClick}
      style={{ 
        cursor: 'pointer', 
        transition: 'transform 0.2s, background 0.2s',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: '32px 24px'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'translateY(-5px)';
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.background = 'var(--card-bg)';
      }}
    >
      <div style={{ 
        width: '64px', height: '64px', 
        borderRadius: '16px', 
        background: color, 
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '16px', color: 'white'
      }}>
        <Icon size={32} />
      </div>
      <h3 style={{ margin: '0 0 8px 0' }}>{title}</h3>
      <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>{description}</p>
    </div>
  );

  return (
    <div className="fade-in" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Welcome, {user?.username}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>What would you like to do today?</p>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
        gap: '24px' 
      }}>
        <ActionCard 
          icon={Video} 
          title="New Meeting" 
          description="Start an instant video call"
          color="var(--primary-blue)"
          onClick={() => alert("Starting new meeting...")}
        />
        <ActionCard 
          icon={Plus} 
          title="Join Meeting" 
          description="Join with a code or link"
          color="#10b981"
          onClick={() => alert("Joining meeting...")}
        />
        <ActionCard 
          icon={Calendar} 
          title="Schedule" 
          description="Plan ahead for a later time"
          color="#8b5cf6"
          onClick={() => alert("Opening scheduler...")}
        />
      </div>
    </div>
  );
}
