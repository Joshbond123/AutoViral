import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Wand2, Zap, CheckCircle, ChevronRight, Trash2, Edit2, X, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { postSchedule, fetchSchedules, deleteSchedule, updateSchedule } from '../lib/api';
import { Schedule as ScheduleType } from '../types';

const NICHES = [
  'Daily Crypto Scam',
  'Crypto Wallet Drain / Phishing',
  'Fake Crypto Guru / Influencer Exposed',
  'Crypto Investment Scam News',
  'Crypto Scam Psychology',
  'AI Crypto Scam',
  'Crypto Romance Scam Stories',
];

export default function Schedule() {
  const [time, setTime] = useState('');
  const [isAutoNiche, setIsAutoNiche] = useState(true);
  const [selectedNiche, setSelectedNiche] = useState(NICHES[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [schedules, setSchedules] = useState<ScheduleType[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTime, setEditTime] = useState('');
  const [editNiche, setEditNiche] = useState('');
  const [editIsAuto, setEditIsAuto] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const navigate = useNavigate();
  const userId = localStorage.getItem('tiktok_user_id') || '';

  const loadSchedules = async () => {
    if (!userId) return;
    setLoadingSchedules(true);
    try {
      const data = await fetchSchedules(userId);
      setSchedules(data);
    } catch {
      // Silently fail if Supabase not configured
    } finally {
      setLoadingSchedules(false);
    }
  };

  useEffect(() => { loadSchedules(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!time) return;
    setIsSubmitting(true);
    setError(null);

    try {
      // Build a scheduled time using today's date + selected time
      const today = new Date();
      const [hours, minutes] = time.split(':').map(Number);
      const scheduledDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes);
      // If the time has already passed today, schedule for tomorrow
      if (scheduledDate < new Date()) {
        scheduledDate.setDate(scheduledDate.getDate() + 1);
      }

      await postSchedule({
        userId,
        scheduledTime: scheduledDate.toISOString(),
        niche: isAutoNiche ? 'AUTO' : selectedNiche,
      });
      setShowSuccess(true);
      setTime('');
      setTimeout(() => {
        setShowSuccess(false);
        loadSchedules();
      }, 2000);
    } catch (err) {
      setError((err as Error)?.message || 'Failed to schedule. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteSchedule(id);
      setSchedules(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      alert((err as Error)?.message || 'Failed to delete schedule.');
    } finally {
      setDeletingId(null);
    }
  };

  const startEdit = (s: ScheduleType) => {
    setEditingId(s.id);
    const d = new Date(s.scheduled_time);
    setEditTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    setEditIsAuto(s.niche === 'AUTO');
    setEditNiche(s.niche === 'AUTO' ? NICHES[0] : s.niche);
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async () => {
    if (!editingId || !editTime) return;
    const s = schedules.find(x => x.id === editingId);
    if (!s) return;
    const d = new Date(s.scheduled_time);
    const [h, m] = editTime.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    try {
      await updateSchedule(editingId, {
        scheduled_time: d.toISOString(),
        niche: editIsAuto ? 'AUTO' : editNiche,
      });
      setSchedules(prev => prev.map(x => x.id === editingId ? { ...x, scheduled_time: d.toISOString(), niche: editIsAuto ? 'AUTO' : editNiche } : x));
      setEditingId(null);
    } catch (err) {
      alert((err as Error)?.message || 'Failed to update schedule.');
    }
  };

  const fmtTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return iso; }
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    running: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    success: 'bg-green-500/10 text-green-400 border-green-500/20',
    failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 md:space-y-12">
      <div>
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight mb-2">Schedule Automation</h1>
        <p className="text-white/40 text-sm md:text-base">Set a daily posting time and niche. The pipeline runs automatically.</p>
      </div>

      {/* Schedule Form */}
      <form onSubmit={handleSubmit}>
        <div className="glass rounded-2xl md:rounded-[40px] p-5 md:p-8 border border-white/5 space-y-6 md:space-y-8">

          {/* Time picker */}
          <div className="space-y-2">
            <label className="text-xs uppercase font-mono tracking-widest text-white/40 ml-1">Daily Posting Time</label>
            <div className="relative max-w-xs">
              <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-brand-primary/50 transition-all text-sm"
              />
            </div>
            <p className="text-xs text-white/30 ml-1">Posts will be scheduled daily at this time.</p>
          </div>

          {/* Niche selection */}
          <div className="space-y-4">
            <label className="text-xs uppercase font-mono tracking-widest text-white/40 ml-1">Niche Selection</label>
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <button
                type="button"
                onClick={() => setIsAutoNiche(true)}
                className={`p-4 md:p-6 rounded-2xl md:rounded-3xl border transition-all text-left ${isAutoNiche ? 'bg-brand-primary/20 border-brand-primary' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
              >
                <Wand2 className={`mb-2 md:mb-3 ${isAutoNiche ? 'text-brand-primary' : 'text-white/20'}`} size={22} />
                <h4 className="font-bold text-sm md:text-base mb-1">Auto Mode</h4>
                <p className="text-[10px] text-white/40 leading-relaxed uppercase tracking-wider font-mono">System picks niche</p>
              </button>
              <button
                type="button"
                onClick={() => setIsAutoNiche(false)}
                className={`p-4 md:p-6 rounded-2xl md:rounded-3xl border transition-all text-left ${!isAutoNiche ? 'bg-brand-secondary/20 border-brand-secondary' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
              >
                <Zap className={`mb-2 md:mb-3 ${!isAutoNiche ? 'text-brand-secondary' : 'text-white/20'}`} size={22} />
                <h4 className="font-bold text-sm md:text-base mb-1">Manual Mode</h4>
                <p className="text-[10px] text-white/40 leading-relaxed uppercase tracking-wider font-mono">Choose your niche</p>
              </button>
            </div>

            <AnimatePresence>
              {!isAutoNiche && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 pt-2">
                    <label className="text-xs uppercase font-mono tracking-widest text-white/40 ml-1">Select Niche</label>
                    <select
                      value={selectedNiche}
                      onChange={(e) => setSelectedNiche(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:outline-none focus:border-brand-secondary/50 transition-all text-sm appearance-none cursor-pointer"
                    >
                      {NICHES.map(n => <option key={n} value={n} className="bg-surface">{n}</option>)}
                    </select>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {error && (
            <p className="text-red-400 text-sm px-1">{error}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !time}
            className={`w-full py-4 md:py-5 rounded-2xl tiktok-gradient font-bold text-base md:text-lg flex items-center justify-center gap-2 transition-all active:scale-95 ${isSubmitting || !time ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] shadow-2xl shadow-brand-primary/20'}`}
          >
            {isSubmitting ? 'Scheduling…' : 'Schedule Post'}
            {!isSubmitting && <ChevronRight size={20} />}
          </button>
        </div>
      </form>

      {/* Schedule Management */}
      <div className="space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">Scheduled Posts</h2>
          <span className="text-xs font-mono text-white/30 uppercase tracking-widest">
            {loadingSchedules ? '…' : `${schedules.length} scheduled`}
          </span>
        </div>

        <div className="glass rounded-2xl md:rounded-[32px] border border-white/5 overflow-hidden">
          {loadingSchedules ? (
            <div className="p-8 text-center text-white/20 text-sm">Loading schedules…</div>
          ) : schedules.length === 0 ? (
            <div className="p-8 md:p-12 text-center">
              <Calendar className="mx-auto text-white/10 mb-4" size={40} />
              <p className="text-white/20 uppercase tracking-widest text-xs font-mono">No schedules yet</p>
              <p className="text-white/20 text-sm mt-2">Add your first schedule above.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {schedules.map((s) => (
                <div key={s.id} className="p-4 md:p-5">
                  {editingId === s.id ? (
                    /* Edit row */
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-mono tracking-widest text-white/30">Time</label>
                          <div className="relative">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                            <input
                              type="time"
                              value={editTime}
                              onChange={e => setEditTime(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-3 text-sm focus:outline-none focus:border-brand-primary/50"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-mono tracking-widest text-white/30">Mode</label>
                          <select
                            value={editIsAuto ? 'AUTO' : editNiche}
                            onChange={e => {
                              if (e.target.value === 'AUTO') { setEditIsAuto(true); }
                              else { setEditIsAuto(false); setEditNiche(e.target.value); }
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-3 text-sm focus:outline-none focus:border-brand-primary/50 appearance-none"
                          >
                            <option value="AUTO" className="bg-surface">Auto Mode</option>
                            {NICHES.map(n => <option key={n} value={n} className="bg-surface">{n}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={saveEdit}
                          className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl tiktok-gradient text-sm font-bold flex items-center justify-center gap-2"
                        >
                          <CheckCircle size={14} /> Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-sm font-medium flex items-center justify-center gap-2 transition-all"
                        >
                          <X size={14} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View row */
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2 rounded-xl bg-white/5 shrink-0 mt-0.5">
                          <Clock size={14} className="text-white/40" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm md:text-base">{fmtTime(s.scheduled_time)}</span>
                            <span className="text-xs text-white/40 font-mono">{fmtDate(s.scheduled_time)}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono uppercase tracking-wider ${statusColors[s.status] || statusColors.pending}`}>
                              {s.status}
                            </span>
                            <span className="text-xs text-white/40 truncate max-w-[180px]">
                              {s.niche === 'AUTO' ? 'Auto Mode' : s.niche}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => startEdit(s)}
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          disabled={deletingId === s.id}
                          className="p-2 rounded-lg bg-white/5 hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-all disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Success overlay */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-6"
          >
            <div className="glass rounded-[40px] p-10 md:p-12 text-center border border-white/10 max-w-sm w-full shadow-2xl">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="text-green-500" size={36} />
              </div>
              <h3 className="text-xl md:text-2xl font-bold mb-2">Post Scheduled!</h3>
              <p className="text-white/40 text-sm">The automation engine will take it from here.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
