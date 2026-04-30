import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ArrowRight, Smartphone } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { fetchTikTokAuthUrl } from '../lib/api';

type Section = { id: string; title: string };

interface LegalLayoutProps {
  eyebrow: string;
  title: React.ReactNode;
  subtitle: string;
  lastUpdated: string;
  sections: Section[];
  children: React.ReactNode;
}

export default function LegalLayout({ eyebrow, title, subtitle, lastUpdated, sections, children }: LegalLayoutProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? '');
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  const handleLogin = async () => {
    try {
      const url = await fetchTikTokAuthUrl();
      window.location.href = url;
    } catch {
      alert('TikTok login is temporarily unavailable. Please try again in a moment.');
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-brand-primary/30 overflow-x-hidden font-sans">
      {/* Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[0%] left-[10%] w-[40%] h-[40%] bg-brand-primary/10 blur-[120px] rounded-full opacity-40" />
        <div className="absolute bottom-[0%] right-[10%] w-[40%] h-[40%] bg-brand-secondary/10 blur-[120px] rounded-full opacity-40" />
      </div>

      {/* Nav */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'py-4 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5' : 'py-6 md:py-8'}`}>
        <div className="container mx-auto px-6 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-3 group">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="AutoViral" className="w-10 h-10 rounded-xl shadow-lg shadow-brand-primary/20 group-hover:rotate-6 transition-transform" />
            <span className="font-bold text-2xl tracking-tighter uppercase">AutoViral</span>
          </Link>

          <div className="hidden lg:flex items-center gap-10 text-sm font-medium text-white/50">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <Link to="/privacy" className={`hover:text-white transition-colors ${location.pathname === '/privacy' ? 'text-white' : ''}`}>Privacy</Link>
            <Link to="/terms" className={`hover:text-white transition-colors ${location.pathname === '/terms' ? 'text-white' : ''}`}>Terms</Link>
          </div>

          <div className="hidden lg:flex items-center gap-4">
            <button onClick={handleLogin} className="px-6 py-2.5 rounded-2xl text-white/70 hover:text-white transition-colors font-semibold text-sm">
              Log In
            </button>
            <button
              onClick={handleLogin}
              className="px-8 py-3 rounded-2xl tiktok-gradient text-white font-bold text-sm shadow-xl shadow-brand-primary/20 hover:shadow-brand-primary/40 hover:-translate-y-0.5 transition-all active:translate-y-0"
            >
              Start Creating
            </button>
          </div>

          <button className="lg:hidden p-2 text-white/70" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Toggle menu">
            {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-full left-0 right-0 bg-[#0A0A0A] border-b border-white/5 p-8 lg:hidden shadow-2xl"
            >
              <div className="flex flex-col gap-6 items-center text-lg font-medium text-white/60">
                <Link to="/" onClick={() => setIsMenuOpen(false)}>Home</Link>
                <Link to="/privacy" onClick={() => setIsMenuOpen(false)}>Privacy</Link>
                <Link to="/terms" onClick={() => setIsMenuOpen(false)}>Terms</Link>
                <button onClick={() => { setIsMenuOpen(false); handleLogin(); }} className="w-full py-4 rounded-2xl tiktok-gradient text-white font-bold text-center mt-4">
                  Start Creating Free
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero */}
      <header className="relative pt-40 md:pt-48 pb-12 md:pb-20 z-10">
        <div className="container mx-auto px-6 max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/5 border border-white/10 mb-8 shadow-inner">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-secondary animate-pulse" />
              <span className="text-[11px] font-bold tracking-[0.25em] uppercase text-brand-secondary">{eyebrow}</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[0.95] uppercase mb-6">
              {title}
            </h1>
            <p className="text-base md:text-xl text-white/50 max-w-3xl leading-relaxed mb-6">
              {subtitle}
            </p>
            <p className="text-[10px] uppercase tracking-[0.25em] font-mono text-white/30">
              Last updated · {lastUpdated}
            </p>
          </motion.div>
        </div>
      </header>

      {/* Content + TOC */}
      <section className="relative z-10 pb-24 md:pb-40">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-16">
            {/* TOC */}
            <aside className="lg:col-span-4 xl:col-span-3 order-2 lg:order-1">
              <div className="lg:sticky lg:top-32">
                <div className="glass rounded-[28px] border border-white/5 p-6 md:p-8">
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/30 mb-6">On this page</h2>
                  <nav>
                    <ul className="space-y-1">
                      {sections.map((s, i) => {
                        const isActive = activeId === s.id;
                        return (
                          <li key={s.id}>
                            <a
                              href={`#${s.id}`}
                              className={`flex items-start gap-3 py-2.5 px-3 rounded-xl text-sm transition-all ${
                                isActive
                                  ? 'bg-brand-primary/10 text-white border border-brand-primary/20'
                                  : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'
                              }`}
                            >
                              <span className={`shrink-0 font-mono text-[10px] mt-0.5 ${isActive ? 'text-brand-primary' : 'text-white/30'}`}>
                                {String(i + 1).padStart(2, '0')}
                              </span>
                              <span className="leading-snug">{s.title}</span>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </nav>
                </div>

                <div className="hidden lg:block glass rounded-[28px] border border-brand-secondary/10 p-6 mt-6">
                  <h3 className="text-sm font-bold mb-2">Questions?</h3>
                  <p className="text-xs text-white/40 leading-relaxed mb-4">
                    Reach our legal team — we usually respond within one business day.
                  </p>
                  <a href="mailto:legal@autoviral.app" className="inline-flex items-center gap-2 text-xs font-bold text-brand-secondary hover:text-white transition-colors">
                    legal@autoviral.app <ArrowRight size={14} />
                  </a>
                </div>
              </div>
            </aside>

            {/* Body */}
            <article className="lg:col-span-8 xl:col-span-9 order-1 lg:order-2">
              <div className="glass rounded-[32px] md:rounded-[40px] border border-white/5 p-6 md:p-12 lg:p-16">
                <div className="legal-prose">
                  {children}
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-white/5 py-16 md:py-24 z-10">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-2">
              <Link to="/" className="flex items-center gap-3 mb-6 group w-fit">
                <img src={`${import.meta.env.BASE_URL}logo.png`} alt="AutoViral" className="w-10 h-10 rounded-xl shadow-lg shadow-brand-primary/20" />
                <span className="font-bold text-2xl tracking-tighter uppercase">AutoViral</span>
              </Link>
              <p className="text-sm text-white/40 max-w-xs leading-relaxed mb-8">
                AI-driven content automation for the world's fastest growing creators.
              </p>
              <div className="flex gap-4">
                {['Twitter', 'GitHub', 'Discord'].map((social) => (
                  <div key={social} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-brand-primary/10 transition-colors cursor-pointer text-white/40 hover:text-white">
                    <Smartphone size={18} />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h5 className="font-bold text-[10px] uppercase tracking-widest text-white/20 mb-8">Product</h5>
              <ul className="space-y-4 text-sm text-white/40">
                <li><Link to="/" className="hover:text-brand-secondary transition-colors">Platform</Link></li>
                <li><Link to="/" className="hover:text-brand-secondary transition-colors">AI Workflow</Link></li>
                <li><Link to="/" className="hover:text-brand-secondary transition-colors">Results</Link></li>
                <li><Link to="/" className="hover:text-brand-secondary transition-colors">Pricing</Link></li>
              </ul>
            </div>

            <div>
              <h5 className="font-bold text-[10px] uppercase tracking-widest text-white/20 mb-8">Legal</h5>
              <ul className="space-y-4 text-sm text-white/40">
                <li><Link to="/terms" className="hover:text-brand-secondary transition-colors">Terms of Service</Link></li>
                <li><Link to="/privacy" className="hover:text-brand-secondary transition-colors">Privacy Policy</Link></li>
                <li><a href="mailto:legal@autoviral.app" className="hover:text-brand-secondary transition-colors">Contact Legal</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] uppercase tracking-widest font-mono text-white/20">
            <p>© 2026 AutoViral Platforms Inc. Professional TikTok Automation.</p>
            <div className="flex gap-8">
              <span>GDPR Compliant</span>
              <span>SOC 2 Aligned</span>
              <span>Built on Supabase</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function LegalSection({ id, number, title, children }: { id: string; number: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-32 mb-14 md:mb-20 last:mb-0">
      <div className="flex items-center gap-4 mb-6">
        <span className="text-xs font-mono font-bold text-brand-secondary tracking-widest">{number}</span>
        <div className="h-px flex-1 bg-gradient-to-r from-brand-secondary/30 to-transparent" />
      </div>
      <h2 className="text-2xl md:text-4xl font-bold tracking-tight mb-6 leading-tight">{title}</h2>
      <div className="space-y-5 text-base md:text-lg text-white/60 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export function LegalCallout({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 rounded-2xl border border-brand-primary/20 bg-brand-primary/5 p-5 md:p-6 text-sm md:text-base text-white/70 leading-relaxed">
      {children}
    </div>
  );
}

export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-3 list-none pl-0">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-brand-primary shrink-0" />
          <span className="text-white/60">{it}</span>
        </li>
      ))}
    </ul>
  );
}
