
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    ArrowRight,
    Eye,
    EyeOff,
    LockKeyhole,
    Mail,
    UserRound,
    ShieldCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function RegisterPage() {
    const { register } = useAuth();
    const navigate = useNavigate();

    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");

        if (fullName.trim().length < 2) {
            setError("Please enter your full name.");
            return;
        }

        if (password.length < 8) {
            setError("Password must contain at least 8 characters.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setSubmitting(true);

        try {
            await register({
                full_name: fullName.trim(),
                email: email.trim(),
                password,
            });

            // Redirect to login after successful registration.
            navigate("/login", { replace: true });
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to create your account. Please try again."
            );
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-cream-100 p-4 sm:p-8">
            <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-plum-900/10 bg-white shadow-2xl lg:min-h-[680px] lg:grid-cols-2">

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
                            Get Started
                        </span>

                        <h1 className="mt-5 font-display text-4xl font-semibold leading-tight sm:text-5xl">
                            Everything you need to manage projects.
                        </h1>

                        <p className="mt-6 max-w-sm text-base leading-7 text-cream-200/75">
                            Create your account and bring project tracking,
                            testing progress, and team activities together.
                        </p>

                        <div className="mt-10 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sand-500 text-plum-900">
                                <ShieldCheck size={21} />
                            </div>

                            <div>
                                <p className="text-sm font-semibold">
                                    One connected workspace
                                </p>

                                <p className="mt-0.5 text-xs text-cream-200/60">
                                    Start organizing your work
                                </p>
                            </div>
                        </div>
                    </div>

                    <p className="relative text-xs text-cream-200/50">
                        Team Automation · Your workspace, organized.
                    </p>
                </section>

                {/* Registration form */}
                <section className="flex items-center justify-center bg-cream-100 px-6 py-10 sm:px-12">
                    <div className="w-full max-w-md">

                        <div className="mb-7">
                            <p className="text-sm font-semibold uppercase tracking-widest text-sand-700">
                                New account
                            </p>

                            <h2 className="mt-3 font-display text-3xl font-semibold text-plum-900">
                                Create account
                            </h2>

                            <p className="mt-2 text-sm leading-6 text-ink-soft">
                                Fill in your details to get started.
                            </p>
                        </div>

                        {/* Error message */}
                        {error && (
                            <div
                                role="alert"
                                className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                            >
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">

                            {/* Full name */}
                            <div>
                                <label
                                    htmlFor="register-name"
                                    className="mb-2 block text-sm font-semibold text-plum-900"
                                >
                                    Full name
                                </label>

                                <div className="relative">
                                    <UserRound
                                        size={18}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 text-plum-900/45"
                                    />

                                    <input
                                        id="register-name"
                                        type="text"
                                        required
                                        autoComplete="name"
                                        value={fullName}
                                        onChange={(event) => setFullName(event.target.value)}
                                        placeholder="Enter your full name"
                                        className="w-full rounded-lg border border-plum-900/15 bg-white py-3 pl-11 pr-4 text-sm text-plum-900 outline-none transition placeholder:text-ink-soft/50 focus:border-sand-500 focus:ring-2 focus:ring-sand-500/20"
                                    />
                                </div>
                            </div>

                            {/* Email */}
                            <div>
                                <label
                                    htmlFor="register-email"
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
                                        id="register-email"
                                        type="email"
                                        required
                                        autoComplete="email"
                                        value={email}
                                        onChange={(event) => setEmail(event.target.value)}
                                        placeholder="you@example.com"
                                        className="w-full rounded-lg border border-plum-900/15 bg-white py-3 pl-11 pr-4 text-sm text-plum-900 outline-none transition placeholder:text-ink-soft/50 focus:border-sand-500 focus:ring-2 focus:ring-sand-500/20"
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <label
                                    htmlFor="register-password"
                                    className="mb-2 block text-sm font-semibold text-plum-900"
                                >
                                    Password
                                </label>

                                <div className="relative">
                                    <LockKeyhole
                                        size={18}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 text-plum-900/45"
                                    />

                                    <input
                                        id="register-password"
                                        type={showPassword ? "text" : "password"}
                                        required
                                        minLength={8}
                                        autoComplete="new-password"
                                        value={password}
                                        onChange={(event) => setPassword(event.target.value)}
                                        placeholder="Create a password"
                                        className="w-full rounded-lg border border-plum-900/15 bg-white py-3 pl-11 pr-12 text-sm text-plum-900 outline-none transition placeholder:text-ink-soft/50 focus:border-sand-500 focus:ring-2 focus:ring-sand-500/20"
                                    />

                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((value) => !value)}
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-plum-900/50 hover:text-plum-900"
                                    >
                                        {showPassword ? (
                                            <EyeOff size={18} />
                                        ) : (
                                            <Eye size={18} />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Confirm password */}
                            <div>
                                <label
                                    htmlFor="register-confirm-password"
                                    className="mb-2 block text-sm font-semibold text-plum-900"
                                >
                                    Confirm password
                                </label>

                                <div className="relative">
                                    <LockKeyhole
                                        size={18}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 text-plum-900/45"
                                    />

                                    <input
                                        id="register-confirm-password"
                                        type={showConfirmPassword ? "text" : "password"}
                                        required
                                        minLength={8}
                                        autoComplete="new-password"
                                        value={confirmPassword}
                                        onChange={(event) => setConfirmPassword(event.target.value)}
                                        placeholder="Confirm your password"
                                        className="w-full rounded-lg border border-plum-900/15 bg-white py-3 pl-11 pr-12 text-sm text-plum-900 outline-none transition placeholder:text-ink-soft/50 focus:border-sand-500 focus:ring-2 focus:ring-sand-500/20"
                                    />

                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword((value) => !value)}
                                        aria-label={
                                            showConfirmPassword
                                                ? "Hide confirm password"
                                                : "Show confirm password"
                                        }
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-plum-900/50 hover:text-plum-900"
                                    >
                                        {showConfirmPassword ? (
                                            <EyeOff size={18} />
                                        ) : (
                                            <Eye size={18} />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={submitting}
                                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-plum-900 px-5 py-3.5 text-sm font-semibold text-cream-100 shadow-md transition hover:bg-plum-800 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {submitting ? "Creating account..." : "Create account"}

                                {!submitting && <ArrowRight size={17} />}
                            </button>
                        </form>

                        <div className="my-6 border-t border-plum-900/10" />

                        <p className="text-center text-sm text-ink-soft">
                            Already have an account?{" "}

                            <Link
                                to="/login"
                                className="font-semibold text-plum-900 underline decoration-sand-500 decoration-2 underline-offset-4 hover:text-sand-700"
                            >
                                Sign in
                            </Link>
                        </p>

                    </div>
                </section>
            </div>
        </main>
    );
}
