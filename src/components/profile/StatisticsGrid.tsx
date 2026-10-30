import type { ComponentType } from "react";

interface StatItem {
  label: string;
  value: number | null;
  icon: ComponentType<{ size?: number; className?: string }>;
  accent: string;
}

export function StatisticsGrid({ stats }: { stats: StatItem[] }) {
  return <div className="grid gap-4 sm:grid-cols-2">{stats.map((item) => { const Icon = item.icon; return <div key={item.label} className="rounded-panel border border-line bg-bg p-4 shadow-panel"><div className={`inline-flex rounded-panel ${item.accent} p-3 text-accent-fg`}><Icon size={18} /></div><p className="mt-4 text-3xl font-semibold text-fg">{item.value ?? "—"}</p><p className="mt-2 text-sm text-muted">{item.label}</p></div>; })}</div>;
}
