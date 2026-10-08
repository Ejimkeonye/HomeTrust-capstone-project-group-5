import { ArrowLeft, Camera, ShieldCheck, FileText } from "lucide-react";

export default function MoveInOutRecordsView({
  property,
  moveInInspectionData = [],
  moveOutInspectionData = [],
  onBack,
  onProceedToSignatures,
}) {
  // Parse or normalize inspection lists safely
  const normalizeData = (data) => {
    return Array.isArray(data)
      ? data
      : Object.keys(data || {}).map((k) => ({
          id: k,
          name: k,
          category: "Rooms",
          ...data[k],
        }));
  };

  const moveInRooms = normalizeData(moveInInspectionData);
  const moveOutRooms = normalizeData(moveOutInspectionData);

  // Combine unique room names from both sets
  const allRoomNames = Array.from(
    new Set([...moveInRooms.map((r) => r.name), ...moveOutRooms.map((r) => r.name)])
  );

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-0 sm:p-6 font-sans">
      <div className="w-full max-w-md bg-white min-h-screen sm:min-h-200 sm:rounded-[48px] shadow-2xl border border-slate-200 flex flex-col justify-between overflow-hidden relative text-slate-900">
        
        {/* Header */}
        <div className="p-4 flex items-center justify-between z-10 gap-2 bg-[#4A1E6D] text-white">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-center truncate">
            <h1 className="text-sm font-extrabold text-white truncate">Move-In & Move-Out Records</h1>
            <p className="text-[10px] text-purple-200 truncate">{property?.address || "Property Comparison"}</p>
          </div>
          <div className="w-9" />
        </div>

        {/* Banner Info */}
        <div className="px-6 pt-4">
          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3 flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#4A1E6D] shrink-0 mt-0.5" />
            <p className="text-[11px] text-purple-900 font-medium leading-relaxed">
              Transparent side-by-side timeline of property condition at initial check-in versus departure.
            </p>
          </div>
        </div>

        {/* Content Scroll Area */}
        <div className="px-6 py-4 flex-1 overflow-y-auto space-y-4 bg-white">
          {allRoomNames.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs font-medium">
              <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              No inspection records found for this property yet.
            </div>
          ) : (
            allRoomNames.map((roomName, idx) => {
              const moveInRoom = moveInRooms.find((r) => r.name === roomName);
              const moveOutRoom = moveOutRooms.find((r) => r.name === roomName);

              return (
                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="text-xs font-extrabold text-slate-900">{roomName}</h3>
                    <span className="text-[10px] bg-purple-100 text-[#4A1E6D] px-2 py-0.5 rounded-md font-bold">
                      {moveOutRoom?.category || moveInRoom?.category || "Rooms"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-[11px]">
                    {/* Move-In State Column */}
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1.5">
                      <div className="font-extrabold text-[#4A1E6D] text-[10px] uppercase tracking-wider">
                        Move-In State
                      </div>
                      <div className="w-full h-16 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center text-slate-400">
                        {moveInRoom?.imageUrl ? (
                          <img src={moveInRoom.imageUrl} alt="Move-In" className="w-full h-full object-cover" />
                        ) : (
                          <Camera className="w-5 h-5 text-slate-300" />
                        )}
                      </div>
                      <div className="space-y-1">
                        {moveInRoom?.items?.length > 0 ? (
                          moveInRoom.items.map((item, i) => (
                            <div key={i} className="flex justify-between text-[10px] text-slate-700">
                              <span className="truncate pr-1">{item.name}:</span>
                              <span className="font-bold capitalize shrink-0 text-slate-900">
                                {item.condition?.replace("_", " ")}
                              </span>
                            </div>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">No checklist items logged</span>
                        )}
                      </div>
                    </div>

                    {/* Move-Out State Column */}
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1.5">
                      <div className="font-extrabold text-purple-900 text-[10px] uppercase tracking-wider">
                        Move-Out State
                      </div>
                      <div className="w-full h-16 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center text-slate-400">
                        {moveOutRoom?.imageUrl ? (
                          <img src={moveOutRoom.imageUrl} alt="Move-Out" className="w-full h-full object-cover" />
                        ) : (
                          <Camera className="w-5 h-5 text-slate-300" />
                        )}
                      </div>
                      <div className="space-y-1">
                        {moveOutRoom?.items?.length > 0 ? (
                          moveOutRoom.items.map((item, i) => (
                            <div key={i} className="flex justify-between text-[10px] text-slate-700">
                              <span className="truncate pr-1">{item.name}:</span>
                              <span className="font-bold capitalize shrink-0 text-[#4A1E6D]">
                                {item.condition?.replace("_", " ")}
                              </span>
                            </div>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">No checklist items logged</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Action */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <button
            onClick={onProceedToSignatures}
            className="w-full bg-[#4A1E6D] hover:bg-purple-950 text-white font-extrabold py-3.5 rounded-2xl text-xs transition-colors shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            Proceed to Move-Out Signatures
          </button>
        </div>

      </div>
    </div>
  );
}