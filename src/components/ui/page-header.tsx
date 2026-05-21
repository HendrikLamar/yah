import type { ReactNode } from "react";

import { Badge } from "./badge";

type StatusVariant = "success" | "error" | "info" | "neutral";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
  status?: { label: string; variant: StatusVariant };
  children?: ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  status,
  children,
}: PageHeaderProps) {
  return (
    <section className="mb-xl">
      <div className="flex flex-col gap-md lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-sm max-w-3xl">
          <p className="text-label-md text-secondary uppercase tracking-wider">
            {eyebrow}
          </p>
          <h1 className="text-headline-lg-mobile md:text-headline-lg text-primary">
            {title}
          </h1>
          {description ? (
            <p className="text-body-md text-on-surface-variant">{description}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-md">
          {status ? <Badge variant={status.variant}>{status.label}</Badge> : null}
          {children}
        </div>
      </div>
    </section>
  );
}
