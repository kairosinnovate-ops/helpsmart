import { Logo } from "@/components/layout/brand";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { TiletBand } from "@/components/tilet";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <LanguageSwitcher />
      </header>
      <main id="main" className="mx-auto w-full max-w-lg flex-1 px-4 pb-16 pt-6 sm:pt-12">
        {children}
      </main>
      <TiletBand />
    </div>
  );
}
