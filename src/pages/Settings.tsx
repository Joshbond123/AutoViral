import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Key, Trash2, Plus, Eye, EyeOff, Check, X, AlertCircle, Database, Loader2 } from 'lucide-react';
import { ApiKey } from '../types';
import { fetchApiKeys, addApiKey, deleteApiKey, toggleApiKey, updateApiKeyValue } from '../lib/api';
import { HAS_SUPABASE } from '../lib/supabase';

type Service = ApiKey['service'];

interface ServiceGroup {
  label: string;
  description: string;
  color: string;
  fields: { service: Service; fieldLabel: string; placeholder: string }[];
}

const SERVICE_GROUPS: ServiceGroup[] = [
  {
    label: 'Cerebras API',
    description: 'Used for generating high-retention TikTok scripts.',
    color: 'text-purple-400',
    fields: [
      { service: 'cerebras', fieldLabel: 'API Key', placeholder: 'csk-••••••••' },
    ],
  },
  {
    label: 'Cloudflare Workers AI',
    description: 'Generates scene visuals. Both Account ID and API Token are required.',
    color: 'text-orange-400',
    fields: [
      { service: 'cloudflare_id', fieldLabel: 'Account ID', placeholder: 'a1b2c3d4e5f6g7h8…' },
      { service: 'cloudflare', fieldLabel: 'API Token', placeholder: 'Bearer ••••••••' },
    ],
  },
  {
    label: 'UnrealSpeech API',
    description: 'Provides the voiceover for all video content.',
    color: 'text-brand-secondary',
    fields: [
      { service: 'unrealspeech', fieldLabel: 'API Key', placeholder: 'sk-••••••••' },
    ],
  },
];

const ALL_SERVICES: Service[] = ['cerebras', 'cloudflare_id', 'cloudflare', 'unrealspeech'];

const SERVICE_LABEL: Record<Service, string> = {
  cerebras: 'Cerebras — API Key',
  cloudflare_id: 'Cloudflare — Account ID',
  cloudflare: 'Cloudflare — API Token',
  unrealspeech: 'UnrealSpeech — API Key',
};

