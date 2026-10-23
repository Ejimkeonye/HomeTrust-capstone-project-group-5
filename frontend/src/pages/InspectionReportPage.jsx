import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Printer,
  Lock,
  Check,
  LogOut,
  ShieldCheck,
  Download,
} from "lucide-react";
import api from "../api/client";

const getSignatureImageUrl = (signature) => {
  if (!signature) return null;

  // Existing base64 signature image.

  if (typeof signature === "string") {
    return signature.startsWith("data:image/") ||
      /^https?:\/\//i.test(signature)
      ? signature
      : null;
  }

  // Backend may return a signature object.

  if (typeof signature === "object") {
    return (
      signature.url ||
      signature.imageUrl ||
      signature.signatureUrl ||
      signature.signedImageUrl ||
      signature.dataUrl ||
      signature.signature ||
      null
    );
  }

  return null;
};

const formatTimestamp = (value) => {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

export default function InspectionReportPage({
  property,

  inspectionId,

  onBack,

  onFinalize,
}) {
  const [activeInspectionData, setActiveInspectionData] = useState(null);

  const [isLoading, setIsLoading] = useState(false);

  const [loadError, setLoadError] = useState("");

  const [showSuccessScreen, setShowSuccessScreen] = useState(false);

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const [pdfError, setPdfError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadInspectionReport = async () => {
      if (!inspectionId) {
        setLoadError("No inspection ID was provided.");

        return;
      }

      setIsLoading(true);
      setLoadError("");
      setActiveInspectionData(null);
      setShowSuccessScreen(false);

      try {
        const response = await api.get(`/inspections/${inspectionId}`);

        if (cancelled) return;

        // GET /inspections/:id currently returns the inspection object.

        const payload = response.data;

        const inspection =
          payload?.inspection ||
          payload?.data?.inspection ||
          payload?.data ||
          payload;

        const propertyId = property?.propertyId || property?.id;
        if (
          !inspection ||
          String(inspection.inspectionId || inspection.id || "") !==
            String(inspectionId) ||
          (inspection.propertyId &&
            propertyId &&
            String(inspection.propertyId) !== String(propertyId)) ||
          inspection.mode === "MoveOut" ||
          inspection.status === "ARCHIVED" ||
          inspection.state === "ARCHIVED"
        ) {
          throw new Error(
            "The requested record is not a valid Move-In inspection for this property.",
          );
        }
        setActiveInspectionData(inspection);
      } catch (err) {
        if (cancelled) return;

        console.error(
          "Failed to load inspection report:",

          err?.response?.data || err?.message,
        );

        setLoadError(
          err?.response?.data?.message ||
            "Unable to load the saved inspection. Please try again.",
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadInspectionReport();

    return () => {
      cancelled = true;
    };
  }, [inspectionId, property?.propertyId, property?.id]);

  // Use the saved inspection returned by the backend as the source of truth.

  const inspection = activeInspectionData || {};

  // GET /inspections/:id exposes separate signature fields, while the POST

  // signature response uses a nested signatures object. Support both shapes.

  const landlordSig = getSignatureImageUrl(
    inspection.signatures?.landlord ?? inspection.landlordSignature,
  );

  const tenantSig = getSignatureImageUrl(
    inspection.signatures?.tenant ?? inspection.tenantSignature,
  );

  const isActuallyLocked = inspection.state === "READ_ONLY";

  const propertyRooms = property?.rooms || [];

  const inspectionItems = Array.isArray(inspection.items)
    ? inspection.items
    : Array.isArray(activeInspectionData)
      ? activeInspectionData
      : [];

  const roomsList = (() => {
    const grouped = new Map();

    propertyRooms.forEach((room) => {
      const roomId = room.roomId || room.id || room.name;

      grouped.set(String(roomId), {
        id: roomId,

        name: room.name || "Unnamed Room",

        category: room.category || "Room",

        items: [],
      });
    });

    inspectionItems.forEach((item, index) => {
      const roomId = String(item.roomId || "unassigned");

      if (!grouped.has(roomId)) {
        grouped.set(roomId, {
          id: roomId,

          name: item.roomName || "Other / Unassigned Items",

          category: "Room",

          items: [],
        });
      }

      grouped.get(roomId).items.push({
        ...item,

        id: item.itemId || item.roomItemId || item.id || index,

        name: item.itemName || item.name || "Unnamed Item",

        evidence: item.evidence || [],
      });
    });

    return Array.from(grouped.values());
  })();

  const handleFinalLockAndSave = () => {
    // The backend owns finalization and persistence. This action only returns

    // the user to the dashboard after the saved inspection is confirmed locked.

    if (!isActuallyLocked || isLoading || loadError) return;

    setShowSuccessScreen(true);

    onFinalize?.(activeInspectionData);
  };

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    if (!inspectionId || isDownloadingPdf) return;

    setIsDownloadingPdf(true);

    setPdfError("");

    let downloadUrl;

    try {
      const response = await api.get(
        `/inspections/${inspectionId}/report.pdf`,

        { responseType: "blob" },
      );

      const pdfBlob = new Blob([response.data], {
        type: "application/pdf",
      });

      downloadUrl = window.URL.createObjectURL(pdfBlob);

      const link = document.createElement("a");

      link.href = downloadUrl;

      link.download = `homecompa-inspection-${inspectionId}.pdf`;

      document.body.appendChild(link);

      link.click();

      link.remove();
    } catch (error) {
      console.error(
        "Failed to download inspection PDF:",

        error?.response?.data || error?.message,
      );

      setPdfError(
        error.response?.status === 401
          ? "Your session has expired. Please sign in again."
          : "Unable to download the inspection report. Please try again.",
      );
    } finally {
      if (downloadUrl) window.URL.revokeObjectURL(downloadUrl);

      setIsDownloadingPdf(false);
    }
  };

  if (showSuccessScreen) {
    return (
      <div className="min-h-screen bg-slate-900/65 backdrop-blur-md flex items-center justify-center p-4">
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
            type="button"
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
      <div className="w-full max-w-6xl mx-auto px-4 bg-white min-h-screen sm:min-h-200 sm:rounded-[48px] shadow-2xl border border-slate-200 flex flex-col justify-between overflow-hidden relative text-slate-900">
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
            Inspection Summary
          </h1>

          <button
            type="button"
            onClick={handlePrint}
            className="p-2 text-white bg-white/10 hover:bg-white/20 rounded-full cursor-pointer transition-colors"
            title="Print Report"
          >
            <Printer className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf || !inspectionId}
            className="p-2 text-white bg-white/10 hover:bg-white/20 rounded-full cursor-pointer transition-colors disabled:opacity-50"
            title={isDownloadingPdf ? "Downloading PDF" : "Download PDF"}
          >
            <Download className="w-4 h-4" />
          </button>
        </div>

        {/* Content Area */}

        <div className="px-6 py-4 flex-1 overflow-y-auto space-y-6 bg-white">
          {pdfError && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {pdfError}
            </div>
          )}

          <div className="border-b border-slate-200 pb-4">
            <div className="text-[10px] font-bold tracking-wider text-[#4A1E6D] uppercase mb-1">
              Verified Record
            </div>

            <h2 className="text-lg font-extrabold text-slate-900">
              {property?.name || property?.address}
            </h2>

            <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
              {inspection.submittedAt || inspection.createdAt
                ? new Date(
                    inspection.submittedAt || inspection.createdAt,
                  ).toLocaleString("en-NG", {
                    dateStyle: "medium",

                    timeStyle: "short",
                  })
                : "Date not recorded"}

              <span
                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                  isActuallyLocked
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : "bg-slate-100 text-slate-600 border-slate-300"
                }`}
              >
                <Lock className="w-3 h-3" />{" "}
                {isActuallyLocked
                  ? "Signed & Locked (READ_ONLY)"
                  : "Draft / Pending Inspection"}
                {isLoading && (
                  <p className="text-sm text-slate-500">
                    Loading saved inspection and evidence...
                  </p>
                )}
                {!isLoading && loadError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {loadError}

                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="ml-2 underline font-bold"
                    >
                      Retry
                    </button>
                  </div>
                )}
              </span>
            </div>
          </div>

          {/* Rooms Walkthrough List */}

          <div className="space-y-3">
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              Walkthrough Breakdown
            </h3>

            {roomsList.length > 0 ? (
              roomsList.map((room, idx) => (
                <div
                  key={room.id || idx}
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-extrabold text-slate-900">
                      {room.name}
                    </h4>

                    <span className="text-[10px] font-extrabold text-purple-900 bg-purple-200/60 px-2 py-0.5 rounded-md">
                      {room.category || "Rooms"}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 space-y-2">
                    {room.items?.map((item, iIdx) => (
                      <div
                        key={item.id || iIdx}
                        className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1.5"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-extrabold text-slate-800">
                            {item.name}
                          </span>

                          <span className="text-[10px] text-purple-900 bg-purple-50 px-2 py-0.5 rounded-md font-bold uppercase">
                            {(item.condition || "Not recorded").replaceAll(
                              "_",

                              " ",
                            )}
                          </span>
                        </div>

                        {/* Render Item Comments / Notes */}

                        {(item.notes || item.comments) && (
                          <p className="text-[11px] text-slate-600 bg-slate-50 p-1.5 rounded-lg border border-slate-200 font-medium">
                            💬 Comments: {item.notes || item.comments}
                          </p>
                        )}

                        {item.dispute && (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 space-y-1">
                            <p className="font-bold text-amber-900">
                              Dispute Filed
                            </p>

                            {item.dispute.severity && (
                              <p className="font-semibold text-amber-800">
                                Severity: {item.dispute.severity}
                              </p>
                            )}

                            {item.dispute.description && (
                              <p className="text-slate-700 whitespace-pre-wrap">
                                {item.dispute.description}
                              </p>
                            )}

                            {item.dispute.raisedBy && (
                              <p className="text-slate-500">
                                Raised by: {item.dispute.raisedBy}
                              </p>
                            )}

                            {item.dispute.timestamp && (
                              <p className="text-slate-500">
                                Date: {formatTimestamp(item.dispute.timestamp)}
                              </p>
                            )}
                          </div>
                        )}

                        {(item.evidence?.length > 0 ||
                          item.photos?.length > 0) && (
                          <div className="grid grid-cols-3 gap-2 pt-2">
                            {(item.evidence || item.photos || []).map(
                              (evidence, index) => {
                                const imageUrl =
                                  evidence.url || evidence.imageUrl;

                                return imageUrl ? (
                                  <a
                                    key={
                                      evidence.evidenceId ||
                                      evidence.id ||
                                      index
                                    }
                                    href={imageUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block"
                                  >
                                    <img
                                      src={imageUrl}
                                      alt={`Evidence for ${item.name}`}
                                      loading="lazy"
                                      className="w-full h-20 rounded-lg object-cover border border-slate-200"
                                    />
                                  </a>
                                ) : (
                                  <div
                                    key={
                                      evidence.evidenceId ||
                                      evidence.id ||
                                      index
                                    }
                                    className="text-[10px] text-slate-500 border rounded-lg p-2"
                                  >
                                    Evidence recorded; image URL unavailable.
                                  </div>
                                );
                              },
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                No walkthrough room details found.
              </div>
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

                  <span
                    className={`text-xs font-extrabold ${landlordSig ? "text-emerald-700" : "text-slate-400"}`}
                  >
                    {landlordSig ? (
                      <img
                        src={landlordSig}
                        alt="Landlord signature"
                        className="max-h-20 max-w-full object-contain"
                      />
                    ) : (
                      <p className="text-sm text-slate-500">
                        Landlord signature not available
                      </p>
                    )}
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

                  <span
                    className={`text-xs font-extrabold ${tenantSig ? "text-emerald-700" : "text-slate-400"}`}
                  >
                    {tenantSig ? (
                      <img
                        src={tenantSig}
                        alt="Tenant signature"
                        className="max-h-20 max-w-full object-contain"
                      />
                    ) : (
                      <p className="text-sm text-slate-500">
                        Tenant signature not available
                      </p>
                    )}
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
              type="button"
              onClick={handleFinalLockAndSave}
              disabled={!isActuallyLocked || isLoading || Boolean(loadError)}
              className="w-full bg-[#4A1E6D] hover:bg-purple-950 text-white font-extrabold py-3.5 rounded-2xl text-xs transition-colors shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" /> Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
