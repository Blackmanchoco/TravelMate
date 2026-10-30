import { LogOut, Settings } from "lucide-react";
import { Link } from "react-router-dom";

export function AccountSettingsCard({ onLogout }: { onLogout: () => void }) {
  return <div className="rounded-panel border border-line bg-surface p-6 shadow-panel"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Account</p><h2 className="mt-2 text-2xl font-semibold text-fg">Manage your profile</h2><div className="mt-6 space-y-3"><Link to="/account-settings" className="flex w-full items-center justify-center gap-2 rounded-full border border-line px-4 py-3 text-sm font-semibold text-fg hover:border-line hover:text-accent"><Settings size={16} /> Open account settings</Link><button type="button" onClick={onLogout} className="flex w-full items-center justify-center gap-2 rounded-full border border-line bg-bg px-4 py-3 text-sm font-semibold text-muted hover:bg-tint"><LogOut size={16} /> Logout</button></div></div>;
}
