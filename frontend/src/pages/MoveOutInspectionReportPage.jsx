import { useState } from "react";
import {
  ArrowLeft,
  Printer,
  Lock,
  Check,
  LogOut,
  ShieldCheck,
  Camera,
} from "lucide-react";

export default function MoveOutInspectionReportPage({
  property,
  moveInInspectionData = [],
  moveOutInspectionData = [],
  signatures = { landlord: null, tenant: null },
  onBack,
  onFinalize,
}) {
  const propertyId = property?.id || "default";
  const reportStorageKey = `hometrust_moveout_report_${propertyId}`;

  const [showSuccessScreen, setShowSuccessScreen] = useState(false);

  // 1. Pull Move-In Data: Check prop first, then fall back to saved Move-In report in localStorage
  const [resolvedMoveIn] = useState(() => {
    if (moveInInspectionData && Object.keys(moveInInspectionData).length > 0) {
      return moveInInspectionData;
    }
    try {
      const savedReport = localStorage.getItem(`hometrust_report_${propertyId}`);
      if (savedReport) {
        const parsed = JSON.parse(savedReport);
        if (parsed.inspectionData) return parsed.inspectionData;
      }
    } catch (e) {
      console.error("Error loading move-in data from storage:", e);
    }
    return property?.inspectionData || {};
  });

  // 2. Pull Move-Out Data: Check prop first, then fall back to temporary move-out storage
  const [resolvedMoveOut] = useState(() => {
    if (moveOutInspectionData && Object.keys(moveOutInspectionData).length > 0) {
      return moveOutInspectionData;
    }
    try {
      const savedMoveOut = localStorage.getItem(reportStorageKey);
      if (savedMoveOut) {
        const parsed = JSON.parse(savedMoveOut);
        if (parsed.moveOutInspectionData) return parsed.moveOutInspectionData;
      }
    } catch (e) {
      console.error("Error loading move-out data from storage:", e);
    }
    return {};
  });

  // Normalize data helper
  const normalizeData = (data) => {
    return Array.isArray(data)
      ? data
      : Object.keys(data || {}).map((k) => ({
          name: k,
          ...data[k],
        }));
  };

  const moveInRooms = normalizeData(resolvedMoveIn);
  const moveOutRooms = normalizeData(resolvedMoveOut);
  const allRoomNames = Array.from(
    new Set([...moveInRooms.map((r) => r.name), ...moveOutRooms.map((r) => r.name)])
  );

  const landlordSig = signatures.landlord;
  const tenantSig = signatures.tenant;

  const handleFinalLockAndSave = () => {
    const timestamp = new Date().toLocaleString();
    const finalReport = {
      propertyId,
      propertyName: property?.name || property?.address,
      landlordSig,
      tenantSig,
      isCompleted: true,
      completedTimestamp: timestamp,
      moveInInspectionData: resolvedMoveIn,
      moveOutInspectionData: resolvedMoveOut,
    };

    localStorage.setItem(reportStorageKey, JSON.stringify(finalReport));

    // Update master properties list in local storage if needed
    try {
      const savedProps = JSON.parse(
        localStorage.getItem("hometrust_properties") || "[]",
      );
      const updatedProps = savedProps.map((p) =>
        p.id === propertyId
          ? {
              ...p,
              moveOutStatus: "LOCKED",
              moveOutSignatures: { landlord: landlordSig, tenant: tenantSig },
              completedTimestamp: timestamp,
            }
          : p,
      );
      localStorage.setItem("hometrust_properties", JSON.stringify(updatedProps));
    } catch (e) {
      console.error(e);
    }

    setShowSuccessScreen(true);

    if (onFinalize) {
      onFinalize(finalReport);
    }
  };

  const handlePrint = () => window.print();

  // Success Screen View
  if (showSuccessScreen) {
    return (
      <div className="min-h-screen bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-white rounded-[40px] max-w-sm w-full p-8 text-center space-y-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
          <div className="w-20 h-20 bg-[#4A1E6D] text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-purple-900/30">
            <ShieldCheck className="w-10 h-10" />
          </div>
          <div className="space-y-3">
            <h2 className="text-xl font-black text-slate-950">
              Move-Out Finalized!
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed px-2 font-medium">
              Both parties have verified and signed. The move-out comparison record is legally sealed and locked.
            </p>
          </div>
          <button
            onClick={() => {
              if (onBack) onBack();
              else window.location.reload();
            }}
            className="w-full inline-flex items-center justify-center gap-2 bg-[#4A1E6D] hover:bg-purple-950 text-white font-bold py-3.5 rounded-2xl transition-colors text-xs cursor-pointer shadow-md"
          >
            <LogOut className="w-4 h-4" /> Back Home
          </button>
        </div>
      </div>
    );
  }

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
          <h1 className="text-base font-extrabold text-white text-center truncate">
            Final Move-Out Report
          </h1>
          <button
            onClick={handlePrint}
            className="p-2 text-white bg-white/10 hover:bg-white/20 rounded-full cursor-pointer transition-colors"
            title="Print Report"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>

        {/* Content Area */}
        <div className="px-6 py-4 flex-1 overflow-y-auto space-y-6 bg-white">
          <div className="border-b border-slate-200 pb-4">
            <div className="text-[10px] font-bold tracking-wider text-[#4A1E6D] uppercase mb-1">
              Verified Side-by-Side Record
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">
              {property?.name || property?.address}
            </h2>

            <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-semibold text-slate-500">
                Processed on: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-300">
                <Lock className="w-3 h-3" /> Signed & Locked (READ_ONLY)
              </span>
            </div>
          </div>
  
          {/* Side-by-Side Room Walkthrough Breakdown */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              Move-In vs. Move-Out Comparison
            </h3>
            {allRoomNames.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-4">No inspection data recorded.</p>
            ) : (
              allRoomNames.map((roomName, idx) => {
                const moveInRoom = moveInRooms.find((r) => r.name === roomName);
                const moveOutRoom = moveOutRooms.find((r) => r.name === roomName);

                return (
                  <div
                    key={idx}
                    className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3"
                  >
                    <div className="flex justify-between items-center border-b pb-2">
                      <h4 className="text-xs font-extrabold text-slate-900">
                        {roomName}
                      </h4>
                      <span className="text-[10px] font-extrabold text-purple-900 bg-purple-200/60 px-2 py-0.5 rounded-md">
                        {moveOutRoom?.category || moveInRoom?.category || "Rooms"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {/* Move-In Column */}
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1.5">
                        <span className="text-[9px] font-extrabold text-[#4A1E6D] uppercase block">Move-In State</span>
                        <div className="w-full h-12 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center">
                          {moveInRoom?.imageUrl ? (
                            <img src={moveInRoom.imageUrl} alt="Move-In" className="w-full h-full object-cover" />
                          ) : (
                            <Camera className="w-4 h-4 text-slate-300" />
                          )}
                        </div>
                        {moveInRoom?.items?.map((item, i) => (
                          <div key={i} className="flex justify-between text-[10px] text-slate-700 py-0.5 border-b border-slate-100 last:border-0">
                            <span className="truncate">{item.name}:</span>
                            <span className="font-bold capitalize">{item.condition?.replace("_", " ")}</span>
                          </div>
                        ))}
                      </div>

                      {/* Move-Out Column */}
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1.5">
                        <span className="text-[9px] font-extrabold text-purple-900 uppercase block">Move-Out State</span>
                        <div className="w-full h-12 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center">
                          {moveOutRoom?.imageUrl ? (
                            <img src={moveOutRoom.imageUrl} alt="Move-Out" className="w-full h-full object-cover" />
                          ) : (
                            <Camera className="w-4 h-4 text-slate-300" />
                          )}
                        </div>
                        {moveOutRoom?.items?.map((item, i) => (
                          <div key={i} className="flex justify-between text-[10px] text-slate-700 py-0.5 border-b border-slate-100 last:border-0">
                            <span className="truncate">{item.name}:</span>
                            <span className="font-bold capitalize text-[#4A1E6D]">{item.condition?.replace("_", " ")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Display Verified Signatures (Read-Only) */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              Digital Verification
            </h3>
            <div className="grid grid-cols-1 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Landlord Signature
                  </span>
                  <span className="text-xs font-extrabold text-emerald-700">
                    Verified & Signed ✓
                  </span>
                </div>
                {landlordSig &&
                  typeof landlordSig === "string" &&
                  landlordSig.startsWith("data:image") && (
                    <img
                      src={landlordSig}
                      alt="Landlord Signature"
                      className="h-8 object-contain"
                    />
                  )}
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Tenant Signature
                  </span>
                  <span className="text-xs font-extrabold text-emerald-700">
                    Verified & Signed ✓
                  </span>
                </div>
                {tenantSig &&
                  typeof tenantSig === "string" &&
                  tenantSig.startsWith("data:image") && (
                    <img
                      src={tenantSig}
                      alt="Tenant Signature"
                      className="h-8 object-contain"
                    />
                  )}
              </div>
            </div>
          </div>

          {/* Finalize Button */}
          <div className="pt-4 border-t border-slate-200">
            <button
              onClick={handleFinalLockAndSave}
              className="w-full bg-[#4A1E6D] hover:bg-purple-950 text-white font-extrabold py-3.5 rounded-2xl text-xs transition-colors shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" /> Save & Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}