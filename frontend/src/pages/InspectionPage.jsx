import { useState } from "react";
import { 
  ArrowLeft, Camera, Check, ChevronRight, Plus, 
  MessageSquare, AlertCircle, AlertTriangle, XCircle, CheckCircle2, 
  Trash2, Edit2, ShieldAlert, X, UserPlus,
} from "lucide-react";
import InvitePartyModal from "../components/InvitePartyModal";
import InviteLinkSent from "../components/InviteLinkSent";

const INITIAL_CATEGORIES = ["All", "Rooms", "Kitchen", "Bathrooms"];

const CONDITION_OPTIONS = [
  { id: "no_issue", label: "No issue", icon: CheckCircle2, color: "text-emerald-600" },
  { id: "stains", label: "Stains", icon: AlertTriangle, color: "text-amber-600" },
  { id: "cracks", label: "Cracks", icon: AlertTriangle, color: "text-orange-600" },
  { id: "broken", label: "Broken", icon: XCircle, color: "text-red-600" },
];

const SEVERITIES = [
  { id: "Minor", label: "Minor", style: "bg-blue-50 text-blue-700 border-blue-200" },
  { id: "Moderate", label: "Moderate", style: "bg-amber-50 text-amber-700 border-amber-200" },
  { id: "Major", label: "Major", style: "bg-orange-50 text-orange-700 border-orange-200" },
  { id: "Critical", label: "Critical", style: "bg-red-50 text-red-700 border-red-200" },
];

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80";

const compressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1024;
        const scaleFactor = MAX_WIDTH / img.width;

        canvas.width = img.width > MAX_WIDTH ? MAX_WIDTH : img.width;
        canvas.height = img.width > MAX_WIDTH ? img.height * scaleFactor : img.height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
    };
  });
};

