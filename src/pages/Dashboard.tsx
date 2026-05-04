import { motion } from 'motion/react';
import { Play, CheckCircle2, AlertCircle, Clock, Video, Eye, Share2, BarChart2, LogOut, TrendingUp, Film } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Post } from '../types';
import { fetchHistory, fetchProfile, TikTokProfile, fetchScheduledCount, subscribeToPosts } from '../lib/api';

export default function Dashboard() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [profile, setProfile] = useState<TikTokProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [scheduledCount, setScheduledCount] = useState<number>(0);
  const navigate = useNavigate();

  useEffect(() => {
    const userId = localStorage.getItem('tiktok_user_id');
    if (!userId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      const [historyRes, profileRes, schedCountRes] = await Promise.allSettled([
        fetchHistory(userId),
        fetchProfile(userId),
        fetchScheduledCount(userId),
      ]);
      if (cancelled) return;

      if (historyRes.status === 'fulfilled') {
        setPosts(Array.isArray(historyRes.value) ? (historyRes.value as Post[]) : []);
      }

      if (profileRes.status === 'fulfilled') {
        setProfile(profileRes.value);
      } else {
        setProfileError(String((profileRes.reason as Error)?.message ?? profileRes.reason));
      }

      if (schedCountRes.status === 'fulfilled') {
        setScheduledCount(schedCountRes.value);
      }

      setLoading(false);
    })();

    // Real-time subscription — updates dashboard live when pipeline runs
    const unsub = subscribeToPosts(userId, (post) => {
      setPosts(prev => {
        const exists = prev.find(p => p.id === post.id);
        if (exists) return prev.map(p => p.id === post.id ? post : p);
        return [post, ...prev].slice(0, 20);
      });
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('tiktok_user_id');
    navigate('/');
  };

  const publishedPosts = posts.filter(p => p.status === 'published');
  const successRate = posts.length > 0
    ? Math.round((publishedPosts.length / posts.length) * 100)
    : null;

  const stats = [
    { label: 'Total Posts', value: loading ? '…' : String(posts.length), icon: Video, color: 'text-brand-secondary' },
    { label: 'Scheduled', value: loading ? '…' : String(scheduledCount), icon: Clock, color: 'text-yellow-500' },
    { label: 'Published', value: loading ? '…' : String(publishedPosts.length), icon: CheckCircle2, color: 'text-green-500' },
    { label: 'Success Rate', value: loading ? '…' : successRate !== null ? `${successRate}%` : 'N/A', icon: TrendingUp, color: 'text-brand-primary' },
  ];

  return (
    <div className="space-y-8 md:space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight mb-2">Welcome back, Creator</h1>
        <p className="text-white/40 text-sm md:text-base">Your TikTok automation pipeline is active.</p>
      </div>

      {/* Connected TikTok account */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl md:rounded-[32px] p-5 md:p-8 border border-brand-primary/20 bg-brand-primary/[0.03]"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 md:gap-6">
          <div className="flex items-center gap-4 md:gap-5">
            <div className="relative shrink-0">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.username ?? 'TikTok user'}
                  className="w-14 h-14 md:w-16 md:h-16 rounded-full object-cover border-2 border-brand-primary/40"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/30">
                  <Video size={24} />
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-4 h-4 md:w-5 md:h-5 rounded-full bg-green-500 border-2 border-[#0a0a0a]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.25em] font-mono text-brand-primary mb-1">
                Connected TikTok account
              </p>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight truncate">
                {loading ? 'Loading…' : profile?.username || 'TikTok creator'}
              </h2>
              <p className="text-white/40 text-xs font-mono mt-1">
                {profile?.id ? `ID: ${profile.id.slice(0, 12)}…` : '—'}
              </p>
              {profileError && (
                <p className="text-red-400 text-xs mt-1 truncate">Error: {profileError}</p>
              )}
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/60 hover:text-white transition-all"
          >
            <LogOut size={12} /> Sign out
          </button>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-4 md:p-6 rounded-2xl md:rounded-3xl glass border border-white/5"
          >
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <div className={`p-2 md:p-3 rounded-xl md:rounded-2xl bg-white/5 ${stat.color}`}>
                <stat.icon size={16} className="md:w-5 md:h-5" />
              </div>
              <span className="text-[9px] md:text-[10px] uppercase font-mono tracking-widest text-white/20 hidden sm:block">Live</span>
            </div>
            <p className="text-white/40 text-xs md:text-sm mb-1">{stat.label}</p>
            <h3 className="text-2xl md:text-3xl font-bold font-mono tracking-tighter">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      {/* Recent History Table */}
      <div className="space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">Recent Post History</h2>
        </div>

        <div className="glass rounded-2xl md:rounded-[32px] border border-white/5 overflow-hidden">
          {/* Mobile card layout */}
          <div className="md:hidden divide-y divide-white/5">
            {loading ? (
              <div className="px-5 py-10 text-center text-white/20 text-sm">Loading history...</div>
            ) : posts.length === 0 ? (
              <div className="px-5 py-10 text-center text-white/20 uppercase tracking-widest text-xs font-mono">No posts yet</div>
            ) : (
              posts.map((post) => (
                <div key={post.id} className="p-4 flex items-center gap-4">
                  <div className="w-10 h-14 rounded-lg bg-surface-lighter overflow-hidden border border-white/10 shrink-0">
                    {post.thumbnail_url ? (
                      <img src={post.thumbnail_url} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/10">
                        <Play size={14} fill="currentColor" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{post.title || post.topic || 'Generating…'}</p>
                    <p className="text-white/40 text-xs truncate">{post.niche || '—'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <StatusBadge status={post.status} />
                      <span className="text-xs text-white/30 font-mono">
                        {post.published_at ? new Date(post.published_at).toLocaleDateString() : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop table layout */}
          <table className="hidden md:table w-full text-left">
            <thead className="bg-white/5 border-b border-white/5">
              <tr>
                <th className="px-6 py-4 text-xs uppercase font-mono tracking-widest text-white/40 font-medium">Video</th>
                <th className="px-6 py-4 text-xs uppercase font-mono tracking-widest text-white/40 font-medium">Topic / Niche</th>
                <th className="px-6 py-4 text-xs uppercase font-mono tracking-widest text-white/40 font-medium">Status</th>
                <th className="px-6 py-4 text-xs uppercase font-mono tracking-widest text-white/40 font-medium">Date</th>
                <th className="px-6 py-4 text-xs uppercase font-mono tracking-widest text-white/40 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-white/20">Loading your history...</td>
                </tr>
              ) : posts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-white/20 uppercase tracking-widest text-xs font-mono">No posts generated yet</td>
                </tr>
              ) : (
                posts.map((post) => (
                  <tr key={post.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-16 rounded-lg bg-surface-lighter overflow-hidden border border-white/10 shrink-0">
                          {post.thumbnail_url ? (
                            <img src={post.thumbnail_url} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/10">
                              <Play size={16} fill="currentColor" />
                            </div>
                          )}
                        </div>
                        <div className="max-w-[200px]">
                          <p className="font-semibold text-sm truncate">{post.title || post.topic || 'Generating…'}</p>
                          <p className="text-white/40 text-xs truncate">ID: {post.id.substring(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{post.topic || '—'}</p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary font-mono uppercase tracking-wider">
                          {post.niche || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={post.status} />
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-white/60">
                        {post.published_at ? new Date(post.published_at).toLocaleDateString() : '—'}
                      </p>
                      <p className="text-xs text-white/20 font-mono">
                        {post.published_at ? new Date(post.published_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {post.video_url && (
                          <a
                            href={post.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
                            title="Watch video"
                          >
                            <Eye size={16} />
                          </a>
                        )}
                        <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all">
                          <BarChart2 size={16} />
                        </button>
                        <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all">
                          <Share2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Post['status'] | string }) {
  const cfg: Record<string, { style: string; Icon: React.ElementType; label: string }> = {
    pending:    { style: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',  Icon: Clock,        label: 'Pending'    },
    processing: { style: 'bg-blue-500/10 text-blue-400 border-blue-500/20',        Icon: AlertCircle,  label: 'Processing' },
    rendered:   { style: 'bg-purple-500/10 text-purple-400 border-purple-500/20',  Icon: Film,         label: 'Rendered'   },
    published:  { style: 'bg-green-500/10 text-green-400 border-green-500/20',     Icon: CheckCircle2, label: 'Published'  },
    failed:     { style: 'bg-red-500/10 text-red-400 border-red-500/20',           Icon: AlertCircle,  label: 'Failed'     },
  };

  const entry = cfg[status] ?? { style: 'bg-white/5 text-white/40 border-white/10', Icon: Clock, label: status };
  const { style, Icon, label } = entry;

  return (
    <span className={`flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${style}`}>
      <Icon size={10} strokeWidth={3} />
      {label}
    </span>
  );
}
