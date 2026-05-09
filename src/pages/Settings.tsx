import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Key, Trash2, Plus, Eye, EyeOff, Check, X,
  AlertCircle, Database, Loader2, RefreshCw,
  Activity, Clock, TrendingUp, Shield, Image,
} from 'lucide-react';
import { ApiKey } from '../types';
import {
  fetchApiKeys, addApiKey, deleteApiKey, toggleApiKey,
  updateApiKeyValue, resetKeyStatus, subscribeToApiKeys,
} from '../lib/api';
import { HAS_SUPABASE } from '../lib/supabase';

type Service = ApiKey['service'];
type KeyStatus = 'active' | 'rate_limited' | 'failed';

interface ServiceGroup {
  label: string;
  description: string;
  color: string;
  accentBg: string;
  badge?: string;
  fields: { service: Service; fieldLabel: string; placeholder: string }[];
}

const SERVICE_GROUPS: ServiceGroup[] = [
  {
    label: 'Cerebras API',
    description: 'AI script generation. Add multiple keys for automatic rotation.',
    color: 'text-purple-400',
    accentBg: 'bg-purple-500/10',
    fields: [{ service: 'cerebras', fieldLabel: 'API Key', placeholder: 'csk-••••••••' }],
  },
  {
    label: 'Cloudflare Workers AI',
    description: 'Primary scene image generation. Both Account ID and API Token required. Add multiple tokens for automatic rotation.',
    color: 'text-orange-400',
    accentBg: 'bg-orange-500/10',
    fields: [
      { service: 'cloudflare_id', fieldLabel: 'Account ID', placeholder: 'a1b2c3d4e5f6g7h8…' },
      { service: 'cloudflare', fieldLabel: 'API Token', placeholder: 'Bearer ••••••••' },
    ],
  },
  {
    label: 'Pollinations AI',
    description: 'Free AI image generation fallback. Automatically activated when Cloudflare quota is exhausted. No API key required — add a token only if you have a premium Pollinations account.',
    color: 'text-green-400',
    accentBg: 'bg-green-500/10',
    badge: 'Auto Fallback',
    fields: [{ service: 'pollinations', fieldLabel: 'API Token (Optional)', placeholder: 'Optional premium token…' }],
  },
  {
    label: 'UnrealSpeech API',
    description: 'TTS voiceover. Add multiple keys for load distribution.',
    color: 'text-cyan-400',
    accentBg: 'bg-cyan-500/10',
    fields: [{ service: 'unrealspeech', fieldLabel: 'API Key', placeholder: 'sk-••••••••' }],
  },
];

const ALL_SERVICES: Service[] = ['cerebras', 'cloudflare_id', 'cloudflare', 'pollinations', 'unrealspeech'];

const SERVICE_LABEL: Record<Service, string> = {
  cerebras: 'Cerebras — API Key',
  cloudflare_id: 'Cloudflare — Account ID',
  cloudflare: 'Cloudflare — API Token',
  pollinations: 'Pollinations AI — API Token (Optional)',
  unrealspeech: 'UnrealSpeech — API Key',
};

function timeAgo(iso?: string): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function successRate(key: ApiKey): string {
  if (key.request_count === 0) return '—';
  return `${Math.round((key.success_count / key.request_count) * 100)}%`;
}

