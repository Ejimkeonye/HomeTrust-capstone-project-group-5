import { useState } from "react";
import { Building2, CheckCircle, Lock, User, ArrowRight } from "lucide-react";

export default function PartyOnboardingPage({
  token,
  property,
  onCompleteOnboarding,
}) {
  // Resolve property data safely from props or localStorage
  const activeProperty =
    property ||
    (() => {
      if (!token) return null;
      try {
        // 1. Try Base64 decoding fallback
        const parsed = JSON.parse(atob(token));
        return {
          id: parsed.propId,
          name: parsed.propName,
          invitedRole: parsed.role,
        };
      } catch {
        // 2. Fall back to searching homecompa_properties in localStorage
        const saved = JSON.parse(
          localStorage.getItem("homecompa_properties") || "[]",
        );
        return (
          saved.find((p) => p.inviteToken === token || p.id === token) || null
        );
      }
    })();

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // Determine invited role dynamically (defaults to 'tenant' if unspecified)
  const invitedRole = activeProperty?.invitedRole || "tenant";
  const isLandlord = invitedRole === "landlord";

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!fullName.trim() || password.length < 6) {
      setError(
        "Please provide your full name and a password with at least 6 characters.",
      );
      return;
    }

    const cleanName = fullName.trim();
    const cleanEmail = `${cleanName.toLowerCase().replace(/\s+/g, "")}@${invitedRole}.local`;
    const targetPropId = activeProperty?.id || token;

    // 1. Create user object
    const newUser = {
      id: `usr-${Date.now()}`,
      name: cleanName,
      email: cleanEmail,
      password: password,
      role: invitedRole,
      activePropertyId: targetPropId,
    };

    // 2. Register user in homecompa_users_db
    const savedUsers = JSON.parse(
      localStorage.getItem("homecompa_users_db") || "[]",
    );
    const userIndex = savedUsers.findIndex(
      (u) =>
        u.name?.toLowerCase() === cleanName.toLowerCase() &&
        u.role === invitedRole,
    );

    if (userIndex >= 0) {
      savedUsers[userIndex] = newUser;
    } else {
      savedUsers.push(newUser);
    }
    localStorage.setItem("homecompa_users_db", JSON.stringify(savedUsers));

    // 3. Link party to property in homecompa_properties
    const savedProps = JSON.parse(
      localStorage.getItem("homecompa_properties") || "[]",
    );
    const updatedProps = savedProps.map((p) => {
      if (p.inviteToken === token || p.id === targetPropId) {
        return {
          ...p,
          ...(isLandlord
            ? {
                landlordId: newUser.id,
                landlordName: cleanName,
                landlordEmail: cleanEmail,
              }
            : {
                tenantId: newUser.id,
                tenantName: cleanName,
                tenantEmail: cleanEmail,
              }),
          status: "Party Joined",
        };
      }
      return p;
    });
    localStorage.setItem("homecompa_properties", JSON.stringify(updatedProps));

    // 4. Set Session Storage & Local Storage
    const sessionData = {
      ...newUser,
      activePropertyId: targetPropId,
    };

    localStorage.setItem("homecompa_token", `token-${Date.now()}`);
    localStorage.setItem("homecompa_user", JSON.stringify(newUser));
    localStorage.setItem(
      "homecompa_current_session",
      JSON.stringify(sessionData),
    );

    // 5. Complete onboarding
    onCompleteOnboarding(sessionData);
  };

  if (!activeProperty && !token) {
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
            {isLandlord ? "Landlord" : "Tenant"} Joint Inspection Invitation
          </span>
          <h2 className="text-2xl font-extrabold text-slate-900">
            Welcome to Hometrust
          </h2>
          <p className="text-xs text-slate-600">
            You've been invited to participate in a joint property inspection as
            the{" "}
            <span className="font-bold">
              {isLandlord ? "Landlord" : "Tenant"}
            </span>
            .
          </p>
        </div>

        {/* Property Summary Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Building2 className="w-4 h-4 text-purple-800" />
            {activeProperty?.name || "Assigned Property"}
          </div>
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            Property record verified & ready for walkthrough
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg">
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-800 focus:outline-none"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Minimum 6 characters to secure your digital signatures.
            </p>
          </div>

          <button
            type="submit"
            className="w-full bg-purple-800 hover:bg-purple-900 text-white font-semibold py-3 rounded-lg text-sm transition-colors shadow flex items-center justify-center gap-2 cursor-pointer"
          >
            Access Property Inspection <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
