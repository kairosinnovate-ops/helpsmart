import { Alert } from "@/components/ui";
import { Logo } from "@/components/layout/brand";

export default function Suspended() {
  return (
    <main id="main" className="mx-auto max-w-lg px-4 py-16">
      <Logo />
      <Alert tone="danger" className="mt-8" title="This account is suspended">
        If you believe this is a mistake, contact HelpSmart support to appeal. See the Complaint and Appeal Policy.
      </Alert>
    </main>
  );
}
