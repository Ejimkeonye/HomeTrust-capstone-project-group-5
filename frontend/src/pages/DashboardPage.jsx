import { useState, useEffect } from "react";
import {
  Home,
  Search,
  ShieldCheck,
  Bell,
  User,
  Camera,
  LineChart,
  LogOut,
} from "lucide-react";
import CreatePropertyModal from "../components/CreatePropertyModal";

export default function DashboardPage({ user, onLogout, onViewReport, onStartInspection, onOpenInviteModal }) {
  const [properties, setProperties] = useState(() => {
    try {
      const saved = localStorage.getItem("homecompa_properties");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error(e);
      return [];
    }
  });

  const [activeTab, setActiveTab] = useState("home");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const firstName = user?.name ? user.name.split(" ")[0] : "Clement";

  useEffect(() => {
    localStorage.setItem("homecompa_properties", JSON.stringify(properties));
  }, [properties]);

  const userProperties = properties.filter((prop) => {
    return (
      prop.createdById === user?.id ||
      prop.landlordId === user?.id ||
      prop.tenantEmail?.toLowerCase() === user?.email?.toLowerCase() ||
      (user?.flatNo && prop.flatNo === user?.flatNo)
    );
  });

  const defaultImage = "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=400&q=80";

  const activeProperty = userProperties[0] || {
    id: "demo-1",
    name: "No 2, sunshine estate, Ikeja city, Lagos",
    address: "No 2, sunshine estate, Ikeja city, Lagos",
    flatNo: user?.flatNo || "2",
    image: defaultImage,
    progress: 80,
  };

  const handlePropertyCreated = (newProperty) => {
    const formattedProperty = {
      ...newProperty,
      id: newProperty.id || `prop-${Date.now()}`,
      createdById: user?.id,
      landlordId: user?.role === "landlord" ? user?.id : newProperty.landlordId,
      tenantEmail: user?.role === "tenant" ? user?.email : newProperty.tenantEmail,
      inviteToken:
        newProperty.inviteToken ||
        `token-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      inspectionData: newProperty.inspectionData || {},
      createdAt: newProperty.createdAt || new Date().toLocaleDateString(),
      image: newProperty.image || defaultImage,
      progress: 0,
    };

    const updated = [formattedProperty, ...properties];
    setProperties(updated);
    setIsModalOpen(false);
    if (onOpenInviteModal) onOpenInviteModal(formattedProperty);
  };

  const handleTriggerInspection = () => {
    const targetProp = {
      ...activeProperty,
      image: activeProperty?.image || defaultImage,
    };

    if (onStartInspection) {
      onStartInspection(targetProp);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-0 sm:p-6 font-sans">
      <div className="w-full max-w-md bg-white min-h-screen sm:min-h-211 sm:rounded-[48px] shadow-2xl border border-slate-200 flex flex-col justify-between overflow-hidden relative pb-24">
        
        {/* Header */}
        <div className="p-6 pt-10 pb-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Good morning, {firstName}
            </h1>
            <button
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-600 font-medium mt-1 leading-snug">
            Let's get your new home documented <br />
            and keep your rights protected
          </p>
        </div>

        {/* Content */}
        <div className="px-6 flex-1 overflow-y-auto space-y-6">
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex gap-3.5 items-center shadow-xs">
            <img
              src={activeProperty.image || defaultImage}
              alt={activeProperty.address || "Property preview"}
              className="w-24 h-20 rounded-xl object-cover shrink-0"
              onError={(e) => {
                e.target.src = defaultImage;
              }}
            />
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-bold text-slate-900 leading-tight truncate">
                {activeProperty.address || activeProperty.name || "No 2, sunshine estate, Ikeja city, Lagos"}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium mt-1">
                Flat {activeProperty.flatNo || "2"}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-3">
            <h2 className="text-sm font-extrabold text-slate-900">Quick actions</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleTriggerInspection}
                className="bg-purple-800 hover:bg-purple-900 text-white rounded-2xl p-4 flex flex-col items-center justify-center text-center transition-all cursor-pointer shadow-sm min-h-30"
              >
                <Camera className="w-6 h-6 text-white mb-2" />
                <span className="text-xs font-bold leading-tight">
                  Start move-in <br /> Inspection
                </span>
              </button>

              <button
                type="button"
                onClick={onViewReport}
                className="bg-white border border-purple-200 hover:border-purple-300 text-purple-900 rounded-2xl p-4 flex flex-col items-center justify-center text-center transition-all cursor-pointer shadow-xs min-h-30"
              >
                <LineChart className="w-6 h-6 text-purple-800 mb-2" />
                <span className="text-xs font-bold text-slate-600 leading-tight">
                  View Inspection <br /> Report
                </span>
              </button>
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-3 pt-1">
            <h2 className="text-sm font-extrabold text-slate-900">Your progress</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span>Move in</span>
                <span>{activeProperty.progress || 80}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-purple-800 h-full rounded-full transition-all duration-500"
                  style={{ width: `${activeProperty.progress || 80}%` }}
                />
              </div>
            </div>
          </div>

          {/* Move-out */}
          <div className="space-y-2 pt-1">
            <h2 className="text-sm font-extrabold text-slate-900">Move out</h2>
            <p className="text-[11px] text-slate-400 font-medium">
              Move out will start when move in inspection is completed
            </p>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="absolute bottom-5 left-5 right-5 bg-white rounded-full border border-slate-200 shadow-xl p-2 flex items-center justify-around z-10">
          <button
            type="button"
            onClick={() => setActiveTab("home")}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              activeTab === "home" ? "bg-purple-800 text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <Home className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("inspection");
              handleTriggerInspection();
            }}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              activeTab === "inspection" ? "bg-purple-800 text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <Search className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("report");
              if (onViewReport) onViewReport();
            }}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              activeTab === "report" ? "bg-purple-800 text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("notifications")}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              activeTab === "notifications" ? "bg-purple-800 text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <Bell className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              activeTab === "profile" ? "bg-purple-800 text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <User className="w-5 h-5" />
          </button>
        </div>
      </div>

      <CreatePropertyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onPropertyCreated={handlePropertyCreated}
      />
    </div>
  );
}