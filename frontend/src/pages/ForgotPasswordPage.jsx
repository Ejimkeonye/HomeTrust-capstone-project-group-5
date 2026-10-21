import { useState } from "react";
import { ArrowLeft, KeyRound, Mail, ShieldCheck } from "lucide-react";
import api from "../api/client";

export default function ForgotPasswordPage({ onBack, onNavigateToLogin }) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resetComplete, setResetComplete] = useState(false);

  const getErrorMessage = (err, fallback) =>
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    err?.message ||
    fallback;

  const handleSendCode = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    const normalisedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalisedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      // api/client adds the configured API base URL (normally /api).
      await api.post("/auth/forgot-password", { email: normalisedEmail });
      setEmail(normalisedEmail);
      setStep(2);
      setNotice(
        "If an account matches this email, a reset code has been requested. Check your inbox and spam folder. The code expires after 10 minutes.",
      );
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "We couldn't request a reset code right now. Please try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the six-digit code from your email.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Your new password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", {
        email: email.trim().toLowerCase(),
        code: code.trim(),
        newPassword,
      });
      setResetComplete(true);
      setNotice(
        "Your password has been reset successfully. You can now sign in with your new password.",
      );
      setCode("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "We couldn't reset your password. Check the code and try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 2 && !resetComplete) {
      setStep(1);
      setCode("");
      setError("");
      setNotice("");
      return;
    }
    if (onBack) onBack();
    else if (onNavigateToLogin) onNavigateToLogin();
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 flex items-center justify-center">
      <div className="w-full max-w-md">
        <button
          type="button"
          onClick={handleBack}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={18} />
          {step === 2 && !resetComplete ? "Back" : "Back to sign in"}
        </button>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            {resetComplete ? (
              <ShieldCheck size={25} />
            ) : step === 1 ? (
              <Mail size={25} />
            ) : (
              <KeyRound size={25} />
            )}
          </div>

          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-blue-700">
            HomeCompa account security
          </p>
          <h1 className="text-2xl font-bold text-slate-900">
            {resetComplete
              ? "Password reset complete"
              : step === 1
                ? "Forgot your password?"
                : "Reset your password"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {resetComplete
              ? "Your account password has been updated."
              : step === 1
                ? "Enter the email address associated with your account and we'll request a reset code."
                : `Enter the six-digit code sent to ${email}. Choose a new password to finish.`}
          </p>

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}
          {notice && (
            <div
              role="status"
              className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
            >
              {notice}
            </div>
          )}

          {!resetComplete && step === 1 && (
            <form onSubmit={handleSendCode} className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="reset-email"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Email address
                </label>
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-3 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Requesting code…" : "Send reset code"}
              </button>
            </form>
          )}

          {!resetComplete && step === 2 && (
            <form onSubmit={handleResetPassword} className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="reset-code"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Six-digit verification code
                </label>
                <input
                  id="reset-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="123456"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-3 tracking-[0.3em] text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
                <p className="mt-2 text-xs text-slate-500">
                  The code expires after 10 minutes.
                </p>
              </div>

              <div>
                <label
                  htmlFor="new-password"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  New password
                </label>
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-3 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Confirm new password
                </label>
                <input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Re-enter your new password"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-3 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(event) => setShowPassword(event.target.checked)}
                  className="rounded border-slate-300"
                />
                Show passwords
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Resetting password…" : "Reset password"}
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={handleSendCode}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Request another code
              </button>
            </form>
          )}

          {resetComplete && (
            <button
              type="button"
              onClick={onNavigateToLogin || onBack}
              className="mt-6 w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white transition hover:bg-blue-800"
            >
              Return to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
