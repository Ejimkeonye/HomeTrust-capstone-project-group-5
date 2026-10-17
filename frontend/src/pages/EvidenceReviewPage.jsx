import { useState, useEffect } from "react";
import { ArrowLeft, Camera, Check, ShieldCheck, Upload, X, MessageSquare, AlertCircle } from "lucide-react";
import api from "../api/client"; // Live API client connected to Render backend

export default function EvidenceReviewPage({
  property,
  onBack,
  onSubmitEvidence,
}) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [descriptiveNote, setDescriptiveNote] = useState("");
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roomsList, setRoomsList] = useState([]);
  const [inspectionId, setInspectionId] = useState(null);

  const todaysFormattedDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const categories = ["All", "Rooms", "Kitchen", "Bathrooms", "Balcony"];
  const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80";

// Fetch live inspection data and map accurate room names and full comments
  useEffect(() => {
    const fetchInspectionEvidence = async () => {
      const targetPropId = property?.propertyId || property?.id;
      if (!targetPropId) {
        setLoading(false);
        return;
      }

      try {
        // 1. Fetch property schema to get exact room names (e.g. "Main Bathroom")
        const propRes = await api.get(`/properties/${targetPropId}`);
        const propertyData = propRes.data?.property || propRes.data;
        const definedRooms = propertyData?.rooms || [];

        // 2. Fetch live inspection data
        const res = await api.get(`/inspections/property/${targetPropId}`);
        const inspections = res.data?.inspections || res.data || [];
        const currentInsp = inspections[0];
        
        if (currentInsp) {
          setInspectionId(currentInsp.inspectionId || currentInsp.id);
        }

        const backendItems = currentInsp?.items || [];
        
        // Map backend items and keep the longest/most complete note string per item
        const itemMap = new Map();
        backendItems.forEach(item => {
          const roomId = item.roomId;
          const itemName = item.itemName || item.name || "General Area";
          const key = `${roomId}-${itemName}`;
          
          const existing = itemMap.get(key);
          const currentNotes = item.notes || item.dispute?.description || "";

          // If we already have a note for this item, keep whichever note string is longer (i.e. complete sentence vs. partial typing fragment)
          const bestNotes = existing && existing.notes.length >= currentNotes.length 
            ? existing.notes 
            : currentNotes;

          itemMap.set(key, {
            name: itemName,
            condition: item.condition || "no_issue",
            notes: bestNotes,
            photos: item.evidence || item.photos || []
          });
        });

        // Build rooms list matching the exact property definition names
        const formattedRooms = definedRooms.map(room => {
          const roomId = room.roomId || room.id;
          const roomName = room.name || "Room"; // This will now correctly output "Main Bathroom", "Kitchen", etc.

          // Find items matching this specific room ID or room name
          const matchedItems = [];
          itemMap.forEach((itemData, key) => {
            if (key.startsWith(roomId) || key.toLowerCase().includes(roomName.toLowerCase())) {
              matchedItems.push(itemData);
            }
          });

          return {
            id: roomId,
            name: roomName,
            category: room.category || "Rooms",
            imageUrl: property?.image || DEFAULT_IMAGE,
            items: matchedItems.length > 0 ? matchedItems : [
              { name: "General Area", condition: "no_issue", notes: "", photos: [] }
            ]
          };
        });

        setRoomsList(formattedRooms);
      } catch (err) {
        console.error("Failed to load inspection evidence from backend:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchInspectionEvidence();
  }, [property]);
  
  // Category Filtering Logic
  const filteredRooms = roomsList.filter((room) => {
    if (activeCategory === "All") return true;
    return room.category?.toLowerCase() === activeCategory.toLowerCase();
  });

  const handleInitialSubmitClick = async () => {
    if (inspectionId) {
      try {
        await api.post(`/inspections/${inspectionId}/submit`, {
          finalNote: descriptiveNote
        });
      } catch (err) {
        console.warn("Backend submit notice:", err?.response?.data || err?.message);
      }
    }
    setShowConfirmationModal(true);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-0 sm:p-6 font-sans">
      <div className="w-full max-w-md bg-white min-h-screen sm:min-h-200 sm:rounded-[48px] shadow-2xl border border-slate-200 flex flex-col justify-between overflow-hidden relative text-slate-900">
        
        {/* Confirmation Modal Overlay */}
        {showConfirmationModal && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#4A1E6D] text-white rounded-[40px] max-w-xs w-full p-8 text-center space-y-6 shadow-2xl">
              <div className="w-20 h-20 bg-white/10 text-white rounded-full flex items-center justify-center mx-auto border border-white/20">
                <ShieldCheck className="w-10 h-10 text-emerald-400" />
              </div>
              <div className="space-y-3">
                <h2 className="text-xl font-black text-white">
                  Congratulations!
                </h2>
                <p className="text-xs text-purple-200 leading-relaxed font-medium">
                  Evidences have been acknowledged and approved by parties.
                </p>
                <div className="text-[10px] text-purple-300 font-bold uppercase tracking-wider">
                  {todaysFormattedDate}
                </div>
              </div>
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirmationModal(false);
                    if (onSubmitEvidence) onSubmitEvidence();
                  }}
                  className="w-full bg-white hover:bg-purple-50 text-[#4A1E6D] font-extrabold py-3 rounded-2xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Proceed to Signatures
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="p-4 flex items-center justify-between z-10 gap-2 bg-[#4A1E6D] text-white">
          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-extrabold text-white text-center truncate">
            Evidence Library
          </h1>
          <div className="w-9" />
        </div>

        {/* Action Bar */}
        <div className="px-6 pt-4 flex gap-2">
          <button
            type="button"
            className="flex-1 bg-purple-50 text-[#4A1E6D] border border-purple-200 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            View evidence
          </button>
          <button
            type="button"
            className="flex-1 bg-[#4A1E6D] hover:bg-purple-900 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> + Add evidence
          </button>
        </div>

        {/* Category Pills */}
        <div className="px-6 pt-3">
          <span className="text-[11px] font-extrabold text-slate-800 block mb-2">
            Category
          </span>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                  activeCategory === cat
                    ? "bg-[#4A1E6D] text-white border-[#4A1E6D]"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Content / Evidence Scroll Area */}
        <div className="px-6 py-4 flex-1 overflow-y-auto space-y-4 bg-white">
          {loading ? (
            <div className="text-center py-10 text-slate-400 text-xs font-medium">
              Loading live evidence records from backend...
            </div>
          ) : filteredRooms.length > 0 ? (
            filteredRooms.map((room, idx) => (
              <div
                key={room.id || idx}
                className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="w-16 h-16 bg-slate-200 rounded-xl overflow-hidden shrink-0 flex items-center justify-center text-slate-400">
                    {room.imageUrl ? (
                      <img
                        src={room.imageUrl}
                        alt={room.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Camera className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className="text-xs font-extrabold text-slate-900">
                        {room.name}
                      </h4>
                      <span className="text-[10px] bg-purple-100 text-[#4A1E6D] px-2 py-0.5 rounded-md font-bold">
                        {room.category || "Rooms"}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 mt-2 space-y-2">
                      <div className="font-semibold text-purple-900 border-b border-purple-100 pb-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-purple-800" />
                        Condition & Comments Checklist:
                      </div>
                      {room.items?.map((item, iIdx) => (
                        <div key={iIdx} className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                          <div className="flex justify-between items-center font-bold text-slate-900 text-xs">
                            <span>{item.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 uppercase">
                              {item.condition.replace("_", " ")}
                            </span>
                          </div>
                          {item.notes && (
                            <p className="text-[11px] text-slate-600 bg-purple-50/50 p-1.5 rounded-lg border border-purple-100 font-medium flex items-start gap-1">
                              <MessageSquare className="w-3 h-3 text-purple-800 shrink-0 mt-0.5" />
                              <span>"{item.notes}"</span>
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-10 text-slate-400 text-xs font-medium flex flex-col items-center gap-2">
              <X className="w-6 h-6 text-slate-300" />
              <span>No live evidence items found for this property inspection.</span>
            </div>
          )}

          {/* Descriptive Note Input */}
          <div className="space-y-1.5 pt-2">
            <label className="text-[11px] font-extrabold text-slate-800">
              Add a descriptive note (Optional)
            </label>
            <textarea
              value={descriptiveNote}
              onChange={(e) => setDescriptiveNote(e.target.value)}
              placeholder="Type any additional notes or observations..."
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-900 focus:outline-none focus:border-[#4A1E6D] resize-none h-20"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <button
            type="button"
            onClick={handleInitialSubmitClick}
            className="w-full bg-[#4A1E6D] hover:bg-purple-950 text-white font-extrabold py-3.5 rounded-2xl text-xs transition-colors shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4" /> Submit Evidence Review
          </button>
        </div>
      </div>
    </div>
  );
}