export default function InspectionPage({ property, userRole = "tenant", onBack, onCompleteInspection }) {
  const safeProperty = property || {
    id: "demo-1",
    address: "No 2, sunshine estate, Ikeja city, Lagos",
    image: DEFAULT_IMAGE,
    status: "ACTIVE",
  };

  const isReadOnly = safeProperty?.status === "READ_ONLY";
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedRoomId, setSelectedRoomId] = useState(null);

  // Property Custom Banner Photo State
  const [propertyImage, setPropertyImage] = useState(() => {
    try {
      const saved = localStorage.getItem(`hometrust_property_image_${safeProperty?.id}`);
      if (saved) return saved;
    } catch (e) {
      console.error(e);
    }
    return safeProperty?.image || DEFAULT_IMAGE;
  });

  // Invite Modal State & Success Screen State
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [showInviteSuccess, setShowInviteSuccess] = useState(false);

  // Filter Toggle State: 'all' | 'disputed'
  const [itemFilter, setItemFilter] = useState("all");

  // Add Custom Section Modal State
  const [addRoomModalOpen, setAddRoomModalOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomCategory, setNewRoomCategory] = useState("Rooms");
  const [customCategory, setCustomCategory] = useState("");
  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false);

  // Rename Room State
  const [isEditingRoomName, setIsEditingRoomName] = useState(false);
  const [editedRoomName, setEditedRoomName] = useState("");

  // Add Sub-Item Modal State
  const [addItemModalOpen, setAddItemModalOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");

  // Dispute Modal State
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [disputeTarget, setDisputeTarget] = useState(null);
  const [disputeNote, setDisputeNote] = useState("");
  const [disputeSeverity, setDisputeSeverity] = useState("Minor");

  // Main Inspection Data State
  const [roomsData, setRoomsData] = useState(() => {
    try {
      const saved = localStorage.getItem(`hometrust_inspection_v5_${safeProperty?.id}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }

    return [
      {
        id: "room-1",
        name: "Main Bedroom",
        category: "Rooms",
        items: [
          { id: "item-101", name: "Curtains", condition: "no_issue", notes: "", photos: [], status: "Normal" },
          { 
            id: "item-102", 
            name: "Cabinet", 
            condition: "broken", 
            notes: "Hinge is completely broken", 
            photos: [], 
            status: "Under Review",
            dispute: {
              severity: "Major",
              description: "Door hinge detached from side wall",
              raisedBy: "tenant",
              timestamp: new Date().toLocaleDateString()
            }
          },
        ],
      },
      {
        id: "room-2",
        name: "Kitchen",
        category: "Kitchen",
        items: [
          { id: "item-201", name: "Kitchen Sink & Cabinets", condition: "no_issue", notes: "", photos: [], status: "Normal" },
          { id: "item-202", name: "Gas Stove & Extractor", condition: "stains", notes: "Burn marks near back burner", photos: [], status: "Under Review" },
        ],
      },
      {
        id: "room-3",
        name: "Main Bathroom",
        category: "Bathrooms",
        items: [
          { id: "item-301", name: "Shower & Tub", condition: "no_issue", notes: "", photos: [], status: "Normal" },
          { id: "item-302", name: "Vanity Cabinet", condition: "no_issue", notes: "", photos: [], status: "Normal" },
        ],
      },
    ];
  });

  const saveRooms = (updatedData) => {
    setRoomsData(updatedData);
    try {
      localStorage.setItem(`homecompa_inspection_v5_${safeProperty?.id}`, JSON.stringify(updatedData));
    } catch (e) {
      console.error(e);
    }
  };

  const handlePropertyPhotoChange = async (e) => {
    if (isReadOnly) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const compressedUrl = await compressImage(file);
    setPropertyImage(compressedUrl);
    try {
      localStorage.setItem(`hometrust_property_image_${safeProperty?.id}`, compressedUrl);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddRoom = (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    const finalCategory = isAddingCustomCategory && customCategory.trim() 
      ? customCategory.trim() 
      : newRoomCategory;

    const newRoom = {
      id: `room-${Date.now()}`,
      name: newRoomName.trim(),
      category: finalCategory,
      items: [
        {
          id: `item-${Date.now()}-1`,
          name: "General Area",
          condition: "no_issue",
          notes: "",
          photos: [],
          status: "Normal",
        },
      ],
    };

    const updated = [...roomsData, newRoom];
    saveRooms(updated);
    setNewRoomName("");
    setCustomCategory("");
    setIsAddingCustomCategory(false);
    setAddRoomModalOpen(false);
  };

  const handleDeleteRoom = (roomId, e) => {
    if (e) e.stopPropagation();
    if (isReadOnly) return;
    if (!window.confirm("Are you sure you want to delete this section and all its contents?")) return;

    const updated = roomsData.filter((r) => r.id !== roomId);
    saveRooms(updated);
    if (selectedRoomId === roomId) {
      setSelectedRoomId(null);
    }
  };

  const handleSaveRoomName = (roomId) => {
    if (!editedRoomName.trim()) return;
    const updated = roomsData.map((r) => (r.id === roomId ? { ...r, name: editedRoomName.trim() } : r));
    saveRooms(updated);
    setIsEditingRoomName(false);
  };

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!newItemName.trim() || !selectedRoomId) return;

    const updated = roomsData.map((room) => {
      if (room.id === selectedRoomId) {
        return {
          ...room,
          items: [
            ...room.items,
            {
              id: `item-${Date.now()}`,
              name: newItemName.trim(),
              condition: "no_issue",
              notes: "",
              photos: [],
              status: "Normal",
            },
          ],
        };
      }
      return room;
    });

    saveRooms(updated);
    setNewItemName("");
    setAddItemModalOpen(false);
  };

  const handleDeleteItem = (roomId, itemId) => {
    if (isReadOnly) return;
    const updated = roomsData.map((room) => {
      if (room.id === roomId) {
        return {
          ...room,
          items: room.items.filter((i) => i.id !== itemId),
        };
      }
      return room;
    });
    saveRooms(updated);
  };

  const updateItemData = (roomId, itemId, fields) => {
    if (isReadOnly) return;
    const updated = roomsData.map((room) => {
      if (room.id === roomId) {
        return {
          ...room,
          items: room.items.map((item) => {
            if (item.id === itemId) {
              const updatedItem = { ...item, ...fields };
              
              if (fields.condition === "no_issue") {
                updatedItem.status = "Normal";
                delete updatedItem.dispute;
              } else if (fields.condition && fields.condition !== "no_issue") {
                updatedItem.status = "Under Review";
              }
              return updatedItem;
            }
            return item;
          }),
        };
      }
      return room;
    });
    saveRooms(updated);
  };

  const handleClearDispute = (roomId, itemId) => {
    if (isReadOnly) return;
    const updated = roomsData.map((room) => {
      if (room.id === roomId) {
        return {
          ...room,
          items: room.items.map((item) => {
            if (item.id === itemId) {
              const updatedItem = { ...item, condition: "no_issue", status: "Normal" };
              delete updatedItem.dispute;
              return updatedItem;
            }
            return item;
          }),
        };
      }
      return room;
    });
    saveRooms(updated);
  };

  const handlePhotoUpload = async (roomId, itemId, e) => {
    if (isReadOnly) return;
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const compressedPhotos = [];
    for (let i = 0; i < files.length; i++) {
      const compressedUrl = await compressImage(files[i]);
      compressedPhotos.push({
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${i}`,
        url: compressedUrl,
        timestamp: new Date().toLocaleDateString(),
      });
    }

    const updated = roomsData.map((room) => {
      if (room.id === roomId) {
        return {
          ...room,
          items: room.items.map((item) => {
            if (item.id === itemId) {
              return { ...item, photos: [...(item.photos || []), ...compressedPhotos] };
            }
            return item;
          }),
        };
      }
      return room;
    });

    saveRooms(updated);
  };

  const handleRaiseDispute = (e) => {
    e.preventDefault();
    if (!disputeTarget) return;

    const targetRoom = roomsData.find(r => r.id === disputeTarget.roomId);
    const targetItem = targetRoom?.items.find(i => i.id === disputeTarget.itemId);

    const newCondition = targetItem?.condition === "no_issue" ? "broken" : targetItem?.condition;

    updateItemData(disputeTarget.roomId, disputeTarget.itemId, {
      condition: newCondition,
      status: "Under Review",
      dispute: {
        description: disputeNote,
        severity: disputeSeverity,
        raisedBy: userRole,
        timestamp: new Date().toLocaleDateString(),
      },
    });

    setDisputeModalOpen(false);
    setDisputeNote("");
    setDisputeSeverity("Minor");
    setDisputeTarget(null);
  };

  const dynamicCategories = Array.from(
    new Set([...INITIAL_CATEGORIES, ...roomsData.map((r) => r.category)])
  );

  const filteredRooms = roomsData.filter((room) => {
    if (selectedCategory === "All") return true;
    return room.category.toLowerCase() === selectedCategory.toLowerCase();
  });

  const activeRoom = roomsData.find((r) => r.id === selectedRoomId);

  const displayedItems = activeRoom?.items.filter((item) => {
    if (itemFilter === "disputed") {
      return item.status === "Under Review" || item.condition !== "no_issue" || !!item.dispute;
    }
    return true;
  }) || [];

  const totalDisputedCount = activeRoom?.items.filter(
    (i) => i.status === "Under Review" || i.condition !== "no_issue" || !!i.dispute
  ).length || 0;

// Frame 706: Success Screen View
  if (showInviteSuccess) {
    return (
      <InviteLinkSent
        onBackHome={() => setShowInviteSuccess(false)} 
        date={new Date().toLocaleDateString()} // Or use new Date().toLocaleDateString(...) if dynamic
      />
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-0 sm:p-6 font-sans">
      <div className="w-full max-w-md bg-white min-h-screen sm:min-h-203 sm:rounded-[48px] shadow-2xl border border-slate-200 flex flex-col justify-between overflow-hidden relative text-slate-900">
      

        {/* Top Header */}
        <div className="p-4 flex items-center justify-between z-10 gap-2 bg-[#4A1E6D] text-white">
          <button
            type="button"
            onClick={() => {
              if (selectedRoomId) {
                setSelectedRoomId(null);
                setIsEditingRoomName(false);
                setItemFilter("all");
              } else {
                onBack && onBack();
              }
            }}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 cursor-pointer shrink-0 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <h1 className="text-base font-extrabold text-white text-center truncate">
            {activeRoom ? activeRoom.name : "Inspection"}
          </h1>

          <div className="flex items-center gap-1.5">
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => setInviteModalOpen(true)}
                className="p-2 text-white bg-white/10 hover:bg-white/20 rounded-full cursor-pointer transition-colors"
                title="Invite Other Party"
              >
                <UserPlus className="w-4 h-4" />
              </button>
            )}

            <button
  type="button"
  onClick={() => {
    // Pass the current rooms data up to the parent component
    if (onCompleteInspection) {
      onCompleteInspection(roomsData);
    }
  }}
  className="text-xs font-extrabold text-[#4A1E6D] bg-white hover:bg-slate-100 px-3.5 py-1.5 rounded-full cursor-pointer shrink-0 transition-colors shadow-md"
