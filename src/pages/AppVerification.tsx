import { useState } from 'react';
  import { motion } from 'motion/react';
  import { Copy, Check, ExternalLink, Shield, FileText, Trash2, Home, AlertCircle } from 'lucide-react';

  const APP_DOMAIN = 'https://autoviral.run.place';

  interface UrlCardProps {
    label: string;
    description: string;
    url: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    color: string;
    badge?: string;
  }

  function UrlCard({ label, description, url, icon: Icon, color, badge }: UrlCardProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        // Fallback for older browsers
        const el = document.createElement('textarea');
        el.value = url;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-all"
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl bg-white/5 ${color}`}>
              <Icon size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">{label}</span>
                {badge && (
                  <span className="text-[10px] font-mono uppercase tracking-widest bg-brand-primary/10 text-brand-primary border border-brand-primary/20 px-2 py-0.5 rounded-full">
                    {badge}
                  </span>
                )}
              </div>
              <p className="text-sm text-white/40 mt-0.5">{description}</p>
            </div>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all flex-shrink-0"
            title="Open in new tab"
          >
            <ExternalLink size={16} />
          </a>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 bg-bg-dark border border-white/5 rounded-xl px-4 py-3">
            <span className="text-sm font-mono text-white/60 break-all">{url}</span>
          </div>
          <motion.button
            onClick={handleCopy}
            whileTap={{ scale: 0.92 }}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
              copied
                ? 'bg-green-500/15 text-green-400 border border-green-500/25'
                : 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20 hover:bg-brand-primary/20'
            }`}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? 'Copied!' : 'Copy'}
          </motion.button>
        </div>
      </motion.div>
    );
  }

  const VERIFICATION_URLS: UrlCardProps[] = [
    {
      label: 'Home / Landing Page',
      description: 'Main application homepage — required as the app URL in Facebook App Review',
      url: APP_DOMAIN + '/',
      icon: Home,
      color: 'text-blue-400',
      badge: 'App URL',
    },
    {
      label: 'Privacy Policy',
      description: 'Full privacy policy covering data collection, usage, Facebook data, and your rights',
      url: APP_DOMAIN + '/privacy',
      icon: Shield,
      color: 'text-purple-400',
      badge: 'Required',
    },
    {
      label: 'Terms of Service',
      description: 'Terms governing use of AutoViral, content policies, and platform compliance',
      url: APP_DOMAIN + '/terms',
      icon: FileText,
      color: 'text-cyan-400',
      badge: 'Required',
    },
    {
      label: 'Data Deletion Instructions',
      description: 'Instructions for users to request deletion of their data, including Facebook data',
      url: APP_DOMAIN + '/data-deletion',
      icon: Trash2,
      color: 'text-orange-400',
      badge: 'Required',
    },
  ];

  export default function AppVerification() {
    const [allCopied, setAllCopied] = useState(false);

    const copyAll = async () => {
      const allUrls = VERIFICATION_URLS.map(u => `${u.label}: ${u.url}`).join('\n');
      try {
        await navigator.clipboard.writeText(allUrls);
      } catch {
        const el = document.createElement('textarea');
        el.value = allUrls;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setAllCopied(true);
      setTimeout(() => setAllCopied(false), 2500);
    };

    return (
      <div className="flex-1 md:ml-64 p-6 md:p-10 max-w-3xl">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={18} className="text-brand-primary" />
            <span className="text-xs font-mono uppercase tracking-widest text-white/30">Settings · Verification</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">App Verification</h1>
          <p className="text-white/50 text-base leading-relaxed">
            All URLs required for Facebook App Review. Each page is publicly accessible, mobile-friendly,
            and compliant with Facebook's platform policies.
          </p>
        </motion.div>

        {/* Info banner */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex items-start gap-3 bg-blue-500/5 border border-blue-500/15 rounded-2xl p-5 mb-8"
        >
          <AlertCircle size={18} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-white/60 leading-relaxed">
            <strong className="text-white">How to use:</strong> Copy each URL below and paste it into the corresponding
            field in your Facebook App Dashboard under <em>Settings → Basic</em>. All pages are live and publicly
            accessible at the domain <span className="font-mono text-white/80">{APP_DOMAIN}</span>.
          </div>
        </motion.div>

        {/* URL Cards */}
        <div className="space-y-4 mb-8">
          {VERIFICATION_URLS.map((item, i) => (
            <motion.div
              key={item.url}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i + 0.15 }}
            >
              <UrlCard {...item} />
            </motion.div>
          ))}
        </div>

        {/* Copy all button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex justify-end"
        >
          <motion.button
            onClick={copyAll}
            whileTap={{ scale: 0.95 }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
              allCopied
                ? 'bg-green-500/15 text-green-400 border border-green-500/25'
                : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white'
            }`}
          >
            {allCopied ? <Check size={15} /> : <Copy size={15} />}
            {allCopied ? 'All URLs copied!' : 'Copy all URLs'}
          </motion.button>
        </motion.div>
      </div>
    );
  }
  