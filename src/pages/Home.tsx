import { useState } from 'react';
  import { motion } from 'motion/react';
  import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, Video, Zap, Brain } from 'lucide-react';
  import { supabaseAuth } from '../lib/supabase';

  export default function Home() {
    const [mode, setMode] = useState<'signin' | 'signup'>('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSuccess(null);
      setLoading(true);
      try {
        if (!supabaseAuth) throw new Error('Authentication service not configured.');
        if (mode === 'signin') {
          const { error } = await supabaseAuth.auth.signInWithPassword({ email, password });
          if (error) throw error;
        } else {
          const { error } = await supabaseAuth.auth.signUp({ email, password });
          if (error) throw error;
          setSuccess('Account created! You can now sign in.');
          setMode('signin');
          setPassword('');
        }
      } catch (err: any) {
        setError(err.message || 'Authentication failed. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    const features = [
      { icon: Brain, label: 'AI Script Generation', desc: 'Cerebras qwen-3-32b writes viral scripts automatically' },
      { icon: Video, label: 'Auto Video Production', desc: 'Remotion renders polished videos from text to frames' },
      { icon: Zap, label: 'Scheduled Pipeline', desc: 'GitHub Actions runs your pipeline every 10 minutes' },
    ];

    return (
      <div className="min-h-screen bg-bg-dark flex items-center justify-center p-4">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-primary/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
        </div>
        <div className="relative w-full max-w-4xl mx-auto grid md:grid-cols-2 gap-8 items-center">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="hidden md:flex flex-col">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-brand-primary/20 border border-brand-primary/30 flex items-center justify-center">
                <Video size={24} className="text-brand-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">AutoViral</h1>
                <p className="text-white/40 text-xs font-mono uppercase tracking-widest">AI Video Automation</p>
              </div>
            </div>
            <h2 className="text-3xl font-bold leading-tight mb-4 text-white">
              Your fully automated<br /><span className="text-brand-primary">video pipeline</span>
            </h2>
            <p className="text-white/50 text-sm mb-8 leading-relaxed">
              From AI-generated script to rendered video, delivered automatically. No manual work required.
            </p>
            <div className="space-y-4">
              {features.map((f, i) => (
                <motion.div key={f.label} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.1, duration: 0.5 }}
                  className="flex items-start gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                  <div className="w-8 h-8 rounded-xl bg-brand-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                    <f.icon size={16} className="text-brand-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{f.label}</p>
                    <p className="text-xs text-white/40 mt-0.5">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="w-full">
            <div className="flex items-center gap-3 mb-8 md:hidden">
              <div className="w-10 h-10 rounded-2xl bg-brand-primary/20 border border-brand-primary/30 flex items-center justify-center">
                <Video size={20} className="text-brand-primary" />
              </div>
              <h1 className="text-xl font-bold">AutoViral</h1>
            </div>
            <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl shadow-black/40">
              <h3 className="text-xl font-bold mb-1">{mode === 'signin' ? 'Welcome back' : 'Create account'}</h3>
              <p className="text-white/40 text-sm mb-7">
                {mode === 'signin' ? 'Sign in to your automation dashboard' : 'Set up your AutoViral account'}
              </p>
              {error && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 mb-5 text-sm text-red-400">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" /><span>{error}</span>
                </motion.div>
              )}
              {success && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-5 text-sm text-emerald-400">
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5" /><span>{success}</span>
                </motion.div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-white/50 uppercase tracking-widest">Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-white/[0.05] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-brand-primary/50 focus:bg-white/[0.08] transition-all" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-white/50 uppercase tracking-widest">Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                    <input type={showPw ? 'text' : 'password'} required minLength={6}
                      value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                      className="w-full bg-white/[0.05] border border-white/10 rounded-xl pl-10 pr-11 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-brand-primary/50 focus:bg-white/[0.08] transition-all" />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-brand-primary text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-brand-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-brand-primary/25 mt-2">
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
                </button>
              </form>
              <div className="mt-6 text-center text-sm text-white/40">
                {mode === 'signin' ? (
                  <>Don't have an account?{' '}
                    <button onClick={() => { setMode('signup'); setError(null); }} className="text-brand-primary hover:text-brand-primary/80 font-medium transition-colors">Sign up</button>
                  </>
                ) : (
                  <>Already have an account?{' '}
                    <button onClick={() => { setMode('signin'); setError(null); }} className="text-brand-primary hover:text-brand-primary/80 font-medium transition-colors">Sign in</button>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center justify-center gap-4 mt-6 text-xs text-white/25">
              <a href="/AutoViral/privacy" className="hover:text-white/50 transition-colors">Privacy Policy</a>
              <span>·</span>
              <a href="/AutoViral/terms" className="hover:text-white/50 transition-colors">Terms of Service</a>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }
  