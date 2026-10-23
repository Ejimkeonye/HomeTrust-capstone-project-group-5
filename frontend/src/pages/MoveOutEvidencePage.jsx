import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Check,
  ShieldCheck,
  Upload,
  X,
  MessageSquare,
  AlertCircle,
  LoaderCircle,
  Plus,
} from "lucide-react";

import { triggerNotification } from "../utils/notifications";
import api from "../api/client";

const CONDITIONS = [
  { value: "no_issue", label: "No Issue" },

  { value: "stains", label: "Stains" },

  { value: "cracks", label: "Cracks" },

  { value: "broken", label: "Broken" },
];

const getItemName = (item) => item.name || item.itemName || "Unnamed item";

const getItemPhotos = (item) => {
  const evidence = Array.isArray(item.evidence) ? item.evidence : [];

  const photos = Array.isArray(item.photos) ? item.photos : [];

  return [
    ...evidence.map((photo) => ({
      ...photo,

      // The controller's url is the signed S3 URL; downloadUrl returns JSON.

      url: photo.url,
    })),

    ...photos,
  ].filter((photo) => Boolean(photo.url));
};

const getErrorMessage = (error) =>
  error.response?.data?.message ||
  error.response?.data?.error ||
  error.message ||
  "Something went wrong. Please try again.";

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