>
  Review & Lock
</button>
          </div>
        </div>

        {/* Read-Only Banner */}
        {isReadOnly && (
          <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-2 text-center text-amber-800 text-xs font-bold backdrop-blur-md">
            🔒 Baseline Locked (READ_ONLY)
          </div>
        )}

        {/* Main Content Scroll Container */}
        <div className="px-6 py-4 flex-1 flex flex-col justify-between overflow-y-auto space-y-4 bg-white">
          
          {/* Main Inspection Banner Image (Updated with Custom Property Photo Picker) */}
          <div className="relative w-full h-40 rounded-2xl overflow-hidden shadow-sm bg-slate-100 border border-slate-200 group">
            <img 
              src={propertyImage} 
              alt="Property banner" 
              className="w-full h-full object-cover" 
              onError={(e) => { e.target.src = DEFAULT_IMAGE; }}
            />
            {isReadOnly ? (
              <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-slate-800 shadow-md">
                  <Camera className="w-5 h-5 text-[#4A1E6D]" />
                </div>
              </div>
            ) : (
              <label className="absolute inset-0 bg-black/20 hover:bg-black/40 transition-colors flex flex-col items-center justify-center cursor-pointer text-white">
                <div className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-slate-800 shadow-md mb-1">
                  <Camera className="w-5 h-5 text-[#4A1E6D]" />
                </div>
                <span className="text-[11px] font-bold drop-shadow-md">Change Apartment Photo</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment"
                  onChange={handlePropertyPhotoChange}
                  className="hidden" 
                />
              </label>
            )}
          </div>

          {/* OVERVIEW MODE */}
          {!selectedRoomId ? (
            <div className="space-y-4 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar flex-1">
                  {dynamicCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap transition-all ${
                        selectedCategory === cat
                          ? "bg-[#4A1E6D] text-white shadow-md"
                          : "bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingCustomCategory(false);
                      setAddRoomModalOpen(true);
                    }}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-[#4A1E6D] border border-slate-200 rounded-xl transition-all cursor-pointer shrink-0 shadow-xs flex items-center gap-1 text-xs font-bold"
                  >
                    <Plus className="w-4 h-4" /> Add Section
                  </button>
                )}
              </div>

              {/* Room Cards (Darker Purple tint) */}
              <div className="space-y-3">
                {filteredRooms.map((room) => {
                  const allPhotos = room.items.flatMap((i) => i.photos || []);
                  const disputedCount = room.items.filter(
                    (i) => i.status === "Under Review" || i.condition !== "no_issue" || !!i.dispute
                  ).length;

                  return (
                    <div
                      key={room.id}
                      onClick={() => setSelectedRoomId(room.id)}
                      className="w-full flex items-center gap-2.5 group cursor-pointer text-left relative bg-purple-900/10 hover:bg-purple-900/15 p-2.5 rounded-2xl transition-all border border-purple-900/20 shadow-xs"
                    >
                      <div className="w-20 h-16 bg-white rounded-xl overflow-hidden grid grid-cols-2 grid-rows-2 gap-0.5 p-0.5 shrink-0 border border-purple-900/10">
                        {[0, 1, 2, 3].map((idx) => (
                          <div key={idx} className="bg-slate-100 w-full h-full overflow-hidden flex items-center justify-center">
                            {allPhotos[idx] ? (
                              <img src={allPhotos[idx].url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-slate-100" />
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex-1 flex items-center justify-between relative">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-xs font-extrabold text-slate-900">{room.name}</h3>
                            {disputedCount > 0 && (
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Has disputes/issues" />
                            )}
                          </div>
                          <p className="text-[10px] text-slate-600 font-semibold mt-0.5">
                            {room.items.length} {room.items.length === 1 ? "Item" : "Items"}
                            {disputedCount > 0 && (
                              <span className="text-amber-600 font-bold ml-1">({disputedCount} Flagged)</span>
                            )}
                          </p>
                          <span className="inline-block mt-1 text-[9px] font-extrabold text-purple-900 bg-purple-200/60 px-2 py-0.5 rounded-md">
                            {room.category}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={(e) => handleDeleteRoom(room.id, e)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white/60 rounded-lg transition-colors cursor-pointer"
                              title="Delete Room"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          <ChevronRight className="w-5 h-5 text-purple-900/60 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* DETAILED ROOM EDIT MODE */
            <div className="space-y-4 text-slate-900 bg-white p-2 rounded-3xl">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 gap-2">
                <div className="flex-1">
                  {isEditingRoomName ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editedRoomName}
                        onChange={(e) => setEditedRoomName(e.target.value)}
                        className="border border-purple-300 rounded-lg px-2 py-1 text-xs font-extrabold text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-800 flex-1 bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveRoomName(activeRoom.id)}
                        className="px-2 py-1 bg-[#4A1E6D] text-white rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-sm font-extrabold text-slate-900">{activeRoom?.name}</h2>
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditedRoomName(activeRoom.name);
                            setIsEditingRoomName(true);
                          }}
                          className="text-slate-400 hover:text-[#4A1E6D] p-1 cursor-pointer"
                          title="Rename Room"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Category: <span className="font-bold text-slate-700">{activeRoom?.category}</span>
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => handleDeleteRoom(activeRoom.id)}
                      className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl cursor-pointer transition-colors"
                      title="Delete whole room"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => setAddItemModalOpen(true)}
                      className="inline-flex items-center gap-1 text-xs font-bold bg-[#4A1E6D] text-white px-3 py-1.5 rounded-xl hover:bg-purple-950 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Amenity
                    </button>
                  )}
                </div>
              </div>

              {/* View Toggle Bar */}
              <div className="bg-slate-100 p-1 rounded-2xl flex items-center border border-slate-200">
                <button
                  type="button"
                  onClick={() => setItemFilter("all")}
                  className={`flex-1 py-1.5 text-center text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
                    itemFilter === "all"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Full Inspection ({activeRoom?.items.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setItemFilter("disputed")}
                  className={`flex-1 py-1.5 text-center text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    itemFilter === "disputed"
                      ? "bg-amber-500 text-white shadow-xs"
                      : "text-amber-700 hover:bg-amber-50"
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  Damaged / Disputed ({totalDisputedCount})
                </button>
              </div>

              {/* Sub-Items List */}
              <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
                {displayedItems.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-xs font-bold">
                      {itemFilter === "disputed" ? "No damaged or disputed items in this section 🎉" : "No items listed."}
                    </p>
                  </div>
                ) : (
                  displayedItems.map((item) => {
                    const isDamagedOrDisputed = item.status === "Under Review" || item.condition !== "no_issue" || !!item.dispute;
                    const activeSeverityObj = SEVERITIES.find(s => s.id === item.dispute?.severity);

                    return (
                      <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3.5 relative">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-extrabold text-slate-900">{item.name}</h4>
                          <div className="flex items-center gap-2">
                            {isDamagedOrDisputed && (
                              <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {item.dispute ? "Dispute Filed" : "Flagged Issue"}
                              </span>
                            )}
                            {!isReadOnly && (
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(activeRoom.id, item.id)}
                                className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                                title="Remove item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Integrated Active Dispute Badge */}
                        {item.dispute && (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1.5 relative">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <ShieldAlert className="w-4 h-4 text-amber-600" />
                                <span className="text-xs font-extrabold text-amber-900">Active Dispute Record</span>
                              </div>
                              {activeSeverityObj && (
                                <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${activeSeverityObj.style}`}>
                                  {activeSeverityObj.label}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-amber-900 font-medium bg-white p-2 rounded-lg border border-amber-100">
                              "{item.dispute.description}"
                            </p>
                            <div className="flex items-center justify-between text-[10px] text-amber-700 pt-0.5 font-semibold">
                              <span>By: {item.dispute.raisedBy || userRole} • {item.dispute.timestamp}</span>
                              {!isReadOnly && (
                                <button
                                  type="button"
                                  onClick={() => handleClearDispute(activeRoom.id, item.id)}
                                  className="text-red-600 hover:underline cursor-pointer font-bold flex items-center gap-0.5"
                                >
                                  <X className="w-3 h-3" /> Clear Dispute
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Photos */}
                        <div className="grid grid-cols-2 gap-2">
                          {item.photos?.map((p, idx) => (
                            <img key={p.id || idx} src={p.url} className="w-full h-20 rounded-xl object-cover border border-slate-200" alt="" />
                          ))}

                          {!isReadOnly && (
                            <label className="w-full h-20 rounded-xl border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors">
                              <Plus className="w-4 h-4 text-[#4A1E6D]" />
                              <span className="text-[10px] font-bold text-[#4A1E6D] mt-0.5">Photo</span>
                              <input
                                type="file"
                                multiple
                                accept="image/*"
                                onChange={(e) => handlePhotoUpload(activeRoom.id, item.id, e)}
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>

                        {/* Condition Selection */}
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-bold text-slate-700 block">Condition</span>
                          <div className="grid grid-cols-2 gap-2">
                            {CONDITION_OPTIONS.map((option) => {
                              const isChecked = item.condition === option.id;
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  disabled={isReadOnly}
                                  onClick={() => updateItemData(activeRoom.id, item.id, { condition: option.id })}
                                  className={`flex items-center gap-2 p-2 rounded-xl text-left border cursor-pointer transition-all ${
                                    isChecked ? "bg-[#4A1E6D] border-[#4A1E6D] text-white" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                  }`}
                                >
                                  <div
                                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                                      isChecked ? "border-white bg-[#4A1E6D] text-white" : "border-slate-300 bg-white"
                                    }`}
                                  >
                                    {isChecked && <Check className="w-2.5 h-2.5 text-white" />}
                                  </div>
                                  <span className="text-[11px] font-extrabold">{option.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Description / Notes */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 block">Note / Description</label>
                          <textarea
                            disabled={isReadOnly}
                            rows={2}
                            value={item.notes || ""}
                            onChange={(e) => updateItemData(activeRoom.id, item.id, { notes: e.target.value })}
                            placeholder="Note condition details, scratches, stains..."
                            className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-800 text-slate-800 placeholder-slate-400"
                          />
                        </div>

                        {/* Dispute Trigger Button */}
                        {!isReadOnly && (
                          <div className="pt-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setDisputeTarget({ roomId: activeRoom.id, itemId: item.id });
                                setDisputeNote(item.dispute?.description || item.notes || "");
                                setDisputeSeverity(item.dispute?.severity || "Minor");
                                setDisputeModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg hover:bg-amber-100 cursor-pointer"
                            >
                              <MessageSquare className="w-3 h-3 text-amber-600" />
                              {item.dispute ? "Edit Dispute Details" : "Dispute Item"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Main Action Button */}
          <div className="pt-4">
            <button
              type="button"
              onClick={() => {
                if (selectedRoomId) {
                  setSelectedRoomId(null);
                } else if (onBack) {
                  onBack();
                }
              }}
              className="w-full bg-[#4A1E6D] hover:bg-purple-950 text-white font-extrabold text-sm py-3.5 px-6 rounded-2xl shadow-lg transition-all text-center cursor-pointer active:scale-[0.99]"
            >
              Back home
            </button>
          </div>

        </div>
      </div>

      {/* Add Section/Room Modal */}
      {addRoomModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 text-slate-900">
          <form onSubmit={handleAddRoom} className="bg-white p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl border border-slate-200">
            <h3 className="font-extrabold text-base text-slate-900">Add New Section / Room</h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Category Type</label>
              {!isAddingCustomCategory ? (
                <div className="space-y-2">
                  <select
                    value={newRoomCategory}
                    onChange={(e) => setNewRoomCategory(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-800 bg-white"
                  >
                    <option value="Rooms">Rooms</option>
                    <option value="Kitchen">Kitchen</option>
                    <option value="Bathrooms">Bathrooms</option>
                    <option value="Balcony">Balcony / Outdoor</option>
                    <option value="Living Room">Living Room</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setIsAddingCustomCategory(true)}
                    className="text-[11px] font-extrabold text-[#4A1E6D] hover:underline cursor-pointer"
                  >
                    + Add standard or custom category
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Terrace, Store Room, Basement"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-800 text-slate-800 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setIsAddingCustomCategory(false)}
                    className="text-[11px] font-extrabold text-slate-500 hover:underline cursor-pointer"
                  >
                    ← Select from default list
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Section/Room Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Bedroom 2, Guest Bath, Back Balcony"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-800 text-slate-800 bg-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAddRoomModalOpen(false)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold text-white bg-[#4A1E6D] hover:bg-purple-950 rounded-xl cursor-pointer shadow-sm"
              >
                Create Section
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Amenity Modal */}
      {addItemModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 text-slate-900">
          <form onSubmit={handleAddItem} className="bg-white p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl border border-slate-200">
            <h3 className="font-extrabold text-base text-slate-900">Add Item / Amenity to {activeRoom?.name}</h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Item / Feature Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Curtains, Wooden Cabinet, Sink, Railing"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-800 text-slate-800 bg-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAddItemModalOpen(false)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold text-white bg-[#4A1E6D] hover:bg-purple-950 rounded-xl cursor-pointer shadow-sm"
              >
                Add Item
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Dispute Modal */}
      {disputeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 text-slate-900">
          <form onSubmit={handleRaiseDispute} className="bg-white p-6 rounded-3xl max-w-md w-full space-y-4 shadow-2xl border border-slate-200">
            <h3 className="font-extrabold text-base text-slate-900">Dispute Item Condition</h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Damage Severity Level</label>
              <div className="grid grid-cols-4 gap-2">
                {SEVERITIES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setDisputeSeverity(s.id)}
                    className={`py-2 px-2 text-[11px] font-bold rounded-xl border text-center transition-all cursor-pointer ${
                      disputeSeverity === s.id ? `${s.style} ring-2 ring-purple-800` : "bg-slate-50 text-slate-600 border-slate-200"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Dispute / Condition Notes</label>
              <textarea
                required
                rows={3}
                value={disputeNote}
                onChange={(e) => setDisputeNote(e.target.value)}
                placeholder="Describe pre-existing damage or condition disagreement..."
                className="w-full border border-slate-300 rounded-2xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-purple-800 text-slate-800 bg-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDisputeModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl cursor-pointer shadow-sm"
              >
                Save Dispute
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Invite Party Modal */}
      <InvitePartyModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        onInviteSent={() => {
          setInviteModalOpen(false);
          setShowInviteSuccess(true);
        }}
        property={safeProperty}
        currentUserRole={userRole}
      />
    </div>
  );
}