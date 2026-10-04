import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, Shield, KeyRound, CheckCircle } from "lucide-react";

export default function LoginPage({ onAuthSuccess, onBack, onNavigateToSignUp }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Forgot Password State
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();
    setErrorMessage("");

    const savedUsers = JSON.parse(localStorage.getItem("homecompa_users_db") || "[]");
    const savedProps = JSON.parse(localStorage.getItem("homecompa_properties") || "[]");
    const cleanInput = identifier.trim().toLowerCase();

    const existingUser = savedUsers.find(
      (u) =>
        (u.email && u.email.toLowerCase() === cleanInput) ||
        (u.name && u.name.toLowerCase() === cleanInput)
    );

    if (!existingUser) {
      setErrorMessage("No account found with that email or name.");
      return;
    }

    if (existingUser.password !== password) {
      setErrorMessage("Incorrect password. Please try again.");
      return;
    }

    const userProp = savedProps.find(
      (p) =>
        (existingUser.activePropertyId && p.id === existingUser.activePropertyId) ||
        (p.tenantId && p.tenantId === existingUser.id) ||
        (p.tenantEmail && p.tenantEmail.toLowerCase() === existingUser.email?.toLowerCase())
    );

    const sessionData = {
      ...existingUser,
      activePropertyId: userProp?.id || existingUser.activePropertyId || null,
    };

    localStorage.setItem("homecompa_token", `token-${Date.now()}`);
    localStorage.setItem("homecompa_user", JSON.stringify(existingUser));
    localStorage.setItem("homecompa_current_session", JSON.stringify(sessionData));

    onAuthSuccess(sessionData);
  };

  // Reset Password Handler
  const handleResetSubmit = (e) => {
    e.preventDefault();
    setErrorMessage("");
    setResetSuccess("");

    const savedUsers = JSON.parse(localStorage.getItem("homecompa_users_db") || "[]");
    const cleanEmail = resetEmail.trim().toLowerCase();

    const userIndex = savedUsers.findIndex(
      (u) => u.email && u.email.toLowerCase() === cleanEmail
    );

    if (userIndex === -1) {
      setErrorMessage("No account found with this email address.");
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage("New password must be at least 6 characters long.");
      return;
    }

    // Update user password in local storage
    savedUsers[userIndex].password = newPassword;
    localStorage.setItem("homecompa_users_db", JSON.stringify(savedUsers));

    setResetSuccess("Password updated successfully! You can now sign in.");
    
    // Switch back to login form after brief delay
    setTimeout(() => {
      setIsResettingPassword(false);
      setIdentifier(resetEmail);
      setPassword("");
      setResetSuccess("");
    }, 1800);
  };

  return (
    <div className="min-h-screen w-full bg-slate-100 flex items-center justify-center p-4 sm:p-8 font-sans">
      
      {/* Container Card */}
      <div className="w-full max-w-md md:max-w-xl bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200 flex flex-col">
        
        {/* Header Bar */}
        <div className="bg-purple-800 text-white px-5 py-4 flex items-center justify-between border-b border-purple-900">
          <button
            type="button"
            onClick={isResettingPassword ? () => setIsResettingPassword(false) : onBack}
            className="w-9 h-9 rounded-full bg-purple-700 hover:bg-purple-600 flex items-center justify-center transition-colors cursor-pointer border border-purple-400/30 shadow-sm"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-base font-semibold tracking-wide text-white">
            {isResettingPassword ? "Reset password" : "Sign in"}
          </h1>
          <div className="w-9"></div>
        </div>

        {/* Hero Banner */}
        <div 
          className="relative h-36 bg-cover bg-center flex flex-col items-center justify-center text-center p-4"
          style={{
            backgroundImage: `linear-gradient(to bottom, rgba(15, 23, 42, 0.45), rgba(15, 23, 42, 0.7)), url('https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80')`
          }}
        >
          <div className="w-10 h-10 rounded-2xl bg-purple-700 flex items-center justify-center text-white mb-1 shadow-md">
            {isResettingPassword ? <KeyRound className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">
            Hometrust
          </h2>
        </div>

        {/* Form Container */}
        <div className="p-6 sm:p-8 bg-white flex-1">
          
          {errorMessage && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl text-center">
              {errorMessage}
            </div>
          )}

          {resetSuccess && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{resetSuccess}</span>
            </div>
          )}

          {!isResettingPassword ? (
            /* --- SIGN IN FORM --- */
            <>
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-slate-900">Welcome back</h3>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Sign in to your account to continue
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1.5">
                    Email address
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="example@gmail.com"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-700 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1.5">
                    Password
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-4 pr-11 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-700 focus:bg-white transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="text-left">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage("");
                      setResetSuccess("");
                      setIsResettingPassword(true);
                    }}
                    className="text-xs text-purple-800 hover:underline font-semibold cursor-pointer"
                  >
                    Forgotten password?
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full bg-purple-800 hover:bg-purple-900 text-white font-bold text-sm py-3.5 rounded-xl shadow-md transition-all cursor-pointer active:scale-[0.99]"
                  >
                    Sign in
                  </button>
                </div>
              </form>

              <div className="text-center text-xs text-slate-500 font-medium mt-6">
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={onNavigateToSignUp}
                  className="text-purple-800 font-bold hover:underline cursor-pointer"
                >
                  Create account
                </button>
              </div>
            </>
          ) : (
            /* --- RESET PASSWORD FORM --- */
            <>
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-slate-900">Reset password</h3>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Enter your registered email and a new password
                </p>
              </div>

              <form onSubmit={handleResetSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1.5">
                    Account Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="example@gmail.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-700 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1.5">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="New password (min 6 characters)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-700 focus:bg-white transition-all"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full bg-purple-800 hover:bg-purple-900 text-white font-bold text-sm py-3.5 rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    Update Password
                  </button>
                </div>
              </form>

              <div className="text-center mt-6">
                <button
                  type="button"
                  onClick={() => setIsResettingPassword(false)}
                  className="text-xs text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                >
                  ← Back to Sign In
                </button>
              </div>
            </>
          )}

        </div>

      </div>
    </div>
  );
}