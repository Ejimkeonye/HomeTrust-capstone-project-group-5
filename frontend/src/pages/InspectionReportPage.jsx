import { useState } from "react";
import {
  ArrowLeft,
  Printer,
  Lock,
  Check,
  LogOut,
  ShieldCheck,
} from "lucide-react";

export default function InspectionReportPage({
  property,
  inspectionData: initialInspectionData,
  signatures = {},
  onBack,
  onFinalize,
}) {
  const reportStorageKey = `hometrust_report_${property?.id || "default"}`;

  const [activeInspectionData] = useState(() => {
    try {
      const saved = localStorage.getItem(reportStorageKey);
      const parsedSaved = saved ? JSON.parse(saved) : {};
      return (
        parsedSaved.inspectionData ||
        initialInspectionData ||
        property?.inspectionData ||
        {}
      );
    } catch (e) {
      console.error(e);
      return initialInspectionData || property?.inspectionData || {};
    }
  });

  // Use signatures passed down from parent/storage
  const landlordSig = signatures.landlord || property?.signatures?.landlord;
  const tenantSig = signatures.tenant || property?.signatures?.tenant;

  const [showSuccessScreen, setShowSuccessScreen] = useState(false);

  // Extract rooms data safely if passed as array or object
  const roomsList = Array.isArray(activeInspectionData)
    ? activeInspectionData
    : Object.keys(activeInspectionData).map((k) => ({
        name: k,
        ...activeInspectionData[k],
      }));

  const handleFinalLockAndSave = () => {
    const timestamp = new Date().toLocaleString();
    const finalReport = {
      propertyId: property?.id,
      propertyName: property?.name || property?.address,
      landlordSig,
      tenantSig,
      isCompleted: true,
      completedTimestamp: timestamp,
      inspectionData: activeInspectionData,
    };

    localStorage.setItem(reportStorageKey, JSON.stringify(finalReport));

    // Update master properties list
    const savedProps = JSON.parse(
      localStorage.getItem("hometrust_properties") || "[]",
    );
    const updatedProps = savedProps.map((p) =>
      p.id === property?.id
        ? {
            ...p,
            status: "READ_ONLY",
            progress: 100,
            signatures: { landlord: landlordSig, tenant: tenantSig },
            inspectionData: activeInspectionData,
            completedTimestamp: timestamp,
          }
        : p,
    );
    localStorage.setItem("hometrust_properties", JSON.stringify(updatedProps));

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
              Congratulations!
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed px-2 font-medium">
              Your evidence has been submitted for approval and acknowledgement.
              The inspection baseline is now sealed and locked.
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
            Inspection Summary
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
              Verified Record
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">
              {property?.name || property?.address}
            </h2>
            <div className="mt-2">
              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-300">
                <Lock className="w-3 h-3" /> Signed & Locked (READ_ONLY)
              </span>
            </div>
          </div>

          {/* Rooms Walkthrough List */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              Walkthrough Breakdown
            </h3>
            {roomsList.map((room, idx) => (
              <div
                key={room.id || idx}
                className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2"
              >
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-extrabold text-slate-900">
                    {room.name}
                  </h4>
                  <span className="text-[10px] font-extrabold text-purple-900 bg-purple-200/60 px-2 py-0.5 rounded-md">
                    {room.category || "Rooms"}
                  </span>
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  {room.items?.map((item, iIdx) => (
                    <div
                      key={item.id || iIdx}
                      className="flex justify-between py-1 border-b border-slate-200/60 last:border-0"
                    >
                      <span className="font-semibold text-slate-800">
                        {item.name}
                      </span>
                      <span className="text-[11px] text-purple-900 font-bold capitalize">
                        {item.condition?.replace("_", " ")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
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
