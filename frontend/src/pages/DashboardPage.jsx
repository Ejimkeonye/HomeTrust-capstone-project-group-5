import { useState } from "react";
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
  onViewEvidence,
}) {
  const [activeTab, setActiveTab] = useState("home");
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);
  const [showAddPropertyModal, setShowAddPropertyModal] = useState(false);

  // New Property Form State
  const [newAddress, setNewAddress] = useState("");
  const [newFlatNo, setNewFlatNo] = useState("");

  const firstName = user?.name ? user.name.split(" ")[0] : user?.firstName || "Clement";
  const defaultImage = "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=400&q=80";

  const handleCreatePropertySubmit = (e) => {
    e.preventDefault();
    if (!newAddress.trim()) return;
    onAddNewProperty({
      address: newAddress,
      flatNo: newFlatNo || "Main House",
      image: defaultImage,
    });
    setNewAddress("");
    setNewFlatNo("");
    setShowAddPropertyModal(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-0 sm:p-6 font-sans">
      <div className="w-full max-w-md bg-white min-h-screen sm:min-h-211 sm:rounded-[48px] shadow-2xl border border-slate-200 flex flex-col justify-between overflow-hidden relative pb-24">
        
        {/* ADD PROPERTY MODAL */}
        {showAddPropertyModal && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-4xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-200">
              <h3 className="text-sm font-extrabold text-purple-900">Add New Property / Unit</h3>
              <form onSubmit={handleCreatePropertySubmit} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700">Property Address</label>
                  <input
                    type="text"
                    required
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    placeholder="e.g. 14 Admiralty Way, Lekki"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-purple-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700">Unit / Flat Number</label>
                  <input
                    type="text"
                    value={newFlatNo}
                    onChange={(e) => setNewFlatNo(e.target.value)}
                    placeholder="e.g. Flat 3B"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-purple-800"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddPropertyModal(false)}
                    className="flex-1 bg-slate-100 text-slate-600 font-bold py-2.5 rounded-xl text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-purple-800 text-white font-bold py-2.5 rounded-xl text-xs hover:bg-purple-900 cursor-pointer"
                  >
                    Save Property
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="p-6 pt-10 pb-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Good morning, {firstName}
            </h1>
            <button onClick={onLogout} className="p-2 text-slate-400 hover:text-red-500 transition-colors cursor-pointer" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
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
                      Active Property
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
                onClick={() => setShowAddPropertyModal(true)}
                className="bg-purple-50 border-2 border-dashed border-purple-300 rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-purple-100/50 transition-all"
              >
                <Building2 className="w-8 h-8 text-purple-800 mb-1" />
                <h3 className="text-xs font-bold text-purple-900">No properties added yet</h3>
                <p className="text-[11px] text-purple-700/80 mt-0.5">Click here to add your first property unit</p>
              </div>
            )}

            {/* Dropdown Menu for Properties */}
            {showPropertyDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 max-h-48 overflow-y-auto p-2 space-y-1">
                {properties.map((prop) => (
                  <div
                    key={prop.id}
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
                      <span className="text-[10px] text-slate-400 font-normal">Flat {prop.flatNo}</span>
                    </div>

                    {/* Delete property button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Are you sure you want to delete "${prop.address}"?`)) {
                          onDeleteProperty(prop.id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                      title="Delete Property"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    setShowPropertyDropdown(false);
                    setShowAddPropertyModal(true);
                  }}
                  className="w-full mt-1 bg-purple-50 text-purple-900 hover:bg-purple-100 p-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add New Property
                </button>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="space-y-3">
            <h2 className="text-sm font-extrabold text-slate-900">Quick actions</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={!activeProperty}
                onClick={() => activeProperty && onStartInspection(activeProperty)}
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
                onClick={onViewReport}
                className="bg-white border border-purple-200 hover:border-purple-300 disabled:border-slate-200 text-purple-900 rounded-2xl p-4 flex flex-col items-center justify-center text-center transition-all cursor-pointer disabled:cursor-not-allowed shadow-xs min-h-30"
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
            <h2 className="text-sm font-extrabold text-slate-900">Inspection Progress</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span>{activeProperty?.address || "No property selected"}</span>
                <span>{activeProperty?.progress || 0}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-purple-800 h-full rounded-full transition-all duration-500"
                  style={{ width: `${activeProperty?.progress || 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="absolute bottom-5 left-5 right-5 bg-white rounded-full border border-slate-200 shadow-xl p-2 flex items-center justify-around z-10">
          <button type="button" onClick={() => setActiveTab("home")} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${activeTab === "home" ? "bg-purple-800 text-white" : "text-slate-700 hover:bg-slate-100"}`}>
            <Home className="w-5 h-5" />
          </button>
          <button type="button" onClick={() => { setActiveTab("inspection"); if(activeProperty) onStartInspection(activeProperty); }} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${activeTab === "inspection" ? "bg-purple-800 text-white" : "text-slate-700 hover:bg-slate-100"}`}>
            <Search className="w-5 h-5" />
          </button>
          <button type="button" onClick={() => { setActiveTab("evidence"); if (onViewEvidence) onViewEvidence(); }} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${activeTab === "evidence" ? "bg-purple-800 text-white" : "text-slate-700 hover:bg-slate-100"}`}>
            <ShieldCheck className="w-5 h-5" />
          </button>
          <button type="button" onClick={() => { setActiveTab("report"); if (onViewReport) onViewReport(); }} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${activeTab === "report" ? "bg-purple-800 text-white" : "text-slate-700 hover:bg-slate-100"}`}>
            <FileText className="w-5 h-5" />
          </button>
          <button type="button" onClick={() => setActiveTab("profile")} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${activeTab === "profile" ? "bg-purple-800 text-white" : "text-slate-700 hover:bg-slate-100"}`}>
            <User className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}