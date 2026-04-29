import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, Shield, Rocket, TrendingUp, ChevronRight, Play, CheckCircle, 
  Globe, Cpu, Sparkles, ArrowRight, BarChart3, Repeat, Menu, X,
  Lock, Calendar, Smartphone, Wand2, Layers, MessageSquare,
  Star, HelpCircle
} from 'lucide-react';

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogin = async () => {
    try {
      const response = await fetch('/api/auth/tiktok/url');
      const { url } = await response.json();
      const width = 500;
      const height = 600;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      window.open(url, 'TikTok Login', `width=${width},height=${height},top=${top},left=${left}`);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-brand-primary/30 overflow-x-hidden font-sans">
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[0%] left-[10%] w-[40%] h-[40%] bg-brand-primary/10 blur-[120px] rounded-full opacity-40" />
        <div className="absolute bottom-[0%] right-[10%] w-[40%] h-[40%] bg-brand-secondary/10 blur-[120px] rounded-full opacity-40" />
        <div className="absolute inset-0 opacity-[0.02]" 
             style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/carbon-fibre.png")' }} />
      </div>

      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'py-4 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5' : 'py-8'}`}>
        <div className="container mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="w-10 h-10 tiktok-gradient rounded-xl flex items-center justify-center shadow-lg shadow-brand-primary/20 group-hover:rotate-6 transition-transform">
              <Zap size={20} fill="white" />
            </div>
            <span className="font-bold text-2xl tracking-tighter uppercase">AutoViral</span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-10 text-sm font-medium text-white/50">
            <a href="#features" className="hover:text-white transition-colors">Platform</a>
            <a href="#workflow" className="hover:text-white transition-colors">AI Workflow</a>
            <a href="#results" className="hover:text-white transition-colors">Results</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
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

          {/* Mobile Toggle */}
          <button className="lg:hidden p-2 text-white/70" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-full left-0 right-0 bg-[#0A0A0A] border-b border-white/5 p-8 lg:hidden shadow-2xl"
            >
              <div className="flex flex-col gap-6 items-center text-lg font-medium text-white/60">
                <a href="#features" onClick={() => setIsMenuOpen(false)}>Platform</a>
                <a href="#workflow" onClick={() => setIsMenuOpen(false)}>AI Workflow</a>
                <a href="#pricing" onClick={() => setIsMenuOpen(false)}>Pricing</a>
                <button onClick={handleLogin} className="w-full py-4 rounded-2xl tiktok-gradient text-white font-bold text-center mt-4">
                  Start Creating Free
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-48 pb-24 z-10 overflow-hidden">
        <div className="container mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/5 border border-white/10 mb-10 shadow-inner">
              <Sparkles size={16} className="text-brand-secondary animate-pulse" />
              <span className="text-[11px] font-bold tracking-[0.25em] uppercase text-brand-secondary">Revolutionizing Viral Content</span>
            </div>
            
            <h1 className="text-5xl md:text-[7.5rem] font-bold tracking-tighter leading-[0.9] md:leading-[0.8] mb-10 inline-block uppercase text-white">
              DOMINATE <br />
              <span className="text-brand-primary">THE FEED</span> <br />
              BY MORNING
            </h1>
            
            <p className="text-base md:text-2xl text-white/40 max-w-3xl mx-auto mb-10 md:mb-16 leading-relaxed px-4">
              AutoViral utilizes massive-scale LLMs and research agents to discover, script, and publish viral vertical content while you sleep.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 md:gap-8">
              <button 
                onClick={handleLogin}
                className="group relative w-full sm:w-auto px-8 md:px-12 py-4 md:py-6 rounded-2xl md:rounded-[28px] tiktok-gradient font-black text-lg md:text-2xl overflow-hidden shadow-2xl shadow-brand-primary/30 hover:scale-105 hover:shadow-brand-primary/50 transition-all active:scale-[0.98]"
              >
                <span className="relative z-10 flex items-center justify-center gap-3">
                  Login with TikTok <ArrowRight size={24} className="group-hover:translate-x-2 transition-transform" />
                </span>
              </button>
            </div>
          </motion.div>
          
          {/* Dashboard Preview Mockup */}
          <motion.div 
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 1 }}
            className="mt-32 relative mx-auto max-w-6xl group"
          >
            <div className="absolute inset-0 bg-brand-primary/20 blur-[120px] rounded-[60px] transform group-hover:scale-110 transition-transform duration-1000" />
            <div className="relative glass rounded-[40px] md:rounded-[60px] p-2 md:p-4 border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden">
              <div className="bg-[#0A0A0A] rounded-[30px] md:rounded-[50px] overflow-hidden aspect-video relative">
                <img 
                  src="https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=2574&auto=format&fit=crop" 
                  className="w-full h-full object-cover opacity-60 mix-blend-overlay" 
                  alt="Dashboard Preview" 
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center hover:scale-110 transition-transform cursor-pointer border border-white/20">
                    <Play size={40} className="text-white fill-white ml-2" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section id="features" className="container mx-auto px-6 py-20 md:py-32 z-10 relative">
        <div className="text-center mb-16 md:mb-24">
          <h2 className="text-4xl md:text-7xl font-bold tracking-tight mb-6">Built for scale. <br />Designed for speed.</h2>
          <p className="text-white/40 text-lg md:text-xl max-w-2xl mx-auto">Everything you need to run a multi-channel TikTok empire from a single interface.</p>
        </div>

        <div className="grid md:grid-cols-12 gap-6 md:gap-8 h-auto">
          {/* Main Large Bento */}
          <div className="md:col-span-8 glass p-8 md:p-12 rounded-3xl md:rounded-[48px] border border-white/5 flex flex-col justify-between group overflow-hidden relative min-h-[400px] md:min-h-[500px]">
             <div className="relative z-10">
               <div className="w-14 h-14 md:w-16 md:h-16 rounded-[20px] md:rounded-[24px] bg-brand-primary/10 flex items-center justify-center mb-8 md:mb-10 border border-brand-primary/20">
                 <Shield size={28} className="text-brand-primary" />
               </div>
               <h3 className="text-3xl md:text-5xl font-bold mb-4 md:mb-6 tracking-tight">TopicShield™ Precision</h3>
               <p className="text-lg md:text-xl text-white/40 leading-relaxed max-w-lg mb-8">
                 Never worry about duplicate content shadow-banning your reach. Our proprietary AI cross-references 800+ recent trending topics to ensure 100% uniqueness.
               </p>
               <div className="flex flex-wrap gap-2 md:gap-3">
                 {['Semantic Hash', 'Duplicate Guard', 'Freshness Engine'].map(t => (
                   <span key={t} className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono uppercase tracking-widest text-brand-secondary">{t}</span>
                 ))}
               </div>
             </div>
             <div className="absolute bottom-0 right-0 w-1/2 h-full bg-gradient-to-l from-brand-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500" />
             <BarChart3 className="absolute -bottom-10 -right-10 text-white/5 transform group-hover:-rotate-12 transition-transform duration-700" size={300} />
          </div>

          <div className="md:col-span-4 flex flex-col gap-8">
            <div className="flex-1 glass p-10 rounded-[40px] border border-brand-secondary/10 group hover:border-brand-secondary/40 transition-colors">
              <div className="w-12 h-12 rounded-2xl bg-brand-secondary/10 flex items-center justify-center mb-6">
                 <Cpu size={24} className="text-brand-secondary" />
               </div>
               <h4 className="text-2xl font-bold mb-4">Cerebras 70B Turbo</h4>
               <p className="text-sm text-white/40 leading-relaxed">
                 Script generation faster than you can think. High-impact writing designed specifically for TikTok retention logic.
               </p>
            </div>
            <div className="flex-1 glass p-10 rounded-[40px] border border-white/5 group">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-6">
                 <Globe size={24} className="text-white/60" />
               </div>
               <h4 className="text-2xl font-bold mb-4">Global Trend Radar</h4>
               <p className="text-sm text-white/40 leading-relaxed">
                 Active web crawlers discover crypto news, scams, and stories across the entire web in real-time.
               </p>
            </div>
          </div>

          <div className="md:col-span-12 grid md:grid-cols-4 gap-8">
            <SmallCard icon={<Calendar />} title="Smart Scheduler" desc="Set it once. Let GitHub Actions handle the triggers 24/7." />
            <SmallCard icon={<Smartphone />} title="Mobile Native" desc="Monitor your entire operation from your phone browser." />
            <SmallCard icon={<Wand2 />} title="Auto-Captioning" desc="Viral-style animated subtitles synced to the millisecond." />
            <SmallCard icon={<Lock />} title="Enterprise Security" desc="TikTok session management via secure token rotation." />
          </div>
        </div>
      </section>

      {/* Results / Workflow Section */}
      <section id="workflow" className="container mx-auto px-6 py-20 md:py-32 border-t border-white/5 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 md:gap-24 items-center">
          <div className="space-y-10 md:space-y-12">
            <div>
              <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 md:mb-8">The Workflow of the <span className="text-brand-primary italic uppercase tracking-tighter">Future</span></h2>
              <p className="text-lg md:text-xl text-white/40 leading-relaxed">
                Standard creators spend 4 hours per video. You{"'"}ll spend 4 seconds.
              </p>
            </div>
            
            <div className="space-y-10">
              <WorkflowStep icon={<Repeat />} num="01" title="Strategic Niche Selection" desc="Pick from 7 optimized high-CPM crypto niches or let our Smart Niche Rotation Engine choose for you." />
              <WorkflowStep icon={<Layers />} num="02" title="GitHub Actions Pipeline" desc="Automated rendering via Remotion using powerful cloud-runners. Zero hardware requirements on your end." />
              <WorkflowStep icon={<MessageSquare />} num="03" title="Automatic Engagement" desc="Videos are posted at the precise moment of maximum platform activity for each specific niche." />
            </div>
          </div>

          {/* Phone Render Mockup */}
          <div className="relative group perspective-1000">
            <motion.div 
               whileHover={{ rotateY: -10, rotateX: 5 }}
               className="aspect-[9/19] max-w-sm mx-auto bg-[#0A0A0A] rounded-[60px] p-4 border-[12px] border-[#1A1A1A] shadow-[0_50px_100px_rgba(0,0,0,0.6)] relative overflow-hidden ring-1 ring-white/10"
            >
              <div className="w-full h-full bg-surface rounded-[45px] overflow-hidden relative">
                <img 
                  src="https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?q=80&w=2487&auto=format&fit=crop" 
                  alt="TikTok Phone" 
                  className="w-full h-full object-cover opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                <div className="absolute bottom-12 left-6 right-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-primary p-0.5"><div className="w-full h-full rounded-full bg-[#050505] flex items-center justify-center font-bold text-xs">AV</div></div>
                    <div>
                      <p className="text-xs font-bold">@autoviral_ai</p>
                      <p className="text-[10px] text-white/40">TopicShield Protecting...</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 w-full bg-white/20 rounded-full" />
                    <div className="h-2 w-2/3 bg-white/20 rounded-full" />
                  </div>
                  <div className="flex gap-2">
                    <div className="px-3 py-1 rounded-full bg-brand-primary/20 text-brand-primary text-[8px] font-bold uppercase tracking-widest border border-brand-primary/30">#CryptoAwareness</div>
                  </div>
                </div>
                {/* Simulated Subtitles */}
                <div className="absolute top-1/2 left-0 right-0 text-center px-4">
                   <motion.p 
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 0.5 }}
                    className="text-4xl font-black italic tracking-tighter text-brand-primary drop-shadow-2xl uppercase"
                   >
                     SCAM ALERT!
                   </motion.p>
                </div>
              </div>
            </motion.div>
            <div className="absolute -z-10 -top-20 -right-20 w-80 h-80 bg-brand-secondary/5 blur-[100px] rounded-full" />
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="container mx-auto px-6 py-32 relative z-10 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold tracking-tight mb-4">Common Questions</h2>
            <p className="text-white/40">Everything you need to know about professional automation.</p>
          </div>
          
          <div className="space-y-6">
            <Accordion 
              title="How does TopicShield™ actually work?" 
              content="TopicShield™ is our proprietary duplicate detection algorithm. It computes semantic hashes of potential video topics and cross-references them against a database of the last 800 subjects you've posted. If a similarity index above 85% is detected, the system automatically fetches a new, unique topic to prevent fatigue and platform shadow-banning." 
            />
            <Accordion 
              title="Is this safe for my TikTok account?" 
              content="Absolutely. We use official TikTok API scopes and follow platform-recommended publishing patterns. By spacing out posts and generating high-quality uniquely rendered videos via Remotion, your account maintains a healthy standing with the algorithmic Trust Score." 
            />
            <Accordion 
              title="Do I need a strong computer to render videos?" 
              content="No. All video rendering is offloaded to our GitHub Actions pipeline running on cloud infrastructure. You could manage your entire AutoViral empire from a $100 Chromebook or even your iPhone." 
            />
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="container mx-auto px-4 md:px-6 py-24 md:py-40 text-center relative z-10">
        <div className="glass rounded-3xl md:rounded-[64px] p-8 md:p-24 border border-white/5 relative overflow-hidden group">
          <div className="absolute inset-0 tiktok-gradient opacity-[0.03] group-hover:opacity-[0.06] transition-opacity" />
          <h2 className="text-5xl md:text-[8rem] font-bold tracking-tighter mb-8 md:mb-10 leading-[0.9] md:leading-none uppercase">THE FEED <br />IS WAITING</h2>
          <p className="text-lg md:text-2xl text-white/30 mb-10 md:mb-16 max-w-2xl mx-auto">Stop manual creation. Start systematic domination with AutoViral.</p>
          <button 
            onClick={handleLogin}
            className="w-full sm:w-auto px-10 md:px-14 py-5 md:py-7 rounded-2xl md:rounded-[32px] bg-white text-black font-black text-xl md:text-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-4 mx-auto shadow-2xl shadow-white/10"
          >
            Login with TikTok <ChevronRight size={28} className="md:w-8 md:h-8" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-surface relative z-10 pt-24 pb-12 border-t border-white/5">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-6 gap-12 mb-20">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 tiktok-gradient rounded-xl flex items-center justify-center shadow-lg shadow-brand-primary/20">
                  <Zap size={20} fill="white" />
                </div>
                <span className="font-bold text-2xl tracking-tighter uppercase">AutoViral</span>
              </div>
              <p className="text-white/30 text-sm max-w-xs leading-relaxed mb-6">
                Redefining social media automation through artificial intelligence and cloud-native workflows.
              </p>
              <div className="flex gap-4">
                {['Twitter', 'GitHub', 'Discord'].map(social => (
                  <div key={social} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-brand-primary/10 transition-colors cursor-pointer text-white/40 hover:text-white">
                    <Smartphone size={18} />
                  </div>
                ))}
              </div>
            </div>
            
            <FooterColumn title="Product" links={['TopicShield', 'AI Scripting', 'API Rotation', 'Scheduled Rendering']} />
            <FooterColumn title="Company" links={['Our Vision', 'Terms of Use', 'Privacy Policy', 'Brand Kit']} />
            <FooterColumn title="Resources" links={['Help Center', 'API Docs', 'Status', 'Creator Guide']} />
          </div>

          <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] uppercase tracking-widest font-mono text-white/20">
            <p>© 2026 AutoViral Platforms Inc. Professional TikTok Automation.</p>
            <div className="flex gap-8">
              <span>GDPR Compliant</span>
              <span>Cloud Run Hosted</span>
              <span>Remotion Integrated</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SmallCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="glass p-8 rounded-[32px] border border-white/5 hover:bg-white/5 transition-all text-center">
      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-6 text-white/40">
        {React.cloneElement(icon as React.ReactElement, { size: 24 })}
      </div>
      <h5 className="font-bold mb-2">{title}</h5>
      <p className="text-xs text-white/30 leading-relaxed">{desc}</p>
    </div>
  );
}

function WorkflowStep({ icon, num, title, desc }: { icon: React.ReactNode, num: string, title: string, desc: string }) {
  return (
    <div className="flex gap-8 group">
      <div className="shrink-0 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-brand-primary/10 group-hover:border-brand-primary/20 transition-all transform group-hover:rotate-6">
           {React.cloneElement(icon as React.ReactElement, { size: 24, className: 'text-white/40 group-hover:text-brand-primary transition-colors' })}
        </div>
      </div>
      <div>
        <div className="flex items-center gap-3 mb-2">
           <span className="text-xs font-mono font-bold text-brand-secondary">{num}</span>
           <h4 className="text-xl font-bold">{title}</h4>
        </div>
        <p className="text-base text-white/40 leading-relaxed max-w-sm">{desc}</p>
      </div>
    </div>
  );
}

function FooterColumn({ title, links }: { title: string, links: string[] }) {
  return (
    <div>
       <h5 className="font-bold text-[10px] uppercase tracking-widest text-white/20 mb-8">{title}</h5>
       <ul className="space-y-4 text-sm text-white/40">
          {links.map(link => (
            <li key={link} className="hover:text-brand-secondary transition-colors cursor-pointer">{link}</li>
          ))}
       </ul>
    </div>
  );
}

function Accordion({ title, content }: { title: string, content: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className={`glass rounded-[28px] border transition-all duration-500 overflow-hidden ${isOpen ? 'border-brand-primary/30' : 'border-white/5 hover:border-white/10'}`}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-8 py-6 flex justify-between items-center text-left"
      >
        <span className="text-lg font-bold">{title}</span>
        <HelpCircle className={`text-white/20 transition-transform duration-500 ${isOpen ? 'rotate-180 text-brand-primary' : ''}`} size={20} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-8 pb-8"
          >
            <p className="text-white/40 leading-relaxed pt-2 border-t border-white/5 mt-2">
              {content}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
