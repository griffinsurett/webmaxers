// Shared section wrapper for preference panels

import type { ReactNode } from "react";

interface SectionProps {
  title: string;
  children: ReactNode;
}

export default function Section({ title, children }: SectionProps) {
  return (
    <section className="mb-8">
      <h3 className="text-lg text-heading mb-4 pb-2 border-b-2 border-primary">
        {title}
      </h3>
      <div>{children}</div>
    </section>
  );
}
