import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Key, RotateCcw, Trash2, Plus, Info, Globe, Github, Database } from 'lucide-react';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'api' | 'github' | 'supabase'>('api');

  return (
    <div className="max-w-5xl">
      <div className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Platform Settings</h1>
        <p className="text-white/40">Manage your credentials, automation tokens, and API key rotation.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-8">
        {[
          { id: 'api', label: 'API Key Management', icon: Key },
          { id: 'github', label: 'GitHub Automation', icon: Github },
          { id: 'supabase', label: 'Database & Sync', icon: Database },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl transition-all font-medium text-sm ${
              activeTab === tab.id 
                ? 'bg-white/10 text-white border border-white/10' 
                : 'text-white/40 hover:text-white'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-8">
        {activeTab === 'api' && <ApiSettings />}
        {activeTab === 'github' && <GithubSettings />}
        {activeTab === 'supabase' && <SupabaseSettings />}
      </div>
    </div>
  );
}

function ApiSettings() {
  return (
    <div className="space-y-8">
      <CredentialSection 
        title="Cerebras API Keys" 
        description="Used for generating high-retention TikTok scripts. Keys are rotated automatically."
        service="cerebras"
      />
      <CredentialSection 
        title="Cloudflare Workers AI" 
        description="Generates scene visuals for each video. Requires Account ID and API Token."
        service="cloudflare"
      />
      <CredentialSection 
        title="UnrealSpeech API" 
        description="Provides the viral energetic male voiceover for all content."
        service="unrealspeech"
      />
    </div>
  );
}

function CredentialSection({ title, description, service }: { title: string, description: string, service: string }) {
  return (
    <div className="glass rounded-[32px] border border-white/5 overflow-hidden">
      <div className="p-8 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold mb-1">{title}</h3>
          <p className="text-sm text-white/40">{description}</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-sm font-medium">
          <Plus size={16} /> Add New Key
        </button>
      </div>
      <div className="p-8 space-y-4">
        <div className="bg-black/20 rounded-2xl border border-white/5 p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-lg bg-green-500/10 text-green-500">
              <Key size={16} />
            </div>
            <div>
              <p className="text-sm font-mono tracking-tight">************************A4F2</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] text-white/20 uppercase font-mono">Used: 142 times</span>
                <span className="text-[10px] text-green-500/50 uppercase font-mono">Status: Active</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-white/20 hover:text-white transition-all"><RotateCcw size={14} /></button>
            <button className="p-2 text-white/20 hover:text-red-500 transition-all"><Trash2 size={14} /></button>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/20 ml-2">
          <Info size={12} />
          <p>Continuous rotation enabled. Failover will shift to next valid key automatically.</p>
        </div>
      </div>
    </div>
  );
}

function GithubSettings() {
  const [token, setToken] = useState('****************************************');
  return (
    <div className="glass rounded-[32px] p-8 border border-white/5 space-y-8">
      <div>
        <h3 className="text-xl font-bold mb-1">GitHub Personal Access Token</h3>
        <p className="text-sm text-white/40">Required to trigger GitHub Actions and render videos via Remotion.</p>
      </div>
      <div className="space-y-4 max-w-2xl">
        <div className="space-y-2">
          <label className="text-[10px] uppercase font-mono tracking-widest text-white/40 ml-1">PAT Token (repo & workflow scope)</label>
          <input 
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-6 focus:outline-none focus:border-brand-primary/50 transition-all font-mono text-sm"
          />
        </div>
        <button className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-sm font-medium border border-white/5">
          Save Token
        </button>
      </div>
    </div>
  );
}

function SupabaseSettings() {
  return (
    <div className="glass rounded-[32px] p-8 border border-white/5 space-y-8">
      <div className="flex items-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-500 border border-green-500/10">
          <Database size={32} />
        </div>
        <div>
          <h3 className="text-xl font-bold mb-1">Supabase Infrastructure</h3>
          <p className="text-sm text-white/40">Real-time database and OAuth token storage is connected.</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-[10px] uppercase font-mono tracking-widest opacity-40">Healthy / 12ms Latency</span>
          </div>
        </div>
      </div>
    </div>
  );
}
