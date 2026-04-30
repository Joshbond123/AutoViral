import React, { useState, useRef } from 'react';
  import { motion, AnimatePresence } from 'motion/react';
  import { Calendar, Clock, Zap, Shield, Wand2, CheckCircle, ChevronRight, Upload, Film, AlertTriangle } from 'lucide-react';
  import { useNavigate } from 'react-router-dom';
  import { postSchedule, uploadVideoToTikTok, UploadResult } from '../lib/api';

  const NICHES = [
    "Daily Crypto Scam 🔥",
    "Crypto Wallet Drain / Phishing 🚨🔓",
    "Fake Crypto Guru / Influencer Exposed 🎭",
    "Crypto Investment Scam News 📈🚨",
    "Crypto Scam Psychology 🧠",
    "AI Crypto Scam 🤖🪙",
    "Crypto Romance Scam Stories ❤️"
  ];

  export default function Schedule() {
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [isAutoNiche, setIsAutoNiche] = useState(true);
    const [selectedNiche, setSelectedNiche] = useState(NICHES[0]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);

      try {
        const userId = localStorage.getItem('tiktok_user_id');
        const scheduledTime = new Date(`${date}T${time}`).toISOString();

        await postSchedule({
          userId: userId || '',
          scheduledTime,
          niche: isAutoNiche ? 'AUTO' : selectedNiche,
        });
        setShowSuccess(true);
        setTimeout(() => navigate('/dashboard'), 2000);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSubmitting(false);
      }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      setVideoFile(f ?? null);
      setUploadResult(null);
    };

    const handleUploadNow = async () => {
      setUploadResult(null);
      const userId = localStorage.getItem('tiktok_user_id') || '';
      if (!userId) {
        setUploadResult({ ok: false, error: 'You are not signed in to TikTok.' });
        return;
      }
      if (!videoFile) {
        setUploadResult({ ok: false, error: 'Pick a video file first.' });
        return;
      }
      if (videoFile.size > 5 * 1024 * 1024) {
        setUploadResult({
          ok: false,
          error: `File is ${(videoFile.size / 1024 / 1024).toFixed(1)} MB. For this demo upload, please use a clip under 5 MB.`,
        });
        return;
      }

      setUploading(true);
      try {
        const result = await uploadVideoToTikTok({ userId, file: videoFile });
        setUploadResult(result);
      } catch (err) {
        setUploadResult({ ok: false, error: (err as Error)?.message || String(err) });
      } finally {
        setUploading(false);
      }
    };

    const fmtBytes = (n: number) => {
      if (n < 1024) return `${n} B`;
      if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
      return `${(n / 1024 / 1024).toFixed(2)} MB`;
    };

    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-2">Schedule Automation</h1>
          <p className="text-white/40">Queue a new video to be researched, generated, and posted.</p>
        </div>

        {/* DEMO: Upload directly to the user's TikTok inbox using video.upload scope */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-[40px] p-8 border border-brand-secondary/30 bg-brand-secondary/[0.03] mb-12"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-6">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] font-mono text-brand-secondary mb-1">
                video.upload demo
              </p>
              <h2 className="text-2xl font-bold tracking-tight">Upload to your TikTok inbox</h2>
              <p className="text-sm text-white/50 mt-1">
                Pushes the selected clip into your TikTok app's drafts (Inbox → Notifications → "You uploaded a video").
                Keep demo files under 5 MB.
              </p>
            </div>
            <Film className="text-brand-secondary/60 hidden md:block" size={48} strokeWidth={1.5} />
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/*"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="grid md:grid-cols-[1fr_auto] gap-4 items-stretch">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl px-6 py-4 transition-all flex items-center gap-4"
            >
              <div className="p-3 rounded-xl bg-brand-secondary/15 text-brand-secondary">
                <Upload size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm truncate">
                  {videoFile ? videoFile.name : 'Choose a video file…'}
                </p>
                <p className="text-xs text-white/40 mt-0.5">
                  {videoFile ? `${fmtBytes(videoFile.size)} · ${videoFile.type || 'video'}` : 'mp4, mov, webm — under 5 MB'}
                </p>
              </div>
            </button>

            <button
              type="button"
              disabled={!videoFile || uploading}
              onClick={handleUploadNow}
              className={`px-8 py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                !videoFile || uploading
                  ? 'bg-white/5 text-white/30 cursor-not-allowed'
                  : 'tiktok-gradient text-white shadow-lg shadow-brand-secondary/30 hover:scale-[1.02] active:scale-95'
              }`}
            >
              {uploading ? 'Uploading to TikTok…' : 'Upload to TikTok Inbox'}
              {!uploading && <ChevronRight size={18} />}
            </button>
          </div>

          <AnimatePresence>
            {uploadResult && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`mt-6 rounded-2xl border p-5 ${
                  uploadResult.ok
                    ? 'border-green-500/30 bg-green-500/[0.05]'
                    : 'border-red-500/30 bg-red-500/[0.05]'
                }`}
              >
                <div className="flex items-start gap-3">
                  {uploadResult.ok ? (
                    <CheckCircle className="text-green-400 shrink-0 mt-0.5" size={20} />
                  ) : (
                    <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={20} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm ${uploadResult.ok ? 'text-green-300' : 'text-red-300'}`}>
                      {uploadResult.ok
                        ? 'Uploaded — check your TikTok app inbox to publish it.'
                        : 'Upload failed.'}
                    </p>
                    {uploadResult.publish_id && (
                      <p className="text-xs text-white/50 font-mono mt-2">
                        publish_id: {uploadResult.publish_id}
                      </p>
                    )}
                    {(uploadResult.error || uploadResult.tiktok || uploadResult.tiktok_init) && (
                      <pre className="text-[10px] text-white/40 font-mono mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-all">
                        {JSON.stringify(uploadResult, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-12">
          {/* Form Column */}
          <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-8">
            <div className="glass rounded-[40px] p-8 border border-white/5 space-y-8">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs uppercase font-mono tracking-widest text-white/40 ml-1">Publish Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-brand-primary/50 transition-all text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase font-mono tracking-widest text-white/40 ml-1">Publish Time</label>
                  <div className="relative">
                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                    <input
                      type="time"
                      required
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-brand-primary/50 transition-all text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-xs uppercase font-mono tracking-widest text-white/40 ml-1">Niche Selection</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setIsAutoNiche(true)}
                    className={`p-6 rounded-3xl border transition-all text-left group ${isAutoNiche ? 'bg-brand-primary/20 border-brand-primary' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                  >
                    <Wand2 className={`mb-3 ${isAutoNiche ? 'text-brand-primary' : 'text-white/20'}`} size={24} />
                    <h4 className="font-bold mb-1">Smart Auto-Niche</h4>
                    <p className="text-[10px] text-white/40 leading-relaxed uppercase tracking-wider font-mono">Rotation Engine Active</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAutoNiche(false)}
                    className={`p-6 rounded-3xl border transition-all text-left ${!isAutoNiche ? 'bg-brand-secondary/20 border-brand-secondary' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                  >
                    <Zap className={`mb-3 ${!isAutoNiche ? 'text-brand-secondary' : 'text-white/20'}`} size={24} />
                    <h4 className="font-bold mb-1">Manual Select</h4>
                    <p className="text-[10px] text-white/40 leading-relaxed uppercase tracking-wider font-mono">Choose Specific Topic</p>
                  </button>
                </div>

                {!isAutoNiche && (
                  <motion.select
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    value={selectedNiche}
                    onChange={(e) => setSelectedNiche(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-6 focus:outline-none focus:border-brand-secondary/50 transition-all text-sm appearance-none cursor-pointer"
                  >
                    {NICHES.map(n => <option key={n} value={n} className="bg-surface">{n}</option>)}
                  </motion.select>
                )}
              </div>

              <button
                disabled={isSubmitting}
                className={`w-full py-5 rounded-2xl tiktok-gradient font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-95 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] shadow-2xl shadow-brand-primary/20'}`}
              >
                {isSubmitting ? 'Queueing Task...' : 'Schedule Automation Pipeline'}
                {!isSubmitting && <ChevronRight size={20} />}
              </button>
            </div>
          </form>

          {/* Info Column */}
          <div className="space-y-6">
            <div className="glass rounded-[32px] p-8 border border-white/5">
              <h5 className="font-bold mb-4 flex items-center gap-2">
                <Shield className="text-green-500" size={18} />
                TopicShield™ Active
              </h5>
              <p className="text-sm text-white/40 leading-relaxed">
                Every scheduled video runs through our duplicate prevention engine. We cross-reference the last 800 generated topics to ensure your feed stays fresh and high-potential.
              </p>
            </div>

            <div className="glass rounded-[32px] p-8 border border-white/5">
              <h5 className="font-bold mb-4 flex items-center gap-2">
                <Zap className="text-brand-secondary" size={18} />
                GitHub Actions
              </h5>
              <p className="text-sm text-white/40 leading-relaxed">
                Rendering is handled via scalable GitHub runners. Once triggered, the entire pipeline from research to posting takes roughly 4-6 minutes.
              </p>
            </div>

            <div className="bg-white/[0.02] rounded-[32px] p-8 border border-white/5 border-dashed">
              <div className="flex gap-4 items-start">
                <CheckCircle className="text-white/20 shrink-0 mt-1" size={16} />
                <div className="text-xs text-white/30 space-y-2">
                  <p>• Automated Trend Research</p>
                  <p>• Cerebras Script Generation</p>
                  <p>• UnrealSpeech VO Integration</p>
                  <p>• Remotion Vertical Rendering</p>
                  <p>• Auto-TikTok Publishing</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-6"
            >
              <div className="glass rounded-[40px] p-12 text-center border border-white/10 max-w-sm w-full shadow-2xl">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="text-green-500" size={40} />
                </div>
                <h3 className="text-2xl font-bold mb-2">Post Scheduled!</h3>
                <p className="text-white/40 text-sm">The automation engine will take it from here. Redirecting to dashboard...</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
  