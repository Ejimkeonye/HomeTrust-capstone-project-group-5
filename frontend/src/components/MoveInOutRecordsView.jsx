import { ArrowLeft, Camera, ShieldCheck, FileText } from "lucide-react";

const normalizeData = (data) => {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  return Object.entries(data).map(([key, value]) => ({
    id: key,
    name: key,
    category: "Rooms",
    ...(value && typeof value === "object" ? value : {}),
  }));
};

const getEvidenceImages = (item) => {
  const evidence = [
    ...(Array.isArray(item?.evidence) ? item.evidence : []),
    ...(Array.isArray(item?.photos) ? item.photos : []),
  ];
  return evidence
    .map((entry) =>
      typeof entry === "string"
        ? entry
        : entry?.url || entry?.imageUrl || entry?.photoUrl,
    )
    .filter(Boolean);
};

const getRoomPhoto = (room) => {
  if (room?.imageUrl) return room.imageUrl;
  for (const item of room?.items || []) {
    const image = getEvidenceImages(item)[0];
    if (image) return image;
  }
  return null;
};

function RecordColumn({ label, room, accentClass }) {
  const photo = getRoomPhoto(room);
  const items = Array.isArray(room?.items) ? room.items : [];

  return (
    <div className="min-w-0 space-y-2 rounded-xl border border-slate-200 bg-white p-2.5">
      <div
        className={`text-[10px] font-extrabold uppercase tracking-wider ${accentClass}`}
      >
        {label}
      </div>
      <div className="flex h-24 w-full items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-400">
        {photo ? (
          <img
            src={photo}
            alt={`${label} evidence`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <Camera className="h-5 w-5 text-slate-300" />
        )}
      </div>
      {items.length ? (
        <div className="space-y-2">
          {items.map((item, index) => {
            const images = getEvidenceImages(item);
            return (
              <div
                key={item.id || item.itemId || item.roomItemId || index}
                className="space-y-1 border-t border-slate-100 pt-1.5"
              >
                <div className="flex items-start justify-between gap-1 text-[10px]">
                  <span className="min-w-0 wrap-break-word text-slate-700">
                    {item.name || item.itemName || "Item"}
                  </span>
                  <span className="shrink-0 font-bold capitalize text-slate-900">
                    {(
                      item.condition ||
                      item.status ||
                      "Not recorded"
                    ).replaceAll("_", " ")}
                  </span>
                </div>
                {item.notes && (
                  <p className="text-[10px] text-slate-500">{item.notes}</p>
                )}
                {images.length > 1 && (
                  <div className="grid grid-cols-3 gap-1">
                    {images.slice(1, 4).map((src, imageIndex) => (
                      <a
                        key={`${src}-${imageIndex}`}
                        href={src}
                        target="_blank"
                        rel="noreferrer"
                        className="block"
                      >
                        <img
                          src={src}
                          alt={`${label} evidence ${imageIndex + 2}`}
                          className="h-12 w-full rounded object-cover"
                          loading="lazy"
                        />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[10px] italic text-slate-400">
          No checklist items recorded
        </p>
      )}
    </div>
  );
}

export default function MoveInOutRecordsView({
  property,
  moveInInspectionData = [],
  moveOutInspectionData = [],
  onBack,
  onProceedToSignatures,
}) {
  const moveInRooms = normalizeData(moveInInspectionData);
  const moveOutRooms = normalizeData(moveOutInspectionData);
  const roomNames = Array.from(
    new Set(
      [...moveInRooms, ...moveOutRooms]
        .map((room) => room?.name || room?.roomName)
        .filter(Boolean),
    ),
  );

  const findRoom = (rooms, name) =>
    rooms.find((room) => (room?.name || room?.roomName) === name) || null;

  return (
    <div className="min-h-screen bg-white p-0 font-sans sm:p-6">
      <div className="relative mx-auto flex min-h-screen w-full max-w-2xl flex-col overflow-hidden border border-slate-200 bg-white text-slate-900 shadow-2xl sm:min-h-[85vh] sm:rounded-3xl">
        <header className="z-10 flex items-center justify-between gap-2 bg-[#4A1E6D] p-4 text-white">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 text-center">
            <h1 className="truncate text-sm font-extrabold">
              Move-In & Move-Out Records
            </h1>
            <p className="truncate text-[10px] text-purple-200">
              {property?.address || "Property Comparison"}
            </p>
          </div>
          <div className="w-9" />
        </header>

        <div className="px-4 pt-4 sm:px-6">
          <div className="flex items-start gap-2.5 rounded-2xl border border-purple-200 bg-purple-50 p-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#4A1E6D]" />
            <p className="text-[11px] font-medium leading-relaxed text-purple-900">
              Compare the saved condition at check-in with the evidence recorded
              at departure.
            </p>
          </div>
        </div>

        <main className="flex-1 space-y-4 overflow-y-auto bg-white px-4 py-4 sm:px-6">
          {roomNames.length === 0 ? (
            <div className="py-16 text-center text-xs font-medium text-slate-400">
              <FileText className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              No inspection records found for this property yet.
            </div>
          ) : (
            roomNames.map((roomName) => {
              const moveInRoom = findRoom(moveInRooms, roomName);
              const moveOutRoom = findRoom(moveOutRooms, roomName);
              return (
                <section
                  key={roomName}
                  className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm sm:p-4"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
                    <h2 className="text-xs font-extrabold text-slate-900">
                      {roomName}
                    </h2>
                    <span className="rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-[#4A1E6D]">
                      {moveOutRoom?.category || moveInRoom?.category || "Rooms"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <RecordColumn
                      label="Move-In State"
                      room={moveInRoom}
                      accentClass="text-[#4A1E6D]"
                    />
                    <RecordColumn
                      label="Move-Out State"
                      room={moveOutRoom}
                      accentClass="text-purple-900"
                    />
                  </div>
                </section>
              );
            })
          )}
        </main>

        <footer className="border-t border-slate-200 bg-white p-4">
          <button
            type="button"
            onClick={onProceedToSignatures}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#4A1E6D] py-3.5 text-xs font-extrabold text-white shadow-lg transition-colors hover:bg-purple-950"
          >
            Proceed to Move-Out Signatures
          </button>
        </footer>
      </div>
    </div>
  );
}
