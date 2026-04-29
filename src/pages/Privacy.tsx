import LegalLayout, { LegalSection, LegalCallout, LegalList } from '../components/LegalLayout';

const sections = [
  { id: 'overview', title: 'Overview' },
  { id: 'information-we-collect', title: 'Information we collect' },
  { id: 'how-we-use', title: 'How we use information' },
  { id: 'tiktok-data', title: 'TikTok account data' },
  { id: 'ai-providers', title: 'AI & third-party processors' },
  { id: 'cookies', title: 'Cookies & local storage' },
  { id: 'sharing', title: 'How we share data' },
  { id: 'retention', title: 'Data retention' },
  { id: 'security', title: 'Security' },
  { id: 'rights', title: 'Your privacy rights' },
  { id: 'children', title: "Children's privacy" },
  { id: 'international', title: 'International transfers' },
  { id: 'changes', title: 'Changes to this policy' },
  { id: 'contact', title: 'Contact us' },
];

export default function Privacy() {
  return (
    <LegalLayout
      eyebrow="Legal · Privacy"
      title={<>Privacy <span className="text-brand-primary">Policy</span></>}
      subtitle="We built AutoViral to do the heavy lifting for creators — and we built our data practices to be just as transparent as the workflow itself. This policy explains exactly what we collect, why we collect it, and how you stay in control."
      lastUpdated="April 29, 2026"
      sections={sections}
    >
      <LegalSection id="overview" number="01" title="Overview">
        <p>
          AutoViral Platforms Inc. (“AutoViral”, “we”, “our”, or “us”) operates the AutoViral platform and the related AI content automation services (the “Services”). This Privacy Policy describes how we collect, use, disclose, and protect your
          information when you use the Services.
        </p>
        <p>
          By using AutoViral, you agree to the collection and use of information as described in this policy. If you do not agree, please do not use
          the Services.
        </p>
        <LegalCallout>
          <strong className="text-white">In one sentence:</strong> we only collect what we need to publish content to TikTok on your behalf, generate
          AI scripts and videos, and keep your account secure — and we never sell your personal data.
        </LegalCallout>
      </LegalSection>

      <LegalSection id="information-we-collect" number="02" title="Information we collect">
        <p>We collect three categories of information:</p>
        <h3 className="text-xl font-bold text-white mt-8 mb-3">a. Information you provide directly</h3>
        <LegalList items={[
          <>Account profile fields you submit (display name, avatar, contact email, time zone).</>,
          <>Schedules, prompts, topics, and brand preferences you configure inside the Dashboard.</>,
          <>Support requests, survey responses, and other communications you send to us.</>,
        ]} />
        <h3 className="text-xl font-bold text-white mt-8 mb-3">b. Information from TikTok</h3>
        <LegalList items={[
          <>Your TikTok user identifier, username, display name, and profile picture URL.</>,
          <>An OAuth access token and refresh token, used solely to upload videos and read basic account metadata.</>,
          <>Aggregate engagement metrics for posts published by AutoViral (views, likes, comments, shares).</>,
        ]} />
        <h3 className="text-xl font-bold text-white mt-8 mb-3">c. Information collected automatically</h3>
        <LegalList items={[
          <>Device, browser, operating system, and IP address (for security and abuse prevention).</>,
          <>Application logs, error reports, and usage analytics to improve reliability and performance.</>,
          <>Cookies and local-storage entries strictly necessary to keep you signed in and remember preferences.</>,
        ]} />
      </LegalSection>

      <LegalSection id="how-we-use" number="03" title="How we use your information">
        <p>We use your information to operate the Services and deliver the experience you signed up for. Specifically, we use it to:</p>
        <LegalList items={[
          <>Authenticate you, manage your account, and connect your TikTok profile.</>,
          <>Generate scripts, voiceovers, and rendered videos using our AI pipeline.</>,
          <>Schedule and publish content to your TikTok account at the times you specify.</>,
          <>Surface analytics and historical data inside your Dashboard.</>,
          <>Detect, investigate, and prevent fraud, abuse, and security incidents.</>,
          <>Comply with legal obligations and enforce our Terms of Service.</>,
          <>Send essential transactional messages (e.g. account, billing, security alerts).</>,
        ]} />
      </LegalSection>

      <LegalSection id="tiktok-data" number="04" title="TikTok account data">
        <p>
          When you click “Login with TikTok”, you authorize AutoViral through TikTok’s standard OAuth 2.0 flow. We request only the scopes we
          actually need: <code className="font-mono text-xs px-2 py-1 rounded bg-white/5 border border-white/10 text-brand-secondary">user.info.basic</code>,{' '}
          <code className="font-mono text-xs px-2 py-1 rounded bg-white/5 border border-white/10 text-brand-secondary">video.upload</code>, and{' '}
          <code className="font-mono text-xs px-2 py-1 rounded bg-white/5 border border-white/10 text-brand-secondary">video.publish</code>.
        </p>
        <LegalList items={[
          <>We never read or scrape any TikTok content that does not belong to you.</>,
          <>We never post, comment, or follow on your behalf without an explicit schedule you created.</>,
          <>You can revoke access at any time from your TikTok settings or by deleting your AutoViral account.</>,
          <>OAuth tokens are stored encrypted at rest and are rotated automatically.</>,
        ]} />
      </LegalSection>

      <LegalSection id="ai-providers" number="05" title="AI & third-party processors">
        <p>
          AutoViral coordinates a small, vetted set of subprocessors to deliver the AI workflow. These providers act on our instructions and may
          process limited, purpose-bound data:
        </p>
        <div className="overflow-x-auto rounded-2xl border border-white/10 my-6">
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr className="text-left text-[10px] uppercase tracking-widest text-white/40">
                <th className="px-5 py-4 font-bold">Provider</th>
                <th className="px-5 py-4 font-bold">Purpose</th>
                <th className="px-5 py-4 font-bold">Data shared</th>
              </tr>
            </thead>
            <tbody className="text-white/60">
              {[
                ['Supabase', 'Database, authentication, edge functions', 'Account, schedule, and post records'],
                ['Cerebras', 'LLM script generation', 'Topic prompts (no PII)'],
                ['Google Gemini', 'Topic research & enrichment', 'Topic prompts (no PII)'],
                ['Cloudflare Workers AI', 'Image and video rendering', 'Generated scripts & assets'],
                ['Unreal Speech', 'Voiceover synthesis', 'Generated script text'],
                ['TikTok', 'Publishing and account info', 'OAuth tokens, video assets'],
                ['GitHub Actions', 'Scheduled job execution', 'Schedule metadata only'],
              ].map(([p, u, d], i) => (
                <tr key={i} className="border-t border-white/5">
                  <td className="px-5 py-4 font-bold text-white">{p}</td>
                  <td className="px-5 py-4">{u}</td>
                  <td className="px-5 py-4 text-white/50">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Each subprocessor is bound by a written data processing agreement and may not use your data for any purpose other than providing the
          contracted service.
        </p>
      </LegalSection>

      <LegalSection id="cookies" number="06" title="Cookies & local storage">
        <p>
          We use a small number of strictly necessary storage entries to keep the application working. We do <strong className="text-white">not</strong>{' '}
          use third-party advertising cookies or cross-site tracking pixels.
        </p>
        <LegalList items={[
          <><strong className="text-white">Session token</strong> — keeps you signed in between visits.</>,
          <><strong className="text-white">Preferences</strong> — remembers UI choices like time zone and theme.</>,
          <><strong className="text-white">Anonymized analytics</strong> — page views, error rates, and performance metrics (no behavioral profiling).</>,
        ]} />
      </LegalSection>

      <LegalSection id="sharing" number="07" title="How we share data">
        <p>We share information only in these limited circumstances:</p>
        <LegalList items={[
          <><strong className="text-white">Subprocessors</strong> listed in §05, strictly to deliver the Services.</>,
          <><strong className="text-white">Legal requirements</strong> — to comply with valid legal process, court orders, or government requests.</>,
          <><strong className="text-white">Safety & abuse</strong> — to investigate fraud, security incidents, or violations of our Terms.</>,
          <><strong className="text-white">Business transfers</strong> — in the event of a merger, acquisition, or asset sale, with notice to you.</>,
          <><strong className="text-white">With your consent</strong> — any other sharing requires your explicit opt-in.</>,
        ]} />
        <LegalCallout>
          We do <strong className="text-white">not</strong> sell, rent, or trade your personal information. Ever.
        </LegalCallout>
      </LegalSection>

      <LegalSection id="retention" number="08" title="Data retention">
        <p>
          We retain account data for as long as your account is active. When you delete your account, we erase or anonymize your personal data within
          30 days, except where we are required to keep records for legal, tax, or fraud-prevention purposes.
        </p>
        <LegalList items={[
          <>OAuth tokens are deleted immediately on disconnect.</>,
          <>Generated content older than 12 months is automatically purged from cold storage unless you pin it.</>,
          <>Server logs are retained for 30 days for diagnostics, then deleted.</>,
        ]} />
      </LegalSection>

      <LegalSection id="security" number="09" title="Security">
        <p>
          We employ industry-standard safeguards to protect your information, including TLS in transit, AES-256 at rest, principle-of-least-privilege
          access controls, role-based authentication for our team, and continuous monitoring. No system is perfectly secure, however, and we
          encourage you to use strong, unique credentials and to report any suspected breach immediately.
        </p>
      </LegalSection>

      <LegalSection id="rights" number="10" title="Your privacy rights">
        <p>Depending on where you live, you may have the right to:</p>
        <LegalList items={[
          <>Access the personal data we hold about you.</>,
          <>Correct inaccurate or incomplete data.</>,
          <>Delete your account and associated data.</>,
          <>Export a portable copy of your data in a common machine-readable format.</>,
          <>Object to or restrict certain processing activities.</>,
          <>Withdraw consent at any time, where processing is based on consent.</>,
          <>Lodge a complaint with your local data protection authority.</>,
        ]} />
        <p>
            To exercise any of these rights, please get in touch through the contact channel listed on our website. We respond within 30 days.
          </p>
        </LegalSection>

      <LegalSection id="children" number="11" title="Children's privacy">
        <p>
          AutoViral is not directed at children under 13 (or under 16 in the EEA), and we do not knowingly collect personal information from them. If
          you believe a minor has provided us with personal data, please contact us and we will delete it promptly.
        </p>
      </LegalSection>

      <LegalSection id="international" number="12" title="International data transfers">
        <p>
          AutoViral is operated from the United States and the European Union. By using the Services, you understand your information may be
          transferred to, stored, and processed in countries other than your own. Where required, we rely on Standard Contractual Clauses or
          equivalent transfer mechanisms.
        </p>
      </LegalSection>

      <LegalSection id="changes" number="13" title="Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. When we make material changes, we will notify you by email or via an in-app banner at
          least 14 days before the changes take effect. The “Last updated” date at the top of this page always reflects the current version.
        </p>
      </LegalSection>

      <LegalSection id="contact" number="14" title="Contact us">
          <p>
            For privacy questions, requests, or complaints, please reach the Data Protection Officer of AutoViral Platforms Inc. through the contact channel listed on our website.
          </p>
        </LegalSection>
    </LegalLayout>
  );
}