export default function Settings() {
  return (
    <div className="max-w-3xl">
      <div className="mb-8 md:mb-12">
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight mb-2">Platform Settings</h1>
        <p className="text-white/40 text-sm md:text-base">Manage your API credentials and automation keys.</p>
      </div>

      <div className="space-y-6 md:space-y-8">
        {!HAS_SUPABASE && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-sm"
          >
            <AlertCircle size={18} className="shrink-0" />
            <p>
              Supabase is not configured. Set{' '}
              <code className="font-mono text-xs bg-yellow-500/10 px-1 rounded">VITE_SUPABASE_URL</code> and{' '}
              <code className="font-mono text-xs bg-yellow-500/10 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> to enable API key management.
            </p>
          </motion.div>
        )}

        <ConnectionStatus />
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
          <p className="text-xs md:text-sm text-white/40">Real-time database and OAuth token storage.</p>
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

  const load = async () => {
    if (!HAS_SUPABASE) { setLoading(false); return; }
    try {
      const data = await fetchApiKeys();
      setKeys(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const maskKey = (k: string) => {
    if (k.length <= 8) return '••••••••';
    return k.slice(0, 4) + '••••••••••••' + k.slice(-4);
  };

  const handleAdd = async () => {
    if (!addValue.trim()) return;
    setAdding(true);
    try {
      const newKey = await addApiKey(addService, addValue.trim());
      setKeys(prev => [...prev, newKey]);
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
      setKeys(prev => prev.filter(k => k.id !== id));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggle = async (key: ApiKey) => {
    try {
      await toggleApiKey(key.id, !key.is_active);
      setKeys(prev => prev.map(k => k.id === key.id ? { ...k, is_active: !k.is_active } : k));
    } catch (e) {
      alert((e as Error).message);
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
      setKeys(prev => prev.map(k => k.id === editingId ? { ...k, key_value: editValue.trim() } : k));
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
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

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

      {/* Add key panel */}
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
                    placeholder="Paste value here…"
                    value={addValue}
                    onChange={e => setAddValue(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-brand-primary/50 font-mono"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={adding || !addValue.trim()}
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
          return (
            <div key={group.label} className="glass rounded-2xl md:rounded-[32px] border border-white/5 overflow-hidden">
              {/* Group header */}
              <div className="px-5 md:px-8 py-4 md:py-5 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-sm md:text-base">{group.label}</h3>
                  <p className="text-xs text-white/40 mt-0.5">{group.description}</p>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-white/20 shrink-0">
                  {groupKeys.length}/{group.fields.length} configured
                </span>
              </div>

              <div className="p-4 md:p-6 space-y-5">
                {group.fields.map(({ service, fieldLabel, placeholder }) => {
                  const fieldKeys = keys.filter(k => k.service === service);

                  return (
                    <div key={service} className="space-y-2">
                      {/* Field label row */}
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] uppercase font-mono tracking-widest font-bold ${group.color}`}>
                          {fieldLabel}
                        </span>
                        {group.fields.length > 1 && (
                          <span className="text-[9px] font-mono text-white/20 uppercase tracking-widest border border-white/10 px-1.5 py-0.5 rounded-full">
                            {service === 'cloudflare_id' ? 'account_id' : 'api_token'}
                          </span>
                        )}
                      </div>

                      {fieldKeys.length === 0 ? (
                        /* Empty state with inline "Add" shortcut */
                        <div className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-white/10 bg-white/[0.015]">
                          <AlertCircle size={14} className="text-white/20 shrink-0" />
                          <p className="text-xs text-white/20 font-mono flex-1">Not configured</p>
                          {HAS_SUPABASE && (
                            <button
                              onClick={() => { setAddService(service); setAddValue(''); setShowAdd(true); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium transition-all text-white/50 hover:text-white"
                            >
                              <Plus size={12} /> Add
                            </button>
                          )}
                        </div>
                      ) : (
                        fieldKeys.map(key => (
                          <div key={key.id} className="bg-black/20 rounded-xl border border-white/5 p-4">
                            {editingId === key.id ? (
                              <div className="space-y-3">
                                <input
                                  type="text"
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  placeholder={placeholder}
                                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm font-mono focus:outline-none focus:border-brand-primary/50"
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={saveEdit}
                                    disabled={saving}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg tiktok-gradient text-xs font-bold disabled:opacity-50"
                                  >
                                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                    {saving ? 'Saving…' : 'Save'}
                                  </button>
                                  <button
                                    onClick={() => setEditingId(null)}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium transition-all"
                                  >
                                    <X size={12} /> Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={`p-1.5 rounded-lg bg-white/5 ${group.color} shrink-0`}>
                                    <Key size={14} />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs md:text-sm font-mono tracking-tight truncate">
                                      {revealedIds.has(key.id) ? key.key_value : maskKey(key.key_value)}
                                    </p>
                                    <div className="flex items-center gap-3 mt-0.5">
                                      <span className={`text-[10px] uppercase font-mono ${key.is_active ? 'text-green-500/60' : 'text-white/20'}`}>
                                        {key.is_active ? 'Active' : 'Inactive'}
                                      </span>
                                      {key.request_count > 0 && (
                                        <span className="text-[10px] text-white/20 font-mono">
                                          {key.request_count} requests
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    onClick={() => toggleReveal(key.id)}
                                    className="p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white transition-all"
                                    title={revealedIds.has(key.id) ? 'Hide' : 'Reveal'}
                                  >
                                    {revealedIds.has(key.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                                  </button>
                                  <button
                                    onClick={() => startEdit(key)}
                                    className="p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white transition-all"
                                    title="Edit"
                                  >
                                    <Key size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleToggle(key)}
                                    className={`p-1.5 rounded-lg transition-all ${key.is_active ? 'hover:bg-yellow-500/10 text-yellow-500/50 hover:text-yellow-400' : 'hover:bg-green-500/10 text-green-500/50 hover:text-green-400'}`}
                                    title={key.is_active ? 'Deactivate' : 'Activate'}
                                  >
                                    {key.is_active ? <X size={14} /> : <Check size={14} />}
                                  </button>
                                  <button
                                    onClick={() => handleDelete(key.id)}
                                    disabled={deletingId === key.id}
                                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all disabled:opacity-50"
                                    title="Delete"
                                  >
                                    {deletingId === key.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))
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
