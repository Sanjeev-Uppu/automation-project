
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
    ArrowRight,
    Eye,
    EyeOff,
    LockKeyhole,
    Mail,
    ShieldCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const redirectTo = location.state?.from?.pathname || "/";

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setSubmitting(true);

        try {
            await login({ email: email.trim(), password });
            navigate(redirectTo, { replace: true });
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Unable to sign in."
            );
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-cream-100 p-4 sm:p-8">
            <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-plum-900/10 bg-white shadow-2xl lg:min-h-[620px] lg:grid-cols-2">

                {/* Branding panel */}
                <section className="relative flex flex-col justify-between overflow-hidden bg-plum-900 p-8 text-cream-100 sm:p-12">
                    <div className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full border border-cream-100/10" />
                    <div className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full border border-cream-100/10" />

                    <div className="relative">
                        <div className="font-display text-3xl font-semibold tracking-tight">
                            Team Automation
                        </div>
                        <div className="mt-2 h-1 w-12 rounded-full bg-sand-500" />
                    </div>

                    <div className="relative my-12">
                        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-sand-500">
                            Project Management Workspace
                        </span>

                        <h1 className="mt-5 font-display text-4xl font-semibold leading-tight sm:text-5xl">
                            Welcome back to your workspace.
                        </h1>

                        <p className="mt-6 max-w-sm text-base leading-7 text-cream-200/75">
                            Manage projects, track testing progress, and keep your
                            team aligned from one place.
                        </p>

                        <div className="mt-10 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sand-500 text-plum-900">
                                <ShieldCheck size={21} />
                            </div>
                            <div>
                                <p className="text-sm font-semibold">Secure workspace</p>
                                <p className="mt-0.5 text-xs text-cream-200/60">
                                    Your account, your projects
                                </p>
                            </div>
                        </div>
                    </div>

                    <p className="relative text-xs text-cream-200/50">
                        Team Automation · Your workspace, organized.
                    </p>
                </section>

                {/* Login form */}
                <section className="flex items-center justify-center bg-cream-100 px-6 py-12 sm:px-12">
                    <div className="w-full max-w-md">
                        <div className="mb-9">
                            <p className="text-sm font-semibold uppercase tracking-widest text-sand-700">
                                Account access
                            </p>

                            <h2 className="mt-3 font-display text-3xl font-semibold text-plum-900">
                                Sign in
                            </h2>

                            <p className="mt-2 text-sm leading-6 text-ink-soft">
                                Enter your account details to continue.
                            </p>
                        </div>

                        {error && (
                            <div
                                role="alert"
                                className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                            >
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label
                                    htmlFor="login-email"
                                    className="mb-2 block text-sm font-semibold text-plum-900"
                                >
                                    Email address
                                </label>

                                <div className="relative">
                                    <Mail
                                        size={18}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 text-plum-900/45"
                                    />

                                    <input
                                        id="login-email"
                                        type="email"
                                        required
                                        autoComplete="email"
                                        value={email}
                                        onChange={(event) => setEmail(event.target.value)}
                                        placeholder="you@example.com"
                                        className="w-full rounded-lg border border-plum-900/15 bg-white py-3.5 pl-11 pr-4 text-sm text-plum-900 outline-none transition placeholder:text-ink-soft/50 focus:border-sand-500 focus:ring-2 focus:ring-sand-500/20"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="mb-2 flex items-center justify-between">
                                    <label
                                        htmlFor="login-password"
                                        className="text-sm font-semibold text-plum-900"
                                    >
                                        Password
                                    </label>
                                </div>

                                <div className="relative">
                                    <LockKeyhole
                                        size={18}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 text-plum-900/45"
                                    />

                                    <input
                                        id="login-password"
                                        type={showPassword ? "text" : "password"}
                                        required
                                        autoComplete="current-password"
                                        value={password}
                                        onChange={(event) => setPassword(event.target.value)}
                                        placeholder="Enter your password"
                                        className="w-full rounded-lg border border-plum-900/15 bg-white py-3.5 pl-11 pr-12 text-sm text-plum-900 outline-none transition placeholder:text-ink-soft/50 focus:border-sand-500 focus:ring-2 focus:ring-sand-500/20"
                                    />

                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((value) => !value)}
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-plum-900/50 transition hover:text-plum-900"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-plum-900 px-5 py-3.5 text-sm font-semibold text-cream-100 shadow-md transition hover:bg-plum-800 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {submitting ? "Signing in..." : "Sign in"}
                                {!submitting && <ArrowRight size={17} />}
                            </button>
                        </form>

                        <div className="my-7 border-t border-plum-900/10" />

                        <p className="text-center text-sm text-ink-soft">
                            Don't have an account?{" "}
                            <Link
                                to="/register"
                                className="font-semibold text-plum-900 underline decoration-sand-500 decoration-2 underline-offset-4 hover:text-sand-700"
                            >
                                Create an account
                            </Link>
                        </p>
                    </div>
                </section>
            </div>
        </main>
    );
}
