interface PlanningPromptChipProps {
  label: string;
  onClick?: () => void;
}

function PlanningPromptChip({ label, onClick }: PlanningPromptChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="identity-chip rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-fg transition hover:border-line hover:bg-tint hover:text-accent"
    >
      {label}
    </button>
  );
}

export default PlanningPromptChip;
