import { LayoutDashboard, Calendar, History, Settings, LogOut, Play, Shield, Zap } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';

export default function Sidebar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('tiktok_user_id');
    navigate('/');
  };

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'Schedule Post', icon: Calendar, path: '/schedule' },
    { name: 'History', icon: History, path: '/history' },
    { name: 'Settings', icon: Settings, path: '/settings' },
  ];

  return (
    <div className="w-64 h-screen bg-surface border-r border-white/5 flex flex-col p-6 fixed left-0 top-0">
      <div className="flex items-center gap-3 mb-12 px-2">
        <div className="w-10 h-10 tiktok-gradient rounded-xl flex items-center justify-center shadow-lg shadow-brand-primary/20">
          <Zap className="text-white fill-white" size={20} />
        </div>
        <div>
          <h1 className="font-bold text-lg tracking-tight">AutoViral</h1>
          <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-mono">TikTok Automation</p>
        </div>
      </div>

      <nav className="flex-1 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                isActive 
                  ? 'bg-white/10 text-white shadow-xl shadow-black/50' 
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`
            }
          >
            <item.icon size={20} />
            <span className="font-medium">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/40 hover:text-white hover:bg-red-500/10 transition-all group"
      >
        <LogOut size={20} className="group-hover:text-red-500" />
        <span className="font-medium group-hover:text-red-500">Logout</span>
      </button>
    </div>
  );
}
