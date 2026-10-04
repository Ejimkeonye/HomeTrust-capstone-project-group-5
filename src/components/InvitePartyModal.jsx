import { useState } from "react";
import { X, Send, Copy, Check, Mail, UserCheck } from "lucide-react";

export default function InvitePartyModal({ isOpen, onClose, property, currentUserRole, onInviteSent }) {
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [invitedSuccess, setInvitedSuccess] = useState(false);

  if (!isOpen || !property) return null;

  // Standardize role comparison
  const normalizedRole = (currentUserRole || "").toLowerCase();
  const isLandlord = normalizedRole === "landlord";
  
  // Dynamic target role based on who is creating/inviting
  const targetRoleName = isLandlord ? "Tenant" : "Landlord";

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const shareableLink = `${baseUrl}/join?propertyId=${property.id}&role=${targetRoleName.toLowerCase()}&token=${property.inviteToken || "demo-token"}`;

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareableLink);
    }
    setCopied(true);
    
    setTimeout(() => {
      setCopied(false);
      if (onClose) onClose();
      if (onInviteSent) onInviteSent(); // Trigger Frame 706
    }, 1000);
  };

  const handleSendInvite = (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      const savedProperties = JSON.parse(localStorage.getItem("homecompa_properties") || "[]");
      const propertyIndex = savedProperties.findIndex((p) => p.id === property.id);

      if (propertyIndex !== -1) {
        if (isLandlord) {
          savedProperties[propertyIndex].tenantEmail = email.trim();
          savedProperties[propertyIndex].tenantInviteStatus = "pending";
        } else {
          savedProperties[propertyIndex].landlordEmail = email.trim();
          savedProperties[propertyIndex].landlordInviteStatus = "pending";
        }
        localStorage.setItem("homecompa_properties", JSON.stringify(savedProperties));
      }
    } catch (err) {
      console.error("Failed to save invitation state:", err);
    }

    setInvitedSuccess(true);
    setTimeout(() => {
      setInvitedSuccess(false);
      setEmail("");
      if (onClose) onClose();
      if (onInviteSent) onInviteSent(); // Trigger Frame 706
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-white rounded-4xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200 flex flex-col">
        
        {/* Dynamic Header */}
        <div className="bg-purple-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-purple-200" />
            <h3 className="text-base font-extrabold">Invite {targetRoleName}</h3>
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
        <div className="p-5 space-y-4">
          <div className="bg-purple-50/80 p-3.5 rounded-2xl border border-purple-100">
            <p className="text-xs font-extrabold text-purple-950 truncate">
              {property.address || property.name || "No 2, sunshine estate, Ikeja city, Lagos"}
            </p>
            <p className="text-[11px] text-purple-800 font-semibold mt-0.5">
              {property.flatNo ? `Flat ${property.flatNo}` : "Inspection Unit"}
            </p>
          </div>

          {invitedSuccess ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-1">
              <p className="text-xs font-bold text-emerald-800">
                Invitation Sent Successfully!
              </p>
              <p className="text-[11px] text-emerald-600 font-medium">
                An invitation email has been recorded for {email}.
              </p>
            </div>
          ) : (
            <>
              {/* Send via Email */}
              <form onSubmit={handleSendInvite} className="space-y-2.5">
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
                    className="bg-purple-900 hover:bg-purple-950 text-white text-xs font-extrabold px-3.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer shrink-0 shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" /> Send
                  </button>
                </div>
              </form>

              <div className="relative flex items-center justify-center my-3">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider absolute">
                  Or share link
                </span>
              </div>

              {/* Copy Link */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Inspection Invitation Link
                </label>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-xl p-1.5 pl-3">
                  <input
                    type="text"
                    readOnly
                    value={shareableLink}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}