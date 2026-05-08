import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap, Clock, Wand2, ChevronRight, Loader2, AlertCircle, CheckCircle,
  Bell, BellDot, X, Play, Download, Copy, Trash2, Tag, Hash,
  RefreshCw, Film, Calendar, Activity, Timer, Check, Video,
  BellOff, BellRing, ShieldCheck,
} from 'lucide-react';
import {
  createManualJob, fetchManualJobs, deleteManualJob, subscribeToManualJobs,
  fetchTodaysManualPosts, deletePost, subscribeToPosts,
  fetchNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification,
  subscribeToNotifications, savePushSubscription, deletePushSubscription, getPushSubscription,
} from '../lib/api';
import { ManualJob, Notification, Post } from '../types';

const NICHES = [
  'Daily Crypto Scam', 'Crypto Wallet Drain', 'Fake Crypto Guru Exposed',
  'Crypto Investment Scam', 'Crypto Scam Psychology', 'AI Crypto Scam', 'Crypto Romance Scam',
];

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  running: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  success: 'bg-green-500/10 text-green-400 border-green-500/20',
  failed:  'bg-red-500/10 text-red-400 border-red-500/20',
};

// VAPID public key — set VITE_VAPID_PUBLIC_KEY in your .env file
// Generate with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
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

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast { id: string; title: string; message: string; type: 'success' | 'error' | 'info'; }

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);

  const colors = { success: 'border-green-500/30 bg-green-500/10', error: 'border-red-500/30 bg-red-500/10', info: 'border-brand-secondary/30 bg-brand-secondary/10' };
  const icons = {
    success: <CheckCircle size={16} className="text-green-400 shrink-0" />,
    error:   <AlertCircle size={16} className="text-red-400 shrink-0" />,
    info:    <Bell size={16} className="text-brand-secondary shrink-0" />,
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 80, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.9 }}
      className={`flex items-start gap-3 px-4 py-3 rounded-2xl border glass shadow-2xl max-w-sm w-full ${colors[toast.type]}`}
    >
      {icons[toast.type]}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{toast.title}</p>
        <p className="text-xs text-white/60 mt-0.5 line-clamp-2">{toast.message}</p>
      </div>
      <button onClick={() => onDismiss(toast.id)} className="text-white/30 hover:text-white transition-all shrink-0 mt-0.5">
        <X size={14} />
      </button>
    </motion.div>
  );
}

// ─── Notification Panel ───────────────────────────────────────────────────────

