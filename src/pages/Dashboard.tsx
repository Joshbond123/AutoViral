import { motion } from 'motion/react';
import { Play, CheckCircle2, AlertCircle, Clock, Video, Eye, Share2, BarChart2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Post } from '../types';
import { fetchHistory } from '../lib/api';

export default function Dashboard() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      const userId = localStorage.getItem('tiktok_user_id');
      if (!userId) return;
      try {
        const data = await fetchHistory(userId);
        setPosts(Array.isArray(data) ? data as Post[] : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const stats = [
    { label: 'Total Posts', value: posts.length, icon: Video, color: 'text-brand-secondary' },
    { label: 'Scheduled', value: '4', icon: Clock, color: 'text-yellow-500' },
    { label: 'Success Rate', value: '98%', icon: CheckCircle2, color: 'text-green-500' },
    { label: 'Avg View Duration', value: '42s', icon: Eye, color: 'text-brand-primary' },
  ];

  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Welcome back, Creator</h1>
        <p className="text-white/40">Your TikTok automation pipeline is active and healthy.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-6 rounded-3xl glass border border-white/5"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-2xl bg-white/5 ${stat.color}`}>
                <stat.icon size={20} />
              </div>
              <span className="text-[10px] uppercase font-mono tracking-widest text-white/20">Real-time</span>
            </div>
            <p className="text-white/40 text-sm mb-1">{stat.label}</p>
            <h3 className="text-3xl font-bold font-mono tracking-tighter">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      {/* Recent History Table */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Recent Post History</h2>
          <button className="text-sm font-medium text-brand-secondary hover:underline">View All</button>
        </div>

        <div className="glass rounded-[32px] border border-white/5 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-white/5 border-b border-white/5">
              <tr>
                <th className="px-6 py-4 text-xs uppercase font-mono tracking-widest text-white/40 font-medium">Video</th>
                <th className="px-6 py-4 text-xs uppercase font-mono tracking-widest text-white/40 font-medium whitespace-nowrap">Topic / Niche</th>
                <th className="px-6 py-4 text-xs uppercase font-mono tracking-widest text-white/40 font-medium">Status</th>
                <th className="px-6 py-4 text-xs uppercase font-mono tracking-widest text-white/40 font-medium">Date</th>
                <th className="px-6 py-4 text-xs uppercase font-mono tracking-widest text-white/40 font-medium">Duration</th>
                <th className="px-6 py-4 text-xs uppercase font-mono tracking-widest text-white/40 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-white/20">Loading your history...</td>
                </tr>
              ) : posts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-white/20 uppercase tracking-widest text-xs font-mono">No posts generated yet</td>
                </tr>
              ) : (
                posts.map((post) => (
                  <tr key={post.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-16 rounded-lg bg-surface-lighter overflow-hidden relative border border-white/10 shrink-0">
                          {post.thumbnail_url ? (
                            <img src={post.thumbnail_url} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/10">
                              <Play size={16} fill="currentColor" />
                            </div>
                          )}
                        </div>
                        <div className="max-w-[200px]">
                          <p className="font-semibold text-sm truncate">{post.title || post.topic}</p>
                          <p className="text-white/40 text-xs truncate">ID: {post.id.substring(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{post.topic}</p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary font-mono uppercase tracking-wider">{post.niche}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={post.status} />
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-white/60">{post.published_at ? new Date(post.published_at).toLocaleDateString() : 'N/A'}</p>
                      <p className="text-xs text-white/20 font-mono italic">{post.published_at ? new Date(post.published_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono text-white/60">{post.duration || '00:15'}s</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
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

function StatusBadge({ status }: { status: Post['status'] }) {
  const styles = {
    pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    processing: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    published: 'bg-green-500/10 text-green-500 border-green-500/20',
    failed: 'bg-red-500/10 text-red-500 border-red-500/20',
  };

  const icons = {
    pending: Clock,
    processing: AlertCircle,
    published: CheckCircle2,
    failed: AlertCircle,
  };

  const Icon = icons[status];

  return (
    <span className={`flex items-center gap-1.5 w-fit px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${styles[status]}`}>
      <Icon size={10} strokeWidth={3} />
      {status}
    </span>
  );
}
