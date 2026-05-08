import { LayoutDashboard, Calendar, History, Settings, LogOut, X, Video } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { logoutTikTok } from '../lib/api';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const handleLogout = async () => {
    const userId = localStorage.getItem('tiktok_user_id');
    if (userId) {
      await logoutTikTok(userId);
    }
    localStorage.removeItem('tiktok_user_id');
    sessionStorage.clear();
    document.cookie.split(';').forEach((c) => {
      document.cookie = c
        .replace(/^ +/, '')
        .replace(/=.*/, `=;expires=${new Date(0).toUTCString()};path=/`);
    });
    window.location.replace(import.meta.env.BASE_URL || '/AutoViral/');
  };

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'Schedule Post', icon: Calendar, path: '/schedule' },
    { name: 'Manual Generate', icon: Video, path: '/manual' },
    { name: 'History', icon: History, path: '/history' },
    { name: 'Settings', icon: Settings, path: '/settings' },
  ];

  const content = (
    <div className="w-64 h-full bg-surface border-r border-white/5 flex flex-col p-6">
      <div className="flex items-center justify-between mb-12 px-2">
        <div className="flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="AutoViral" className="w-10 h-10 rounded-xl shadow-lg shadow-brand-primary/20" />
          <div>
            <h1 className="font-bold text-lg tracking-tight">AutoViral</h1>
            <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-mono">TikTok Automation</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onClose}
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

  return (
    <>
      <div className="hidden md:flex fixed left-0 top-0 h-screen z-30">
        {content}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed left-0 top-0 h-screen z-50 md:hidden"
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