function StatusBadge({ status }: { status: KeyStatus }) {
  const cfg = {
    active: { label: 'Active', cls: 'bg-green-500/15 text-green-400 border-green-500/20', dot: 'bg-green-400' },
    rate_limited: { label: 'Rate Limited', cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20', dot: 'bg-yellow-400' },
    failed: { label: 'Failed', cls: 'bg-red-500/15 text-red-400 border-red-500/20', dot: 'bg-red-400' },
  }[status] ?? { label: 'Active', cls: 'bg-green-500/15 text-green-400 border-green-500/20', dot: 'bg-green-400' };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono uppercase tracking-widest ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${status === 'active' ? 'animate-pulse' : ''}`} />
      {cfg.label}
    </span>
  );
}

export default function Settings() {
  return (
    <div className="max-w-3xl">
      <div className="mb-8 md:mb-12">
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight mb-2">Platform Settings</h1>
        <p className="text-white/40 text-sm md:text-base">Manage API credentials with automatic key rotation and intelligent fallback.</p>
      </div>

      <div className="space-y-6 md:space-y-8">
        {!HAS_SUPABASE && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-sm"
          >
            <AlertCircle size={18} className="shrink-0" />
            <p>Supabase is not configured. Set <code className="font-mono text-xs bg-yellow-500/10 px-1 rounded">VITE_SUPABASE_URL</code> and <code className="font-mono text-xs bg-yellow-500/10 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> to enable key management.</p>
          </motion.div>
        )}

        <ConnectionStatus />
        <RotationBanner />
        <FallbackBanner />
        <ApiKeyManager />
      </div>
    </div>
  );
}

function ConnectionStatus() {
  return (
    <div className="glass rounded-2xl md:rounded-[32px] p-5 md:p-8 border border-white/5">
      <div className="flex items-center gap-4 md:gap-6">
        <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-green-500/10 flex items-center justify-center text-green-500 border border-green-500/10 shrink-0">
          <Database size={24} />
        </div>
        <div>
          <h3 className="text-lg md:text-xl font-bold mb-1">Supabase Infrastructure</h3>
          <p className="text-xs md:text-sm text-white/40">Real-time database and credential storage.</p>
          <div className="flex items-center gap-2 mt-2">
            <div className={`w-2 h-2 rounded-full ${HAS_SUPABASE ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-[10px] uppercase font-mono tracking-widest text-white/40">
              {HAS_SUPABASE ? 'Connected' : 'Not configured'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function RotationBanner() {
  return (
    <div className="glass rounded-2xl border border-brand-primary/10 p-5 md:p-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary shrink-0 mt-0.5">
          <Shield size={20} />
        </div>
        <div>
          <h3 className="font-bold text-sm md:text-base mb-1">Automatic Key Rotation Enabled</h3>
          <p className="text-xs text-white/40 leading-relaxed">
            When multiple keys are added for the same service, the pipeline automatically rotates between them — using the least-used key first.
            If a key hits a rate limit, it is temporarily skipped and the next key takes over. Failed keys are bypassed automatically.
          </p>
          <div className="flex flex-wrap gap-3 mt-3">
            {[
              { icon: TrendingUp, label: 'Round-robin rotation' },
              { icon: Activity, label: 'Auto-skip on rate limit' },
              { icon: RefreshCw, label: 'Real-time usage tracking' },
            ].map(({ icon: Icon, label }) => (
              <span key={label} className="flex items-center gap-1.5 text-[10px] uppercase font-mono tracking-widest text-white/30 border border-white/5 px-3 py-1.5 rounded-full">
                <Icon size={11} /> {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FallbackBanner() {
  return (
    <div className="glass rounded-2xl border border-green-500/10 p-5 md:p-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400 shrink-0 mt-0.5">
          <Image size={20} />
        </div>
        <div>
          <h3 className="font-bold text-sm md:text-base mb-1">Intelligent Image Generation Fallback</h3>
          <p className="text-xs text-white/40 leading-relaxed">
            The pipeline first attempts Cloudflare Workers AI (with automatic key rotation) for each scene image.
            If all Cloudflare keys are exhausted or rate-limited, it automatically falls back to Pollinations AI — a free public service with no daily quota.
            Video generation is never blocked by image API failures.
          </p>
          <div className="flex flex-wrap gap-3 mt-3">
            {[
              { label: '1st: Cloudflare AI', color: 'text-orange-400 border-orange-500/20' },
              { label: '2nd: Pollinations AI', color: 'text-green-400 border-green-500/20' },
              { label: '3rd: Dark fallback', color: 'text-white/30 border-white/10' },
            ].map(({ label, color }) => (
              <span key={label} className={`flex items-center gap-1.5 text-[10px] uppercase font-mono tracking-widest border px-3 py-1.5 rounded-full ${color}`}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [addService, setAddService] = useState<Service>('cerebras');
  const [addValue, setAddValue] = useState('');
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!HAS_SUPABASE) { setLoading(false); return; }
    try {
      const data = await fetchApiKeys();
      setKeys(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!HAS_SUPABASE) return;
    const unsub = subscribeToApiKeys(({ eventType, key }) => {
      setKeys(prev => {
        if (eventType === 'INSERT') return [...prev, key];
        if (eventType === 'UPDATE') return prev.map(k => k.id === key.id ? { ...k, ...key } : k);
        if (eventType === 'DELETE') return prev.filter(k => k.id !== key.id);
        return prev;
      });
    });
    return unsub;
  }, []);

  const maskKey = (k: string) => {
    if (k.length <= 8) return '••••••••';
    return k.slice(0, 4) + '••••••••••••' + k.slice(-4);
  };

  const handleAdd = async () => {
    if (!addValue.trim()) return;
    setAdding(true);
    try {
      await addApiKey(addService, addValue.trim());
      setAddValue('');
      setShowAdd(false);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this key?')) return;
    setDeletingId(id);
    try {
      await deleteApiKey(id);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggle = async (key: ApiKey) => {
    try {
      await toggleApiKey(key.id, !key.is_active);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleReset = async (id: string) => {
    setResettingId(id);
    try {
      await resetKeyStatus(id);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setResettingId(null);
    }
  };

  const startEdit = (key: ApiKey) => {
    setEditingId(key.id);
    setEditValue(key.key_value);
  };

  const saveEdit = async () => {
    if (!editingId || !editValue.trim()) return;
    setSaving(true);
    try {
      await updateApiKeyValue(editingId, editValue.trim());
      setEditingId(null);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggleReveal = (id: string) => {
    setRevealedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalRequests = keys.reduce((s, k) => s + k.request_count, 0);
  const activeCount = keys.filter(k => k.is_active && k.status === 'active').length;
  const rateLimitedCount = keys.filter(k => k.status === 'rate_limited').length;

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
          <Key size={18} className="text-white/40" /> API Key Management
        </h2>
        {HAS_SUPABASE && (
          <button
            onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-sm font-medium transition-all"
          >
            <Plus size={16} /> Add Key
          </button>
        )}
      </div>

      {!loading && keys.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Requests', value: totalRequests.toLocaleString(), color: 'text-white' },
            { label: 'Active Keys', value: activeCount, color: 'text-green-400' },
            { label: 'Rate Limited', value: rateLimitedCount, color: rateLimitedCount > 0 ? 'text-yellow-400' : 'text-white/30' },
          ].map(s => (
            <div key={s.label} className="glass rounded-xl border border-white/5 p-4 text-center">
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-[10px] uppercase font-mono tracking-widest text-white/30 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass rounded-2xl border border-brand-primary/20 p-5 space-y-4">
              <h3 className="font-bold text-sm">Add New Key</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono tracking-widest text-white/40">Service / Field</label>
                  <select
                    value={addService}
                    onChange={e => setAddService(e.target.value as Service)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-brand-primary/50 appearance-none"
                  >
                    {ALL_SERVICES.map(s => (
                      <option key={s} value={s} className="bg-surface">{SERVICE_LABEL[s]}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono tracking-widest text-white/40">Value</label>
                  <input
                    type="password"
                    placeholder={addService === 'pollinations' ? 'Optional — leave empty for free tier' : 'Paste value here…'}
                    value={addValue}
                    onChange={e => setAddValue(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-brand-primary/50 font-mono"
                  />
                </div>
              </div>
              {addService === 'pollinations' && (
                <p className="text-[11px] text-green-400/70 bg-green-500/5 border border-green-500/10 rounded-xl px-4 py-3">
                  Pollinations AI works without any API key — it is used automatically as a free fallback when Cloudflare quota is exhausted. Only add a token if you have a premium Pollinations account.
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={adding || (!addValue.trim() && addService !== 'pollinations')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl tiktok-gradient text-sm font-bold disabled:opacity-50"
                >
                  {adding ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {adding ? 'Saving…' : 'Add Key'}
                </button>
                <button
                  onClick={() => { setShowAdd(false); setAddValue(''); }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-sm font-medium transition-all"
                >
                  <X size={14} /> Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="glass rounded-2xl border border-white/5 p-10 text-center text-white/20 text-sm flex items-center justify-center gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading keys…
        </div>
      ) : error ? (
        <div className="glass rounded-2xl border border-red-500/20 p-6 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      ) : (
        SERVICE_GROUPS.map(group => {
          const groupKeys = keys.filter(k => group.fields.some(f => f.service === k.service));
          const configuredCount = group.fields.filter(f => keys.some(k => k.service === f.service)).length;
          const isPollinations = group.fields.some(f => f.service === 'pollinations');

          return (
            <div key={group.label} className="glass rounded-2xl md:rounded-[32px] border border-white/5 overflow-hidden">
              <div className="px-5 md:px-8 py-4 md:py-5 border-b border-white/5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-bold text-sm md:text-base">{group.label}</h3>
                      {group.badge && (
                        <span className="text-[9px] font-mono uppercase tracking-widest text-green-400/80 border border-green-500/20 px-2 py-0.5 rounded-full bg-green-500/5">
                          {group.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/40 mt-0.5">{group.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isPollinations ? (
                      <span className="text-[10px] font-mono uppercase tracking-widest text-green-400/50">
                        always available
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono uppercase tracking-widest text-white/20">
                        {configuredCount}/{group.fields.length} configured
                      </span>
                    )}
                    {groupKeys.length > 1 && (
                      <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-brand-primary/60 border border-brand-primary/20 px-2 py-0.5 rounded-full">
                        <RefreshCw size={9} /> rotating
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 md:p-6 space-y-6">
                {group.fields.map(({ service, fieldLabel, placeholder }) => {
                  const fieldKeys = keys.filter(k => k.service === service);
                  const hasMultiple = fieldKeys.length > 1;
                  const isOptionalPollinations = service === 'pollinations';

                  return (
                    <div key={service} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] uppercase font-mono tracking-widest font-bold ${group.color}`}>
                            {fieldLabel}
                          </span>
                          {group.fields.length > 1 && (
                            <span className="text-[9px] font-mono text-white/20 uppercase tracking-widest border border-white/10 px-1.5 py-0.5 rounded-full">
                              {service === 'cloudflare_id' ? 'account_id' : 'api_token'}
                            </span>
                          )}
                          {hasMultiple && (
                            <span className="text-[9px] font-mono text-brand-primary/60 uppercase tracking-widest border border-brand-primary/15 px-1.5 py-0.5 rounded-full">
                              {fieldKeys.length} keys
                            </span>
                          )}
                        </div>
                        {HAS_SUPABASE && (
                          <button
                            onClick={() => { setAddService(service); setAddValue(''); setShowAdd(true); }}
                            className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/30 hover:text-white transition-all"
                          >
                            <Plus size={10} /> Add
                          </button>
                        )}
                      </div>

                      {fieldKeys.length === 0 ? (
                        <div className={`flex items-center gap-3 p-4 rounded-xl border border-dashed bg-white/[0.015] ${isOptionalPollinations ? 'border-green-500/20' : 'border-white/10'}`}>
                          {isOptionalPollinations ? (
                            <>
                              <Check size={14} className="text-green-400/50 shrink-0" />
                              <div className="flex-1">
                                <p className="text-xs text-green-400/60 font-mono">Free public API active — no key required</p>
                                <p className="text-[10px] text-white/20 mt-0.5">Automatically used as fallback when Cloudflare is unavailable</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <AlertCircle size={14} className="text-white/20 shrink-0" />
                              <p className="text-xs text-white/20 font-mono flex-1">Not configured</p>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {fieldKeys.map((key, keyIdx) => (
                            <motion.div
                              key={key.id}
                              layout
                              className={`bg-black/20 rounded-xl border overflow-hidden ${
                                key.status === 'rate_limited'
                                  ? 'border-yellow-500/20'
                                  : key.status === 'failed'
                                  ? 'border-red-500/20'
                                  : 'border-white/5'
                              }`}
                            >
                              {editingId === key.id ? (
                                <div className="p-4 space-y-3">
                                  <input
                                    type="text"
                                    value={editValue}
                                    onChange={e => setEditValue(e.target.value)}
                                    placeholder={placeholder}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm font-mono focus:outline-none focus:border-brand-primary/50"
                                  />
                                  <div className="flex gap-2">
                                    <button onClick={saveEdit} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg tiktok-gradient text-xs font-bold disabled:opacity-50">
                                      {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                      {saving ? 'Saving…' : 'Save'}
                                    </button>
                                    <button onClick={() => setEditingId(null)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium transition-all">
                                      <X size={12} /> Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                      <div className={`p-1.5 rounded-lg ${group.accentBg} ${group.color} shrink-0 mt-0.5`}>
                                        <Key size={13} />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                          <StatusBadge status={(key.status ?? 'active') as KeyStatus} />
                                          {hasMultiple && (
                                            <span className="text-[9px] font-mono text-white/20 uppercase">
                                              #{keyIdx + 1}
                                            </span>
                                          )}
                                          {!key.is_active && (
                                            <span className="text-[9px] font-mono text-white/20 uppercase border border-white/10 px-1.5 py-0.5 rounded-full">disabled</span>
                                          )}
                                        </div>
                                        <p className="text-xs md:text-sm font-mono tracking-tight truncate text-white/70">
                                          {revealedIds.has(key.id) ? key.key_value : maskKey(key.key_value)}
                                        </p>
                                        <div className="flex items-center gap-4 mt-2 flex-wrap">
                                          <div className="flex items-center gap-1.5 text-[10px] text-white/30">
                                            <Activity size={10} />
                                            <span>{key.request_count.toLocaleString()} reqs</span>
                                          </div>
                                          <div className="flex items-center gap-1.5 text-[10px] text-white/30">
                                            <TrendingUp size={10} />
                                            <span>{successRate(key)} success</span>
                                          </div>
                                          <div className="flex items-center gap-1.5 text-[10px] text-white/30">
                                            <Clock size={10} />
                                            <span>{timeAgo(key.last_used_at)}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        onClick={() => toggleReveal(key.id)}
                                        className="p-2 rounded-lg hover:bg-white/5 text-white/30 hover:text-white transition-all"
                                        title={revealedIds.has(key.id) ? 'Hide' : 'Reveal'}
                                      >
                                        {revealedIds.has(key.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                                      </button>
                                      <button
                                        onClick={() => startEdit(key)}
                                        className="p-2 rounded-lg hover:bg-white/5 text-white/30 hover:text-white transition-all"
                                        title="Edit value"
                                      >
                                        <Key size={14} />
                                      </button>
                                      {key.status !== 'active' && (
                                        <button
                                          onClick={() => handleReset(key.id)}
                                          disabled={resettingId === key.id}
                                          className="p-2 rounded-lg hover:bg-white/5 text-yellow-400/60 hover:text-yellow-400 transition-all"
                                          title="Reset status to active"
                                        >
                                          {resettingId === key.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleToggle(key)}
                                        className={`p-2 rounded-lg hover:bg-white/5 transition-all ${key.is_active ? 'text-green-400/60 hover:text-green-400' : 'text-white/20 hover:text-white'}`}
                                        title={key.is_active ? 'Disable key' : 'Enable key'}
                                      >
                                        {key.is_active ? <Check size={14} /> : <X size={14} />}
                                      </button>
                                      <button
                                        onClick={() => handleDelete(key.id)}
                                        disabled={deletingId === key.id}
                                        className="p-2 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all"
                                        title="Delete key"
                                      >
                                        {deletingId === key.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
