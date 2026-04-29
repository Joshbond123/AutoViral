/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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

const PUBLIC_PATHS = new Set(['/', '/privacy', '/terms']);

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('tiktok_user_id'));
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
      {!isPublicPage && <Sidebar />}

      <main className={`flex-1 transition-all duration-500 ${!isPublicPage ? 'pl-64' : ''}`}>
        <div className={!isPublicPage ? 'p-12 max-w-7xl mx-auto' : ''}>
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
                <Route path="/history" element={<Dashboard />} /> {/* History page reused dashboard for now */}
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
