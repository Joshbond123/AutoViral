import LegalLayout, { LegalSection, LegalCallout, LegalList } from '../components/LegalLayout';

  const sections = [
    { id: 'overview', title: 'Overview' },
    { id: 'facebook-data', title: 'Facebook data deletion' },
    { id: 'account-deletion', title: 'Delete your account' },
    { id: 'what-is-deleted', title: 'What gets deleted' },
    { id: 'what-is-retained', title: 'What we retain' },
    { id: 'timeline', title: 'Deletion timeline' },
    { id: 'contact', title: 'Contact us' },
  ];

  export default function DataDeletion() {
    return (
      <LegalLayout
        eyebrow="Legal · Data Deletion"
        title={<>Data Deletion <span className="text-brand-primary">Instructions</span></>}
        subtitle="You have the right to delete your data at any time. This page explains exactly how to request deletion of your personal information, including all data associated with any connected platforms."
        lastUpdated="June 9, 2026"
        sections={sections}
      >
        <LegalSection id="overview" number="01" title="Overview">
          <p>
            AutoViral is committed to your privacy and your right to control your personal data. You may request the deletion of your
            account and all associated data at any time, at no cost, with no questions asked.
          </p>
          <LegalCallout>
            <strong className="text-white">Quick summary:</strong> To delete all your data, either use the in-app delete option, email us
            at <a href="mailto:privacy@joshbond123.github.io/AutoViral" className="text-brand-primary underline">privacy@joshbond123.github.io/AutoViral</a>, or
            follow the step-by-step instructions on this page. We process all deletion requests within 30 days.
          </LegalCallout>
        </LegalSection>

        <LegalSection id="facebook-data" number="02" title="Facebook data deletion">
          <p>
            If you connected your Facebook Page to AutoViral, we store your Facebook Page Access Token and Page ID to enable automated
            video publishing on your behalf. You may revoke this access and delete the associated data at any time.
          </p>
          <h3 className="text-xl font-bold text-white mt-8 mb-3">Option A — Remove from within AutoViral</h3>
          <LegalList items={[
            'Sign in to your AutoViral account at joshbond123.github.io/AutoViral',
            'Navigate to Settings → Facebook Page',
            'Click "Remove" next to your connected Facebook Page',
            'Confirm the removal — your Page Access Token and all associated data are immediately deleted from our database',
          ]} />
          <h3 className="text-xl font-bold text-white mt-8 mb-3">Option B — Revoke from Facebook directly</h3>
          <p>
            You can revoke AutoViral's access to your Facebook account directly from Facebook's settings at any time:
          </p>
          <LegalList items={[
            'Go to Facebook Settings → Security and Login → Apps and Websites',
            'Find "AutoViral" in the list of connected apps',
            'Click "Remove" to revoke access',
            'Once revoked, please also email us at privacy@joshbond123.github.io/AutoViral so we can delete your stored Page Access Token from our database',
          ]} />
          <h3 className="text-xl font-bold text-white mt-8 mb-3">Option C — Submit a deletion request</h3>
          <p>
            Send an email to <a href="mailto:privacy@joshbond123.github.io/AutoViral" className="text-brand-primary underline">privacy@joshbond123.github.io/AutoViral</a> with
            the subject line <strong className="text-white">"Data Deletion Request"</strong> and include:
          </p>
          <LegalList items={[
            'Your AutoViral account email address',
            'The Facebook Page ID or Page name you connected (if known)',
            'A brief description of what you would like deleted (Facebook data only, or full account)',
          ]} />
          <LegalCallout>
            We will confirm receipt of your request within 48 hours and complete the deletion within 30 days, sending you a confirmation
            email once done.
          </LegalCallout>
        </LegalSection>

        <LegalSection id="account-deletion" number="03" title="Delete your full account">
          <p>
            To delete your entire AutoViral account and all associated data (not just Facebook data), follow these steps:
          </p>
          <h3 className="text-xl font-bold text-white mt-8 mb-3">Step 1 — Sign in to AutoViral</h3>
          <p>
            Visit <a href="https://joshbond123.github.io/AutoViral" className="text-brand-primary underline">joshbond123.github.io/AutoViral</a> and sign in with
            your email and password.
          </p>
          <h3 className="text-xl font-bold text-white mt-8 mb-3">Step 2 — Go to Settings</h3>
          <p>
            From the sidebar, navigate to <strong className="text-white">Settings</strong>. Scroll to the bottom of the page to find the
            <strong className="text-white"> Account Deletion</strong> section.
          </p>
          <h3 className="text-xl font-bold text-white mt-8 mb-3">Step 3 — Confirm deletion</h3>
          <p>
            Click <strong className="text-white">"Delete My Account"</strong> and confirm your decision. This action is permanent and
            cannot be undone.
          </p>
          <h3 className="text-xl font-bold text-white mt-8 mb-3">Alternative — Email request</h3>
          <p>
            If you cannot access your account, email us at{' '}
            <a href="mailto:privacy@joshbond123.github.io/AutoViral" className="text-brand-primary underline">privacy@joshbond123.github.io/AutoViral</a>{' '}
            with the subject line <strong className="text-white">"Account Deletion Request"</strong> and your registered email address.
            We will verify your identity and process the deletion within 30 days.
          </p>
        </LegalSection>

        <LegalSection id="what-is-deleted" number="04" title="What gets deleted">
          <p>When you request full account deletion, we permanently delete:</p>
          <LegalList items={[
            'Your account profile (email address, display name, avatar)',
            'Your authentication credentials and session tokens',
            'All API keys you stored in AutoViral (Cerebras, Cloudflare, etc.)',
            'Your Facebook Page Access Token and Page configuration',
            'All video generation schedules (pending and historical)',
            'All generated video records and associated metadata (titles, scripts, captions)',
            'Your agent instructions and automation settings',
            'Push notification subscriptions',
            'All chat messages and activity logs',
            'Any other data stored under your user ID in our database',
          ]} />
          <LegalCallout>
            <strong className="text-white">Note on video files:</strong> Videos you have already published to Facebook or other platforms
            reside on those platforms and are subject to their own deletion policies. AutoViral does not have the ability to remove content
            already posted to external platforms on your behalf.
          </LegalCallout>
        </LegalSection>

        <LegalSection id="what-is-retained" number="05" title="What we retain">
          <p>After deletion, we may retain the following for legitimate business and legal purposes:</p>
          <LegalList items={[
            'Anonymised, aggregated analytics that cannot be traced back to you',
            'Records required by applicable law or to resolve ongoing legal disputes',
            'Billing and financial transaction records (if applicable) as required by tax law',
            'Abuse prevention logs for a limited period to protect platform integrity',
          ]} />
          <p>
            We do not sell your personal data to third parties, before or after deletion. Any retained records are stored securely,
            access-controlled, and deleted as soon as legally permissible.
          </p>
        </LegalSection>

        <LegalSection id="timeline" number="06" title="Deletion timeline">
          <LegalList items={[
            'Immediate: Your account is deactivated and you are signed out across all devices',
            'Within 24 hours: Your data is marked for deletion and no longer accessible in the application',
            'Within 30 days: All data is permanently purged from our active databases',
            'Within 90 days: Residual data is removed from encrypted backups as they rotate',
            'Confirmation email sent once purge is complete',
          ]} />
        </LegalSection>

        <LegalSection id="contact" number="07" title="Contact us">
          <p>
            For any questions about data deletion, or to submit a deletion request, please contact our privacy team:
          </p>
          <LegalList items={[
            'Email: privacy@joshbond123.github.io/AutoViral',
            'Subject line for account deletion: "Account Deletion Request"',
            'Subject line for Facebook data only: "Data Deletion Request"',
            'Response time: within 48 business hours',
          ]} />
          <p>
            We take every deletion request seriously and are committed to completing all requests promptly and transparently.
          </p>
        </LegalSection>
      </LegalLayout>
    );
  }
  