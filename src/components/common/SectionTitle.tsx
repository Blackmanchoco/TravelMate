import { ArrowRight } from "lucide-react";

interface SectionTitleProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
}

function SectionTitle({
  eyebrow,
  title,
  description,
  actionText,
  onAction,
}: SectionTitleProps) {
  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">

      <div className="max-w-2xl">

        {eyebrow && (
          <span className="mb-3 block text-sm font-semibold uppercase tracking-wider text-accent">
            {eyebrow}
          </span>
        )}

        <h2 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl">
          {title}
        </h2>

        {description && (
          <p className="mt-4 text-base leading-7 text-muted">
            {description}
          </p>
        )}

      </div>

      {actionText && (
        <button
          type="button"
          onClick={onAction}
          className="group inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-accent transition hover:text-accent"
        >
          {actionText}

          <ArrowRight
            size={17}
            className="transition-transform group-hover:translate-x-1"
          />
        </button>
      )}

    </div>
  );
}

export default SectionTitle;