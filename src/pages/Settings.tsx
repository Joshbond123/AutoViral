import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Key, Trash2, Plus, Eye, EyeOff, Check, X,
  AlertCircle, Database, Loader2, RefreshCw,
  Activity, Clock, TrendingUp, Shield, Image,
  Globe, MessageSquare, ListChecks, Pencil, Info,
} from 'lucide-react';
import { ApiKey, FacebookSettings, AgentInstruction } from '../types';
import {
  fetchApiKeys, addApiKey, deleteApiKey, toggleApiKey,
  updateApiKeyValue, resetKeyStatus, subscribeToApiKeys,
  fetchFacebookSettings, addFacebookSetting, deleteFacebookSetting,
  updateFacebookSetting, testFacebookToken,
  fetchAgentInstructions, addAgentInstruction, deleteAgentInstruction, updateAgentInstruction,
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
  const userId = typeof window !== 'undefined' ? localStorage.getItem('tiktok_user_id') || '' : '';

  return (
    <div className="max-w-3xl">
      <div className="mb-8 md:mb-12">
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight mb-2">Platform Settings</h1>
        <p className="text-white/40 text-sm md:text-base">Manage API credentials, Facebook integration, and auto-publishing settings.</p>
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
        {userId && <FacebookManager userId={userId} />}
        {userId && <AgentInstructionsManager userId={userId} />}
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

// ─── Facebook Integration Manager ─────────────────────────────────────────────

function FacebookManager({ userId }: { userId: string }) {
  const [settings, setSettings] = useState<FacebookSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [newToken, setNewToken] = useState('');
  const [showNewTokenInput, setShowNewTokenInput] = useState(false);
  const [showNewTokenText, setShowNewTokenText] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editToken, setEditToken] = useState('');
  const [showEditToken, setShowEditToken] = useState<Record<string, boolean>>({});
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!HAS_SUPABASE) { setLoading(false); return; }
    try {
      const data = await fetchFacebookSettings(userId);
      setSettings(data);
    } catch (e: any) {
      setAddError(e.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!newToken.trim()) { setAddError('Page Access Token is required.'); return; }
    setAdding(true);
    setAddError(null);
    try {
      const created = await addFacebookSetting(userId, newToken);
      setSettings(prev => [...prev, created]);
      setNewToken('');
      setShowNewTokenInput(false);
    } catch (e: any) {
      setAddError(e.message);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this Facebook Page token?')) return;
    setDeletingId(id);
    try {
      await deleteFacebookSetting(id);
      setSettings(prev => prev.filter(s => s.id !== id));
    } catch (e: any) {
      setAddError(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    setTestResults(prev => ({ ...prev, [id]: { ok: false, msg: 'Testing…' } }));
    try {
      const result = await testFacebookToken(id);
      setTestResults(prev => ({
        ...prev,
        [id]: { ok: result.ok, msg: result.ok ? `✓ Valid — ${result.pageName}` : `✗ ${result.error ?? 'Invalid token'}` },
      }));
      if (result.ok) {
        setSettings(prev => prev.map(s => s.id === id ? { ...s, status: 'active', page_name: result.pageName ?? s.page_name } : s));
      } else {
        setSettings(prev => prev.map(s => s.id === id ? { ...s, status: 'failed' } : s));
      }
    } catch (e: any) {
      setTestResults(prev => ({ ...prev, [id]: { ok: false, msg: `✗ ${e.message}` } }));
    } finally {
      setTestingId(null);
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (!editToken.trim()) { setEditingId(null); return; }
    setSavingEditId(id);
    try {
      await updateFacebookSetting(id, editToken);
      setSettings(prev => prev.map(s => s.id === id ? { ...s, page_access_token: editToken, status: 'active' } : s));
      setEditingId(null);
      setEditToken('');
    } catch (e: any) {
      setAddError(e.message);
    } finally {
      setSavingEditId(null);
    }
  };

  return (
    <div className="glass rounded-2xl md:rounded-[32px] border border-white/5 overflow-hidden">
      <div className="px-5 md:px-8 py-4 md:py-5 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-500 shrink-0">
              <Globe size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm md:text-base">Facebook Integration</h3>
                {settings.some(s => s.is_active && s.status === 'active') && (
                  <span className="text-[9px] font-mono uppercase tracking-widest text-green-400/80 border border-green-500/20 px-2 py-0.5 rounded-full bg-green-500/5">
                    Connected
                  </span>
                )}
              </div>
              <p className="text-xs text-white/40 mt-0.5">Auto-publish generated videos to your Facebook Page</p>
            </div>
          </div>
          <button
            onClick={() => { setShowNewTokenInput(v => !v); setAddError(null); setNewToken(''); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary text-xs font-bold transition-all"
          >
            {showNewTokenInput ? <X size={13} /> : <Plus size={13} />}
            {showNewTokenInput ? 'Cancel' : 'Add Page'}
          </button>
        </div>
      </div>

      <div className="p-5 md:p-8 space-y-5">
        {/* Info banner */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-600/5 border border-blue-500/15">
          <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-white/50 leading-relaxed space-y-1">
            <p><strong className="text-blue-400">How to get a Page Access Token:</strong></p>
            <p>1. Go to <a href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noopener" className="text-blue-400 underline underline-offset-2">Meta Graph API Explorer</a> → select your app.</p>
            <p>2. Click <strong>Generate Access Token</strong> → select your Page from the dropdown.</p>
            <p>3. Request: <code className="bg-white/10 px-1 rounded font-mono text-[10px]">pages_manage_posts</code> + <code className="bg-white/10 px-1 rounded font-mono text-[10px]">pages_read_engagement</code>.</p>
            <p>4. For a long-lived token, use the <a href="https://developers.facebook.com/docs/facebook-login/access-tokens/refreshing" target="_blank" rel="noopener" className="text-blue-400 underline underline-offset-2">token exchange endpoint</a>.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-white/20 text-sm">
            <Loader2 size={16} className="animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {/* Add token form */}
            <AnimatePresence>
              {showNewTokenInput && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/5">
                    <label className="text-[10px] uppercase font-mono tracking-widest text-white/40">
                      Facebook Page Access Token
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <input
                          type={showNewTokenText ? 'text' : 'password'}
                          value={newToken}
                          onChange={e => setNewToken(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setShowNewTokenInput(false); setNewToken(''); } }}
                          placeholder="EAAxxxxxxxxxxxxx..."
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-4 pr-10 text-xs focus:outline-none focus:border-blue-500/50 font-mono transition-all"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewTokenText(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-all"
                        >
                          {showNewTokenText ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      </div>
                      <button
                        onClick={handleAdd}
                        disabled={adding}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-bold transition-all hover:bg-brand-primary/90 disabled:opacity-50 whitespace-nowrap"
                      >
                        {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                        {adding ? 'Verifying…' : 'Add Page'}
                      </button>
                    </div>
                    {addError && (
                      <p className="flex items-center gap-1.5 text-red-400 text-xs">
                        <AlertCircle size={11} /> {addError}
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {settings.length === 0 && !showNewTokenInput ? (
              <div className="py-10 text-center border border-dashed border-white/5 rounded-2xl">
                <Globe className="mx-auto text-white/10 mb-3" size={32} />
                <p className="text-white/20 text-xs uppercase font-mono tracking-widest">No pages connected</p>
                <p className="text-white/20 text-xs mt-1 px-4">Add a Facebook Page Access Token to enable auto-publishing.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {settings.map(s => (
                  <motion.div
                    key={s.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-white/5 overflow-hidden"
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        s.status === 'active' ? 'bg-blue-600/10 text-blue-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                        <Globe size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold truncate">
                            {s.page_name || 'Unknown Page'}
                          </span>
                          {s.page_id && (
                            <span className="text-[9px] font-mono text-white/25">ID: {s.page_id}</span>
                          )}
                          <span className={`text-[9px] px-2 py-0.5 rounded-full border font-mono uppercase tracking-widest ${
                            s.status === 'active'
                              ? 'bg-green-500/10 text-green-400 border-green-500/20'
                              : 'bg-red-500/10 text-red-400 border-red-500/20'
                          }`}>
                            {s.status}
                          </span>
                        </div>
                        <div className="text-[10px] text-white/20 font-mono mt-0.5 truncate">
                          {s.page_access_token.slice(0, 24)}…
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleTest(s.id)}
                          disabled={testingId === s.id}
                          title="Test token validity"
                          className="p-1.5 rounded-lg hover:bg-white/10 text-white/20 hover:text-brand-secondary transition-all disabled:opacity-30"
                        >
                          {testingId === s.id ? <Loader2 size={12} className="animate-spin" /> : <Activity size={12} />}
                        </button>
                        <button
                          onClick={() => {
                            if (editingId === s.id) { setEditingId(null); setEditToken(''); }
                            else { setEditingId(s.id); setEditToken(''); }
                          }}
                          className={`p-1.5 rounded-lg transition-all ${editingId === s.id ? 'text-white/40 bg-white/5' : 'text-white/20 hover:text-white hover:bg-white/10'}`}
                        >
                          {editingId === s.id ? <X size={12} /> : <Pencil size={12} />}
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          disabled={deletingId === s.id}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all disabled:opacity-30"
                        >
                          {deletingId === s.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        </button>
                      </div>
                    </div>

                    {/* Test result */}
                    {testResults[s.id] && (
                      <div className={`px-4 py-2 text-[11px] font-mono border-t border-white/5 ${
                        testResults[s.id].ok ? 'text-green-400 bg-green-500/5' : 'text-red-400 bg-red-500/5'
                      }`}>
                        {testResults[s.id].msg}
                      </div>
                    )}

                    {/* Edit token form */}
                    <AnimatePresence>
                      {editingId === s.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden border-t border-white/5 bg-white/[0.02]"
                        >
                          <div className="flex items-center gap-2 p-4">
                            <div className="flex-1 relative">
                              <input
                                type={showEditToken[s.id] ? 'text' : 'password'}
                                value={editToken}
                                onChange={e => setEditToken(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(s.id); if (e.key === 'Escape') { setEditingId(null); setEditToken(''); } }}
                                placeholder="Paste new Page Access Token…"
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-4 pr-10 text-xs focus:outline-none focus:border-brand-primary/50 font-mono transition-all"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => setShowEditToken(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-all"
                              >
                                {showEditToken[s.id] ? <EyeOff size={11} /> : <Eye size={11} />}
                              </button>
                            </div>
                            <button
                              onClick={() => handleSaveEdit(s.id)}
                              disabled={savingEditId === s.id || !editToken.trim()}
                              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold disabled:opacity-50 transition-all"
                            >
                              {savingEditId === s.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                              Save
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            )}

            {addError && !showNewTokenInput && (
              <p className="flex items-center gap-1.5 text-red-400 text-xs px-1">
                <AlertCircle size={11} /> {addError}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Agent Instructions Manager ────────────────────────────────────────────────

function AgentInstructionsManager({ userId }: { userId: string }) {
  const [instructions, setInstructions] = useState<AgentInstruction[]>([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!HAS_SUPABASE) { setLoading(false); return; }
    try {
      const data = await fetchAgentInstructions(userId);
      setInstructions(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!newText.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const ins = await addAgentInstruction(userId, newText.trim());
      setInstructions(prev => [...prev, ins]);
      setNewText('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  };

  const handleStartEdit = (ins: AgentInstruction) => {
    setEditingId(ins.id);
    setEditText(ins.instruction);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editText.trim()) return;
    setSavingEdit(true);
    try {
      await updateAgentInstruction(editingId, editText.trim());
      setInstructions(prev => prev.map(i => i.id === editingId ? { ...i, instruction: editText.trim() } : i));
      setEditingId(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this instruction?')) return;
    setDeletingId(id);
    try {
      await deleteAgentInstruction(id);
      setInstructions(prev => prev.filter(i => i.id !== id));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="glass rounded-2xl md:rounded-[32px] border border-white/5 overflow-hidden">
      <div className="px-5 md:px-8 py-4 md:py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-secondary/10 flex items-center justify-center text-brand-secondary shrink-0">
            <ListChecks size={18} />
          </div>
          <div>
            <h3 className="font-bold text-sm md:text-base">Agent Instructions</h3>
            <p className="text-xs text-white/40 mt-0.5">Custom instructions appended to the video description on every Facebook publish.</p>
          </div>
          <span className="ml-auto text-[10px] font-mono uppercase tracking-widest text-white/20">
            {instructions.length} instruction{instructions.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="p-5 md:p-8 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-white/20 text-sm">
            <Loader2 size={16} className="animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {instructions.length === 0 && (
              <div className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-white/10 bg-white/[0.015]">
                <MessageSquare size={14} className="text-white/20 shrink-0" />
                <p className="text-xs text-white/30 font-mono">No instructions yet — add one below to have it sent with every video delivery.</p>
              </div>
            )}

            <AnimatePresence>
              {instructions.map((ins) => (
                <motion.div
                  key={ins.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.025] border border-white/5 group"
                >
                  <MessageSquare size={13} className="text-brand-secondary/60 shrink-0 mt-0.5" />
                  {editingId === ins.id ? (
                    <div className="flex-1 space-y-2">
                      <textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        rows={3}
                        autoFocus
                        className="w-full bg-white/5 border border-white/15 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-brand-secondary/50 resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveEdit}
                          disabled={savingEdit}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-secondary/20 hover:bg-brand-secondary/30 text-brand-secondary text-xs font-medium transition-all disabled:opacity-50"
                        >
                          {savingEdit ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 text-xs font-medium transition-all"
                        >
                          <X size={11} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="flex-1 text-sm text-white/80 leading-relaxed">{ins.instruction}</p>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                        <button
                          onClick={() => handleStartEdit(ins)}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white transition-all"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(ins.id)}
                          disabled={deletingId === ins.id}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-all disabled:opacity-30"
                        >
                          {deletingId === ins.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            <div className="space-y-2">
              <textarea
                value={newText}
                onChange={e => setNewText(e.target.value)}
                placeholder="Add a new instruction… e.g. 'Always respond in English' or 'Tag this as urgent if views exceed 10k'"
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-brand-secondary/50 resize-none transition-all"
                onKeyDown={e => {
                  if (e.key === 'Enter' && e.metaKey) { e.preventDefault(); handleAdd(); }
                }}
              />
              {error && (
                <p className="flex items-center gap-2 text-red-400 text-xs">
                  <AlertCircle size={12} /> {error}
                </p>
              )}
              <button
                onClick={handleAdd}
                disabled={adding || !newText.trim()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-secondary/20 hover:bg-brand-secondary/30 text-brand-secondary text-sm font-medium transition-all disabled:opacity-40"
              >
                {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {adding ? 'Adding…' : 'Add Instruction'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── API Key Manager ───────────────────────────────────────────────────────────

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
                              className={`rounded-xl border overflow-hidden ${
                                !key.is_active ? 'opacity-50 border-white/5' :
                                key.status === 'failed' ? 'border-red-500/20 bg-red-500/5' :
                                key.status === 'rate_limited' ? 'border-yellow-500/20 bg-yellow-500/5' :
                                'border-white/5'
                              }`}
                            >
                              <div className="flex items-center gap-3 px-4 py-3">
                                <span className="text-[10px] font-mono text-white/20 w-4 shrink-0">#{keyIdx + 1}</span>

                                {editingId === key.id ? (
                                  <input
                                    type="text"
                                    value={editValue}
                                    onChange={e => setEditValue(e.target.value)}
                                    autoFocus
                                    className="flex-1 bg-transparent border-b border-brand-primary/40 text-xs font-mono focus:outline-none py-0.5 min-w-0"
                                  />
                                ) : (
                                  <span className="flex-1 text-xs font-mono text-white/60 truncate min-w-0">
                                    {revealedIds.has(key.id) ? key.key_value : maskKey(key.key_value)}
                                  </span>
                                )}

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <StatusBadge status={key.status} />

                                  {editingId === key.id ? (
                                    <>
                                      <button onClick={saveEdit} disabled={saving}
                                        className="p-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-all disabled:opacity-50">
                                        {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                      </button>
                                      <button onClick={() => setEditingId(null)}
                                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white transition-all">
                                        <X size={12} />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button onClick={() => toggleReveal(key.id)}
                                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/20 hover:text-white transition-all">
                                        {revealedIds.has(key.id) ? <EyeOff size={12} /> : <Eye size={12} />}
                                      </button>
                                      <button onClick={() => startEdit(key)}
                                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/20 hover:text-white transition-all">
                                        <Pencil size={12} />
                                      </button>
                                      {key.status !== 'active' && (
                                        <button onClick={() => handleReset(key.id)} disabled={resettingId === key.id}
                                          className="p-1.5 rounded-lg hover:bg-white/10 text-white/20 hover:text-white transition-all disabled:opacity-30">
                                          {resettingId === key.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                        </button>
                                      )}
                                      <button onClick={() => handleToggle(key)}
                                        className={`p-1.5 rounded-lg transition-all text-xs font-mono ${key.is_active ? 'text-green-400/50 hover:text-yellow-400' : 'text-white/20 hover:text-green-400'}`}>
                                        {key.is_active ? '●' : '○'}
                                      </button>
                                      <button onClick={() => handleDelete(key.id)} disabled={deletingId === key.id}
                                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all disabled:opacity-30">
                                        {deletingId === key.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-4 px-4 py-2 bg-white/[0.02] border-t border-white/5">
                                {[
                                  { icon: Activity, label: 'Requests', value: key.request_count.toLocaleString() },
                                  { icon: TrendingUp, label: 'Success rate', value: successRate(key) },
                                  { icon: Clock, label: 'Last used', value: timeAgo(key.last_used_at) },
                                ].map(({ icon: Icon, label, value }) => (
                                  <div key={label} className="flex items-center gap-1.5">
                                    <Icon size={10} className="text-white/20" />
                                    <span className="text-[10px] font-mono text-white/20">{label}:</span>
                                    <span className="text-[10px] font-mono text-white/40">{value}</span>
                                  </div>
                                ))}
                              </div>
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