export default function MoveOutEvidencePage({
  property,
  inspectionData,
  inspectionId,
  onBack,
  onDashboard,
  onSubmitEvidence,
  onUpdateInspectionData,
}) {
  const [inspectionState, setInspectionState] = useState(null);

  const [inspectionStateLoading, setInspectionStateLoading] = useState(true);

  const [inspectionStateError, setInspectionStateError] = useState(false);

  const [verifiedInspectionId, setVerifiedInspectionId] = useState(null);

  const isReadOnly = inspectionState === "READ_ONLY";

  // Fail closed until the active inspection's authoritative state is known.

  const canModifyInspection =
    Boolean(inspectionId) &&
    verifiedInspectionId === inspectionId &&
    !inspectionStateLoading &&
    !inspectionStateError &&
    Boolean(inspectionState) &&
    !isReadOnly;

  const [activeCategory, setActiveCategory] = useState("All");

  const [descriptiveNote, setDescriptiveNote] = useState("");

  const [showConfirmationModal, setShowConfirmationModal] = useState(false);

  const [selectedImage, setSelectedImage] = useState(null);

  const [uploadingItemIds, setUploadingItemIds] = useState([]);

  const [uploadMessage, setUploadMessage] = useState("");

  const [uploadProgress, setUploadProgress] = useState({
    completed: 0,
    total: 0,
  });

  // Add Evidence modal state.

  const [showAddModal, setShowAddModal] = useState(false);

  const [selectedRoomId, setSelectedRoomId] = useState("");

  const [newItemName, setNewItemName] = useState("");

  const [newItemCondition, setNewItemCondition] = useState("no_issue");

  const [newItemNotes, setNewItemNotes] = useState("");

  const [checklistItems, setChecklistItems] = useState([]);

  const [savingItem, setSavingItem] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  const [successMessage, setSuccessMessage] = useState("");

  // Read the authoritative state from this inspection, not the property.

  // Reset on every inspection change and fail closed if the request fails.

  useEffect(() => {
    let cancelled = false;

    if (!inspectionId) {
      return () => {
        cancelled = true;
      };
    }

    api

      .get(`/inspections/${inspectionId}`)

      .then((response) => {
        const inspection =
          response.data?.inspection || response.data?.data || response.data;

        if (!inspection?.state) {
          throw new Error("The backend did not return the inspection state.");
        }

        if (!cancelled) {
          setInspectionState(inspection.state);

          setVerifiedInspectionId(inspectionId);
        }
      })

      .catch((error) => {
        console.error(
          "Could not load inspection state:",

          getErrorMessage(error),
        );

        if (!cancelled) {
          setInspectionStateError(true);

          setErrorMessage(
            "Could not verify the inspection state. Refresh the inspection before editing or uploading evidence.",
          );
        }
      })

      .finally(() => {
        if (!cancelled) setInspectionStateLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [inspectionId]);

  const todaysFormattedDate = new Date().toLocaleDateString("en-US", {
    month: "long",

    day: "numeric",

    year: "numeric",
  });

  // Normalize inspection data without losing backend room/item IDs.

  const roomsList = useMemo(() => {
    const propertyRooms = Array.isArray(property?.rooms) ? property.rooms : [];

    const flatItems = Array.isArray(inspectionData)
      ? inspectionData
      : Array.isArray(inspectionData?.items)
        ? inspectionData.items
        : [];

    const suppliedRooms = Array.isArray(inspectionData?.rooms)
      ? inspectionData.rooms
      : propertyRooms;

    // InspectionPage may already provide rooms with their items grouped.

    if (
      Array.isArray(inspectionData) &&
      inspectionData.every(
        (entry) => Array.isArray(entry.items) || Array.isArray(entry.roomItems),
      )
    ) {
      return inspectionData.map((room) => ({
        ...room,

        roomId: room.roomId || room.id,

        name: room.name || room.roomName || "Unnamed room",

        items: (room.items || room.roomItems || []).map((item) => ({
          ...item,

          id: item.roomItemId || item.itemId || item.id,

          roomItemId: item.roomItemId || item.itemId,

          name: getItemName(item),

          evidence: Array.isArray(item.evidence) ? item.evidence : [],
        })),
      }));
    }

    return suppliedRooms.map((room) => {
      const roomId = room.roomId || room.id;

      const existingItems = Array.isArray(room.items)
        ? room.items
        : Array.isArray(room.roomItems)
          ? room.roomItems
          : [];

      const matchingItems = flatItems.filter(
        (item) =>
          (item.roomId && item.roomId === roomId) ||
          (item.roomName &&
            room.name &&
            item.roomName.toLowerCase() === room.name.toLowerCase()),
      );

      const uniqueItems = new Map();

      [...existingItems, ...matchingItems].forEach((item) => {
        const id =
          item.roomItemId ||
          item.itemId ||
          item.id ||
          `${item.roomId}-${getItemName(item)}`;

        uniqueItems.set(id, {
          ...item,

          id,

          roomItemId: item.roomItemId || item.itemId,

          name: getItemName(item),

          evidence: Array.isArray(item.evidence) ? item.evidence : [],
        });
      });

      return {
        ...room,

        roomId,

        name: room.name || room.roomName || "Unnamed room",

        items: [...uniqueItems.values()],
      };
    });
  }, [inspectionData, property]);

  // Only allow real property room IDs when saving items to the backend.

  const propertyRooms = useMemo(() => {
    const rooms = Array.isArray(property?.rooms) ? property.rooms : [];

    return rooms

      .filter((room) => room.roomId || room.id)

      .map((room) => ({
        ...room,

        roomId: room.roomId || room.id,

        name: room.name || room.roomName || "Unnamed room",
      }));
  }, [property]);

  const categories = useMemo(() => {
    const values = new Set(["All", "Rooms", "Kitchen", "Bathrooms", "Balcony"]);

    roomsList.forEach((room) => {
      values.add(room.category || "Rooms");
    });

    return [...values];
  }, [roomsList]);

  const filteredRooms = roomsList.filter((room) => {
    if (activeCategory === "All") return true;

    const categoryMatch =
      (room.category || "Rooms").toLowerCase() === activeCategory.toLowerCase();

    const nameMatch = room.name

      ?.toLowerCase()

      .includes(activeCategory.toLowerCase());

    return categoryMatch || nameMatch;
  });

  const resetAddForm = () => {
    setSelectedRoomId("");

    setNewItemName("");

    setNewItemCondition("no_issue");

    setNewItemNotes("");

    setChecklistItems([]);

    setErrorMessage("");

    setSuccessMessage("");
  };

  const handleAddChecklistItem = () => {
    if (!canModifyInspection) {
      setErrorMessage(
        "The inspection state is not verified or the inspection is read-only.",
      );

      return;
    }

    setErrorMessage("");

    setSuccessMessage("");

    if (!newItemName.trim()) {
      setErrorMessage("Enter an item name before adding it.");

      return;
    }

    if (!CONDITIONS.some((condition) => condition.value === newItemCondition)) {
      setErrorMessage("Choose a valid condition.");

      return;
    }

    setChecklistItems((previous) => [
      ...previous,

      {
        localId: `${Date.now()}-${previous.length}`,

        name: newItemName.trim(),

        condition: newItemCondition,

        notes: newItemNotes.trim(),
      },
    ]);

    setNewItemName("");

    setNewItemCondition("no_issue");

    setNewItemNotes("");
  };

  const handleRemoveChecklistItem = (localId) => {
    if (!canModifyInspection) {
      setErrorMessage(
        "The inspection state is not verified or the inspection is read-only.",
      );

      return;
    }

    setChecklistItems((previous) =>
      previous.filter((item) => item.localId !== localId),
    );
  };

  const handleSaveNewEvidence = async (event) => {
    event.preventDefault();

    setErrorMessage("");

    setSuccessMessage("");

    if (!canModifyInspection) {
      setErrorMessage(
        "The inspection state is not verified or this inspection is read-only. New evidence items cannot be added.",
      );

      return;
    }

    if (!inspectionId) {
      setErrorMessage(
        "The inspection ID is missing. Return to the inspection and try again.",
      );

      return;
    }

    if (!selectedRoomId) {
      setErrorMessage("Choose an existing property room.");

      return;
    }

    // Include the item currently in the input, even if the user

    // hasn't clicked the + button yet.

    const itemsToSave = [...checklistItems];

    if (newItemName.trim()) {
      itemsToSave.push({
        localId: `current-${Date.now()}`,

        name: newItemName.trim(),

        condition: newItemCondition,

        notes: newItemNotes.trim(),
      });
    }

    if (itemsToSave.length === 0) {
      setErrorMessage("Add at least one checklist item.");

      return;
    }

    const selectedRoom = propertyRooms.find(
      (room) => room.roomId === selectedRoomId,
    );

    if (!selectedRoom) {
      setErrorMessage(
        "That room could not be matched to the property. Refresh and try again.",
      );

      return;
    }

    setSavingItem(true);

    const savedItems = [];

    const failedItems = [];

    try {
      // Save items one by one. Keep the actual IDs returned by the API.

      // If a later item fails, preserve the items that were already saved.

      for (const item of itemsToSave) {
        try {
          const response = await api.post(
            `/inspections/${inspectionId}/items`,

            {
              roomId: selectedRoom.roomId,

              itemName: item.name,

              condition: item.condition,

              notes: item.notes || "",
            },
          );

          const payload =
            response.data?.item || response.data?.roomItem || response.data;

          const savedItemId = payload?.roomItemId || payload?.itemId;

          if (!savedItemId) {
            throw new Error(
              `The server did not return an ID for "${item.name}".`,
            );
          }

          savedItems.push({
            ...payload,

            id: savedItemId,

            roomItemId: savedItemId,

            name: payload.itemName || payload.name || item.name,

            condition: payload.condition || item.condition,

            notes: payload.notes ?? item.notes ?? "",

            photos: payload.photos || [],

            evidence: payload.evidence || [],
          });
        } catch (error) {
          failedItems.push({
            name: item.name,

            message: getErrorMessage(error),
          });
        }
      }

      if (savedItems.length > 0) {
        const existingRoom = roomsList.find(
          (room) =>
            room.roomId === selectedRoom.roomId ||
            room.id === selectedRoom.roomId ||
            room.name?.toLowerCase() === selectedRoom.name.toLowerCase(),
        );

        let updatedRooms;

        if (existingRoom) {
          updatedRooms = roomsList.map((room) => {
            if (room !== existingRoom) return room;

            const currentItems = Array.isArray(room.items) ? room.items : [];

            const existingIds = new Set(
              currentItems

                .map((item) => item.roomItemId || item.itemId || item.id)

                .filter(Boolean),
            );

            const newUniqueItems = savedItems.filter(
              (item) => !existingIds.has(item.roomItemId),
            );

            return {
              ...room,

              roomId: selectedRoom.roomId,

              items: [...currentItems, ...newUniqueItems],
            };
          });
        } else {
          updatedRooms = [
            {
              ...selectedRoom,

              id: selectedRoom.roomId,

              roomId: selectedRoom.roomId,

              category: selectedRoom.category || "Rooms",

              items: savedItems,
            },

            ...roomsList,
          ];
        }

        // Update the UI only with items confirmed by the backend.

        onUpdateInspectionData?.(updatedRooms);

        // Restore the property-scoped notification, but only after

        // the backend has successfully saved at least one item.

        const propertyKey = property?.propertyId || property?.id;

        if (propertyKey) {
          triggerNotification(
            propertyKey,

            savedItems.length === 1
              ? "New Move-Out Evidence Item Added"
              : "New Move-Out Evidence Items Added",

            `Added ${savedItems.length} item(s) to the ${selectedRoom.name} inspection.`,

            "system",
          );
        }
      }

      if (failedItems.length > 0) {
        const failedNames = failedItems.map((item) => item.name).join(", ");

        setErrorMessage(
          savedItems.length > 0
            ? `Saved ${savedItems.length} item(s), but could not save: ${failedNames}. Please retry the failed items.`
            : `No items were saved. ${failedItems[0].message}`,
        );

        // Remove successful entries from the checklist so retrying

        // doesn't unnecessarily submit them again.

        const successfulNames = new Set(savedItems.map((item) => item.name));

        setChecklistItems((previous) =>
          previous.filter((item) => !successfulNames.has(item.name)),
        );

        setNewItemName("");

        setNewItemNotes("");

        setNewItemCondition("no_issue");
      } else {
        setSuccessMessage(
          `${savedItems.length} item(s) saved to the inspection.`,
        );

        setChecklistItems([]);

        setNewItemName("");

        setNewItemNotes("");

        setNewItemCondition("no_issue");
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSavingItem(false);
    }
  };

  const handleProceed = async () => {
    setErrorMessage("");

    if (!canModifyInspection) {
      setErrorMessage(
        "The inspection state is not verified or the inspection is read-only.",
      );

      setShowConfirmationModal(false);

      return;
    }

    if (!inspectionId) {
      setErrorMessage("The inspection ID is missing.");

      return;
    }

    if (!onSubmitEvidence) {
      setErrorMessage(
        "The next-step action is not configured. Please return to the inspection.",
      );

      return;
    }

    setSubmitting(true);

    try {
      await onSubmitEvidence(inspectionId, descriptiveNote.trim());

      setShowConfirmationModal(false);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhotoUpload = async (roomId, itemId, event) => {
    const input = event.target;

    const files = Array.from(input.files || []);

    if (!files.length) return;

    if (!canModifyInspection) {
      setErrorMessage(
        inspectionStateError || inspectionStateLoading
          ? "The inspection state has not been verified. Refresh and try again."
          : "This inspection is read-only. Evidence cannot be uploaded.",
      );

      input.value = "";

      return;
    }

    if (!inspectionId) {
      setErrorMessage("No backend inspection is available for this upload.");

      input.value = "";

      return;
    }

    const supportedTypes = new Set([
      "image/jpeg",

      "image/png",

      "image/webp",

      "image/heic",

      "video/mp4",

      "video/quicktime",
    ]);

    if (files.some((file) => !supportedTypes.has(file.type))) {
      setErrorMessage(
        "Unsupported file format. Use JPEG, PNG, WebP, HEIC, MP4, or QuickTime video.",
      );

      input.value = "";

      return;
    }

    const uploadKey = `${roomId}:${itemId}`;

    setErrorMessage("");

    setUploadMessage("");

    setUploadingItemIds((current) =>
      current.includes(uploadKey) ? current : [...current, uploadKey],
    );

    let uploadedCount = 0;
    let uploadStage = "Preparing upload";
    setUploadProgress({ completed: 0, total: files.length });

    try {
      const room = roomsList.find(
        (entry) => entry.id === roomId || entry.roomId === roomId,
      );

      const item = room?.items?.find(
        (entry) => entry.id === itemId || entry.roomItemId === itemId,
      );

      if (!room || !item) {
        throw new Error("Could not find the room or item for this upload.");
      }

      const propertyRoom = propertyRooms.find(
        (entry) =>
          entry.roomId === (room.roomId || room.id) ||
          entry.name?.toLowerCase() === room.name?.toLowerCase(),
      );

      if (!propertyRoom?.roomId) {
        throw new Error(
          "This room has no valid backend room ID. Refresh the property and try again.",
        );
      }

      // Reuse an existing backend ID whenever possible. If this item

      // still has a temporary local ID, create it before uploading.

      let latestRooms = roomsList;

      // `id` can be a UI/local ID; only these explicit fields identify a

      // backend ROOM_ITEMS record.

      let backendItemId = item.roomItemId || item.itemId || null;

      if (!backendItemId) {
        const itemResponse = await api.post(
          `/inspections/${inspectionId}/items`,

          {
            roomId: propertyRoom.roomId,

            itemName: item.name || item.itemName || "Unnamed item",

            condition: item.condition || "no_issue",

            notes: item.notes || "",
          },
        );

        const savedItem =
          itemResponse.data?.item ||
          itemResponse.data?.roomItem ||
          itemResponse.data;

        backendItemId = savedItem?.roomItemId || savedItem?.itemId;

        if (!backendItemId) {
          throw new Error(
            "The backend did not return an ID for the inspection item.",
          );
        }

        // Replace the temporary ID in the displayed inspection data.

        const roomsWithBackendItem = roomsList.map((currentRoom) => ({
          ...currentRoom,

          items: (currentRoom.items || []).map((currentItem) => {
            const isTargetRoom =
              (currentRoom.roomId || currentRoom.id) === roomId;

            const isTargetItem =
              currentItem.id === itemId || currentItem.roomItemId === itemId;

            if (!isTargetRoom || !isTargetItem) {
              return currentItem;
            }

            return {
              ...currentItem,

              ...savedItem,

              id: backendItemId,

              roomItemId: backendItemId,

              name: savedItem.itemName || savedItem.name || currentItem.name,
            };
          }),
        }));

        latestRooms = roomsWithBackendItem;

        onUpdateInspectionData?.(latestRooms);
      }

      // Carry forward updates locally as each file is confirmed.

      for (const [fileIndex, file] of files.entries()) {
        // 1. Request the S3 presigned upload URL.
        uploadStage = `Requesting secure upload URL for file ${fileIndex + 1} of ${files.length}`;
        setUploadMessage(`${uploadStage}...`);

        const presignResponse = await api.post("/evidence/presigned-url", {
          file_name: file.name,

          content_type: file.type,

          inspection_id: inspectionId,

          item_id: backendItemId,
        });

        const { upload_url: uploadUrl, object_key: objectKey } =
          presignResponse.data || {};

        if (!uploadUrl || !objectKey) {
          throw new Error(
            "The evidence controller did not return an upload URL and object key.",
          );
        }

        // 2. Upload the actual file to S3.
        uploadStage = `Uploading file ${fileIndex + 1} of ${files.length} to secure storage`;
        setUploadMessage(`${uploadStage}...`);

        const s3Response = await fetch(uploadUrl, {
          method: "PUT",

          headers: {
            "Content-Type": file.type,
          },

          body: file,
        });

        if (!s3Response.ok) {
          throw new Error(`S3 upload failed with status ${s3Response.status}.`);
        }

        // 3. Confirm the upload with the backend.
        uploadStage = `Saving evidence record for file ${fileIndex + 1} of ${files.length}`;
        setUploadMessage(`${uploadStage}...`);

        const confirmResponse = await api.post(
          `/evidence/${inspectionId}/items/${backendItemId}/confirm`,

          {
            object_key: objectKey,

            content_type: file.type,

            metadata: {
              fileName: file.name,
            },
          },
        );

        const evidence =
          confirmResponse.data?.evidence ||
          confirmResponse.data?.data ||
          confirmResponse.data;

        const evidenceId = evidence?.evidenceId || evidence?.id;

        const evidenceUrl = evidence?.url;

        if (!evidenceId || !evidenceUrl) {
          throw new Error(
            "The upload was confirmed, but the response did not include an evidence ID and URL.",
          );
        }

        const savedPhoto = {
          id: evidenceId,

          evidenceId,

          objectKey: evidence.objectKey || objectKey,

          url: evidenceUrl,

          type: file.type,

          fileName: file.name,

          timestamp: new Date().toLocaleString(),
        };

        // 4. Attach the confirmed record to the matching backend item.

        latestRooms = latestRooms.map((currentRoom) => ({
          ...currentRoom,

          items: (currentRoom.items || []).map((currentItem) => {
            const matchesRoom =
              (currentRoom.roomId || currentRoom.id) === roomId ||
              (currentRoom.roomId || currentRoom.id) === propertyRoom.roomId;

            const matchesItem =
              currentItem.roomItemId === backendItemId ||
              currentItem.id === backendItemId ||
              currentItem.id === itemId;

            if (!matchesRoom || !matchesItem) {
              return currentItem;
            }

            const existingPhotos = currentItem.photos || [];

            if (
              existingPhotos.some(
                (photo) =>
                  photo.evidenceId === evidenceId || photo.id === evidenceId,
              )
            ) {
              return currentItem;
            }

            return {
              ...currentItem,

              id: backendItemId,

              roomItemId: backendItemId,

              photos: [...existingPhotos, savedPhoto],
            };
          }),
        }));

        // Update React state through the parent callback after each

        // successful confirmation, not before the upload succeeds.

        onUpdateInspectionData?.(latestRooms);

        // Preserve the existing local cache behavior.

        try {
          const propertyKey = property?.propertyId || property?.id;

          if (propertyKey) {
            localStorage.setItem(
              `hometrust_inspection_v6_${propertyKey}`,

              JSON.stringify(latestRooms),
            );
          }
        } catch (storageError) {
          console.warn(
            "Could not cache evidence details locally:",

            storageError,
          );
        }

        uploadedCount += 1;
        setUploadProgress({
          completed: uploadedCount,
          total: files.length,
        });
      }

      setUploadMessage(
        `${uploadedCount} file(s) uploaded and saved successfully.`,
      );

      const propertyKey = property?.propertyId || property?.id;

      if (propertyKey && uploadedCount > 0) {
        triggerNotification(
          propertyKey,

          "Evidence Uploaded",

          `${uploadedCount} file(s) added to ${item.name || item.itemName || "an inspection item"}.`,

          "system",
        );
      }
    } catch (error) {
      console.error(
        "Evidence upload failed:",

        error.response?.data || error.message,
      );

      setErrorMessage(`${uploadStage} failed: ${getErrorMessage(error)}`);

      if (uploadedCount > 0) {
        setUploadMessage(
          `${uploadedCount} file(s) were saved before the upload stopped.`,
        );
      }
    } finally {
      setUploadingItemIds((current) =>
        current.filter((key) => key !== uploadKey),
      );

      // Allows selecting the same file again.
      input.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-0 sm:p-6 font-sans">
      <div className="w-full max-w-6xl mx-auto px-4 bg-white min-h-screen sm:min-h-200 sm:rounded-[48px] shadow-2xl border border-slate-200 flex flex-col justify-between overflow-hidden relative text-slate-900">
        {selectedImage && (
          <div
            onClick={() => setSelectedImage(null)}
            className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4 cursor-pointer"
          >
            <button
              type="button"
              aria-label="Close image preview"
              onClick={() => setSelectedImage(null)}
              className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
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

        {showAddModal && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-40 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl sm:rounded-4xl max-w-sm w-full p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-sm font-extrabold text-[#4A1E6D]">
                  Add Move-Out Evidence to Room
                </h3>

                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);

                    resetAddForm();
                  }}
                  disabled={!canModifyInspection}
                  aria-label="Close add evidence form"
                  className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-[11px] text-slate-500">
                Select a room already belonging to this property. New items will
                be saved to the inspection backend.
              </p>

              <form onSubmit={handleSaveNewEvidence} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">
                    Existing Room / Space
                  </label>

                  <select
                    required
                    value={selectedRoomId}
                    onChange={(event) => setSelectedRoomId(event.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-[#4A1E6D]"
                  >
                    <option value="">Choose a room</option>

                    {propertyRooms.map((room) => (
                      <option key={room.roomId} value={room.roomId}>
                        {room.name}
                      </option>
                    ))}
                  </select>

                  {propertyRooms.length === 0 && (
                    <p className="text-[10px] text-amber-700">
                      No property room IDs are available. Refresh the property
                      data before adding items.
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">
                    Item Name
                  </label>

                  <input
                    type="text"
                    value={newItemName}
                    onChange={(event) => setNewItemName(event.target.value)}
                    placeholder="e.g. Walls, window handle, wardrobe"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-[#4A1E6D]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">
                    Condition
                  </label>

                  <select
                    value={newItemCondition}
                    onChange={(event) =>
                      setNewItemCondition(event.target.value)
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-[#4A1E6D]"
                  >
                    {CONDITIONS.map((condition) => (
                      <option key={condition.value} value={condition.value}>
                        {condition.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">
                    Item Notes (Optional)
                  </label>

                  <textarea
                    value={newItemNotes}
                    onChange={(event) => setNewItemNotes(event.target.value)}
                    maxLength={2000}
                    rows={2}
                    placeholder="Describe the condition..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-[#4A1E6D] resize-y"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddChecklistItem}
                  disabled={!canModifyInspection}
                  className="w-full bg-purple-50 text-[#4A1E6D] border border-purple-200 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-purple-100 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add to Checklist
                </button>

                {checklistItems.length > 0 && (
                  <div className="space-y-2 pt-2 border-t">
                    <label className="text-[11px] font-bold text-slate-700">
                      Checklist Items ({checklistItems.length})
                    </label>

                    <div className="space-y-1 max-h-36 overflow-y-auto bg-slate-50 p-2 rounded-xl border border-slate-200">
                      {checklistItems.map((item) => (
                        <div
                          key={item.localId}
                          className="flex justify-between items-start gap-2 text-[11px] text-slate-700 bg-white rounded-lg p-2"
                        >
                          <div className="min-w-0">
                            <p className="font-bold wrap-break-word">
                              {item.name}
                            </p>

                            <p className="font-bold capitalize text-[#4A1E6D] mt-1">
                              {item.condition.replaceAll("_", " ")}
                            </p>

                            {item.notes && (
                              <p className="text-slate-500 mt-1 wrap-break-word">
                                {item.notes}
                              </p>
                            )}

                            {item.dispute &&
                              typeof item.dispute === "object" && (
                                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 space-y-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-[11px] font-extrabold text-amber-900">
                                      Dispute / Issue Raised
                                    </p>
                                    {item.dispute.severity && (
                                      <span className="shrink-0 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                                        {item.dispute.severity}
                                      </span>
                                    )}
                                  </div>
                                  {item.dispute.description && (
                                    <p className="text-[11px] text-amber-950 whitespace-pre-wrap">
                                      {item.dispute.description}
                                    </p>
                                  )}
                                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-amber-800">
                                    {item.dispute.raisedBy && (
                                      <span>
                                        Raised by: {item.dispute.raisedBy}
                                      </span>
                                    )}
                                    {item.dispute.timestamp && (
                                      <span>
                                        Date: {formatTimestamp(item.dispute.timestamp)}
                                      </span>
                                    )}
                                  </div>
                                  {item.status && (
                                    <p className="text-[10px] font-semibold text-amber-900">
                                      Status: {item.status}
                                    </p>
                                  )}
                                </div>
                              )}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveChecklistItem(item.localId)
                            }
                            aria-label={`Remove ${item.name}`}
                            className="text-slate-400 hover:text-red-600 p-1"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {errorMessage && (
                  <p role="alert" className="text-[11px] text-red-700">
                    {errorMessage}
                  </p>
                )}

                {successMessage && (
                  <p role="status" className="text-[11px] text-emerald-700">
                    {successMessage}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={
                    savingItem ||
                    propertyRooms.length === 0 ||
                    !canModifyInspection
                  }
                  className="w-full bg-[#4A1E6D] hover:bg-purple-900 text-white font-extrabold py-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {savingItem ? (
                    <>
                      <LoaderCircle className="w-4 h-4 animate-spin" />
                      Saving Items...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Save Evidence
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {showConfirmationModal && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-30 flex items-center justify-center p-4">
<div className="bg-[#4A1E6D] text-white rounded-4xl w-full max-w-sm sm:max-w-md p-6 sm:p-8 text-center space-y-6 shadow-2xl">

              <div className="w-20 h-20 bg-white/10 text-white rounded-full flex items-center justify-center mx-auto border border-white/20">
                <ShieldCheck className="w-10 h-10 text-emerald-400" />
              </div>

              <div className="space-y-3">
                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  Ready to Continue?
                </h2>

                <p className="text-sm text-purple-200 leading-relaxed font-medium">
                  Your recorded inspection items are ready for the next step.
                  Continue when you are ready.
                </p>

                <div className="text-[10px] text-purple-300 font-bold uppercase tracking-wider">
                  {todaysFormattedDate}
                </div>
              </div>

              {errorMessage && (
                <p role="alert" className="text-xs text-red-200">
                  {errorMessage}
                </p>
              )}

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  disabled={submitting || !canModifyInspection}
                  onClick={handleProceed}
                 className="w-full bg-white hover:bg-purple-50 text-[#4A1E6D] font-extrabold py-4 rounded-2xl text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <LoaderCircle className="w-4 h-4 animate-spin" />
                      Please wait...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Proceed to Signatures
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={submitting || !canModifyInspection}
                  onClick={() => {
                    setShowConfirmationModal(false);

                    setErrorMessage("");
                  }}
                  className="text-sm text-white/80 hover:text-white disabled:opacity-50"
                >
                  Go back to evidence
                </button>
              </div>
            </div>
          </div>
        )}

        <header className="p-4 flex items-center justify-between z-10 gap-2 bg-[#4A1E6D] text-white">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to inspection"
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <h1 className="text-base font-extrabold text-white text-center truncate">
            Move-Out Evidence Library
          </h1>

          <button
            type="button"
            onClick={onDashboard}
            className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20 transition-colors whitespace-nowrap"
          >
            Dashboard
          </button>
        </header>

        <div className="px-6 pt-4 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveCategory("All");

              setErrorMessage("");
            }}
            className="flex-1 bg-purple-50 text-[#4A1E6D] border border-purple-200 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5"
          >
            View evidence
          </button>

          <button
            type="button"
            onClick={() => {
              if (!canModifyInspection) {
                setErrorMessage(
                  "The inspection state is not verified or the inspection is read-only.",
                );

                return;
              }

              resetAddForm();

              setShowAddModal(true);
            }}
            className="flex-1 bg-[#4A1E6D] hover:bg-purple-900 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />+ Add evidence
          </button>
        </div>

        <div className="px-6 pt-3">
          <p className="text-[11px] text-slate-600 truncate">
            {property?.name || property?.address || "Selected property"}
          </p>
        </div>
        <div className="px-6 pt-3">
          <span className="text-[11px] font-extrabold text-slate-800 block mb-2">
            Category
          </span>

          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                  activeCategory === category
                    ? "bg-[#4A1E6D] text-white border-[#4A1E6D]"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
        <main className="px-6 py-4 flex-1 overflow-y-auto space-y-4 bg-white">
          {uploadMessage && (
            <p role="status" className="text-xs text-emerald-700">
              {uploadMessage}
            </p>
          )}

          {uploadingItemIds.length > 0 && (
            <p className="text-xs text-purple-800" role="status">
              {uploadProgress.completed} of {uploadProgress.total} files
              uploaded
            </p>
          )}

          {errorMessage && !showAddModal && !showConfirmationModal && (
            <p role="alert" className="text-xs text-red-700">
              {errorMessage}
            </p>
          )}

          {inspectionStateLoading && (
            <div
              role="status"
              className="flex items-center justify-center gap-2 py-4 text-sm text-purple-800"
            >
              <LoaderCircle className="w-5 h-5 animate-spin" />
              Verifying inspection status...
            </div>
          )}

          {filteredRooms.length > 0 ? (
            filteredRooms.map((room, roomIndex) => {
              const roomPhotos = [
                ...(room.imageUrl
                  ? [{ url: room.imageUrl, type: "image/unknown" }]
                  : []),

                ...(room.items || []).flatMap(getItemPhotos).filter((photo) => {
                  const type = photo.type || photo.content_type || "";

                  return !type.startsWith("video/");
                }),
              ];

              return (
                <section
                  key={room.roomId || room.id || room.name || roomIndex}
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-16 h-16 bg-slate-200 rounded-xl overflow-hidden shrink-0 grid grid-cols-2 grid-rows-2 gap-0.5 p-0.5 border border-slate-300">
                      {[0, 1, 2, 3].map((photoIndex) => (
                        <div
                          key={photoIndex}
                          className="bg-slate-100 w-full h-full overflow-hidden flex items-center justify-center"
                        >
                          {roomPhotos[photoIndex]?.url ? (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedImage(roomPhotos[photoIndex].url)
                              }
                              aria-label="View evidence photo"
                              className="w-full h-full"
                            >
                              <img
                                src={roomPhotos[photoIndex].url}
                                alt={`Evidence ${photoIndex + 1}`}
                                className="w-full h-full object-cover hover:scale-110 transition-transform"
                              />
                            </button>
                          ) : (
                            <Camera className="w-3 h-3 text-slate-300" />
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <h2 className="text-xs font-extrabold text-slate-900 wrap-break-word">
                          {room.name || "Unnamed room"}
                        </h2>

                        <span className="shrink-0 text-[10px] bg-purple-100 text-[#4A1E6D] px-2 py-0.5 rounded-md font-bold">
                          {room.category || "Rooms"}
                        </span>
                      </div>

                      <p className="text-[10px] text-slate-500 mt-1">
                        {room.items?.length || 0} recorded item(s)
                      </p>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-600 space-y-2">
                    <div className="font-semibold text-purple-900 border-b border-purple-100 pb-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-purple-800" />
                      Condition &amp; Comments Checklist:
                    </div>

                    {room.items?.length ? (
                      room.items.map((item, itemIndex) => (
                        <div
                          key={
                            item.roomItemId ||
                            item.itemId ||
                            item.id ||
                            itemIndex
                          }
                          className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1"
                        >
                          <div className="flex justify-between items-center gap-2 font-bold text-slate-900 text-xs">
                            <span className="wrap-break-word">
                              {getItemName(item)}
                            </span>

                            <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 uppercase">
                              {(item.condition || "no_issue").replaceAll(
                                "_",

                                " ",
                              )}
                            </span>
                          </div>

                          {item.notes && (
                            <p className="text-[11px] text-slate-600 bg-purple-50/50 p-1.5 rounded-lg border border-purple-100 font-medium flex items-start gap-1">
                              <MessageSquare className="w-3 h-3 text-purple-800 shrink-0 mt-0.5" />

                              <span>{item.notes}</span>
                            </p>
                          )}

                          {getItemPhotos(item).length > 0 && (
                            <p className="text-[10px] text-emerald-700 flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              {getItemPhotos(item).length} photo(s) available
                            </p>
                          )}

                          <div className="flex items-center justify-between gap-2 pt-2">
                            <label
                              className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${
                                !canModifyInspection ||
                                uploadingItemIds.includes(
                                  `${room.roomId || room.id}:${item.roomItemId || item.id}`,
                                )
                                  ? "text-slate-400 cursor-not-allowed"
                                  : "text-[#4A1E6D] cursor-pointer hover:text-purple-900"
                              }`}
                            >
                              {uploadingItemIds.includes(
                                `${room.roomId || room.id}:${item.roomItemId || item.id}`,
                              ) ? (
                                <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Camera className="w-3.5 h-3.5" />
                              )}

                              {uploadingItemIds.includes(
                                `${room.roomId || room.id}:${item.roomItemId || item.id}`,
                              )
                                ? "Uploading..."
                                : !canModifyInspection
                                  ? isReadOnly
                                    ? "Read-only"
                                    : "Verifying inspection…"
                                  : "Add photos"}

                              <input
                                type="file"
                                multiple
                                accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime"
                                disabled={
                                  !canModifyInspection ||
                                  uploadingItemIds.includes(
                                    `${room.roomId || room.id}:${item.roomItemId || item.id}`,
                                  )
                                }
                                onChange={(event) =>
                                  handlePhotoUpload(
                                    room.roomId || room.id,

                                    item.roomItemId || item.id,

                                    event,
                                  )
                                }
                                className="hidden"
                              />
                            </label>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-[11px] text-slate-500 py-1">
                        No checklist items have been recorded for this room yet.
                      </p>
                    )}
                  </div>
                </section>
              );
            })
          ) : (
            <div className="text-center py-10 text-slate-400 text-xs font-medium flex flex-col items-center gap-2">
              <X className="w-6 h-6 text-slate-300" />

              <span>
                No evidence items found for this property inspection. Click
                &quot;+ Add evidence&quot; to add an item to an existing room.
              </span>
            </div>
          )}

          {/* Descriptive note */}

          <div className="space-y-1.5 pt-2">
            <label className="text-[11px] font-extrabold text-slate-800">
              Add a descriptive note (Optional)
            </label>

            <textarea
              value={descriptiveNote}
              onChange={(event) => setDescriptiveNote(event.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Type any additional notes or observations..."
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-900 focus:outline-none focus:border-[#4A1E6D] resize-none"
            />

            <p className="text-[10px] text-slate-500">
              This note remains on this page until it is connected to a backend
              field or endpoint.
            </p>
          </div>
        </main>

        <footer className="p-4 border-t border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => {
              if (!canModifyInspection) {
                setErrorMessage(
                  "The inspection state is not verified or the inspection is read-only.",
                );

                return;
              }

              setErrorMessage("");

              setShowConfirmationModal(true);
            }}
            className="w-full bg-[#4A1E6D] hover:bg-purple-950 text-white font-extrabold py-3.5 rounded-2xl text-xs transition-colors shadow-lg flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            Submit Move-Out Evidence
          </button>
        </footer>
      </div>
    </div>
  );
}
