import type { ReactNode } from "react";

type StatusTone = "neutral" | "success" | "warning";

type FeatureCard = {
  title: string;
  body: string;
};

type FeaturePageProps = {
  eyebrow: string;
  title: string;
  description: string;
  statusLabel?: string;
  statusTone?: StatusTone;
  cards?: FeatureCard[];
  children?: ReactNode;
};

const toneClasses: Record<StatusTone, string> = {
  neutral: "border-slate-700 bg-slate-800/80 text-slate-200",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  warning: "border-amber-400/30 bg-amber-400/10 text-amber-100",
};

export function FeaturePage({
  eyebrow,
  title,
  description,
  statusLabel,
  statusTone = "neutral",
  cards = [],
  children,
}: FeaturePageProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-lg shadow-black/20">
        <span className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-300">
          {eyebrow}
        </span>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-50">
              {title}
            </h2>
            <p className="text-sm leading-7 text-slate-300 sm:text-base">
              {description}
            </p>
          </div>
          {statusLabel ? (
            <div
              className={`inline-flex rounded-full border px-3 py-2 text-sm font-medium ${toneClasses[statusTone]}`}
            >
              {statusLabel}
            </div>
          ) : null}
        </div>
      </section>

      {cards.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <article
              key={card.title}
              className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5"
            >
              <h3 className="text-base font-semibold text-slate-100">{card.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">{card.body}</p>
            </article>
          ))}
        </section>
      ) : null}

      {children}
    </div>
  );
}
