
import { useState } from "react";
import {
  ArrowLeft,
  UserRound,
  ShieldCheck,
  Mail,
  Phone,
  LogOut,
  Pencil,
  Share2,
  X,
  Building2,
  Copy,
  Check,
} from "lucide-react";

export default function ProfilePage({
  user,
  properties = [],
  onBack,
  onLogout,
  onUpdateProfile,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [formData, setFormData] = useState({
    name: user?.name || user?.firstName || "",
    phoneNumber: user?.phoneNumber || "",
  });

  const formatName = (rawName) => {
    if (!rawName) return "HomeTrust User";

    return rawName.includes(" ")
      ? rawName
      : rawName.replace(/([a-z])([A-Z])/g, "$1 $2");
  };

  const userName = formatName(user?.name || user?.firstName);
  const userEmail = user?.email || "No email available";
  const userRole = user?.role || "User";
  const userPhone = user?.phoneNumber || "No phone number added";
  const propertyCount = Array.isArray(properties) ? properties.length : 0;

  const initials = userName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

  const permissionText =
    userRole.toLowerCase() === "tenant"
      ? "Collaborative & Dispute Access"
      : "Full Portfolio & Layout Control";

  const handleEditOpen = () => {
    setFormData({
      name: user?.name || user?.firstName || "",
      phoneNumber: user?.phoneNumber || "",
    });
    setSaveMessage("");
    setIsEditing(true);
  };

  const handleSave = (event) => {
    event.preventDefault();

    const cleanedName = formData.name.trim();
    const cleanedPhone = formData.phoneNumber.trim();

    if (!cleanedName) {
      setSaveMessage("Please enter your name.");
      return;
    }

    if (typeof onUpdateProfile !== "function") {
      setSaveMessage("Profile updates are not connected yet.");
      return;
    }

    onUpdateProfile({
      name: cleanedName,
      phoneNumber: cleanedPhone,
    });

    setSaveMessage("");
    setIsEditing(false);
  };

  const handleShare = async () => {
    const shareData = {
      title: "HomeTrust",
      text: "HomeTrust helps landlords and tenants document property conditions and work together on inspections.",
      url: window.location.origin,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setShareMessage("");
        setIsSharing(false);
        return;
      }

      await navigator.clipboard.writeText(
        `${shareData.text}\n${shareData.url}`,
      );

      setShareMessage("HomeTrust introduction copied!");
      setIsSharing(true);
    } catch (error) {
      if (error?.name === "AbortError") return;

      setShareMessage("Sharing isn't available here. Please copy the app URL from your browser.");
      setIsSharing(true);
    }
  };

  const accountRows = [
    {
      label: "Email address",
      value: userEmail,
      icon: Mail,
    },
    {
      label: "Phone number",
      value: userPhone,
      icon: Phone,
    },
    {
      label: "Permissions",
      value: permissionText,
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100 sm:p-6 font-sans">
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col overflow-hidden bg-white text-slate-900 shadow-xl sm:min-h-190 sm:rounded-[36px] sm:border sm:border-slate-200">
        {/* Purple hero section */}
        <section className="relative overflow-hidden bg-linear-to-br from-[#35104F] via-[#4A1E6D] to-[#7139A0] px-6 pb-10 pt-5 text-white">
          {/* Decorative bubbles */}
          <div className="pointer-events-none absolute -right-12 top-8 h-40 w-40 rounded-full border border-white/10 bg-white/5" />
          <div className="pointer-events-none absolute -right-2 top-24 h-24 w-24 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -bottom-12 -left-10 h-36 w-36 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute left-1/2 top-36 h-3 w-3 rounded-full bg-purple-200/40" />

          <header className="relative z-10 flex items-center justify-between">
            <button
              type="button"
              onClick={onBack}
              aria-label="Go back"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 transition hover:bg-white/20"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <h1 className="text-base font-extrabold tracking-wide">
              My Profile
            </h1>

            <button
              type="button"
              onClick={handleShare}
              aria-label="Share HomeTrust"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 transition hover:bg-white/20"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </header>

          <div className="relative z-10 mt-8 flex flex-col items-center text-center">
            <div className="relative">
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/70 bg-purple-100 text-3xl font-extrabold text-[#4A1E6D] shadow-xl">
                {initials || <UserRound className="h-10 w-10" />}
              </div>

              <span className="absolute bottom-1 right-0 h-5 w-5 rounded-full border-2 border-[#4A1E6D] bg-emerald-400" />
            </div>

            <h2 className="mt-4 max-w-full wrap-break-word text-2xl font-extrabold">
              {userName}
            </h2>

            <span className="mt-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest">
              {userRole}
            </span>

            <p className="mt-3 max-w-xs text-sm leading-relaxed text-purple-100">
              Your HomeTrust account and property workspace
            </p>

            <div className="mt-5 flex w-full max-w-xs gap-3">
              <button
                type="button"
                onClick={handleEditOpen}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-[#4A1E6D] shadow-md transition hover:bg-purple-50"
              >
                <Pencil className="h-4 w-4" />
                Edit profile
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/20"
              >
                <Share2 className="h-4 w-4" />
                Share
              </button>
            </div>
          </div>
        </section>

        {/* Main content */}
        <main className="flex-1 space-y-6 px-5 py-6">
          {/* Property count only — no duplicate inspection/report stats */}
          <section className="flex items-center justify-between rounded-3xl border border-purple-100 bg-linear-to-r from-purple-50 to-white p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                My properties
              </p>
              <p className="mt-1 text-3xl font-extrabold text-[#4A1E6D]">
                {propertyCount}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {propertyCount === 1 ? "Property in your workspace" : "Properties in your workspace"}
              </p>
            </div>

            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#4A1E6D] text-white shadow-lg shadow-purple-200">
              <Building2 className="h-7 w-7" />
            </div>
          </section>

          {/* Account information */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">
                Account information
              </h3>
              <button
                type="button"
                onClick={handleEditOpen}
                className="text-xs font-bold text-[#6B2B91] hover:underline"
              >
                Edit details
              </button>
            </div>

            <div className="space-y-1 rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
              {accountRows.map(({ label, value, icon: Icon }, index) => (
                <div
                  key={label}
                  className={`flex min-w-0 items-center gap-3 rounded-2xl p-3 ${
                    index !== accountRows.length - 1
                      ? "border-b border-slate-100"
                      : ""
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-[#5B267F]">
                    <Icon className="h-4.5 w-4.5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {label}
                    </p>
                    <p className="mt-1 wrap-break-word text-sm font-bold text-slate-800">
                      {value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {shareMessage && (
            <div
              role="status"
              className="rounded-2xl bg-purple-50 p-3 text-sm font-medium text-[#4A1E6D]"
            >
              {shareMessage}
            </div>
          )}
        </main>

        {/* Sign out */}
        <footer className="border-t border-slate-100 bg-white p-5">
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 py-3.5 text-sm font-extrabold text-red-600 transition hover:bg-red-100"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>

          <p className="mt-3 text-center text-[10px] font-medium tracking-wide text-slate-400">
            HOME TRUST · YOUR PROPERTY RECORDS, TOGETHER
          </p>
        </footer>

        {/* Edit profile modal */}
        {isEditing && (
          <div
            className="absolute inset-0 z-30 flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setIsEditing(false);
              }
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-profile-title"
              className="w-full rounded-t-[30px] bg-white p-6 shadow-2xl sm:rounded-3xl"
            >
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2
                    id="edit-profile-title"
                    className="text-lg font-extrabold text-slate-900"
                  >
                    Edit profile
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Update your personal details.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  aria-label="Close edit profile"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label
                    htmlFor="profile-name"
                    className="mb-1.5 block text-xs font-bold text-slate-700"
                  >
                    Full name
                  </label>
                  <input
                    id="profile-name"
                    type="text"
                    autoComplete="name"
                    value={formData.name}
                    onChange={(event) =>
                      setFormData((previous) => ({
                        ...previous,
                        name: event.target.value,
                      }))
                    }
                    required
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                    placeholder="Enter your full name"
                  />
                </div>

                <div>
                  <label
                    htmlFor="profile-phone"
                    className="mb-1.5 block text-xs font-bold text-slate-700"
                  >
                    Phone number
                  </label>
                  <input
                    id="profile-phone"
                    type="tel"
                    autoComplete="tel"
                    value={formData.phoneNumber}
                    onChange={(event) =>
                      setFormData((previous) => ({
                        ...previous,
                        phoneNumber: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                    placeholder="Enter your phone number"
                  />
                </div>

                <div>
                  <label
                    htmlFor="profile-email"
                    className="mb-1.5 block text-xs font-bold text-slate-700"
                  >
                    Email address
                  </label>
                  <input
                    id="profile-email"
                    type="email"
                    value={userEmail}
                    readOnly
                    className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
                  />
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Email changes should be verified through your account settings.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="profile-role"
                    className="mb-1.5 block text-xs font-bold text-slate-700"
                  >
                    Account role
                  </label>
                  <input
                    id="profile-role"
                    type="text"
                    value={userRole}
                    readOnly
                    className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
                  />
                </div>

                {saveMessage && (
                  <p role="alert" className="text-xs font-semibold text-red-600">
                    {saveMessage}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full rounded-2xl bg-[#4A1E6D] py-3.5 text-sm font-extrabold text-white transition hover:bg-[#35104F]"
                >
                  Save changes
                </button>

                <p className="text-center text-[11px] leading-relaxed text-slate-400">
                  Profile saving currently updates this app session. Persistent
                  account updates will be connected to the backend user API.
                </p>
              </form>
            </section>
          </div>
        )}

        {/* Share fallback */}
        {isSharing && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-5">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="share-title"
              className="w-full rounded-3xl bg-white p-5 shadow-2xl"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2
                    id="share-title"
                    className="text-lg font-extrabold text-slate-900"
                  >
                    Share HomeTrust
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    Share the app, not your private profile information.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSharing(false)}
                  aria-label="Close share dialog"
                  className="rounded-full bg-slate-100 p-2 text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="mt-4 wrap-break-word rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                {shareMessage || window.location.origin}
              </p>

              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(window.location.origin);
                    setShareMessage("App link copied!");
                  } catch {
                    setShareMessage(
                      `Copy this link manually: ${window.location.origin}`,
                    );
                  }
                }}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#4A1E6D] py-3 text-sm font-bold text-white"
              >
                {shareMessage === "App link copied!" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                Copy app link
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
