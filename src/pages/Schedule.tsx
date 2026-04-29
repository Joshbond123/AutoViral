import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Clock, Zap, Shield, Wand2, CheckCircle, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { postSchedule } from '../lib/api';

const NICHES = [
  "Daily Crypto Scam 🔥",
  "Crypto Wallet Drain / Phishing 🚨🔓",
  "Fake Crypto Guru / Influencer Exposed 🎭",
  "Crypto Investment Scam News 📈🚨",
  "Crypto Scam Psychology 🧠",
  "AI Crypto Scam 🤖🪙",
  "Crypto Romance Scam Stories ❤️"
];

export default function Schedule() {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [isAutoNiche, setIsAutoNiche] = useState(true);
  const [selectedNiche, setSelectedNiche] = useState(NICHES[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const userId = localStorage.getItem('tiktok_user_id');
      const scheduledTime = new Date(`${date}T${time}`).toISOString();
      
      await postSchedule({
        userId: userId || '',
        scheduledTime,
        niche: isAutoNiche ? 'AUTO' : selectedNiche,
      });
      setShowSuccess(true);
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Schedule Automation</h1>
        <p className="text-white/40">Queue a new video to be researched, generated, and posted.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-12">
        {/* Form Column */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-8">
          <div className="glass rounded-[40px] p-8 border border-white/5 space-y-8">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs uppercase font-mono tracking-widest text-white/40 ml-1">Publish Date</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-brand-primary/50 transition-all text-sm"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase font-mono tracking-widest text-white/40 ml-1">Publish Time</label>
                <div className="relative">
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                  <input
                    type="time"
                    required
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-brand-primary/50 transition-all text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-xs uppercase font-mono tracking-widest text-white/40 ml-1">Niche Selection</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setIsAutoNiche(true)}
                  className={`p-6 rounded-3xl border transition-all text-left group ${isAutoNiche ? 'bg-brand-primary/20 border-brand-primary' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                >
                  <Wand2 className={`mb-3 ${isAutoNiche ? 'text-brand-primary' : 'text-white/20'}`} size={24} />
                  <h4 className="font-bold mb-1">Smart Auto-Niche</h4>
                  <p className="text-[10px] text-white/40 leading-relaxed uppercase tracking-wider font-mono">Rotation Engine Active</p>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAutoNiche(false)}
                  className={`p-6 rounded-3xl border transition-all text-left ${!isAutoNiche ? 'bg-brand-secondary/20 border-brand-secondary' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                >
                  <Zap className={`mb-3 ${!isAutoNiche ? 'text-brand-secondary' : 'text-white/20'}`} size={24} />
                  <h4 className="font-bold mb-1">Manual Select</h4>
                  <p className="text-[10px] text-white/40 leading-relaxed uppercase tracking-wider font-mono">Choose Specific Topic</p>
                </button>
              </div>

              {!isAutoNiche && (
                <motion.select
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  value={selectedNiche}
                  onChange={(e) => setSelectedNiche(e.target.value)}
                  className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-6 focus:outline-none focus:border-brand-secondary/50 transition-all text-sm appearance-none cursor-pointer"
                >
                  {NICHES.map(n => <option key={n} value={n} className="bg-surface">{n}</option>)}
                </motion.select>
              )}
            </div>

            <button
              disabled={isSubmitting}
              className={`w-full py-5 rounded-2xl tiktok-gradient font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-95 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] shadow-2xl shadow-brand-primary/20'}`}
            >
              {isSubmitting ? 'Queueing Task...' : 'Schedule Automation Pipeline'}
              {!isSubmitting && <ChevronRight size={20} />}
            </button>
          </div>
        </form>

        {/* Info Column */}
        <div className="space-y-6">
          <div className="glass rounded-[32px] p-8 border border-white/5">
            <h5 className="font-bold mb-4 flex items-center gap-2">
              <Shield className="text-green-500" size={18} />
              TopicShield™ Active
            </h5>
            <p className="text-sm text-white/40 leading-relaxed">
              Every scheduled video runs through our duplicate prevention engine. We cross-reference the last 800 generated topics to ensure your feed stays fresh and high-potential.
            </p>
          </div>

          <div className="glass rounded-[32px] p-8 border border-white/5">
            <h5 className="font-bold mb-4 flex items-center gap-2">
              <Zap className="text-brand-secondary" size={18} />
              GitHub Actions
            </h5>
            <p className="text-sm text-white/40 leading-relaxed">
              Rendering is handled via scalable GitHub runners. Once triggered, the entire pipeline from research to posting takes roughly 4-6 minutes.
            </p>
          </div>

          <div className="bg-white/[0.02] rounded-[32px] p-8 border border-white/5 border-dashed">
            <div className="flex gap-4 items-start">
              <CheckCircle className="text-white/20 shrink-0 mt-1" size={16} />
              <div className="text-xs text-white/30 space-y-2">
                <p>• Automated Trend Research</p>
                <p>• Cerebras Script Generation</p>
                <p>• UnrealSpeech VO Integration</p>
                <p>• Remotion Vertical Rendering</p>
                <p>• Auto-TikTok Publishing</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-6"
          >
            <div className="glass rounded-[40px] p-12 text-center border border-white/10 max-w-sm w-full shadow-2xl">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="text-green-500" size={40} />
              </div>
              <h3 className="text-2xl font-bold mb-2">Post Scheduled!</h3>
              <p className="text-white/40 text-sm">The automation engine will take it from here. Redirecting to dashboard...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
