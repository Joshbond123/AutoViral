import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Clock, Wand2, Zap, CheckCircle, ChevronRight, Trash2, Edit2, X,
  Calendar, AlertCircle, Activity, TerminalSquare, Timer, Tag,
  RefreshCw, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { postSchedule, fetchSchedules, deleteSchedule, updateSchedule, subscribeToSchedules } from '../lib/api';
import { Schedule as ScheduleType } from '../types';
import { HAS_SUPABASE } from '../lib/supabase';

const NICHES = [
  'Daily Crypto Scam',
  'Crypto Wallet Drain',
  'Fake Crypto Guru Exposed',
  'Crypto Investment Scam',
  'Crypto Scam Psychology',
  'AI Crypto Scam',
  'Crypto Romance Scam',
];

const STATUS_STYLES: Record<string, string> = {
  pending:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  running:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
  success:  'bg-green-500/10 text-green-400 border-green-500/20',
  failed:   'bg-red-500/10 text-red-400 border-red-500/20',
};

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}
function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' }); }
  catch { return iso; }
}
function fmtRelative(iso: string) {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch { return iso; }
}
function fmtExecTime(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export default function Schedule() {
  const [time, setTime] = useState('');
  const [isAutoNiche, setIsAutoNiche] = useState(true);
  const [selectedNiche, setSelectedNiche] = useState(NICHES[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [schedules, setSchedules] = useState<ScheduleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTime, setEditTime] = useState('');
  const [editNiche, setEditNiche] = useState('');
  const [editIsAuto, setEditIsAuto] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const userId = localStorage.getItem('tiktok_user_id') || '';

  const loadSchedules = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      const data = await fetchSchedules(userId);
      setSchedules(data);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadSchedules();

    // Real-time subscription — this is the ONLY place new records are added to state.
    // The handleSubmit function intentionally does NOT manually push to state to avoid
    // duplicates (the subscription fires for our own inserts too).
    const unsub = subscribeToSchedules(userId, (updated) => {
      setSchedules(prev => {
        const exists = prev.find(s => s.id === updated.id);
        if (exists) return prev.map(s => s.id === updated.id ? updated : s);
        return [...prev, updated].sort(
          (a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime()
        );
      });
    });
    return unsub;
  }, [loadSchedules, userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!time || !userId) { setError(!userId ? 'No user session — please log in.' : 'Select a time.'); return; }
    setIsSubmitting(true);
    setError(null);
    try {
      const today = new Date();
      const [h, m] = time.split(':').map(Number);
      const dt = new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m);
      if (dt < new Date()) dt.setDate(dt.getDate() + 1);

      // Insert directly to Supabase. The real-time subscription will pick up the
      // new record and add it to state — we do NOT manually push here to prevent duplicates.
      await postSchedule({
        userId,
        scheduledTime: dt.toISOString(),
        niche: isAutoNiche ? 'AUTO' : selectedNiche,
      });

      setShowSuccess(true);
      setTime('');
      setTimeout(() => setShowSuccess(false), 2500);
    } catch (err) {
      setError((err as Error).message || 'Failed to schedule. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteSchedule(id);
      setSchedules(prev => prev.filter(s => s.id !== id));
    } catch (err) { alert((err as Error).message); }
    finally { setDeletingId(null); }
  };

  const startEdit = (s: ScheduleType) => {
    setEditingId(s.id);
    const d = new Date(s.scheduled_time);
    setEditTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    setEditIsAuto(s.niche === 'AUTO');
    setEditNiche(s.niche === 'AUTO' ? NICHES[0] : s.niche);
  };

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
      setSchedules(prev => prev.map(x => x.id === editingId
        ? { ...x, scheduled_time: d.toISOString(), niche: editIsAuto ? 'AUTO' : editNiche }
        : x
      ));
      setEditingId(null);
    } catch (err) { alert((err as Error).message); }
  };

  const pendingCount = schedules.filter(s => s.status === 'pending').length;
  const runningCount = schedules.filter(s => s.status === 'running').length;

  return (
    <div className="max-w-3xl mx-auto space-y-8 md:space-y-12">
      <div>
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight mb-2">Schedule Automation</h1>
        <p className="text-white/40 text-sm md:text-base">Set a daily posting time. The pipeline runs automatically via GitHub Actions.</p>
      </div>

      {/* Pipeline status bar */}
      {(pendingCount > 0 || runningCount > 0) && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-3 px-5 py-4 rounded-2xl border text-sm ${
            runningCount > 0
              ? 'bg-blue-500/10 border-blue-500/20 text-blue-300'
              : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300'
          }`}
        >
          {runningCount > 0 ? (
            <Loader2 size={16} className="animate-spin shrink-0" />
          ) : (
            <Activity size={16} className="shrink-0" />
          )}
          <span>
            {runningCount > 0
              ? `${runningCount} job${runningCount > 1 ? 's' : ''} running — pipeline executing now`
              : `${pendingCount} schedule${pendingCount > 1 ? 's' : ''} queued — will run at the set time`}
          </span>
        </motion.div>
      )}

      {/* Schedule Form */}
      <form onSubmit={handleSubmit}>
        <div className="glass rounded-2xl md:rounded-[40px] p-5 md:p-8 border border-white/5 space-y-6 md:space-y-8">

          <div className="space-y-2">
            <label className="text-xs uppercase font-mono tracking-widest text-white/40 ml-1">Daily Posting Time</label>
            <div className="relative max-w-xs">
              <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
              <input
                type="time"
                required
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-brand-primary/50 transition-all text-sm"
              />
            </div>
            <p className="text-xs text-white/30 ml-1">Schedules tomorrow if the time has already passed today.</p>
          </div>

          <div className="space-y-4">
            <label className="text-xs uppercase font-mono tracking-widest text-white/40 ml-1">Niche Selection</label>
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <button type="button" onClick={() => setIsAutoNiche(true)}
                className={`p-4 md:p-6 rounded-2xl md:rounded-3xl border transition-all text-left ${isAutoNiche ? 'bg-brand-primary/20 border-brand-primary' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
              >
                <Wand2 className={`mb-2 md:mb-3 ${isAutoNiche ? 'text-brand-primary' : 'text-white/20'}`} size={22} />
                <h4 className="font-bold text-sm md:text-base mb-1">Auto Mode</h4>
                <p className="text-[10px] text-white/40 leading-relaxed uppercase tracking-wider font-mono">AI picks niche + topic</p>
              </button>
              <button type="button" onClick={() => setIsAutoNiche(false)}
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
                      onChange={e => setSelectedNiche(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:outline-none focus:border-brand-secondary/50 transition-all text-sm appearance-none cursor-pointer"
                    >
                      {NICHES.map(n => <option key={n} value={n} className="bg-surface">{n}</option>)}
                    </select>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {error && <p className="text-red-400 text-sm px-1 flex items-center gap-2"><AlertCircle size={14} />{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting || !time}
            className={`w-full py-4 md:py-5 rounded-2xl tiktok-gradient font-bold text-base md:text-lg flex items-center justify-center gap-2 transition-all active:scale-95 ${isSubmitting || !time ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] shadow-2xl shadow-brand-primary/20'}`}
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : null}
            {isSubmitting ? 'Scheduling…' : 'Schedule Post'}
            {!isSubmitting && <ChevronRight size={20} />}
          </button>
        </div>
      </form>

      {/* Schedule List */}
      <div className="space-y-4 md:space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">Scheduled Posts</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-white/30 uppercase tracking-widest">
              {loading ? '…' : `${schedules.length} total`}
            </span>
            <button
              onClick={loadSchedules}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/30 hover:text-white transition-all"
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <div className="glass rounded-2xl md:rounded-[32px] border border-white/5 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-white/20 text-sm flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Loading schedules…
            </div>
          ) : schedules.length === 0 ? (
            <div className="p-10 md:p-14 text-center">
              <Calendar className="mx-auto text-white/10 mb-4" size={40} />
              <p className="text-white/20 uppercase tracking-widest text-xs font-mono">No schedules yet</p>
              <p className="text-white/20 text-sm mt-2">Add your first schedule above to start automating.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {schedules.map(s => (
                <ScheduleRow
                  key={s.id}
                  s={s}
                  editingId={editingId}
                  editTime={editTime}
                  editNiche={editNiche}
                  editIsAuto={editIsAuto}
                  deletingId={deletingId}
                  expandedId={expandedId}
                  setEditTime={setEditTime}
                  setEditNiche={setEditNiche}
                  setEditIsAuto={setEditIsAuto}
                  setExpandedId={setExpandedId}
                  onStartEdit={startEdit}
                  onSaveEdit={saveEdit}
                  onCancelEdit={() => setEditingId(null)}
                  onDelete={handleDelete}
                />
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
              <h3 className="text-xl md:text-2xl font-bold mb-2">Schedule Created!</h3>
              <p className="text-white/40 text-sm">The pipeline will run automatically at the set time.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ScheduleRowProps {
  s: ScheduleType;
  editingId: string | null;
  editTime: string;
  editNiche: string;
  editIsAuto: boolean;
  deletingId: string | null;
  expandedId: string | null;
  setEditTime: (v: string) => void;
  setEditNiche: (v: string) => void;
  setEditIsAuto: (v: boolean) => void;
  setExpandedId: (v: string | null) => void;
  onStartEdit: (s: ScheduleType) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
}

function ScheduleRow({
  s, editingId, editTime, editNiche, editIsAuto, deletingId, expandedId,
  setEditTime, setEditNiche, setEditIsAuto, setExpandedId,
  onStartEdit, onSaveEdit, onCancelEdit, onDelete,
}: ScheduleRowProps) {
  const isEditing = editingId === s.id;
  const isExpanded = expandedId === s.id;
  const hasDetails = s.last_run_at || s.last_topic || s.last_error;

  return (
    <motion.div
      layout
      className="border-b border-white/5 last:border-0"
    >
      <div className="p-4 md:p-5">
        {isEditing ? (
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
                <label className="text-[10px] uppercase font-mono tracking-widest text-white/30">Niche / Mode</label>
                <select
                  value={editIsAuto ? 'AUTO' : editNiche}
                  onChange={e => { if (e.target.value === 'AUTO') setEditIsAuto(true); else { setEditIsAuto(false); setEditNiche(e.target.value); } }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-3 text-sm focus:outline-none focus:border-brand-primary/50 appearance-none"
                >
                  <option value="AUTO" className="bg-surface">Auto Mode</option>
                  {NICHES.map(n => <option key={n} value={n} className="bg-surface">{n}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onSaveEdit} className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl tiktok-gradient text-sm font-bold flex items-center justify-center gap-2">
                <CheckCircle size={14} /> Save
              </button>
              <button onClick={onCancelEdit} className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-sm font-medium flex items-center justify-center gap-2 transition-all">
                <X size={14} /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="p-2 rounded-xl bg-white/5 shrink-0 mt-0.5">
                {s.status === 'running' ? (
                  <Loader2 size={14} className="text-blue-400 animate-spin" />
                ) : (
                  <Clock size={14} className="text-white/40" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm md:text-base">{fmtTime(s.scheduled_time)}</span>
                  <span className="text-xs text-white/40 font-mono">{fmtDate(s.scheduled_time)}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono uppercase tracking-wider ${STATUS_STYLES[s.status] || STATUS_STYLES.pending}`}>
                    {s.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-xs text-white/40 truncate max-w-[200px]">
                    {s.niche === 'AUTO' ? '✦ Auto Mode' : s.niche}
                  </span>
                  {s.execution_time_ms && s.execution_time_ms > 0 && (
                    <span className="flex items-center gap-1 text-[10px] text-white/20 font-mono">
                      <Timer size={10} /> {fmtExecTime(s.execution_time_ms)}
                    </span>
                  )}
                  {s.last_run_at && (
                    <span className="text-[10px] text-white/20 font-mono">
                      Last: {fmtRelative(s.last_run_at)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {hasDetails && (
                <button
                  onClick={() => setExpandedId(isExpanded ? null : s.id)}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/30 hover:text-white transition-all"
                  title="Show details"
                >
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              )}
              <button
                onClick={() => onStartEdit(s)}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={() => onDelete(s.id)}
                disabled={deletingId === s.id}
                className="p-2 rounded-lg bg-white/5 hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-all disabled:opacity-50"
              >
                {deletingId === s.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Execution Details Panel */}
      <AnimatePresence>
        {!isEditing && isExpanded && hasDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 md:px-5 pb-4 space-y-3">
              <div className="bg-black/30 rounded-2xl p-4 space-y-3 border border-white/5">
                <p className="text-[10px] uppercase font-mono tracking-widest text-white/30">Last Execution Details</p>

                {s.last_topic && (
                  <div className="flex items-start gap-2">
                    <Tag size={12} className="text-brand-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] uppercase font-mono text-white/30 mb-0.5">Topic Generated</p>
                      <p className="text-sm font-medium">{s.last_topic}</p>
                    </div>
                  </div>
                )}

                {s.last_run_at && (
                  <div className="flex items-start gap-2">
                    <Activity size={12} className="text-green-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] uppercase font-mono text-white/30 mb-0.5">Run Time</p>
                      <p className="text-sm font-mono">
                        {new Date(s.last_run_at).toLocaleString()} &nbsp;·&nbsp;
                        <span className={s.last_run_status === 'success' ? 'text-green-400' : 'text-red-400'}>
                          {s.last_run_status ?? 'unknown'}
                        </span>
                        {s.execution_time_ms ? ` · ${fmtExecTime(s.execution_time_ms)}` : ''}
                      </p>
                    </div>
                  </div>
                )}

                {s.last_error && (
                  <div className="flex items-start gap-2">
                    <AlertCircle size={12} className="text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] uppercase font-mono text-white/30 mb-0.5">Last Error</p>
                      <p className="text-xs font-mono text-red-300 break-all">{s.last_error}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
