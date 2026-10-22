import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Check,
  Lock,
  Printer,
  ShieldCheck,
  LogOut,
  AlertCircle,
  LoaderCircle
} from "lucide-react";
import api from "../api/client";

const unwrapInspection = (response) =>
  response?.data?.inspection ||
  response?.data?.data?.inspection ||
  response?.data?.data ||
  response?.data ||
  response;

const getSignatureUrl = (signature) => {
  if (!signature) return null;
  if (typeof signature === "string")
    return signature.startsWith("data:image/") ||
      /^https?:\/\//i.test(signature)
      ? signature
      : null;
  if (typeof signature === "object") {
    if (!signature.uploadedAt) return null;
    return (
      signature.url ||
      signature.imageUrl ||
      signature.signatureUrl ||
      signature.signedImageUrl ||
      signature.dataUrl ||
      null
    );
  }
  return null;
};

const normalizeEvidence = (item) => {
  const entries = [
    ...(Array.isArray(item?.evidence) ? item.evidence : []),
    ...(Array.isArray(item?.photos) ? item.photos : []),
  ];
  return entries
    .map((entry) =>
      typeof entry === "string"
        ? entry
        : entry?.url || entry?.imageUrl || entry?.photoUrl,
    )
    .filter(Boolean);
};

const buildRooms = (inspection, propertyRooms = []) => {
  const rooms = new Map();
  (Array.isArray(propertyRooms) ? propertyRooms : []).forEach((room) => {
    const id = String(room.roomId || room.id || room.name || "unassigned");
    rooms.set(id, {
      id,
      name: room.name || "Unnamed Room",
      category: room.category || "Room",
      items: [],
    });
  });
  (Array.isArray(inspection?.items) ? inspection.items : []).forEach(
    (item, index) => {
      const id = String(item.roomId || "unassigned");
      if (!rooms.has(id)) {
        rooms.set(id, {
          id,
          name: item.roomName || "Other / Unassigned Items",
          category: "Room",
          items: [],
        });
      }
      rooms.get(id).items.push({
        ...item,
        id: item.itemId || item.roomItemId || item.id || index,
        name: item.itemName || item.name || "Unnamed Item",
        evidence: item.evidence || [],
        photos: item.photos || [],
      });
    },
  );
  return [...rooms.values()];
};

function SignatureCard({ label, signature }) {
  const image = getSignatureUrl(signature);
  const saved = Boolean(
    signature && (typeof signature !== "object" || signature.uploadedAt),
  );
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase text-slate-500">
          {label}
        </div>
        <div
          className={`mt-1 text-xs font-extrabold ${saved ? "text-emerald-700" : "text-slate-400"}`}
        >
          {saved ? "Signature saved" : "Pending signature"}
        </div>
        {signature?.signedAt && (
          <div className="mt-1 text-[10px] text-slate-500">
            {new Date(signature.signedAt).toLocaleString()}
          </div>
        )}
      </div>
      {image ? (
        <img
          src={image}
          alt={`${label} image`}
          className="max-h-16 max-w-[45%] object-contain"
        />
      ) : (
        <span className="text-[10px] text-slate-400">No image available</span>
      )}
    </div>
  );
}

