import { useState } from "react";
import { X, Send, Copy, Check, Mail, UserCheck } from "lucide-react";
import api from "../api/client"; // Live API client connected to Render backend

export default function InvitePartyModal({
  isOpen,
  onClose,
  property,
  inspectionId,
  currentUserRole,
  onInviteSent,
}) {
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [invitedSuccess, setInvitedSuccess] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen || !property) return null;

  const normalizedRole = (currentUserRole || "").toLowerCase();
  const isLandlord = normalizedRole === "landlord";
  const targetRoleName = isLandlord ? "Tenant" : "Landlord";
  const targetRole = isLandlord ? "TENANT" : "LANDLORD";

  const handleGenerateOrSend = async (targetEmail) => {
    setLoading(true);
    setErrorMsg("");
    try {
      const propId = property.propertyId || property.id;
      const res = await api.post("/invitations", {
        propertyId: propId,
        inspectionId: inspectionId,
        email: targetEmail.trim(),
        targetRole: targetRole,
      });

      const link = res.data?.inviteLink || `https://homebase-frontend-app.vercel.app/join?token=${res.data?.invitation?.token}`;
      setGeneratedLink(link);
      setInvitedSuccess(true);
    } catch (err) {
      console.error("Failed to create invitation:", err);
      setErrorMsg(err?.response?.data?.message || "Failed to generate invite link.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (generatedLink && navigator.clipboard) {
      navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        if (onClose) onClose();
        if (onInviteSent) onInviteSent();
      }, 1000);
    }
  };

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    await handleGenerateOrSend(email);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-white rounded-4xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200 flex flex-col">
        {/* Header */}
        <div className="bg-[#4A1E6D] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-purple-200" />
            <h3 className="text-base font-extrabold">
              Invite {targetRoleName}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-purple-800 text-purple-200 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-slate-900">
          <div className="bg-purple-50/80 p-3.5 rounded-2xl border border-purple-100">
            <p className="text-xs font-extrabold text-purple-950 truncate">
              {property.address || property.name || "Property Inspection Unit"}
            </p>
            <p className="text-[11px] text-purple-800 font-semibold mt-0.5">
              {property.flatNo ? `Flat ${property.flatNo}` : "Inspection Unit"}
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold">
              {errorMsg}
            </div>
          )}

          {invitedSuccess ? (
            <div className="space-y-3">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-1">
                <p className="text-xs font-bold text-emerald-800">
                  Invitation Created Successfully!
                </p>
                <p className="text-[11px] text-emerald-600 font-medium">
                  Copy the secure link below to share with your {targetRoleName.toLowerCase()}.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Secure Shareable Link
                </label>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-xl p-1.5 pl-3">
                  <input
                    type="text"
                    readOnly
                    value={generatedLink}
                    className="bg-transparent text-xs text-slate-600 font-mono flex-1 outline-none truncate"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="bg-purple-100 hover:bg-purple-200 text-purple-900 text-xs font-extrabold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSendInvite} className="space-y-3">
              <label className="block text-xs font-bold text-slate-800">
                Send invite via Email
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    placeholder={`Enter ${targetRoleName.toLowerCase()}'s email`}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-800 focus:bg-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#4A1E6D] hover:bg-purple-950 text-white text-xs font-extrabold px-4 py-2 rounded-xl transition-all flex items-center gap-1 cursor-pointer shrink-0 shadow-xs disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" /> {loading ? "Generating..." : "Generate"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}