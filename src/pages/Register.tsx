import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Mail,
  Plane,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../lib/api-client";

function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hasReadPrivacyNotice, setHasReadPrivacyNotice] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const passwordStrength = useMemo(() => {
    if (password.length === 0) return { label: "", color: "bg-line" };
    if (password.length < 8) return { label: "Weak", color: "bg-fg" };
    if (password.length < 12 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return { label: "Fair", color: "bg-fg" };
    }
    return { label: "Strong", color: "bg-accent" };
  }, [password]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!hasReadPrivacyNotice) {
      return;
    }

    if (!name.trim()) {
      setError("Please tell us your name.");
      return;
    }

    if (!/.+@.+\..+/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please try again.");
      return;
    }

    try {
      setIsSubmitting(true);
      await register({ name: name.trim(), email, password });
      setSuccess(true);
      navigate("/profile", { replace: true });
    } catch (submissionError) {
      setError(
        submissionError instanceof ApiError
          ? submissionError.message
          : "Unable to create your account. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl overflow-hidden rounded-panel border border-surface/70 bg-surface/80 shadow-panel backdrop-blur-xl lg:min-h-[900px]">
        <motion.div
          initial={false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="relative hidden flex-1 overflow-hidden bg-accent lg:block"
        >
          <div className="absolute inset-0 bg-accent" aria-hidden="true" />
          <div className="absolute inset-0 bg-accent" />
          <div className="absolute inset-0 flex flex-col justify-between p-10 text-accent-fg">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-panel bg-surface/15 backdrop-blur-sm">
                <Plane size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-tint">TravelMate</p>
                <p className="text-xs text-tint">AI Travel Planner</p>
              </div>
            </div>

            <div className="max-w-lg">
              <h1 className="text-4xl font-semibold leading-tight lg:text-5xl">Build Your Perfect Malaysian Escape</h1>
              <p className="mt-4 text-lg leading-8 text-tint">
                Create an account to save destinations, build itineraries, and ask the local AI assistant about places in the TravelMate catalogue.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {[
                  ["Real Malaysian places", "Local AI assistant (qwen3:8b) answering from the TravelMate catalogue"],
                  ["Saved Places", "Flexible itineraries"],
                ].flat().map((item) => (
                  <div key={item} className="rounded-panel border border-surface/15 bg-surface/10 px-4 py-3 text-sm font-medium text-tint backdrop-blur-sm">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55 }}
          className="flex flex-1 items-center justify-center bg-surface/90 px-4 py-8 sm:px-8 lg:px-10"
        >
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight text-fg">Create account</h2>
                <p className="mt-2 text-sm leading-6 text-muted">Start discovering beautiful Malaysia with a more personal plan.</p>
              </div>
              <div className="rounded-panel border border-line bg-bg p-3 text-accent">
                <Sparkles size={18} />
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block text-sm font-medium text-fg">
                Full name
                <div className="mt-2 flex items-center gap-2 rounded-panel border border-line bg-bg px-3 py-3 transition focus-within:border-accent focus-within:bg-surface focus-within:shadow-panel">
                  <ShieldCheck size={17} className="text-muted" />
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Your name"
                    className="w-full border-0 bg-transparent text-sm text-fg outline-none"
                    required
                  />
                </div>
              </label>

              <label className="block text-sm font-medium text-fg">
                Email address
                <div className="mt-2 flex items-center gap-2 rounded-panel border border-line bg-bg px-3 py-3 transition focus-within:border-accent focus-within:bg-surface focus-within:shadow-panel">
                  <Mail size={17} className="text-muted" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="w-full border-0 bg-transparent text-sm text-fg outline-none"
                    required
                  />
                </div>
              </label>

              <label className="block text-sm font-medium text-fg">
                Password
                <div className="mt-2 flex items-center gap-2 rounded-panel border border-line bg-bg px-3 py-3 transition focus-within:border-accent focus-within:bg-surface focus-within:shadow-panel">
                  <ShieldCheck size={17} className="text-muted" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Create a password"
                    className="w-full border-0 bg-transparent text-sm text-fg outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="text-muted transition hover:text-fg"
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className={`h-1.5 flex-1 rounded-full ${passwordStrength.color}`} />
                    <span className="text-xs font-medium text-muted">{passwordStrength.label || "Start typing"}</span>
                  </div>
                )}
              </label>

              <label className="block text-sm font-medium text-fg">
                Confirm password
                <div className="mt-2 flex items-center gap-2 rounded-panel border border-line bg-bg px-3 py-3 transition focus-within:border-accent focus-within:bg-surface focus-within:shadow-panel">
                  <ShieldCheck size={17} className="text-muted" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Confirm your password"
                    className="w-full border-0 bg-transparent text-sm text-fg outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((current) => !current)}
                    className="text-muted transition hover:text-fg"
                  >
                    {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>

              <div className="flex items-start gap-3 rounded-control border border-line bg-bg px-3 py-3">
                <input
                  id="privacy-notice-consent"
                  type="checkbox"
                  required
                  checked={hasReadPrivacyNotice}
                  onChange={(event) => setHasReadPrivacyNotice(event.target.checked)}
                  aria-labelledby="privacy-notice-consent-label privacy-notice-link"
                  className="mt-1 h-4 w-4 shrink-0 accent-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                />
                <div className="flex flex-wrap gap-x-1 text-sm leading-6 text-fg">
                  <label id="privacy-notice-consent-label" htmlFor="privacy-notice-consent">I have read the</label>
                  <Link id="privacy-notice-link" to="/privacy" className="font-semibold text-accent underline underline-offset-4">Privacy Notice</Link>
                </div>
              </div>

              {error && <p className="rounded-panel border border-line bg-bg px-3 py-2 text-sm text-muted">{error}</p>}
              {success && <p className="rounded-panel border border-line bg-tint px-3 py-2 text-sm text-accent">Account created. Redirecting you to start planning…</p>}

              <button
                type="submit"
                disabled={isSubmitting || !hasReadPrivacyNotice}
                className="flex w-full items-center justify-center gap-2 rounded-panel bg-accent px-4 py-3.5 text-sm font-semibold text-accent-fg shadow-panel transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-80"
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-surface/60 border-t-surface" />
                    Creating account…
                  </span>
                ) : (
                  <>
                    Create account
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-muted">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-accent transition hover:text-accent">
                Sign in
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default Register;