function RecordColumn({ title, room, accent }) {
  const items = Array.isArray(room?.items) ? room.items : [];
  const firstPhoto =
    room?.imageUrl || items.flatMap(normalizeEvidence)[0] || null;
  return (
    <div className="min-w-0 space-y-2 rounded-xl border border-slate-200 bg-white p-2.5">
      <div
        className={`text-[10px] font-extrabold uppercase tracking-wider ${accent}`}
      >
        {title}
      </div>
      <div className="flex h-24 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-400">
        {firstPhoto ? (
          <img
            src={firstPhoto}
            alt={`${title} evidence`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <Camera className="h-5 w-5 text-slate-300" />
        )}
      </div>
      {items.length ? (
        items.map((item, index) => {
          const photos = normalizeEvidence(item);
          return (
            <div
              key={item.id || item.itemId || index}
              className="space-y-1 border-t border-slate-100 pt-2"
            >
              <div className="flex items-start justify-between gap-2 text-[10px]">
                <span className="min-w-0 wrap-break-word text-slate-700">
                  {item.name || item.itemName || "Item"}
                </span>
                <span className="shrink-0 font-bold capitalize text-slate-900">
                  {String(
                    item.condition || item.status || "Not recorded",
                  ).replaceAll("_", " ")}
                </span>
              </div>

              {(item.notes || item.comments) && (
                <p className="text-[10px] text-slate-600">
                  💬 Comments: {item.notes || item.comments}
                </p>
              )}
              {item.dispute && (
                <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-2">
                  <p className="text-[10px] font-bold text-amber-900">
                    Dispute Filed
                  </p>
                  {item.dispute.severity && (
                    <p className="text-[10px] font-semibold text-amber-800">
                      Severity: {item.dispute.severity}
                    </p>
                  )}
                  {item.dispute.description && (
                    <p className="whitespace-pre-wrap text-[10px] text-slate-700">
                      {item.dispute.description}
                    </p>
                  )}
                  {item.dispute.raisedBy && (
                    <p className="text-[10px] text-slate-500">
                      Raised by: {item.dispute.raisedBy}
                    </p>
                  )}
                  {item.dispute.timestamp && (
                    <p className="text-[10px] text-slate-500">
                      Date: {item.dispute.timestamp}
                    </p>
                  )}
                </div>
              )}

              {photos.length > 1 && (
                <div className="grid grid-cols-3 gap-1">
                  {photos.slice(1, 4).map((src, photoIndex) => (
                    <a
                      key={`${src}-${photoIndex}`}
                      href={src}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img
                        src={src}
                        alt={`${title} evidence ${photoIndex + 2}`}
                        className="h-12 w-full rounded object-cover"
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              )}
              {!photos.length && (
                <p className="text-[10px] italic text-slate-400">
                  No photo evidence attached
                </p>
              )}
            </div>
          );
        })
      ) : (
        <p className="text-[10px] italic text-slate-400">
          No checklist items recorded
        </p>
      )}
    </div>
  );
}

export default function MoveOutInspectionReportPage({
  property,
  inspectionId,
  moveInInspectionId,
  moveInInspectionData = [],
  moveOutInspectionData = [],
  onBack,
  onFinalize,
}) {
  const propertyId = property?.propertyId || property?.id || null;
  const [moveInRecord, setMoveInRecord] = useState(null);
  const [moveOutRecord, setMoveOutRecord] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadRecords = async () => {
      setIsLoading(true);
      setLoadError("");
      setMoveInRecord(null);
      setMoveOutRecord(null);
      try {
        if (!propertyId || !moveInInspectionId || !inspectionId) {
          throw new Error(
            "Both saved inspection IDs and the selected property are required to load this report.",
          );
        }
        const [moveInResponse, moveOutResponse] = await Promise.all([
          api.get(`/inspections/${moveInInspectionId}`),
          api.get(`/inspections/${inspectionId}`),
        ]);
        const moveIn = unwrapInspection(moveInResponse);
        const moveOut = unwrapInspection(moveOutResponse);
        const valid = (record, id) =>
          record &&
          String(record.inspectionId || record.id || "") === String(id) &&
          (!record.propertyId ||
            String(record.propertyId) === String(propertyId)) &&
          record.status !== "ARCHIVED" &&
          record.state !== "ARCHIVED";
        if (!valid(moveIn, moveInInspectionId) || moveIn.mode === "MoveOut") {
          throw new Error(
            "The saved Move-In inspection could not be verified for this property.",
          );
        }
        if (!valid(moveOut, inspectionId) || moveOut.mode !== "MoveOut") {
          throw new Error(
            "The saved Move-Out inspection could not be verified for this property.",
          );
        }
        if (!cancelled) {
          setMoveInRecord(moveIn);
          setMoveOutRecord(moveOut);
        }
      } catch (error) {
        if (!cancelled)
          setLoadError(
            error?.response?.data?.message ||
              error?.message ||
              "Unable to load the saved Move-Out report.",
          );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    loadRecords();
    return () => {
      cancelled = true;
    };
  }, [propertyId, inspectionId, moveInInspectionId]);

  const moveInRooms = useMemo(
    () =>
      moveInRecord
        ? buildRooms(moveInRecord, property?.rooms || [])
        : Array.isArray(moveInInspectionData)
          ? moveInInspectionData
          : [],
    [moveInRecord, property?.rooms, moveInInspectionData],
  );
  const moveOutRooms = useMemo(
    () =>
      moveOutRecord
        ? buildRooms(moveOutRecord, property?.rooms || [])
        : Array.isArray(moveOutInspectionData)
          ? moveOutInspectionData
          : [],
    [moveOutRecord, property?.rooms, moveOutInspectionData],
  );
  const allRoomNames = useMemo(
    () => [
      ...new Set(
        [...moveInRooms, ...moveOutRooms]
          .map((room) => room?.name || room?.roomName)
          .filter(Boolean),
      ),
    ],
    [moveInRooms, moveOutRooms],
  );
  const isActuallyLocked = moveOutRecord?.state === "READ_ONLY";
  const landlordSignature = moveOutRecord?.landlordSignature || null;
  const tenantSignature = moveOutRecord?.tenantSignature || null;

  const finish = () => {
    if (!isActuallyLocked || isLoading || loadError) return;
    setShowSuccess(true);
    onFinalize?.({ inspection: moveOutRecord, moveInInspection: moveInRecord });
  };

  if (showSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900/60 p-4">
        <div className="w-full max-w-sm space-y-6 rounded-4xl bg-white p-8 text-center shadow-2xl">
          <ShieldCheck className="mx-auto h-12 w-12 text-[#4A1E6D]" />
          <h2 className="text-xl font-black text-slate-950">
            Move-Out Report Confirmed
          </h2>
          <p className="text-xs leading-relaxed text-slate-600">
            The backend confirms that both parties' signatures have been saved
            and the Move-Out inspection is read-only.
          </p>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#4A1E6D] py-3.5 text-xs font-bold text-white"
          >
            <LogOut className="h-4 w-4" /> Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-0 font-sans sm:p-6">
      <div className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col overflow-hidden border border-slate-200 bg-white text-slate-900 shadow-2xl sm:min-h-[85vh] sm:rounded-3xl">
        <header className="flex items-center justify-between gap-3 bg-[#4A1E6D] p-4 text-white">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-center text-sm font-extrabold">
            Final Move-Out Report
          </h1>
          <button
            type="button"
            onClick={() => window.print()}
            aria-label="Print report"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
          >
            <Printer className="h-4 w-4" />
          </button>
        </header>
        <main className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
          <section className="border-b border-slate-200 pb-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#4A1E6D]">
              Backend-verified side-by-side record
            </div>
            <h2 className="mt-1 text-lg font-extrabold">
              {property?.name || property?.address || "Property"}
            </h2>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-500">
                {moveOutRecord?.submittedAt || moveOutRecord?.createdAt
                  ? new Date(
                      moveOutRecord.submittedAt || moveOutRecord.createdAt,
                    ).toLocaleString()
                  : "Date not recorded"}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold ${isActuallyLocked ? "border-emerald-300 bg-emerald-100 text-emerald-800" : "border-slate-300 bg-slate-100 text-slate-600"}`}
              >
                <Lock className="h-3 w-3" />
                {isActuallyLocked
                  ? "Signed & Locked (READ_ONLY)"
                  : "Pending signatures / review"}
              </span>
            </div>
          </section>
          {isLoading && (
  <div
    role="status"
    className="flex items-center justify-center gap-2 py-4 text-sm text-purple-800"
  >
    <LoaderCircle className="h-5 w-5 animate-spin" />
    Loading and verifying both saved inspections…
  </div>
)}
          {loadError && (
            <div
              role="alert"
              className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              <AlertCircle className="h-5 w-5 shrink-0" />{" "}
              <div>
                {loadError}
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="ml-2 font-bold underline"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
          {!isLoading && !loadError && (
            <>
              <section className="space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider">
                  Move-In vs Move-Out Comparison
                </h3>
                {!allRoomNames.length ? (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-400">
                    No room or checklist details were found in the saved
                    inspections.
                  </p>
                ) : (
                  allRoomNames.map((roomName) => {
                    const moveInRoom = moveInRooms.find(
                      (room) => (room.name || room.roomName) === roomName,
                    );
                    const moveOutRoom = moveOutRooms.find(
                      (room) => (room.name || room.roomName) === roomName,
                    );
                    return (
                      <div
                        key={roomName}
                        className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4"
                      >
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <h4 className="text-xs font-extrabold">{roomName}</h4>
                          <span className="rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-900">
                            {moveOutRoom?.category ||
                              moveInRoom?.category ||
                              "Room"}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <RecordColumn
                            title="Move-In State"
                            room={moveInRoom}
                            accent="text-[#4A1E6D]"
                          />
                          <RecordColumn
                            title="Move-Out State"
                            room={moveOutRoom}
                            accent="text-purple-900"
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </section>
              <section className="space-y-3 border-t border-slate-200 pt-4">
                <h3 className="text-xs font-extrabold uppercase tracking-wider">
                  Digital Verification
                </h3>
                <SignatureCard
                  label="Landlord Signature"
                  signature={landlordSignature}
                />
                <SignatureCard
                  label="Tenant Signature"
                  signature={tenantSignature}
                />
              </section>
            </>
          )}
          <section className="border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={finish}
              disabled={!isActuallyLocked || isLoading || Boolean(loadError)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#4A1E6D] py-3.5 text-xs font-extrabold text-white shadow-lg transition-colors hover:bg-purple-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Check className="h-4 w-4" /> Confirm & Return to Dashboard
            </button>
            {!isActuallyLocked && !loadError && !isLoading && (
              <p className="mt-2 text-center text-[11px] text-slate-500">
                This report remains pending until the backend marks the Move-Out
                inspection READ_ONLY.
              </p>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
