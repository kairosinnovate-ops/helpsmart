/**
 * Long-form marketing and policy content. Kept as content files (not inline in components) so it can be
 * translated per locale or moved to a CMS. English only for now; other locales fall back to English.
 */
export interface ContentPage {
  title: string;
  intro: string;
  sections: { heading: string; body: string[] }[];
  draft?: boolean;
}

export const PAGES: Record<string, ContentPage> = {
  "how-it-works": {
    title: "How HelpSmart works",
    intro: "HelpSmart connects households and businesses in Addis Ababa with verified, approved local professionals.",
    sections: [
      { heading: "1. Create and verify your account", body: ["Sign up with your name, Ethiopian mobile number and email. Then verify your identity through Fayda, Ethiopia's National Digital ID, once HelpSmart's official integration is authorised. You can browse before verifying."] },
      { heading: "2. Discover trusted professionals", body: ["Search by service, sub-city and neighbourhood. Compare ratings from verified bookings, experience, qualifications and prices in Ethiopian Birr. Professionals appear only after HelpSmart approves them."] },
      { heading: "3. Book, or post a request for quotes", body: ["Book at a listed rate, ask for a custom quote, or post a request so several nearby professionals can quote. Your exact location is shared only after a booking is confirmed."] },
      { heading: "4. Get it done, pay and review", body: ["Track progress in the app and message your professional without sharing your number. During launch, pay in cash or by bank transfer and confirm in the app. Leave a review after the job is completed."] },
    ],
  },
  "become-a-helper": {
    title: "Become a Helper on HelpSmart Pro",
    intro: "Grow your business with customers nearby. Set your own prices and hours.",
    sections: [
      { heading: "Who can join", body: ["Independent professionals and registered service businesses in Addis Ababa offering house cleaning, domestic help, plumbing, electrical and handyman services. Care services (elderly assistance, childcare) open later, after safeguarding requirements are in place."] },
      { heading: "How approval works", body: ["Create your account, verify your identity with Fayda, complete your professional profile, upload certificates or licences, add references, then submit for review. Our team reviews every application before your profile becomes visible."] },
      { heading: "What it costs", body: ["Joining is free. HelpSmart charges a commission on completed jobs, shown clearly in your earnings. Identity verification and safety features are never paid ranking privileges."] },
    ],
  },
  family: {
    title: "HelpSmart Family",
    intro: "For Ethiopians abroad who want reliable help for parents, relatives and property in Addis Ababa.",
    sections: [
      { heading: "Coming soon", body: ["HelpSmart Family will let you add family members with their consent, manage several addresses, arrange recurring cleaning and repairs, receive service completion reports and pay with supported international methods."] },
      { heading: "Care with dignity", body: ["Non-medical elderly assistance will open only after safeguarding, training and operational procedures are in place."] },
    ],
  },
  about: {
    title: "About HelpSmart",
    intro: "Our mission is to simplify everyday life by connecting people with trusted, skilled and accessible service professionals while creating sustainable employment opportunities.",
    sections: [
      { heading: "Our vision", body: ["To become Africa's most trusted digital marketplace for everyday services."] },
      { heading: "What we stand for", body: ["Trust: verified identities, transparent reviews and professional accountability.", "Accessibility: reliable services available whenever and wherever customers need them.", "Opportunity: helping local professionals build reputations and sustainable incomes.", "Inclusion: serving all communities regardless of ethnicity, language, religion or background."] },
      { heading: "Company", body: ["HelpSmart Technologies PLC (proposed legal entity). Built in Ethiopia. Designed for Africa."] },
    ],
  },
  careers: { title: "Careers", intro: "We're building the team behind Ethiopia's trusted service marketplace.", sections: [{ heading: "Open roles", body: ["There are no open roles right now. Check back soon."] }] },
  contact: { title: "Contact", intro: "We'd love to hear from you.", sections: [{ heading: "Customer support", body: ["Signed-in users can contact support from My account → Get support. Contact details for the company will be published at launch."] }] },
  help: {
    title: "Help Center",
    intro: "Answers to common questions.",
    sections: [
      { heading: "Booking", body: ["Open a professional's profile and choose Book Now or Request a Quote. You confirm the price before anything is booked."] },
      { heading: "Cancelling", body: ["You can cancel from the booking page before the service starts. The professional's cancellation policy is shown on their profile."] },
      { heading: "Disputes", body: ["If something went wrong, open a dispute on the booking within 72 hours of completion. Our team will review it."] },
      { heading: "Verification", body: ["HelpSmart uses Fayda for identity verification. We never ask for your Fayda OTP. If anyone asks for it, report them."] },
    ],
  },
  safety: {
    title: "Safety information",
    intro: "Trust and safety are at the core of HelpSmart. HelpSmart is not an emergency service.",
    sections: [
      { heading: "In an emergency", body: ["Call the police on 991, an ambulance on 907, or the fire service on 939. (Numbers to be confirmed with authorities before launch.)"] },
      { heading: "What verification means", body: ["Fayda verification confirms a person's identity. It is not a guarantee that a person is safe or professionally competent. HelpSmart Approved means our team reviewed the professional's application."] },
      { heading: "Stay safe", body: ["Keep communication and payment records in HelpSmart. Never share your Fayda OTP, passwords or bank PINs. Report anything unsafe from the profile, message or booking page."] },
    ],
  },
};

