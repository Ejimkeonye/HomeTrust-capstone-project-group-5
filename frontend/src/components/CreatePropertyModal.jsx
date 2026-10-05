import { useState } from "react";
import { X, Plus, Trash2, Building, MapPin, Home, Hash } from "lucide-react";

const PROPERTY_TYPES = [
  "Apartment",
  "Single Family House",
  "Condo",
  "Townhouse",
  "Studio",
  "Commercial",
];

const DEFAULT_ROOM_SUGGESTIONS = [
  "Living Room",
  "Kitchen",
  "Master Bedroom",
  "Master Bathroom",
  "Guest Bedroom",
  "Dining Room",
  "Balcony",
];

export default function CreatePropertyModal({
  isOpen,
  onClose,
  onPropertyCreated,
}) {
  const [propertyName, setPropertyName] = useState("");
  const [address, setAddress] = useState("");
  const [flatNo, setFlatNo] = useState("");
  const [propertyType, setPropertyType] = useState("Apartment");
  const [rooms, setRooms] = useState([
    "Living Room",
    "Kitchen",
    "Master Bedroom",
  ]);
  const [customRoomInput, setCustomRoomInput] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  if (!isOpen) return null;

  const handleAddRoom = (roomName) => {
    const trimmed = roomName.trim();
    if (!trimmed) return;
    if (rooms.includes(trimmed)) {
      setErrorMessage(`"${trimmed}" has already been added.`);
      return;
    }
    setRooms([...rooms, trimmed]);
    setCustomRoomInput("");
    setErrorMessage("");
  };

  const handleRemoveRoom = (indexToRemove) => {
    if (rooms.length <= 1) {
      setErrorMessage("A property must have at least one room.");
      return;
    }
    setRooms(rooms.filter((_, idx) => idx !== indexToRemove));
    setErrorMessage("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!propertyName.trim() || !address.trim()) {
      setErrorMessage("Please fill in both Property Name and Address.");
      return;
    }

    if (rooms.length === 0) {
      setErrorMessage("Please add at least one room.");
      return;
    }

    const newProperty = {
      id: `prop-${Date.now()}`,
      name: propertyName.trim(),
      address: address.trim(),
      flatNo: flatNo.trim() || "1",
      type: propertyType,
      rooms,
      createdAt: new Date().toLocaleDateString(),
    };

    onPropertyCreated(newProperty);
    onClose();

    // Reset Form
    setPropertyName("");
    setAddress("");
    setFlatNo("");
    setPropertyType("Apartment");
    setRooms(["Living Room", "Kitchen", "Master Bedroom"]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200 relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              Add New Property
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Define the property details and rooms for joint inspection.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl font-medium">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Inputs: Name, Address, Flat No, Type */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Property / Building Name
              </label>
              <div className="relative">
                <Building className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={propertyName}
                  onChange={(e) => setPropertyName(e.target.value)}
                  placeholder="e.g. Sunshine Estate"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-purple-700 focus:bg-white focus:outline-none transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Street Address
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. No 2, Ikeja, Lagos"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-purple-700 focus:bg-white focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Flat / Unit No
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={flatNo}
                    onChange={(e) => setFlatNo(e.target.value)}
                    placeholder="e.g. Flat 2"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-purple-700 focus:bg-white focus:outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Property Type
              </label>
              <div className="relative">
                <Home className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-purple-700 focus:bg-white focus:outline-none transition-all cursor-pointer"
                >
                  {PROPERTY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Rooms Configuration */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-800">
              Inspection Rooms ({rooms.length})
            </label>

            {/* Added Room Tags */}
            <div className="flex flex-wrap gap-1.5 min-h-10 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              {rooms.map((room, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 text-[11px] font-semibold text-slate-800 rounded-full shadow-2xs"
                >
                  {room}
                  <button
                    type="button"
                    onClick={() => handleRemoveRoom(index)}
                    className="text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            {/* Quick Suggestions */}
            <div className="space-y-1.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Quick Add Suggestions:
              </span>
              <div className="flex flex-wrap gap-1">
                {DEFAULT_ROOM_SUGGESTIONS.filter((s) => !rooms.includes(s)).map(
                  (suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => handleAddRoom(suggestion)}
                      className="text-[11px] bg-purple-50 text-purple-800 hover:bg-purple-100 font-medium px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      + {suggestion}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Custom Room Input */}
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={customRoomInput}
                onChange={(e) => setCustomRoomInput(e.target.value)}
                placeholder="Custom room (e.g. Study Room)"
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-purple-700 focus:bg-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleAddRoom(customRoomInput)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-purple-800 hover:bg-purple-900 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              Save Property
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}