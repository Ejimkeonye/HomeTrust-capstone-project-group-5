import { useState, useRef } from "react";
import { ArrowLeft, Camera, Check, ShieldCheck, Upload, X, MessageSquare, AlertCircle } from "lucide-react";

export default function MoveOutEvidencePage({
  inspectionData,
  onBack,
  onSubmitEvidence,
  onUpdateInspectionData,
}) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [descriptiveNote, setDescriptiveNote] = useState("");
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  // State for custom "Add Evidence" modal form
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomCategory, setNewRoomCategory] = useState("Rooms");
  const [newImagePreview, setNewImagePreview] = useState(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemCondition, setNewItemCondition] = useState("no_issue");
  const [checklistItems, setChecklistItems] = useState([]);
  
  const fileInputRef = useRef(null);

  const todaysFormattedDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const categories = ["All", "Rooms", "Kitchen", "Bathrooms", "Balcony"];

  const roomsList = Array.isArray(inspectionData) 
    ? inspectionData 
    : (inspectionData?.rooms || Object.keys(inspectionData || {}).map((k) => ({
        id: k,
        name: k,
        category: "Rooms",
        ...inspectionData[k],
      })) || []);

  const filteredRooms = roomsList.filter((room) => {
    if (activeCategory === "All") return true;
    const nameMatch = room.name?.toLowerCase().includes(activeCategory.toLowerCase());
    const categoryMatch = room.category?.toLowerCase() === activeCategory.toLowerCase();
    return nameMatch || categoryMatch;
  });

  const handleInitialSubmitClick = () => {
    setShowConfirmationModal(true);
  };

  // Handle Image Selection for Custom Modal
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setNewImagePreview(uploadEvent.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleAddChecklistItem = () => {
    if (!newItemName.trim()) return;
    setChecklistItems((prev) => [
      ...prev,
      { name: newItemName.trim(), condition: newItemCondition },
    ]);
    setNewItemName("");
    setNewItemCondition("no_issue");
  };

  const handleSaveNewEvidence = (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    const newPhotoObj = newImagePreview ? {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
      url: newImagePreview,
      timestamp: new Date().toLocaleDateString(),
    } : null;

    const customEvidenceRoom = {
      id: `room-${Date.now()}`,
      name: newRoomName.trim(),
      category: newRoomCategory,
      items: checklistItems.length > 0
        ? checklistItems.map((ci, idx) => ({
            id: `item-${Date.now()}-${idx}`,
            name: ci.name,
            condition: ci.condition,
            photos: idx === 0 && newPhotoObj ? [newPhotoObj] : [],
            notes: "",
          }))
        : [{
            id: `item-${Date.now()}-1`,
            name: "General Area",
            condition: "no_issue",
            photos: newPhotoObj ? [newPhotoObj] : [],
            notes: "",
          }],
    };

    const updatedRooms = [customEvidenceRoom, ...roomsList];
    if (onUpdateInspectionData) {
      onUpdateInspectionData(updatedRooms);
    }

    // Reset Form & Close Modal
    setShowAddModal(false);
    setNewRoomName("");
    setNewRoomCategory("Rooms");
    setNewImagePreview(null);
    setChecklistItems([]);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-0 sm:p-6 font-sans">
      <div className="w-full max-w-md bg-white min-h-screen sm:min-h-200 sm:rounded-[48px] shadow-2xl border border-slate-200 flex flex-col justify-between overflow-hidden relative text-slate-900">
        
        {/* Hidden File Input for Custom Modal */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageSelect}
          accept="image/*"
          className="hidden"
        />

        {/* FULL-SIZE IMAGE PREVIEW LIGHTBOX */}
        {selectedImage && (
          <div 
            onClick={() => setSelectedImage(null)}
            className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4 cursor-pointer animate-fade-in"
          >
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/25 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={selectedImage}
              alt="Evidence preview"
              className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-white/10"
            />
            <p className="text-white/70 text-xs font-medium mt-4">
              Tap anywhere to close preview
            </p>
          </div>
        )}

        {/* CUSTOM "ADD EVIDENCE" MODAL FORM */}
        {showAddModal && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-4xl max-w-sm w-full p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-sm font-extrabold text-[#4A1E6D]">
                  Add Move-Out Evidence Room
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveNewEvidence} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">
                    Room / Space Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="e.g. Master Bedroom, Kitchen"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-[#4A1E6D]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">
                    Category
                  </label>
                  <select
                    value={newRoomCategory}
                    onChange={(e) => setNewRoomCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-[#4A1E6D]"
                  >
                    <option value="Rooms">Rooms</option>
                    <option value="Kitchen">Kitchen</option>
                    <option value="Bathrooms">Bathrooms</option>
                    <option value="Balcony">Balcony</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">
                    Evidence Photo
                  </label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-24 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 cursor-pointer overflow-hidden"
                  >
                    {newImagePreview ? (
                      <img
                        src={newImagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <>
                        <Upload className="w-5 h-5 text-slate-400 mb-1" />
                        <span className="text-[10px] text-slate-500 font-medium">
                          Click to upload photo
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-2 pt-1 border-t">
                  <label className="text-[11px] font-bold text-slate-700">
                    Add Departure Checklist Item
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder="Item name (e.g. Walls, Fixtures)"
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs focus:outline-none"
                    />
                    <select
                      value={newItemCondition}
                      onChange={(e) => setNewItemCondition(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs focus:outline-none capitalize"
                    >
                      <option value="no_issue">No Issue</option>
                      <option value="stains">Stains</option>
                      <option value="cracks">Cracks</option>
                      <option value="broken">Broken</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleAddChecklistItem}
                      className="bg-[#4A1E6D] text-white px-3 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  {checklistItems.length > 0 && (
                    <div className="space-y-1 max-h-24 overflow-y-auto bg-slate-50 p-2 rounded-xl border border-slate-200">
                      {checklistItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between text-[11px] text-slate-700"
                        >
                          <span>{item.name}</span>
                          <span className="font-bold capitalize text-[#4A1E6D]">
                            {item.condition.replace("_", " ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#4A1E6D] hover:bg-purple-900 text-white font-extrabold py-3 rounded-xl text-xs transition-colors cursor-pointer mt-4"
                >
                  Save Move-Out Evidence
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Confirmation Modal Overlay */}
        {showConfirmationModal && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#4A1E6D] text-white rounded-[40px] max-w-xs w-full p-8 text-center space-y-6 shadow-2xl">
              <div className="w-20 h-20 bg-white/10 text-white rounded-full flex items-center justify-center mx-auto border border-white/20">
                <ShieldCheck className="w-10 h-10 text-emerald-400" />
              </div>
              <div className="space-y-3">
                <h2 className="text-xl font-black text-white">
                  Departure Acknowledged
                </h2>
                <p className="text-xs text-purple-200 leading-relaxed font-medium">
                  Move-out evidence records have been successfully submitted for review.
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
            Move-Out Evidence Library
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
            onClick={() => setShowAddModal(true)}
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
          {filteredRooms.length > 0 ? (
            filteredRooms.map((room, idx) => {
              const roomPhotos = room.imageUrl 
                ? [{ url: room.imageUrl }] 
                : (room.items?.flatMap(item => item.photos || []) || []);

              return (
                <div
                  key={room.id || idx}
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    {/* Clickable Room Photo Grid Thumbnail */}
                    <div className="w-16 h-16 bg-slate-200 rounded-xl overflow-hidden shrink-0 grid grid-cols-2 grid-rows-2 gap-0.5 p-0.5 border border-slate-300">
                      {[0, 1, 2, 3].map((photoIdx) => (
                        <div key={photoIdx} className="bg-slate-100 w-full h-full overflow-hidden flex items-center justify-center">
                          {roomPhotos[photoIdx] ? (
                            <img
                              src={roomPhotos[photoIdx].url}
                              alt=""
                              onClick={() => setSelectedImage(roomPhotos[photoIdx].url)}
                              className="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform"
                              title="Click to view full image"
                            />
                          ) : (
                            <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                              <Camera className="w-3 h-3 text-slate-300" />
                            </div>
                          )}
                        </div>
                      ))}
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
                          Departure Condition & Notes:
                        </div>
                        {room.items?.map((item, iIdx) => (
                          <div key={iIdx} className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                            <div className="flex justify-between items-center font-bold text-slate-900 text-xs">
                              <span>{item.name}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 uppercase">
                                {(item.condition || "no_issue").replace("_", " ")}
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
              );
            })
          ) : (
            <div className="text-center py-10 text-slate-400 text-xs font-medium flex flex-col items-center gap-2">
              <X className="w-6 h-6 text-slate-300" />
              <span>No move-out evidence items found. Click "+ Add evidence" to create a custom record.</span>
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
              placeholder="Type any additional departure notes or observations..."
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
            <Check className="w-4 h-4" /> Submit Move-Out Evidence
          </button>
        </div>
      </div>
    </div>
  );
}