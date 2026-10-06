import { useState } from "react";
import { ArrowLeft, Shield, Mail, KeyRound, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage({ onBack, onNavigateToLogin }) {
  const [step, setStep] = useState(1); // Step 1: Request Email, Step 2: Verify Code & Reset
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSendCode = (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!email.trim()) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    // Front-end simulation: Proceed to code verification step
    setSuccessMessage(`A verification code has been sent to ${email}`);
    setTimeout(() => {
      setSuccessMessage("");
      setStep(2);
    }, 1200);
  };

  const handleResetPassword = (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (code.length < 4) {
      setErrorMessage("Please enter a valid verification code.");
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }

    setSuccessMessage("Password successfully reset! Redirecting to login...");
    setTimeout(() => {
      onNavigateToLogin();
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200 flex flex-col">
        {/* Header Bar */}
        <div className="bg-purple-800 text-white px-5 py-4 flex items-center justify-between border-b border-purple-900">
          <button
            type="button"
            onClick={step === 2 ? () => setStep(1) : onBack}
            className="w-9 h-9 rounded-full bg-purple-700 hover:bg-purple-600 flex items-center justify-center transition-colors cursor-pointer border border-purple-400/30 shadow-sm"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-base font-semibold tracking-wide text-white">
            {step === 1 ? "Forgot Password" : "Verify Code"}
          </h1>
          <div className="w-9"></div>
        </div>

        {/* Hero Banner */}
        <div
          className="relative h-32 bg-cover bg-center flex flex-col items-center justify-center text-center p-4"
          style={{
            backgroundImage: `linear-gradient(to bottom, rgba(15, 23, 42, 0.45), rgba(15, 23, 42, 0.7)), url('https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80')`,
          }}
        >
          <div className="w-10 h-10 rounded-2xl bg-purple-700 flex items-center justify-center text-white mb-1 shadow-md">
            <Shield className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">
            Hometrust
          </h2>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8 bg-white flex-1">
          {errorMessage && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl text-center">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center justify-center gap-2 text-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {step === 1 ? (
            /* STEP 1: Enter Email */
            <form onSubmit={handleSendCode} className="space-y-5">
              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-slate-900">
                  Reset Password
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Enter your registered email address and we'll send you a
                  verification code.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1.5">
                  Email Address
                </label>
                <div className="relative flex items-center">
                  <input
                    type="email"
                    required
                    placeholder="example@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-700 focus:bg-white transition-all"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5" />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-purple-800 hover:bg-purple-900 text-white font-bold text-sm py-3.5 rounded-xl shadow-md transition-all cursor-pointer mt-2"
              >
                Send Code
              </button>
            </form>
          ) : (
            /* STEP 2: Enter Code & New Password */
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-slate-900">
                  Enter Verification Code
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Code sent to{" "}
                  <span className="font-semibold text-purple-900">{email}</span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1.5">
                  Verification Code
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-3 text-sm tracking-widest text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-700 focus:bg-white transition-all"
                  />
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-700 focus:bg-white transition-all"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-purple-800 hover:bg-purple-900 text-white font-bold text-sm py-3.5 rounded-xl shadow-md transition-all cursor-pointer mt-2"
              >
                Reset Password
              </button>
            </form>
          )}

          <div className="text-center text-xs text-slate-500 font-medium mt-6">
            Remembered your password?{" "}
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="text-purple-800 font-bold hover:underline cursor-pointer"
            >
              Sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
