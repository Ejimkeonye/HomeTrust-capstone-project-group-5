import { ArrowLeft, User, Shield, Mail, Phone, LogOut } from "lucide-react";

export default function ProfilePage({ user, onBack, onLogout }) {
  // Fallback data if user details are minimal
  const userName = user?.name || user?.firstName || "Clement John";
  const userEmail = user?.email || "clement@example.com";
  const userRole = user?.role || "Landlord";
  const userPhone = user?.phoneNumber || "+234 800 000 0000";

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-0 sm:p-6 font-sans">
      <div className="w-full max-w-md bg-white min-h-screen sm:min-h-203 sm:rounded-[48px] shadow-2xl border border-slate-200 flex flex-col justify-between overflow-hidden relative text-slate-900">
        
        {/* Header */}
        <div className="p-4 flex items-center justify-between z-10 gap-2 bg-[#4A1E6D] text-white">
          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 cursor-pointer shrink-0 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-extrabold text-white text-center truncate">
            My Profile
          </h1>
          <div className="w-9" /> {/* Spacer */}
        </div>

        {/* Content */}
        <div className="px-6 py-8 flex-1 space-y-6 overflow-y-auto">
          {/* Avatar & Name Section */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-20 h-20 rounded-full bg-purple-100 border-2 border-purple-800 flex items-center justify-center text-purple-900 shadow-md">
              <User className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">{userName}</h2>
              <span className="inline-block mt-1 px-3 py-1 rounded-full bg-purple-100 text-purple-900 text-xs font-extrabold uppercase tracking-wide">
                Role: {userRole}
              </span>
            </div>
          </div>

          {/* Details Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-4 shadow-2xs">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Account Information</h3>
            
            <div className="flex items-center gap-3.5 text-xs text-slate-700 font-medium">
              <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-purple-800 shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Email Address</p>
                <p className="truncate font-bold text-slate-900">{userEmail}</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 text-xs text-slate-700 font-medium">
              <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-purple-800 shrink-0">
                <Phone className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Phone Number</p>
                <p className="truncate font-bold text-slate-900">{userPhone}</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 text-xs text-slate-700 font-medium">
              <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-purple-800 shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Permissions Status</p>
                <p className="truncate font-bold text-slate-900">
                  {userRole.toLowerCase() === "tenant" ? "Collaborative & Dispute Access" : "Full Portfolio & Layout Control"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Logout Button */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <button
            type="button"
            onClick={onLogout}
            className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-extrabold py-3.5 rounded-2xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>

      </div>
    </div>
  );
}