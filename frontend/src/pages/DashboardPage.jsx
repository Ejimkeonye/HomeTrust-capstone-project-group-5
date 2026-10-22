import { useState } from "react";

import CreatePropertyModal from "../components/CreatePropertyModal";

import {
  Home,
  Search,
  ShieldCheck,
  User,
  Camera,
  LineChart,
  LogOut,
  FileText,
  Plus,
  ChevronDown,
  Trash2,
  Building2,
  Bell,
} from "lucide-react";

export default function DashboardPage({
  user,

  properties = [],

  activeProperty,

  onSelectProperty,

  onAddNewProperty,

  onDeleteProperty,

  onLogout,

  onViewReport,

  onStartInspection,

  onStartMoveOutInspection,

  onViewMoveOutReport,

  onViewEvidence,

  onOpenNotifications,

  onOpenProfile,

  hasUnreadNotifications = true,
}) {
  const [activeTab, setActiveTab] = useState("home");

  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);

  const [showAddPropertyModal, setShowAddPropertyModal] = useState(false);

  // Check if user joined via an invitation link*

  const isInvitedParticipant = Boolean(user?.isInvitedParticipant);

  const getFirstName = () => {
    if (!user) return "User";

    const rawName = user.name || user.firstName || "User";

    const formattedName = rawName.includes(" ")
      ? rawName
      : rawName.replace(/([a-z])([A-Z])/g, "$1 $2");

    return formattedName.trim().split(" ")[0];
  };

  const firstName = getFirstName();

  const defaultImage =
    "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=400&q=80";

  const getGreeting = () => {
    const hour = new Date().getHours();

    if (hour < 12) return "Good morning";

    if (hour < 18) return "Good afternoon";

    return "Good evening";
  };

  // App.jsx hydrates these fields from verified backend inspection records.
  const isMoveInFullySigned = activeProperty?.status === "READ_ONLY";

  const isMoveOutLocked = activeProperty?.moveOutStatus === "READ_ONLY";
  const moveInProgress = Math.min(
    100,
    Math.max(0, Number(activeProperty?.progress) || 0),
  );
  const moveOutProgress = Math.min(
    100,
    Math.max(0, Number(activeProperty?.moveOutProgress) || 0),
  );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-0 sm:p-6 font-sans">
      <div className="w-full max-w-6xl mx-auto px-4 bg-white min-h-screen sm:min-h-211 sm:rounded-[48px] shadow-2xl border border-slate-200 flex flex-col justify-between overflow-hidden relative pb-24">
        {!isInvitedParticipant && (
          <CreatePropertyModal
            isOpen={showAddPropertyModal}
            onClose={() => setShowAddPropertyModal(false)}
            onPropertyCreated={(createdProperty) => {
              onAddNewProperty(createdProperty);

              setShowAddPropertyModal(false);
            }}
          />
        )}

        {/* Header */}

        <div className="p-6 pt-10 pb-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-extrabold text-slate-950 tracking-tight">
              {getGreeting()}, {firstName}!
            </h1>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onOpenNotifications}
                className="p-2 text-slate-600 hover:text-purple-900 transition-colors relative cursor-pointer"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />

                {hasUnreadNotifications && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                )}
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="p-2 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-600 font-medium mt-1 leading-snug">
            Manage your rental portfolio & document inspections seamlessly.
          </p>
        </div>

        {/* Content */}

        <div className="px-6 flex-1 overflow-y-auto space-y-6">
          {/* PROPERTY SWITCHER CARD */}

          <div className="relative">
            {activeProperty ? (
              <div
                onClick={() => setShowPropertyDropdown(!showPropertyDropdown)}
                className="bg-slate-50 border border-purple-200 rounded-2xl p-3 flex gap-3.5 items-center shadow-xs cursor-pointer hover:border-purple-400 transition-all"
              >
                <img
                  src={activeProperty?.image || defaultImage}
                  alt={activeProperty?.address}
                  className="w-20 h-20 rounded-xl object-cover shrink-0"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800 bg-purple-100 px-2 py-0.5 rounded-md">
                      Active Property{" "}
                      {isInvitedParticipant ? "(Shared Workspace)" : ""}
                    </span>

                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  </div>

                  <h3 className="text-xs font-bold text-slate-900 leading-tight truncate mt-1">
                    {activeProperty?.address}
                  </h3>

                  <p className="text-[11px] text-slate-500 font-medium">
                    Flat {activeProperty?.flatNo || "1"}
                  </p>
                </div>
              </div>
            ) : (
              <div
                onClick={() =>
                  !isInvitedParticipant && setShowAddPropertyModal(true)
                }
                className={`bg-purple-50 border-2 border-dashed border-purple-300 rounded-2xl p-5 flex flex-col items-center justify-center text-center transition-all ${!isInvitedParticipant ? "cursor-pointer hover:bg-purple-100/50" : "cursor-default"}`}
              >
                <Building2 className="w-8 h-8 text-purple-800 mb-1" />

                <h3 className="text-xs font-bold text-purple-900">
                  No properties assigned yet
                </h3>

                <p className="text-[11px] text-purple-700/80 mt-0.5">
                  {!isInvitedParticipant
                    ? "Click here to add your first property unit"
                    : "Waiting for property assignment"}
                </p>
              </div>
            )}

            {showPropertyDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 max-h-48 overflow-y-auto p-2 space-y-1">
                {properties.map((prop) => (
                  <div
                    key={prop.propertyId || prop.id}
                    className="p-2.5 rounded-xl hover:bg-purple-50 flex items-center justify-between text-xs font-bold text-slate-800 group"
                  >
                    <div
                      onClick={() => {
                        onSelectProperty(prop);

                        setShowPropertyDropdown(false);
                      }}
                      className="flex-1 truncate cursor-pointer pr-2"
                    >
                      <span className="truncate block">{prop.address}</span>

                      <span className="text-[10px] text-slate-400 font-normal">
                        Flat {prop.flatNo}
                      </span>
                    </div>

                    {!isInvitedParticipant && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();

                          if (
                            window.confirm(
                              `Are you sure you want to delete "${prop.address}"?`,
                            )
                          ) {
                            onDeleteProperty(prop.propertyId || prop.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                        title="Delete Property"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}

                {!isInvitedParticipant && (
                  <button
                    onClick={() => {
                      setShowPropertyDropdown(false);

                      setShowAddPropertyModal(true);
                    }}
                    className="w-full mt-1 bg-purple-50 text-purple-900 hover:bg-purple-100 p-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Add New Property
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Quick Actions */}

          <div className="space-y-3">
            <h2 className="text-sm font-extrabold text-slate-900">
              Quick actions
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={!activeProperty}
                onClick={() =>
                  activeProperty && onStartInspection(activeProperty)
                }
                className="bg-purple-800 hover:bg-purple-900 disabled:bg-slate-300 text-white rounded-2xl p-4 flex flex-col items-center justify-center text-center transition-all cursor-pointer disabled:cursor-not-allowed shadow-sm min-h-30"
              >
                <Camera className="w-6 h-6 text-white mb-2" />

                <span className="text-xs font-bold leading-tight">
                  Start inspection <br /> for this unit
                </span>
              </button>

              <button
                type="button"
                disabled={!activeProperty}
                onClick={() => activeProperty && onViewReport?.(activeProperty)}
                className="bg-white border border-purple-200 hover:border-purple-300 disabled:border-slate-200 text-purple-900 rounded-2xl p-4 flex flex-col items-center justify-center text-center transition-all cursor-pointer disabled:cursor-not-allowed shadow-xs min-h-30"
              >
                <LineChart className="w-6 h-6 text-purple-800 mb-2" />

                <span className="text-xs font-bold text-slate-600 leading-tight">
                  View Inspection <br /> Report
                </span>
              </button>
            </div>
          </div>

          {/* Move-In Inspection Progress */}

          <div className="space-y-3 pt-1">
            <h2 className="text-sm font-extrabold text-slate-900">
              Move-In Inspection Progress
            </h2>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span>{activeProperty?.address || "No property selected"}</span>

                <span>{moveInProgress}%</span>
              </div>

              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-purple-800 h-full rounded-full transition-all duration-500"
                  style={{ width: `${moveInProgress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Move-Out Compartment Card (Gated until Move-In is Fully Signed by BOTH parties) */}

          <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-extrabold text-slate-900">
                  Move-Out Compartment
                </h2>

                <p className="text-[10px] text-slate-500">
                  Record property state upon departure.
                </p>
              </div>

              <span
                className={`text-[10px] px-2.5 py-1 rounded-full font-extrabold ${
                  isMoveInFullySigned
                    ? "bg-purple-100 text-purple-900"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                {isMoveInFullySigned ? "Ready" : "Locked"}
              </span>
            </div>

            {isMoveInFullySigned ? (
              <div className="space-y-2">
                {isMoveOutLocked ? (
                  <button
                    type="button"
                    onClick={() =>
                      activeProperty &&
                      onViewMoveOutReport &&
                      onViewMoveOutReport(activeProperty)
                    }
                    className="w-full bg-purple-100 text-[#4A1E6D] border border-purple-300 hover:bg-purple-200 font-extrabold text-xs py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                  >
                    <FileText className="w-4 h-4" /> View Final Move-Out Report
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        activeProperty &&
                        onViewMoveOutReport &&
                        onViewMoveOutReport(activeProperty)
                      }
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold text-xs py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5" /> View Report
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        activeProperty &&
                        onStartMoveOutInspection &&
                        onStartMoveOutInspection(activeProperty)
                      }
                      className="bg-[#4A1E6D] hover:bg-purple-950 text-white font-extrabold text-xs py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Camera className="w-3.5 h-3.5" /> Start Walkthrough
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 font-medium text-center py-2 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                🔒 Move-out unlocks after both Landlord and Tenant sign the
                Move-In report.
              </div>
            )}
          </div>

          {/* Move-Out Inspection Progress */}

          {isMoveInFullySigned && (
            <div className="space-y-3 pt-1">
              <h2 className="text-sm font-extrabold text-slate-900">
                Move-Out Inspection Progress
              </h2>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>
                    {activeProperty?.address || "No property selected"}
                  </span>

                  <span>{moveOutProgress}%</span>
                </div>

                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-[#4A1E6D] h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${moveOutProgress}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Navigation */}

        <div className="absolute bottom-5 left-5 right-5 bg-white rounded-full border border-slate-200 shadow-xl p-2 flex items-center justify-around z-10">
          <button
            type="button"
            onClick={() => setActiveTab("home")}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${activeTab === "home" ? "bg-purple-800 text-white" : "text-slate-700 hover:bg-slate-100"}`}
          >
            <Home className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("inspection");

              if (activeProperty && onStartInspection) {
                onStartInspection(activeProperty);
              } else {
                alert("Please select a property unit first to inspect.");
              }
            }}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${activeTab === "inspection" ? "bg-purple-800 text-white" : "text-slate-700 hover:bg-slate-100"}`}
          >
            <Search className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("evidence");

              if (onViewEvidence) onViewEvidence();
            }}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${activeTab === "evidence" ? "bg-purple-800 text-white" : "text-slate-700 hover:bg-slate-100"}`}
          >
            <ShieldCheck className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("report");

              if (activeProperty && onViewReport) onViewReport(activeProperty);
            }}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${activeTab === "report" ? "bg-purple-800 text-white" : "text-slate-700 hover:bg-slate-100"}`}
          >
            <FileText className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("profile");

              if (onOpenProfile) onOpenProfile();
            }}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${activeTab === "profile" ? "bg-purple-800 text-white" : "text-slate-700 hover:bg-slate-100"}`}
          >
            <User className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
