import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Schedule from './pages/Schedule';
import Settings from './pages/Settings';
import Home from './pages/Home';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import { AnimatePresence, motion } from 'motion/react';
import { Menu } from 'lucide-react';

const PUBLIC_PATHS = new Set(['/', '/privacy', '/terms']);

function bootstrapSession(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const uid = params.get('uid');
    if (uid) {
      localStorage.setItem('tiktok_user_id', uid);
      params.delete('uid');
      const newSearch = params.toString();
      window.history.replaceState(
        {},
        '',
        window.location.pathname + (newSearch ? '?' + newSearch : ''),
      );
      return uid;
    }
  } catch {
    /* ignore */
  }
  return localStorage.getItem('tiktok_user_id');
}

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!bootstrapSession());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        localStorage.setItem('tiktok_user_id', event.data.user_id);
        setIsAuthenticated(true);
      }
    };
    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const isPublicPage = PUBLIC_PATHS.has(location.pathname);
  const isLandingPage = location.pathname === '/';

  if (!isAuthenticated && !isPublicPage) {
    return <Navigate to="/" replace />;
  }

  if (isAuthenticated && isLandingPage) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-screen bg-bg-dark text-white selection:bg-brand-primary selection:text-white">
      {!isPublicPage && (
        <>
          {/* Mobile overlay backdrop */}
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              />
            )}
          </AnimatePresence>
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        </>
      )}

      <main className={`flex-1 min-w-0 transition-all duration-500 ${!isPublicPage ? 'md:pl-64' : ''}`}>
        {!isPublicPage && (
          /* Mobile top bar */
          <div className="flex items-center gap-4 px-4 py-4 border-b border-white/5 bg-surface md:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-white/70"
            >
              <Menu size={20} />
            </button>
            <span className="font-bold text-lg tracking-tight">AutoViral</span>
          </div>
        )}
        <div className={!isPublicPage ? 'p-5 md:p-12 max-w-7xl mx-auto' : ''}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <Routes location={location}>
                <Route path="/" element={<Home />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/schedule" element={<Schedule />} />
                <Route path="/history" element={<Dashboard />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/AutoViral">
      <AppContent />
    </BrowserRouter>
  );
}
