import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
  import { useEffect, useState } from 'react';
  import type { Session } from '@supabase/supabase-js';
  import Sidebar from './components/Sidebar';
  import Dashboard from './pages/Dashboard';
  import Schedule from './pages/Schedule';
  import Settings from './pages/Settings';
  import Home from './pages/Home';
  import Privacy from './pages/Privacy';
  import Terms from './pages/Terms';
  import DataDeletion from './pages/DataDeletion';
  import AppVerification from './pages/AppVerification';
  import ManualGenerate from './pages/ManualGenerate';
  import { AnimatePresence, motion } from 'motion/react';
  import { Menu } from 'lucide-react';
  import { supabaseAuth } from './lib/supabase';

  const PUBLIC_PATHS = new Set(['/', '/privacy', '/terms', '/data-deletion']);

  function AppContent() {
    const [session, setSession] = useState<Session | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const location = useLocation();

    useEffect(() => {
      if (!supabaseAuth) { setAuthLoading(false); return; }
      supabaseAuth.auth.getSession().then(({ data: { session } }) => {
        if (session?.user?.id) localStorage.setItem('tiktok_user_id', session.user.id);
        setSession(session);
        setAuthLoading(false);
      });
      const { data: { subscription } } = supabaseAuth.auth.onAuthStateChange((_event, session) => {
        if (session?.user?.id) {
          localStorage.setItem('tiktok_user_id', session.user.id);
        } else {
          localStorage.removeItem('tiktok_user_id');
        }
        setSession(session);
        setAuthLoading(false);
      });
      return () => subscription.unsubscribe();
    }, []);

    useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

    if (authLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-bg-dark">
          <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    const isAuthenticated = !!session;
    const isPublicPage = PUBLIC_PATHS.has(location.pathname);
    const isLandingPage = location.pathname === '/';

    if (!isAuthenticated && !isPublicPage) return <Navigate to="/" replace />;
    if (isAuthenticated && isLandingPage) return <Navigate to="/dashboard" replace />;

    return (
      <div className="flex min-h-screen bg-bg-dark text-white selection:bg-brand-primary selection:text-white">
        {!isPublicPage && (
          <>
            <AnimatePresence>
              {sidebarOpen && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onClick={() => setSidebarOpen(false)}
                  className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
                />
              )}
            </AnimatePresence>
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <button
              onClick={() => setSidebarOpen(true)}
              className="fixed top-4 left-4 z-30 md:hidden p-2.5 rounded-xl bg-surface border border-white/10 text-white/60 hover:text-white shadow-lg"
            >
              <Menu size={20} />
            </button>
          </>
        )}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/data-deletion" element={<DataDeletion />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/manual" element={<ManualGenerate />} />
          <Route path="/history" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/app-verification" element={<AppVerification />} />
          <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/'} replace />} />
        </Routes>
      </div>
    );
  }

  export default function App() {
    return (
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    );
  }
  