const DRAFT = "This document is a placeholder that requires legal review before production use. It is not a binding agreement.";

export const LEGAL: Record<string, ContentPage> = {
  terms: { title: "Terms of Service", intro: DRAFT, draft: true, sections: [{ heading: "Scope", body: ["Placeholder. To be drafted with Ethiopian counsel, covering marketplace role, user obligations, fees, liability, governing law and dispute resolution."] }] },
  privacy: { title: "Privacy Policy", intro: DRAFT, draft: true, sections: [{ heading: "Scope", body: ["Placeholder. Must reflect the Personal Data Protection Proclamation and any regulator guidance, data categories, purposes, retention, cross-border transfers, and data subject rights."] }] },
  "identity-consent": { title: "Identity Verification Consent", intro: DRAFT, draft: true, sections: [{ heading: "Scope", body: ["Placeholder. Explains what HelpSmart receives from Fayda, why, how long it is kept, and how to withdraw consent. Must match the scopes and claims approved during Fayda partner onboarding."] }] },
  "provider-agreement": { title: "Provider Agreement", intro: DRAFT, draft: true, sections: [{ heading: "Scope", body: ["Placeholder. Worker classification, commission, conduct standards, insurance, safeguarding obligations for care categories."] }] },
  "community-guidelines": { title: "Community Guidelines", intro: DRAFT, draft: true, sections: [{ heading: "Respect", body: ["No harassment, discrimination, exploitation or unsafe working conditions. Violations can lead to suspension."] }] },
  "cancellation-refund": { title: "Cancellation and Refund Policy", intro: DRAFT, draft: true, sections: [{ heading: "Scope", body: ["Placeholder. Flexible, moderate and strict provider policies; refund handling through licensed payment partners."] }] },
  "safety-policy": { title: "Safety Policy", intro: DRAFT, draft: true, sections: [{ heading: "Scope", body: ["Placeholder. Incident handling, escalation, cooperation with authorities."] }] },
  "data-retention": { title: "Data Retention Policy", intro: DRAFT, draft: true, sections: [{ heading: "Scope", body: ["Placeholder. See docs/SECURITY.md for the engineering retention schedule that this policy must confirm."] }] },
  "complaints-appeals": { title: "Complaint and Appeal Policy", intro: DRAFT, draft: true, sections: [{ heading: "Scope", body: ["Placeholder. How users complain, appeal moderation and suspension decisions, and timelines."] }] },
};