function NotificationPanel({ notifications, onClose, onMarkRead, onMarkAllRead, onDelete }: {
  notifications: Notification[];
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDelete: (id: string) => void;
}) {
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.95 }}
      transition={{ type: 'spring', damping: 28, stiffness: 400 }}
      className="absolute right-0 top-14 z-50 w-80 md:w-96 glass border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Bell size={15} className="text-brand-secondary" />
          <span className="font-semibold text-sm">Notifications</span>
          {unreadCount > 0 && (
            <span className="text-[10px] bg-brand-primary text-white rounded-full px-1.5 py-0.5 font-bold font-mono">{unreadCount}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={onMarkAllRead} className="text-[10px] text-brand-secondary hover:text-white transition-all uppercase font-mono tracking-wider">
              Mark all read
            </button>
          )}
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
        {notifications.length === 0 ? (
          <div className="py-10 text-center">
            <Bell className="mx-auto text-white/10 mb-3" size={28} />
            <p className="text-white/20 text-xs uppercase font-mono tracking-widest">No notifications yet</p>
            <p className="text-white/20 text-xs mt-1">You'll be notified when videos are ready</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.read && onMarkRead(n.id)}
              className={`px-4 py-3 transition-colors cursor-default hover:bg-white/5 ${!n.read ? 'bg-white/[0.025]' : ''}`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                  n.type === 'success' ? 'bg-green-400' : n.type === 'error' ? 'bg-red-400' : 'bg-brand-secondary'
                } ${n.read ? 'opacity-20' : ''}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold leading-tight ${n.read ? 'text-white/50' : 'text-white'}`}>{n.title}</p>
                  <p className="text-xs text-white/40 mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
                  <p className="text-[10px] text-white/20 font-mono mt-1">{fmtRelative(n.created_at)}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(n.id); }}
                  className="p-1 rounded hover:bg-white/10 text-white/20 hover:text-white/60 transition-all shrink-0 mt-0.5"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}

// ─── Push Notification Banner ─────────────────────────────────────────────────

type PushStatus = 'idle' | 'loading' | 'subscribed' | 'denied' | 'unsupported' | 'no-vapid';

function PushSubscriptionBanner({ userId }: { userId: string }) {
  const [status, setStatus] = useState<PushStatus>('loading');
  const [toggling, setToggling] = useState(false);
  const [swReg, setSwReg] = useState<ServiceWorkerRegistration | null>(null);
  const [currentSub, setCurrentSub] = useState<PushSubscription | null>(null);

  useEffect(() => {
    if (!VAPID_PUBLIC_KEY) { setStatus('no-vapid'); return; }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setStatus('unsupported'); return; }
    if (Notification.permission === 'denied') { setStatus('denied'); return; }

    (async () => {
      try {
        const reg = await navigator.serviceWorker.register(
          `${import.meta.env.BASE_URL}sw.js`,
          { scope: import.meta.env.BASE_URL }
        );
        setSwReg(reg);
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          const saved = await getPushSubscription(userId);
          if (saved && saved.endpoint === existing.endpoint) {
            setCurrentSub(existing);
            setStatus('subscribed');
          } else {
            setStatus('idle');
          }
        } else {
          setStatus('idle');
        }
      } catch (e) {
        console.warn('SW registration failed:', e);
        setStatus('unsupported');
      }
    })();
  }, [userId]);

  const handleSubscribe = async () => {
    if (!swReg || !VAPID_PUBLIC_KEY) return;
    setToggling(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setStatus('denied'); return; }

      const sub = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      await savePushSubscription(userId, sub.toJSON() as PushSubscriptionJSON);
      setCurrentSub(sub);
      setStatus('subscribed');
    } catch (e: any) {
      console.error('Subscribe failed:', e);
    } finally {
      setToggling(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!currentSub) return;
    setToggling(true);
    try {
      await deletePushSubscription(userId, currentSub.endpoint);
      await currentSub.unsubscribe();
      setCurrentSub(null);
      setStatus('idle');
    } catch (e: any) {
      console.error('Unsubscribe failed:', e);
    } finally {
      setToggling(false);
    }
  };

  if (status === 'loading') return null;
  if (status === 'unsupported') return null;
  if (status === 'no-vapid') return null;

  if (status === 'denied') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-3 px-5 py-4 rounded-2xl border bg-yellow-500/5 border-yellow-500/20 text-yellow-300"
      >
        <BellOff size={16} className="shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Push notifications blocked</p>
          <p className="text-xs text-yellow-300/60 mt-0.5">
            To enable them, open your browser settings and allow notifications for this site.
          </p>
        </div>
      </motion.div>
    );
  }

  if (status === 'subscribed') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl border bg-green-500/5 border-green-500/20"
      >
        <div className="flex items-center gap-3">
          <ShieldCheck size={18} className="text-green-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-300">Push notifications enabled</p>
            <p className="text-xs text-white/40 mt-0.5">You'll receive an alert on this device when your video is ready — even if the app is closed.</p>
          </div>
        </div>
        <button
          onClick={handleUnsubscribe}
          disabled={toggling}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all text-xs font-medium disabled:opacity-40"
        >
          {toggling ? <Loader2 size={12} className="animate-spin" /> : <BellOff size={12} />}
          Turn off
        </button>
      </motion.div>
    );
  }

  // status === 'idle'
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl border bg-brand-secondary/5 border-brand-secondary/20"
    >
      <div className="flex items-center gap-3">
        <BellRing size={18} className="text-brand-secondary shrink-0" />
        <div>
          <p className="text-sm font-semibold">Get notified when your video is ready</p>
          <p className="text-xs text-white/40 mt-0.5">Enable push notifications to receive an alert even when AutoViral is closed.</p>
        </div>
      </div>
      <button
        onClick={handleSubscribe}
        disabled={toggling}
        className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl tiktok-gradient text-sm font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 whitespace-nowrap"
      >
        {toggling ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
        Enable
      </button>
    </motion.div>
  );
}

// ─── Video Card ───────────────────────────────────────────────────────────────

function VideoCard({ post, onDelete }: { post: Post; onDelete: (id: string) => void }) {
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedHashtags, setCopiedHashtags] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const copyText = async (text: string, type: 'caption' | 'hashtags') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'caption') { setCopiedCaption(true); setTimeout(() => setCopiedCaption(false), 2000); }
      else { setCopiedHashtags(true); setTimeout(() => setCopiedHashtags(false), 2000); }
    } catch { /* ignore */ }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await onDelete(post.id); } finally { setDeleting(false); }
  };

  const isReady = post.status === 'rendered' || post.status === 'published';

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="glass rounded-2xl md:rounded-3xl border border-white/5 overflow-hidden flex flex-col"
      >
        {/* Thumbnail */}
        <div className="relative bg-surface-lighter overflow-hidden group" style={{ aspectRatio: '9/16', maxHeight: '220px' }}>
          {post.thumbnail_url ? (
            <img src={post.thumbnail_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-black/40">
              <Film className="text-white/10" size={36} />
            </div>
          )}

          {!isReady && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
              <Loader2 size={22} className="text-brand-secondary animate-spin" />
              <span className="text-[10px] text-white/50 font-mono uppercase tracking-widest">
                {post.status === 'processing' ? 'Generating...' : post.status}
              </span>
            </div>
          )}

          {isReady && post.video_url && (
            <button
              onClick={() => setShowPlayer(true)}
              className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-200"
            >
              <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                <Play size={18} fill="white" className="text-white ml-1" />
              </div>
            </button>
          )}

          <div className="absolute top-2 left-2">
            <span className={`text-[9px] px-2 py-0.5 rounded-full border font-mono uppercase tracking-wider ${STATUS_STYLES[post.status] || STATUS_STYLES.pending}`}>
              {post.status}
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="p-4 flex-1 flex flex-col gap-3">
          <div>
            <p className="font-semibold text-sm line-clamp-2 leading-snug">{post.title || post.topic || 'Generating...'}</p>
            <p className="text-[10px] text-white/30 font-mono mt-1 uppercase tracking-wider">{post.niche || '—'}</p>
          </div>

          {post.caption && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Tag size={10} className="text-brand-primary shrink-0" />
                <span className="text-[10px] uppercase font-mono tracking-wider text-white/30">Caption</span>
              </div>
              <p className="text-xs text-white/70 line-clamp-3 leading-relaxed bg-white/5 rounded-xl px-3 py-2">{post.caption}</p>
            </div>
          )}

          {post.hashtags && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Hash size={10} className="text-brand-secondary shrink-0" />
                <span className="text-[10px] uppercase font-mono tracking-wider text-white/30">Hashtags</span>
              </div>
              <p className="text-[10px] text-brand-secondary/70 line-clamp-2 leading-relaxed bg-brand-secondary/5 rounded-xl px-3 py-2 font-mono">{post.hashtags}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1.5 pt-1 mt-auto flex-wrap">
            {post.video_url && isReady && (
              <button
                onClick={() => setShowPlayer(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all text-xs font-medium"
              >
                <Play size={12} /> <span className="hidden sm:inline">Play</span>
              </button>
            )}
            {post.video_url && isReady && (
              <a
                href={post.video_url}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all text-xs font-medium"
              >
                <Download size={12} /> <span className="hidden sm:inline">Download</span>
              </a>
            )}
            {post.caption && (
              <button
                onClick={() => copyText(post.caption!, 'caption')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary transition-all text-xs font-medium"
              >
                {copiedCaption ? <Check size={12} /> : <Copy size={12} />}
                <span className="hidden sm:inline">{copiedCaption ? 'Copied!' : 'Caption'}</span>
              </button>
            )}
            {post.hashtags && (
              <button
                onClick={() => copyText(post.hashtags!, 'hashtags')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-secondary/10 hover:bg-brand-secondary/20 text-brand-secondary transition-all text-xs font-medium"
              >
                {copiedHashtags ? <Check size={12} /> : <Copy size={12} />}
                <span className="hidden sm:inline">{copiedHashtags ? 'Copied!' : 'Tags'}</span>
              </button>
            )}
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-all text-xs font-medium ml-auto disabled:opacity-30"
            >
              {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Video Player Modal */}
      <AnimatePresence>
        {showPlayer && post.video_url && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowPlayer(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-xs"
            >
              <button
                onClick={() => setShowPlayer(false)}
                className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center text-white transition-all border border-white/20"
              >
                <X size={16} />
              </button>
              <video
                src={post.video_url}
                controls
                autoPlay
                playsInline
                className="w-full rounded-2xl bg-black shadow-2xl"
                style={{ aspectRatio: '9/16' }}
              />
              {post.title && (
                <p className="text-center text-sm text-white/50 mt-3 font-medium px-2 line-clamp-1">{post.title}</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ManualGenerate() {
  const userId = localStorage.getItem('tiktok_user_id') || '';

  const [mode, setMode] = useState<'now' | 'schedule'>('now');
  const [time, setTime] = useState('');
  const [isAutoNiche, setIsAutoNiche] = useState(true);
  const [selectedNiche, setSelectedNiche] = useState(NICHES[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const [jobs, setJobs] = useState<ManualJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);

  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  const addToast = useCallback((title: string, message: string, type: Toast['type'] = 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, title, message, type }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadJobs = useCallback(async () => {
    if (!userId) { setJobsLoading(false); return; }
    try { const data = await fetchManualJobs(userId); setJobs(data); }
    catch { /* ignore */ } finally { setJobsLoading(false); }
  }, [userId]);

  const loadPosts = useCallback(async () => {
    if (!userId) { setPostsLoading(false); return; }
    try { const data = await fetchTodaysManualPosts(userId); setPosts(data); }
    catch { /* ignore */ } finally { setPostsLoading(false); }
  }, [userId]);

  const loadNotifications = useCallback(async () => {
    if (!userId) return;
    try { const data = await fetchNotifications(userId); setNotifications(data); }
    catch { /* ignore */ }
  }, [userId]);

  useEffect(() => {
    loadJobs();
    loadPosts();
    loadNotifications();

    const unsubJobs = subscribeToManualJobs(userId, (job) => {
      setJobs(prev => {
        const exists = prev.find(j => j.id === job.id);
        if (exists) return prev.map(j => j.id === job.id ? job : j);
        return [job, ...prev];
      });
    });

    const unsubPosts = subscribeToPosts(userId, (post) => {
      if (!post.manual_job_id) return;
      setPosts(prev => {
        const exists = prev.find(p => p.id === post.id);
        if (exists) return prev.map(p => p.id === post.id ? post : p);
        return [post, ...prev];
      });
    });

    const unsubNotifs = subscribeToNotifications(userId, (notif) => {
      setNotifications(prev => [notif, ...prev]);
      addToast(notif.title, notif.message, notif.type);
    });

    return () => { unsubJobs(); unsubPosts(); unsubNotifs(); };
  }, [userId, loadJobs, loadPosts, loadNotifications, addToast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) { setError('No user session — please log in.'); return; }
    if (mode === 'schedule' && !time) { setError('Please select a time.'); return; }

    setIsSubmitting(true);
    setError(null);

    try {
      let scheduledTime: string | null = null;
      if (mode === 'schedule' && time) {
        const today = new Date();
        const [h, m] = time.split(':').map(Number);
        const dt = new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m);
        if (dt < new Date()) dt.setDate(dt.getDate() + 1);
        scheduledTime = dt.toISOString();
      }

      await createManualJob({ userId, scheduledTime, niche: isAutoNiche ? 'AUTO' : selectedNiche });

      setShowSuccess(true);
      setTime('');
      setTimeout(() => setShowSuccess(false), 2500);
    } catch (err) {
      setError((err as Error).message || 'Failed to create job. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteJob = async (id: string) => {
    try { await deleteManualJob(id); setJobs(prev => prev.filter(j => j.id !== id)); }
    catch (err) { alert((err as Error).message); }
  };

  const handleDeletePost = async (id: string) => {
    try { await deletePost(id); setPosts(prev => prev.filter(p => p.id !== id)); }
    catch (err) { alert((err as Error).message); }
  };

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead(userId);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleDeleteNotif = async (id: string) => {
    await deleteNotification(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const activeJobs = jobs.filter(j => j.status === 'pending' || j.status === 'running');

  return (
    <div className="max-w-4xl mx-auto space-y-8 md:space-y-10">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight mb-2">Manual Video Generation</h1>
          <p className="text-white/40 text-sm md:text-base">Generate videos instantly or on schedule — without auto-publishing to TikTok.</p>
        </div>

        {/* Notification Bell */}
        <div className="relative shrink-0" ref={notifRef}>
          <button
            onClick={() => setNotifPanelOpen(p => !p)}
            className="relative p-3 rounded-2xl glass border border-white/10 hover:border-white/20 text-white/60 hover:text-white transition-all"
          >
            {unreadCount > 0 ? <BellDot size={20} className="text-brand-secondary" /> : <Bell size={20} />}
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-brand-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <AnimatePresence>
            {notifPanelOpen && (
              <NotificationPanel
                notifications={notifications}
                onClose={() => setNotifPanelOpen(false)}
                onMarkRead={handleMarkRead}
                onMarkAllRead={handleMarkAllRead}
                onDelete={handleDeleteNotif}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Push Notification Subscription Banner */}
      {userId && <PushSubscriptionBanner userId={userId} />}

      {/* Active jobs status */}
      <AnimatePresence>
        {activeJobs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`flex items-center gap-3 px-5 py-4 rounded-2xl border text-sm ${
              activeJobs.some(j => j.status === 'running')
                ? 'bg-blue-500/10 border-blue-500/20 text-blue-300'
                : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300'
            }`}
          >
            {activeJobs.some(j => j.status === 'running')
              ? <Loader2 size={16} className="animate-spin shrink-0" />
              : <Activity size={16} className="shrink-0" />}
            <span>
              {activeJobs.some(j => j.status === 'running')
                ? 'Generating video — pipeline is running now'
                : `${activeJobs.length} job${activeJobs.length > 1 ? 's' : ''} queued — will generate at the scheduled time`}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generation Form */}
      <form onSubmit={handleSubmit}>
        <div className="glass rounded-2xl md:rounded-[40px] p-5 md:p-8 border border-white/5 space-y-6 md:space-y-8">

          {/* Mode selector */}
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <button type="button" onClick={() => setMode('now')}
              className={`p-4 md:p-6 rounded-2xl md:rounded-3xl border transition-all text-left ${mode === 'now' ? 'bg-brand-primary/20 border-brand-primary' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
            >
              <Zap className={`mb-2 md:mb-3 ${mode === 'now' ? 'text-brand-primary' : 'text-white/20'}`} size={22} />
              <h4 className="font-bold text-sm md:text-base mb-1">Generate Now</h4>
              <p className="text-[10px] text-white/40 leading-relaxed uppercase tracking-wider font-mono">Start immediately</p>
            </button>
            <button type="button" onClick={() => setMode('schedule')}
              className={`p-4 md:p-6 rounded-2xl md:rounded-3xl border transition-all text-left ${mode === 'schedule' ? 'bg-brand-secondary/20 border-brand-secondary' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
            >
              <Calendar className={`mb-2 md:mb-3 ${mode === 'schedule' ? 'text-brand-secondary' : 'text-white/20'}`} size={22} />
              <h4 className="font-bold text-sm md:text-base mb-1">Schedule</h4>
              <p className="text-[10px] text-white/40 leading-relaxed uppercase tracking-wider font-mono">Pick a time</p>
            </button>
          </div>

          {/* Time picker */}
          <AnimatePresence>
            {mode === 'schedule' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-2 pt-2">
                  <label className="text-xs uppercase font-mono tracking-widest text-white/40 ml-1">Generation Time</label>
                  <div className="relative max-w-xs">
                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                    <input
                      type="time"
                      required={mode === 'schedule'}
                      value={time}
                      onChange={e => setTime(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-brand-secondary/50 transition-all text-sm"
                    />
                  </div>
                  <p className="text-xs text-white/30 ml-1">Schedules for tomorrow if the time has already passed today.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Niche selection */}
          <div className="space-y-4">
            <label className="text-xs uppercase font-mono tracking-widest text-white/40 ml-1">Niche Selection</label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setIsAutoNiche(true)}
                className={`p-4 rounded-2xl border transition-all text-left ${isAutoNiche ? 'bg-brand-primary/20 border-brand-primary' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
              >
                <Wand2 className={`mb-2 ${isAutoNiche ? 'text-brand-primary' : 'text-white/20'}`} size={18} />
                <h4 className="font-semibold text-sm mb-0.5">Auto Mode</h4>
                <p className="text-[10px] text-white/40 font-mono uppercase tracking-wider">AI picks niche</p>
              </button>
              <button type="button" onClick={() => setIsAutoNiche(false)}
                className={`p-4 rounded-2xl border transition-all text-left ${!isAutoNiche ? 'bg-brand-secondary/20 border-brand-secondary' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
              >
                <Tag className={`mb-2 ${!isAutoNiche ? 'text-brand-secondary' : 'text-white/20'}`} size={18} />
                <h4 className="font-semibold text-sm mb-0.5">Choose Niche</h4>
                <p className="text-[10px] text-white/40 font-mono uppercase tracking-wider">Pick manually</p>
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
                  <select
                    value={selectedNiche}
                    onChange={e => setSelectedNiche(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 focus:outline-none focus:border-brand-secondary/50 transition-all text-sm appearance-none cursor-pointer mt-2"
                  >
                    {NICHES.map(n => <option key={n} value={n} className="bg-surface">{n}</option>)}
                  </select>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {error && (
            <p className="text-red-400 text-sm px-1 flex items-center gap-2">
              <AlertCircle size={14} />{error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || (mode === 'schedule' && !time)}
            className={`w-full py-4 md:py-5 rounded-2xl tiktok-gradient font-bold text-base md:text-lg flex items-center justify-center gap-2 transition-all active:scale-95 ${
              isSubmitting || (mode === 'schedule' && !time) ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] shadow-2xl shadow-brand-primary/20'
            }`}
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : null}
            {isSubmitting ? 'Creating job…' : mode === 'now' ? 'Generate Now' : 'Schedule Generation'}
            {!isSubmitting && <ChevronRight size={20} />}
          </button>
        </div>
      </form>

      {/* Jobs list */}
      {(jobsLoading || jobs.length > 0) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight">Generation Jobs</h2>
            <button onClick={loadJobs} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/30 hover:text-white transition-all">
              <RefreshCw size={14} />
            </button>
          </div>
          <div className="glass rounded-2xl md:rounded-[32px] border border-white/5 overflow-hidden">
            {jobsLoading ? (
              <div className="p-8 text-center text-white/20 text-sm flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Loading jobs…
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {jobs.map(job => (
                  <motion.div key={job.id} layout className="p-4 md:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="p-2 rounded-xl bg-white/5 shrink-0 mt-0.5">
                          {job.status === 'running' ? <Loader2 size={14} className="text-blue-400 animate-spin" />
                            : job.status === 'success' ? <CheckCircle size={14} className="text-green-400" />
                            : job.status === 'failed' ? <AlertCircle size={14} className="text-red-400" />
                            : <Video size={14} className="text-white/40" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm">{fmtTime(job.scheduled_time || job.created_at || '')}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono uppercase tracking-wider ${STATUS_STYLES[job.status] || STATUS_STYLES.pending}`}>
                              {job.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-xs text-white/40 truncate max-w-[200px]">
                              {job.niche === 'AUTO' ? '✦ Auto Mode' : job.niche}
                            </span>
                            {job.execution_time_ms && job.execution_time_ms > 0 && (
                              <span className="flex items-center gap-1 text-[10px] text-white/20 font-mono">
                                <Timer size={10} /> {fmtExecTime(job.execution_time_ms)}
                              </span>
                            )}
                            {job.last_topic && (
                              <span className="text-[10px] text-white/30 font-mono truncate max-w-[180px]">{job.last_topic}</span>
                            )}
                          </div>
                          {job.last_error && (
                            <p className="text-[10px] text-red-400/70 mt-1 truncate">{job.last_error}</p>
                          )}
                        </div>
                      </div>
                      {job.status === 'pending' && (
                        <button
                          onClick={() => handleDeleteJob(job.id)}
                          className="p-2 rounded-lg bg-white/5 hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-all shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Today's Videos */}
      <div className="space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight">Today's Generated Videos</h2>
            <p className="text-xs text-white/30 mt-1 font-mono uppercase tracking-wider">
              {postsLoading ? '…' : `${posts.length} video${posts.length !== 1 ? 's' : ''} generated today`}
            </p>
          </div>
          <button onClick={loadPosts} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/30 hover:text-white transition-all">
            <RefreshCw size={14} />
          </button>
        </div>

        {postsLoading ? (
          <div className="glass rounded-2xl border border-white/5 p-12 text-center flex items-center justify-center gap-2 text-white/20">
            <Loader2 size={16} className="animate-spin" /> Loading videos…
          </div>
        ) : posts.length === 0 ? (
          <div className="glass rounded-2xl md:rounded-[32px] border border-white/5 p-12 md:p-16 text-center">
            <Film className="mx-auto text-white/10 mb-4" size={40} />
            <p className="text-white/20 uppercase tracking-widest text-xs font-mono">No videos generated today</p>
            <p className="text-white/20 text-sm mt-2">Use Generate Now or schedule a generation above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            <AnimatePresence>
              {posts.map(post => <VideoCard key={post.id} post={post} onDelete={handleDeletePost} />)}
            </AnimatePresence>
          </div>
        )}
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
              <h3 className="text-xl md:text-2xl font-bold mb-2">
                {mode === 'now' ? 'Generation Started!' : 'Generation Scheduled!'}
              </h3>
              <p className="text-white/40 text-sm">
                {mode === 'now'
                  ? "Your video is being generated. You'll be notified when it's ready."
                  : 'The pipeline will generate your video at the set time.'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastItem toast={toast} onDismiss={dismissToast} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
