import type { ContentPage } from "@/content/pages";
import { Alert, ButtonLink } from "@/components/ui";

export function ContentView({ page, cta, draftNotice }: { page: ContentPage; cta?: { href: string; label: string }; draftNotice?: string }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-trust sm:text-4xl">{page.title}</h1>
      {page.draft && draftNotice ? (
        <Alert tone="warning" className="mt-6" title={draftNotice} />
      ) : (
        <p className="mt-4 text-lg leading-relaxed text-ink/75">{page.intro}</p>
      )}
      <div className="mt-10 space-y-8">
        {page.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-lg font-semibold text-ink">{s.heading}</h2>
            {s.body.map((p) => (
              <p key={p} className="mt-2 leading-relaxed text-ink/75">{p}</p>
            ))}
          </section>
        ))}
      </div>
      {cta && <div className="mt-10"><ButtonLink href={cta.href} size="lg">{cta.label}</ButtonLink></div>}
    </article>
  );
}
