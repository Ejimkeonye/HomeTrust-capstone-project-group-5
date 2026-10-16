import { useState } from "react";
import { Building2, CheckCircle, Lock, User, ArrowRight } from "lucide-react";
import api from "../api/client"; // Live API client connected to Render backend

export default function PartyOnboardingPage({
  token,
  onCompleteOnboarding,
}) {
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName.trim() || password.length < 8) {
      setError("Please provide your full name and a password with at least 8 characters.");
      return;
    }

    if (!token) {
      setError("Invalid or missing invitation token.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 🛠️ CALL YOUR REAL BACKEND RESOLVE INVITATION CONTROLLER
      const res = await api.post(`/invitations/resolve/${token}`, {
        name: fullName.trim(),
        password: password,
      });

      const { token: jwtToken, user, propertyId, inspectionId } = res.data;

      // Save valid backend credentials and session data with invitation flag
      localStorage.setItem("hometrust_token", jwtToken);
      localStorage.setItem("hometrust_user", JSON.stringify(user));
      
      const sessionData = {
        ...user,
        activePropertyId: propertyId,
        activeInspectionId: inspectionId,
        isInvitedParticipant: true, // 🛠️ Flags them as joining via invite link
      };
      localStorage.setItem("hometrust_current_session", JSON.stringify(sessionData));

      // Complete onboarding and pass session data up to App.jsx
      if (onCompleteOnboarding) {
        onCompleteOnboarding(sessionData);
      }
    } catch (err) {
      console.error("Failed to resolve invitation on backend:", err);
      setError(err?.response?.data?.message || "Failed to accept invitation. Token may be expired.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white border border-red-200 rounded-2xl shadow-sm text-center space-y-4 font-sans">
        <p className="text-red-600 font-semibold text-sm">
          Invalid or expired invitation link.
        </p>
        <p className="text-xs text-slate-500">
          Please request a new magic link from your property counterpart.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto my-12 px-4 font-sans">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <span className="inline-block px-3 py-1 bg-purple-50 text-purple-800 text-xs font-semibold rounded-full border border-purple-200">
            Joint Property Inspection Invitation
          </span>
          <h2 className="text-2xl font-extrabold text-slate-900">
            Welcome to Hometrust
          </h2>
          <p className="text-xs text-slate-600">
            You've been invited to participate in a collaborative property inspection workspace.
          </p>
        </div>

        {/* Property Summary Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Building2 className="w-4 h-4 text-purple-800" />
            Inspection Workspace
          </div>
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            Secure token verified & ready for walkthrough
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Your Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-800 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Create Access Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-800 focus:outline-none"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Minimum 8 characters to secure your digital signatures.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-800 hover:bg-purple-900 text-white font-semibold py-3 rounded-lg text-sm transition-colors shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span>{loading ? "Joining Workspace..." : "Access Property Inspection"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}