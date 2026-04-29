import LegalLayout, { LegalSection, LegalCallout, LegalList } from '../components/LegalLayout';

const sections = [
  { id: 'acceptance', title: 'Acceptance of terms' },
  { id: 'service', title: 'The service' },
  { id: 'eligibility', title: 'Eligibility & accounts' },
  { id: 'tiktok-compliance', title: 'TikTok platform compliance' },
  { id: 'user-content', title: 'Your content & licenses' },
  { id: 'ai-content', title: 'AI-generated content' },
  { id: 'acceptable-use', title: 'Acceptable use' },
  { id: 'subscriptions', title: 'Subscriptions & billing' },
  { id: 'ip', title: 'Our intellectual property' },
  { id: 'third-party', title: 'Third-party services' },
  { id: 'disclaimers', title: 'Disclaimers' },
  { id: 'liability', title: 'Limitation of liability' },
  { id: 'indemnification', title: 'Indemnification' },
  { id: 'termination', title: 'Termination' },
  { id: 'governing-law', title: 'Governing law & disputes' },
  { id: 'changes', title: 'Changes to these terms' },
  { id: 'contact', title: 'Contact us' },
];

export default function Terms() {
  return (
    <LegalLayout
      eyebrow="Legal · Terms"
      title={<>Terms of <span className="text-brand-primary">Service</span></>}
      subtitle="These Terms govern your use of AutoViral. They are written to be readable, but they're still a binding contract — please take a few minutes to skim them."
      lastUpdated="April 29, 2026"
      sections={sections}
    >
      <LegalSection id="acceptance" number="01" title="Acceptance of these terms">
        <p>
          These Terms of Service (the “Terms”) form a legal agreement between you and AutoViral Platforms Inc. (“AutoViral”, “we”, “our”, “us”). By
          creating an account, signing in with TikTok, or using any part of the Services, you agree to be bound by these Terms and our Privacy
          Policy.
        </p>
        <LegalCallout>
          If you are using the Services on behalf of an organization, you represent that you have authority to bind that organization, and “you”
          refers to that organization.
        </LegalCallout>
      </LegalSection>

      <LegalSection id="service" number="02" title="The service">
        <p>
          AutoViral is an AI-powered content automation platform that helps creators discover trending topics, generate scripts and voiceovers,
          render vertical videos, and schedule publishing to TikTok. The Services include the AutoViral Dashboard, our scheduling and rendering pipeline, and any related APIs, integrations, or features we make available.
        </p>
        <p>
          We may update, improve, or change features at any time. Where a change materially reduces functionality you depend on, we will notify you
          in advance.
        </p>
      </LegalSection>

      <LegalSection id="eligibility" number="03" title="Eligibility & accounts">
        <LegalList items={[
          <>You must be at least 18 years old, or the age of legal majority in your jurisdiction, to use AutoViral.</>,
          <>You must provide accurate registration information and keep it current.</>,
          <>You are responsible for all activity under your account, including content posted via your connected TikTok profile.</>,
          <>Keep your credentials confidential and notify us immediately of any unauthorized access.</>,
          <>One person or organization per account; sharing accounts is not permitted on personal plans.</>,
        ]} />
      </LegalSection>

      <LegalSection id="tiktok-compliance" number="04" title="TikTok platform compliance">
        <p>
          AutoViral integrates with TikTok via official APIs. By using AutoViral you agree to also comply with{' '}
          <a href="https://www.tiktok.com/legal/page/global/terms-of-service/en" target="_blank" rel="noreferrer" className="text-brand-secondary hover:text-white transition-colors font-semibold">
            TikTok’s Terms of Service
          </a>{' '}
          and{' '}
          <a href="https://www.tiktok.com/community-guidelines" target="_blank" rel="noreferrer" className="text-brand-secondary hover:text-white transition-colors font-semibold">
            Community Guidelines
          </a>
          .
        </p>
        <LegalList items={[
          <>You are solely responsible for ensuring content you publish via AutoViral complies with TikTok’s rules.</>,
          <>You agree not to use AutoViral to engage in spam, fake-engagement, or any behavior that could result in account suspension.</>,
          <>We may proactively block content or accounts that we reasonably believe violate TikTok’s policies.</>,
          <>If TikTok suspends or terminates your account, your AutoViral subscription remains in effect; we are not responsible for TikTok’s decisions.</>,
        ]} />
      </LegalSection>

      <LegalSection id="user-content" number="05" title="Your content & licenses">
        <p>
          You retain all ownership rights in the prompts, scripts, brand assets, voices, and other materials you submit to AutoViral (collectively,
          “Your Content”). You grant AutoViral a worldwide, non-exclusive, royalty-free license to host, store, process, transmit, modify, render,
          and display Your Content solely as needed to provide the Services to you.
        </p>
        <p>
          This license ends when you delete Your Content or close your account, except for backups retained for the limited periods described in our
          Privacy Policy.
        </p>
        <p>
          You represent that you have all rights necessary to grant this license and that Your Content does not infringe any third party’s rights.
        </p>
      </LegalSection>

      <LegalSection id="ai-content" number="06" title="AI-generated content">
        <p>
          AutoViral uses large language models, image generators, and voice synthesis to produce content based on your prompts. You should be aware
          that:
        </p>
        <LegalList items={[
          <>AI output may be inaccurate, biased, or unsuitable for some purposes — you must review before publishing.</>,
          <>Different users may receive similar outputs from similar prompts; AI output is not exclusive.</>,
          <>You are responsible for ensuring your use of AI-generated content complies with applicable laws, including disclosure rules in your jurisdiction (e.g. FTC, EU AI Act labeling).</>,
          <>You may not use the Services to create content that impersonates real people, generates non-consensual intimate imagery, or violates the rights of others.</>,
        ]} />
        <LegalCallout>
          To the extent permitted by law, you own the AI-generated outputs created from your prompts. We make no warranty that any output is
          copyrightable in your jurisdiction.
        </LegalCallout>
      </LegalSection>

      <LegalSection id="acceptable-use" number="07" title="Acceptable use">
        <p>You agree not to use the Services to:</p>
        <LegalList items={[
          <>Violate any law, regulation, or third-party right (including IP, privacy, and publicity rights).</>,
          <>Generate or distribute hateful, harassing, sexually explicit involving minors, or unlawfully violent content.</>,
          <>Mislead viewers about the nature of content, including disinformation, election interference, or financial scams.</>,
          <>Reverse engineer, decompile, scrape, or attempt to extract source code from the Services.</>,
          <>Interfere with the integrity or performance of the Services, including overwhelming our infrastructure.</>,
          <>Resell, sublicense, or white-label the Services without our prior written consent.</>,
          <>Build a competing product using outputs from our APIs.</>,
        ]} />
      </LegalSection>

      <LegalSection id="subscriptions" number="08" title="Subscriptions & billing">
        <p>
          Some features are available only with a paid subscription. Pricing, plan details, and usage limits are shown at checkout and on our
          Pricing page. By starting a subscription you authorize us (and our payment processor) to charge the payment method on file at the
          beginning of each billing period until you cancel.
        </p>
        <LegalList items={[
          <>Subscriptions auto-renew unless cancelled before the end of the current billing period.</>,
          <>Fees are non-refundable except where required by law or expressly stated.</>,
          <>We may change pricing on 30 days’ notice; changes apply to the next billing cycle.</>,
          <>If a payment fails, we may suspend the Services until the balance is settled.</>,
        ]} />
      </LegalSection>

      <LegalSection id="ip" number="09" title="Our intellectual property">
        <p>
          The Services, including the AutoViral name, logo, product UI, source code, documentation, and any underlying models or pipelines we
          develop, are owned by AutoViral and protected by intellectual property laws. We grant you a limited, revocable, non-transferable license
          to use the Services in accordance with these Terms. No other rights are granted by implication.
        </p>
      </LegalSection>

      <LegalSection id="third-party" number="10" title="Third-party services">
        <p>
          The Services rely on third-party providers (TikTok, Supabase, Cerebras, Google Gemini, Cloudflare Workers AI, Unreal Speech, GitHub
          Actions, and others). Your use of those services through AutoViral is also subject to their terms. We are not responsible for outages,
          changes, or actions by third parties.
        </p>
      </LegalSection>

      <LegalSection id="disclaimers" number="11" title="Disclaimers">
        <p className="uppercase text-sm tracking-wider font-bold text-white/80">
          The services are provided “as is” and “as available” without warranties of any kind, whether express, implied, or statutory.
        </p>
        <p>
          To the fullest extent permitted by law, AutoViral disclaims all warranties, including merchantability, fitness for a particular purpose,
          non-infringement, and any warranty arising from course of dealing or usage of trade. We do not warrant that the Services will be
          uninterrupted, secure, error-free, that any AI output will be accurate, or that posts will achieve any particular reach or engagement.
        </p>
      </LegalSection>

      <LegalSection id="liability" number="12" title="Limitation of liability">
        <p className="uppercase text-sm tracking-wider font-bold text-white/80">
          To the maximum extent permitted by law, AutoViral and its officers, directors, employees, and affiliates will not be liable for any
          indirect, incidental, special, consequential, exemplary, or punitive damages, or any loss of profits, revenues, data, goodwill, or other
          intangible losses.
        </p>
        <p>
          Our total cumulative liability for any claim arising out of or relating to the Services shall not exceed the greater of (a) the amounts
          you paid to AutoViral in the twelve (12) months preceding the event giving rise to the claim, or (b) one hundred U.S. dollars ($100).
        </p>
      </LegalSection>

      <LegalSection id="indemnification" number="13" title="Indemnification">
        <p>
          You agree to defend, indemnify, and hold harmless AutoViral and its affiliates from and against any claims, liabilities, damages, losses,
          and expenses (including reasonable attorneys’ fees) arising out of or related to: (a) Your Content, (b) your use of the Services, (c)
          your violation of these Terms, or (d) your violation of any third-party right, including TikTok’s policies.
        </p>
      </LegalSection>

      <LegalSection id="termination" number="14" title="Termination">
        <p>
          You may stop using AutoViral and close your account at any time from the Settings page. We may suspend or terminate your access if you
          breach these Terms, present a security or legal risk, or for prolonged inactivity. We will give reasonable notice where practical.
        </p>
        <p>Sections that by their nature should survive termination (including ownership, disclaimers, liability limits, and dispute resolution) will survive.</p>
      </LegalSection>

      <LegalSection id="governing-law" number="15" title="Governing law & disputes">
        <p>
          These Terms are governed by the laws of the State of Delaware, USA, without regard to conflict-of-law rules. Any dispute arising out of or
          relating to these Terms or the Services will be resolved exclusively in the state or federal courts located in Wilmington, Delaware, and
          you consent to personal jurisdiction in those courts.
        </p>
        <p>
          If you reside in the European Economic Area, the United Kingdom, or Switzerland, the mandatory consumer protections of your country of
          residence apply in addition to these Terms.
        </p>
      </LegalSection>

      <LegalSection id="changes" number="16" title="Changes to these terms">
        <p>
          We may update these Terms from time to time. If we make material changes, we will notify you by email or via an in-app banner at least 14
          days before they take effect. Continued use of the Services after the effective date constitutes acceptance of the updated Terms.
        </p>
      </LegalSection>

      <LegalSection id="contact" number="17" title="Contact us">
          <p>
            For legal questions or to send formal notices, please contact AutoViral Platforms Inc. through the contact channel listed on our website.
          </p>
        </LegalSection>
    </LegalLayout>
  );
}
