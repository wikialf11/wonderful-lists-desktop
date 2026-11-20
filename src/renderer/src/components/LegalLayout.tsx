import type { ReactNode } from "react";

export function LegalLayout({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <a href="#/" className="font-mono-brutal text-xs uppercase underline">
          ← Volver a la app
        </a>
        <h1 className="display-font text-5xl uppercase leading-none mt-6 mb-2">{title}</h1>
        <p className="font-mono-brutal text-[10px] uppercase opacity-60 mb-8">
          Última actualización: {updated}
        </p>
        <div className="space-y-6 font-mono-brutal text-sm leading-relaxed">{children}</div>
      </div>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="display-font text-xl uppercase mb-2">{title}</h2>
      <div className="space-y-3 opacity-90">{children}</div>
    </section>
  );
}
