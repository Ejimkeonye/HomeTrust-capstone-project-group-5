import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronRight,
  Plus,
  MessageSquare,
  AlertCircle,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Trash2,
  Edit2,
  ShieldAlert,
  X,
  LoaderCircle,
} from "lucide-react";
import api from "../api/client"; // Live API client connected to Render backend
import { triggerNotification } from "../utils/notifications";

const INITIAL_CATEGORIES = ["All", "Rooms", "Kitchen", "Bathrooms"];

const CONDITION_OPTIONS = [
  {
    id: "no_issue",
    label: "No issue",
    icon: CheckCircle2,
    color: "text-emerald-600",
  },
  {
    id: "stains",
    label: "Stains",
    icon: AlertTriangle,
    color: "text-amber-600",
  },
  {
    id: "cracks",
    label: "Cracks",
    icon: AlertTriangle,
    color: "text-orange-600",
  },
  { id: "broken", label: "Broken", icon: XCircle, color: "text-red-600" },
];

const SEVERITIES = [
  {
    id: "Minor",
    label: "Minor",
    style: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    id: "Moderate",
    label: "Moderate",
    style: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    id: "Major",
    label: "Major",
    style: "bg-orange-50 text-orange-700 border-orange-200",
  },
  {
    id: "Critical",
    label: "Critical",
    style: "bg-red-50 text-red-700 border-red-200",
  },
];

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80";

const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () =>
        reject(new Error("Could not process the selected image."));
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1024;
        const scaleFactor = MAX_WIDTH / img.width;

        canvas.width = img.width > MAX_WIDTH ? MAX_WIDTH : img.width;
        canvas.height =
          img.width > MAX_WIDTH ? img.height * scaleFactor : img.height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
    };
  });
};

const normalizePropertyRooms = (rooms = []) =>
  (Array.isArray(rooms) ? rooms : []).map((room, index) => {
    const roomObject = typeof room === "string" ? { name: room } : room;
    const name = String(roomObject?.name || `Room ${index + 1}`).trim();
    const roomId =
      roomObject?.roomId || roomObject?.id || `room-${index}-${name}`;
    const category = String(roomObject?.category || "").trim();
    const lowerName = name.toLowerCase();
    const inferredCategory =
      category ||
      (lowerName.includes("kitchen")
        ? "Kitchen"
        : lowerName.includes("bath") || lowerName.includes("toilet")
          ? "Bathrooms"
          : lowerName.includes("balcony") || lowerName.includes("terrace")
            ? "Balcony"
            : "Rooms");

    return {
      ...roomObject,
      id: roomId,
      roomId,
      name,
      category: inferredCategory,
      items: Array.isArray(roomObject?.items) ? roomObject.items : [],
    };
  });

export default function MoveOutInspectionPage({
  property,
  userRole = "tenant",
  onBack,
  onCompleteMoveOutInspection,
}) {
  const safeProperty = property || null;
  const propertyKey = safeProperty?.propertyId || safeProperty?.id;

  const [inspectionState, setInspectionState] = useState("DRAFT");
  const isReadOnly = inspectionState === "READ_ONLY";
  const [showReadOnlyWarning, setShowReadOnlyWarning] = useState(false);
  const warnIfReadOnly = () => {
    if (!isReadOnly) return false;
    setShowReadOnlyWarning(true);
    return true;
  };
  const [isLoadingInspection, setIsLoadingInspection] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [inspectionId, setInspectionId] = useState(null);

  // Property Custom Banner Photo State (Scoped strictly to current property ID, no bleed)
  const [propertyImage, setPropertyImage] = useState(() => {
    if (!propertyKey) return DEFAULT_IMAGE;
    try {
      const saved = localStorage.getItem(
        `hometrust_moveout_property_image_${propertyKey}`,
      );
      if (saved) return saved;
    } catch (e) {
      console.error(e);
    }
    return safeProperty?.image || DEFAULT_IMAGE;
  });

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

  // Main Move-Out Inspection Data State (Initialized strictly empty for new properties)
  const [roomsData, setRoomsData] = useState(() => {
    if (!propertyKey) return [];

    try {
      const saved = localStorage.getItem(
        `hometrust_moveout_inspection_v6_${propertyKey}`,
      );
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }

    return [];
  });

  // Background Backend Sync Initialization

  useEffect(() => {
    let cancelled = false;

    const initInspectionBackend = async () => {
      setIsLoadingInspection(true);
      setRoomsData([]);
      setInspectionId(null);

      if (!propertyKey) {
        setIsLoadingInspection(false);
        return;
      }

      try {
        // 1. Load this property's rooms.
        const propertyResponse = await api.get(`/properties/${propertyKey}`);

        const propertyRecord =
          propertyResponse.data?.property || propertyResponse.data;

        if (cancelled) return;

        const propertyRooms = normalizePropertyRooms(
          propertyRecord?.rooms || safeProperty?.rooms || [],
        );

        // 2. Find this property's Move-Out inspection.
        const listResponse = await api.get(
          `/inspections/property/${propertyKey}`,
        );

        const inspections =
          listResponse.data?.inspections || listResponse.data || [];

        let inspection = inspections.find((entry) => entry.mode === "MoveOut");

        // 3. Create one only if a Move-Out inspection does not exist.
        if (!inspection) {
          const createResponse = await api.post("/inspections", {
            propertyId: propertyKey,
            mode: "MoveOut",
          });

          inspection = createResponse.data?.inspection || createResponse.data;
        }

        const id = inspection?.inspectionId || inspection?.id;

        if (!id) {
          throw new Error("The backend did not return an inspection ID.");
        }

        // 4. Load the inspection and its saved items/evidence.
        const detailResponse = await api.get(`/inspections/${id}`);

        const detail = detailResponse.data?.inspection || detailResponse.data;

        if (cancelled) return;

        setInspectionId(id);
        setInspectionState(detail?.state || "DRAFT");

        const backendItems = Array.isArray(detail?.items) ? detail.items : [];

        // 5. Match backend items to the property's rooms.
        const mergedRooms = propertyRooms.map((room) => {
          const matchingItems = backendItems.filter((item) => {
            const backendRoomId = item.roomId || item.room?.roomId;
            const backendRoomName = item.roomName || item.room?.name;

            return (
              (backendRoomId &&
                String(backendRoomId) === String(room.roomId)) ||
              (backendRoomName &&
                String(backendRoomName).trim().toLowerCase() ===
                  String(room.name).trim().toLowerCase())
            );
          });

          const items = matchingItems.map((item) => {
            const itemId = item.roomItemId || item.id;
            const evidence = item.evidence || item.photos || [];

            return {
              id: itemId,
              roomItemId: itemId,
              name: item.itemName || item.name || "Inspection Item",
              condition: item.condition || "no_issue",
              notes: item.notes || "",
              dispute: item.dispute ?? null,
              status:
                item.status ||
                (item.condition && item.condition !== "no_issue"
                  ? "Under Review"
                  : "Normal"),
              photos: evidence.map((entry) => ({
                id: entry.evidenceId || entry.id,
                evidenceId: entry.evidenceId || entry.id,
                objectKey: entry.objectKey,
                url: entry.url,
                downloadUrl: entry.downloadUrl,
                fileName:
                  entry.clientMetadata?.fileName ||
                  entry.metadata?.fileName ||
                  "",
                type:
                  entry.type || entry.contentType || entry.content_type || "",
                contentType: entry.contentType || entry.content_type || "",
                timestamp: entry.createdAt || entry.timestamp || "",
              })),
            };
          });

          return { ...room, items };
        });

        setRoomsData(mergedRooms);

        try {
          localStorage.setItem(
            `hometrust_moveout_inspection_v6_${propertyKey}`,
            JSON.stringify(mergedRooms),
          );
        } catch (storageError) {
          console.warn(
            "Could not cache Move-Out inspection data:",
            storageError,
          );
        }
      } catch (err) {
        if (cancelled) return;

        console.error(
          "Move-Out inspection initialization failed:",
          err?.response?.data || err?.message,
        );

        // Fall back to the selected property's room definitions.
        setRoomsData(normalizePropertyRooms(safeProperty?.rooms || []));
      } finally {
        if (!cancelled) {
          setIsLoadingInspection(false);
        }
      }
    };

    initInspectionBackend();

    return () => {
      cancelled = true;
    };
  }, [propertyKey, safeProperty?.rooms]);
  const saveRooms = (updatedData) => {
    setRoomsData(updatedData);
    try {
      if (propertyKey) {
        localStorage.setItem(
          `hometrust_moveout_inspection_v6_${propertyKey}`,
          JSON.stringify(updatedData),
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePropertyPhotoChange = async (e) => {
    if (isReadOnly || isLoadingInspection || !inspectionId) return;
    const file = e.target.files?.[0];
    if (!file) return;

    let compressedUrl;
    try {
      compressedUrl = await compressImage(file);
    } catch (err) {
      console.error("Property photo processing failed:", err);
      alert("The selected photo could not be processed.");
      e.target.value = "";
      return;
    }
    setPropertyImage(compressedUrl);
    try {
      if (propertyKey) {
        localStorage.setItem(
          `hometrust_moveout_property_image_${propertyKey}`,
          compressedUrl,
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddRoom = async (e) => {
    e.preventDefault();
    if (warnIfReadOnly()) return;
    if (isReadOnly || isLoadingInspection || !inspectionId || !propertyKey)
      return;
    if (!newRoomName.trim()) return;

    const finalCategory =
      isAddingCustomCategory && customCategory.trim()
        ? customCategory.trim()
        : newRoomCategory;

    const roomNameTrimmed = newRoomName.trim();
    const newRoomId = `room-${Date.now()}`;

    const newRoom = {
      id: newRoomId,
      roomId: newRoomId,
      name: roomNameTrimmed,
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

    if (propertyKey) {
      triggerNotification(
        propertyKey,
        "Move-Out Section Added",
        `Added departure section: "${roomNameTrimmed}".`,
        "system",
      );

      try {
        const currentRoomsList = updated.map((r) => ({
          roomId: r.id || r.roomId,
          name: r.name,
          category: r.category,
        }));

        await api.put(`/properties/${propertyKey}`, {
          name: safeProperty?.name || "Property",
          address: safeProperty?.address,
          type: safeProperty?.type || "Apartment",
          flatNo: safeProperty?.flatNo || "1",
          image: safeProperty?.image || DEFAULT_IMAGE,
          rooms: currentRoomsList,
        });

        const initialItem = newRoom.items[0];
        const itemResponse = await api.post(
          `/inspections/${inspectionId}/items`,
          {
            roomId: newRoom.roomId,
            itemName: initialItem.name,
            condition: initialItem.condition,
            notes: initialItem.notes,
          },
        );
        const savedItem =
          itemResponse.data?.item ||
          itemResponse.data?.roomItem ||
          itemResponse.data;
        const backendItemId =
          savedItem?.roomItemId || savedItem?.itemId || savedItem?.id;
        if (!backendItemId)
          throw new Error("Backend did not return the initial room item ID.");

        const withBackendItem = updated.map((room) =>
          room.id === newRoomId
            ? {
                ...room,
                items: room.items.map((item) =>
                  item.id === initialItem.id
                    ? { ...item, id: backendItemId, roomItemId: backendItemId }
                    : item,
                ),
              }
            : room,
        );
        saveRooms(withBackendItem);
      } catch (err) {
        console.error(
          "Failed to save the new room and its initial inspection item:",
          err?.response?.data || err?.message,
        );
        alert(
          "The room was added locally, but could not be fully saved to the backend. Please refresh and check before continuing.",
        );
      }
    }
  };

  const handleDeleteRoom = async (roomId, e) => {
    if (warnIfReadOnly()) return;
    if (isReadOnly || isLoadingInspection || !inspectionId) return;
    if (e) e.stopPropagation();
    if (
      !window.confirm(
        "Are you sure you want to delete this section and all its contents?",
      )
    )
      return;

    const updated = roomsData.filter((r) => r.id !== roomId);
    saveRooms(updated);
    if (selectedRoomId === roomId) {
      setSelectedRoomId(null);
    }

    if (propertyKey) {
      try {
        const currentRoomsList = updated.map((r) => ({
          roomId: r.id,
          name: r.name,
          category: r.category,
        }));
        await api.put(`/properties/${propertyKey}`, {
          name: safeProperty?.name || "Property",
          address: safeProperty?.address,
          type: safeProperty?.type || "Apartment",
          rooms: currentRoomsList,
        });
      } catch (err) {
        console.warn("Backend deletion sync note:", err?.message);
      }
    }
  };

  const handleSaveRoomName = async (roomId) => {
    if (warnIfReadOnly()) return;
    if (
      isReadOnly ||
      isLoadingInspection ||
      !inspectionId ||
      !propertyKey ||
      !editedRoomName.trim()
    )
      return;
    const roomToRename = roomsData.find((room) => room.id === roomId);
    if (!roomToRename) return;

    const previousName = roomToRename.name;
    const updated = roomsData.map((room) =>
      room.id === roomId ? { ...room, name: editedRoomName.trim() } : room,
    );
    saveRooms(updated);
    setIsEditingRoomName(false);

    try {
      const currentRoomsList = updated.map((room) => ({
        roomId: room.roomId || room.id,
        name: room.name,
        category: room.category,
      }));
      await api.put(`/properties/${propertyKey}`, {
        name: safeProperty?.name || "Property",
        address: safeProperty?.address,
        type: safeProperty?.type || "Apartment",
        flatNo: safeProperty?.flatNo || "1",
        image: safeProperty?.image || DEFAULT_IMAGE,
        rooms: currentRoomsList,
      });
    } catch (err) {
      console.error(
        "Room rename could not be saved:",
        err?.response?.data || err?.message,
      );
      alert("The room name could not be saved. Please try again.");
      const reverted = updated.map((room) =>
        room.id === roomId ? { ...room, name: previousName } : room,
      );
      saveRooms(reverted);
    }
  };

  const ensureBackendItemId = async (roomId, itemId) => {
    const room = roomsData.find(
      (entry) => entry.id === roomId || entry.roomId === roomId,
    );

    const item = room?.items?.find(
      (entry) => entry.id === itemId || entry.roomItemId === itemId,
    );

    if (!room || !item) {
      throw new Error("Could not find the room or item.");
    }

    if (!inspectionId) {
      throw new Error("No backend inspection is available.");
    }

    if (item.roomItemId && !String(item.roomItemId).startsWith("item-")) {
      return item.roomItemId;
    }

    const response = await api.post(`/inspections/${inspectionId}/items`, {
      roomId: room.roomId || room.id || room.name,
      itemName: item.name,
      condition: item.condition || "no_issue",
      notes: item.notes || "",
    });

    const savedItem =
      response.data?.item || response.data?.roomItem || response.data;

    const backendItemId = savedItem?.roomItemId || savedItem?.id;

    if (!backendItemId) {
      throw new Error("The backend did not return an item ID.");
    }

    const updatedRooms = roomsData.map((entry) => ({
      ...entry,
      items: (entry.items || []).map((existingItem) =>
        entry.id === roomId &&
        (existingItem.id === itemId || existingItem.roomItemId === itemId)
          ? {
              ...existingItem,
              id: backendItemId,
              roomItemId: backendItemId,
            }
          : existingItem,
      ),
    }));

    saveRooms(updatedRooms);

    return backendItemId;
  };
  const handleAddItem = async (e) => {
    e.preventDefault();
    if (warnIfReadOnly()) return;
    if (isReadOnly || isLoadingInspection || !inspectionId) return;

    const itemName = newItemName.trim();
    if (!itemName || !selectedRoomId) return;

    const targetRoom = roomsData.find((room) => room.id === selectedRoomId);
    if (!targetRoom) return;

    try {
      const response = await api.post(`/inspections/${inspectionId}/items`, {
        roomId: targetRoom.roomId || targetRoom.id || targetRoom.name,
        itemName,
        condition: "no_issue",
        notes: "",
      });

      const savedItem =
        response.data?.item || response.data?.roomItem || response.data;
      const backendItemId =
        savedItem?.roomItemId || savedItem?.itemId || savedItem?.id;
      if (!backendItemId)
        throw new Error("Backend did not return the new item ID.");

      const newItem = {
        id: backendItemId,
        roomItemId: backendItemId,
        name: itemName,
        condition: "no_issue",
        notes: "",
        dispute: null,
        photos: [],
        status: "Normal",
      };
      const updated = roomsData.map((room) =>
        room.id === selectedRoomId
          ? { ...room, items: [...(room.items || []), newItem] }
          : room,
      );
      saveRooms(updated);
      setNewItemName("");
      setAddItemModalOpen(false);

      if (propertyKey) {
        triggerNotification(
          propertyKey,
          "Departure Amenity Added",
          `Added "${itemName}" to ${targetRoom.name || "section"}.`,
          "system",
        );
      }
    } catch (error) {
      console.error(
        "Failed to save new inspection item:",
        error?.response?.data || error?.message,
      );
      alert("The item could not be saved. Please try again.");
    }
  };

  const handleDeleteItem = async (roomId, itemId) => {
    if (warnIfReadOnly()) return;
    if (isReadOnly || isLoadingInspection || !inspectionId) return;
    const room = roomsData.find((entry) => entry.id === roomId);
    const item = room?.items?.find(
      (entry) => entry.id === itemId || entry.roomItemId === itemId,
    );
    if (!room || !item) return;
    if (!window.confirm("Remove this item from the inspection?")) return;

    if (
      inspectionId &&
      item.roomItemId &&
      !String(item.roomItemId).startsWith("item-")
    ) {
      try {
        await api.delete(
          `/inspections/${inspectionId}/items/${item.roomItemId}`,
        );
      } catch (err) {
        console.error(
          "Item deletion failed:",
          err?.response?.data || err?.message,
        );
        alert("The item could not be deleted from the saved inspection.");
        return;
      }
    }

    const updated = roomsData.map((entry) =>
      entry.id === roomId
        ? {
            ...entry,
            items: (entry.items || []).filter(
              (candidate) =>
                candidate.id !== itemId && candidate.roomItemId !== itemId,
            ),
          }
        : entry,
    );
    saveRooms(updated);
  };

  const updateItemData = async (roomId, itemId, fields) => {
    if (warnIfReadOnly()) return;
    if (isReadOnly || isLoadingInspection || !inspectionId) return;
    const updated = roomsData.map((room) => {
      if (room.id === roomId) {
        return {
          ...room,
          items: room.items.map((item) => {
            if (item.id === itemId || item.roomItemId === itemId) {
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

    if (inspectionId) {
      try {
        const backendRoomItemId = await ensureBackendItemId(roomId, itemId);

        await api.patch(
          `/inspections/${inspectionId}/items/${backendRoomItemId}`,
          {
            condition:
              fields.condition !== undefined ? fields.condition : undefined,
            notes: fields.notes !== undefined ? fields.notes : undefined,
            dispute: fields.dispute !== undefined ? fields.dispute : undefined,
            status: fields.status !== undefined ? fields.status : undefined,
          },
        );
      } catch (err) {
        console.error(
          "Move-Out item update failed:",
          err?.response?.data || err?.message,
        );
      }
    }
  };

  const handleClearDispute = (roomId, itemId) => {
    if (warnIfReadOnly()) return;
    if (isReadOnly || isLoadingInspection || !inspectionId) return;

    updateItemData(roomId, itemId, {
      condition: "no_issue",
      notes: "",
      dispute: null,
      status: "Normal",
    });
  };

  const handlePhotoUpload = async (roomId, itemId, e) => {
    const input = e.target;
    const files = Array.from(input.files || []);

    if (!files.length) return;
    if (warnIfReadOnly()) {
      input.value = "";
      return;
    }

    if (!inspectionId) {
      alert("The inspection has not finished loading.");
      input.value = "";
      return;
    }

    try {
      const backendItemId = await ensureBackendItemId(roomId, itemId);

      for (const file of files) {
        const presignResponse = await api.post("/evidence/presigned-url", {
          file_name: file.name,
          content_type: file.type,
          inspection_id: inspectionId,
          item_id: backendItemId,
        });

        const { upload_url: uploadUrl, object_key: objectKey } =
          presignResponse.data || {};

        if (!uploadUrl || !objectKey) {
          throw new Error("The backend did not return an upload URL.");
        }

        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Evidence upload failed (${uploadResponse.status}).`);
        }

        const confirmResponse = await api.post(
          `/evidence/${inspectionId}/items/${backendItemId}/confirm`,
          {
            object_key: objectKey,
            content_type: file.type,
            metadata: { fileName: file.name },
          },
        );

        const evidence =
          confirmResponse.data?.evidence ||
          confirmResponse.data?.data ||
          confirmResponse.data;

        if (!(evidence?.evidenceId || evidence?.id) || !evidence?.url) {
          throw new Error(
            "The backend did not return the confirmed evidence ID and URL.",
          );
        }

        setRoomsData((previousRooms) => {
          const updatedRooms = previousRooms.map((room) => ({
            ...room,
            items: (room.items || []).map((item) =>
              room.id === roomId &&
              (item.id === itemId || item.roomItemId === backendItemId)
                ? {
                    ...item,
                    id: backendItemId,
                    roomItemId: backendItemId,
                    photos: [
                      ...(item.photos || []),
                      {
                        id: evidence.evidenceId || evidence.id,
                        evidenceId: evidence.evidenceId || evidence.id,
                        objectKey,
                        url: evidence.url,
                        fileName: file.name,
                        type: file.type,
                        contentType: file.type,
                        timestamp:
                          evidence.createdAt || new Date().toISOString(),
                      },
                    ],
                  }
                : item,
            ),
          }));

          try {
            localStorage.setItem(
              `hometrust_moveout_inspection_v6_${propertyKey}`,
              JSON.stringify(updatedRooms),
            );
          } catch (storageError) {
            console.warn("Could not cache Move-Out evidence:", storageError);
          }

          return updatedRooms;
        });
      }
    } catch (err) {
      console.error(
        "Move-Out evidence upload failed:",
        err?.response?.data || err?.message,
      );

      alert("Evidence could not be saved. Please try again.");
    } finally {
      input.value = "";
    }
  };
  const handleRaiseDispute = (e) => {
    e.preventDefault();
    if (warnIfReadOnly()) return;
    if (isLoadingInspection || !inspectionId) return;
    if (!disputeNote.trim()) return;
    if (!disputeTarget) return;

    const targetRoom = roomsData.find((r) => r.id === disputeTarget.roomId);
    const targetItem = targetRoom?.items.find(
      (i) =>
        i.id === disputeTarget.itemId || i.roomItemId === disputeTarget.itemId,
    );

    const newCondition =
      targetItem?.condition === "no_issue" ? "broken" : targetItem?.condition;

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

    if (propertyKey) {
      triggerNotification(
        propertyKey,
        "Move-Out Issue Flagged",
        `Departure issue flagged on ${targetItem?.name || "item"} (${disputeSeverity}).`,
        "dispute",
      );
    }

    setDisputeModalOpen(false);
    setDisputeNote("");
    setDisputeSeverity("Minor");
    setDisputeTarget(null);
  };

  const dynamicCategories = Array.from(
    new Set([...INITIAL_CATEGORIES, ...roomsData.map((r) => r.category)]),
  );

  const filteredRooms = roomsData.filter((room) => {
    if (selectedCategory === "All") return true;
    return (
      String(room.category || "Rooms").toLowerCase() ===
      selectedCategory.toLowerCase()
    );
  });

  const activeRoom = roomsData.find((r) => r.id === selectedRoomId);

  const displayedItems =
    activeRoom?.items.filter((item) => {
      if (itemFilter === "disputed") {
        return (
          item.status === "Under Review" ||
          item.condition !== "no_issue" ||
          !!item.dispute
        );
      }
      return true;
    }) || [];

  const totalDisputedCount =
    activeRoom?.items.filter(
      (i) =>
        i.status === "Under Review" ||
        i.condition !== "no_issue" ||
        !!i.dispute,
    ).length || 0;

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-0 sm:p-6 font-sans">
      <div className="w-full max-w-6xl mx-auto px-4 bg-white min-h-screen sm:min-h-203 sm:rounded-[48px] shadow-2xl border border-slate-200 flex flex-col justify-between overflow-hidden relative text-slate-900">
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
            {activeRoom ? activeRoom.name : "Move-Out Inspection"}
          </h1>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                if (isReadOnly || isLoadingInspection || !inspectionId) return;
                try {
                  const response = await api.post(
                    `/inspections/${inspectionId}/submit`,
                  );
                  const inspection = response.data?.inspection || response.data;
                  setInspectionState(inspection?.state || "UNDER_REVIEW");
                  if (propertyKey) {
                    triggerNotification(
                      propertyKey,
                      "Move-Out Walkthrough Submitted",
                      "The departure condition record has been submitted for review.",
                      "system",
                    );
                  }
                  if (onCompleteMoveOutInspection)
                    onCompleteMoveOutInspection(roomsData);
                } catch (err) {
                  console.error(
                    "Failed to submit Move-Out inspection:",
                    err?.response?.data || err?.message,
                  );
                  alert(
                    "The inspection could not be submitted. Please try again.",
                  );
                }
              }}
              disabled={isReadOnly || isLoadingInspection || !inspectionId}
              className="text-xs font-extrabold text-[#4A1E6D] bg-white hover:bg-slate-100 px-3.5 py-1.5 rounded-full cursor-pointer shrink-0 transition-colors shadow-md"
            >
              Review & Sign
            </button>
          </div>
        </div>

        {/* Collaborative Notice Banner */}
        {isReadOnly && (
          <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-2 text-center text-amber-900 text-xs font-medium backdrop-blur-md">
            🔒 <strong>Inspection locked:</strong> This Move-Out inspection is
            finalised and can no longer be edited.
          </div>
        )}

        {/* Main Content Scroll Container */}
        <div className="px-6 py-4 flex-1 flex flex-col justify-between overflow-y-auto space-y-4 bg-white">
          {/* Main Inspection Banner Image with Camera Capture enabled */}
          <div className="relative w-full h-40 rounded-2xl overflow-hidden shadow-sm bg-slate-100 border border-slate-200 group">
            <img
              src={propertyImage}
              alt="Property banner"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.src = DEFAULT_IMAGE;
              }}
            />
            <label className="absolute inset-0 bg-black/20 hover:bg-black/40 transition-colors flex flex-col items-center justify-center cursor-pointer text-white">
              <div className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-slate-800 shadow-md mb-1">
                <Camera className="w-5 h-5 text-[#4A1E6D]" />
              </div>
              <span className="text-[11px] font-bold drop-shadow-md">
                Change Departure Photo
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePropertyPhotoChange}
                disabled={isReadOnly || isLoadingInspection || !inspectionId}
                className="hidden"
              />
            </label>
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

                <button
                  type="button"
                  onClick={() => {
                    if (warnIfReadOnly()) return;
                    if (isReadOnly || isLoadingInspection) return;
                    setIsAddingCustomCategory(false);
                    setAddRoomModalOpen(true);
                  }}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-[#4A1E6D] border border-slate-200 rounded-xl transition-all cursor-pointer shrink-0 shadow-xs flex items-center gap-1 text-xs font-bold"
                >
                  <Plus className="w-4 h-4" /> Add Section
                </button>
              </div>

              {/* Room Cards */}
              {isLoadingInspection && (
                <div
                  role="status"
                  className="flex items-center justify-center gap-2 py-4 text-sm text-purple-800"
                >
                  <LoaderCircle className="w-5 h-5 animate-spin" />
                  Loading move-out inspection and evidence...
                </div>
              )}
              <div className="space-y-3">
                {filteredRooms.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    No inspection sections yet. Click "+ Add Section" or add a
                    room to begin!
                  </div>
                ) : (
                  filteredRooms.map((room) => {
                    const allPhotos = room.items.flatMap((i) => i.photos || []);
                    const disputedCount = room.items.filter(
                      (i) =>
                        i.status === "Under Review" ||
                        i.condition !== "no_issue" ||
                        !!i.dispute,
                    ).length;

                    return (
                      <div
                        key={room.id}
                        onClick={() => setSelectedRoomId(room.id)}
                        className="w-full flex items-center gap-2.5 group cursor-pointer text-left relative bg-purple-900/10 hover:bg-purple-900/15 p-2.5 rounded-2xl transition-all border border-purple-900/20 shadow-xs"
                      >
                        <div className="w-20 h-16 bg-white rounded-xl overflow-hidden grid grid-cols-2 grid-rows-2 gap-0.5 p-0.5 shrink-0 border border-purple-900/10">
                          {[0, 1, 2, 3].map((idx) => (
                            <div
                              key={idx}
                              className="bg-slate-100 w-full h-full overflow-hidden flex items-center justify-center"
                            >
                              {allPhotos[idx] ? (
                                <img
                                  src={allPhotos[idx].url}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-slate-100" />
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="flex-1 flex items-center justify-between relative">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-xs font-extrabold text-slate-900">
                                {room.name}
                              </h3>
                              {disputedCount > 0 && (
                                <span
                                  className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"
                                  title="Has disputes/issues"
                                />
                              )}
                            </div>
                            <p className="text-[10px] text-slate-600 font-semibold mt-0.5">
                              {room.items.length}{" "}
                              {room.items.length === 1 ? "Item" : "Items"}
                              {disputedCount > 0 && (
                                <span className="text-amber-600 font-bold ml-1">
                                  ({disputedCount} Flagged)
                                </span>
                              )}
                            </p>
                            <span className="inline-block mt-1 text-[9px] font-extrabold text-purple-900 bg-purple-200/60 px-2 py-0.5 rounded-md">
                              {room.category}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => handleDeleteRoom(room.id, e)}
                              disabled={
                                isReadOnly ||
                                isLoadingInspection ||
                                !inspectionId
                              }
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white/60 rounded-lg transition-colors cursor-pointer"
                              title="Delete Room"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <ChevronRight className="w-5 h-5 text-purple-900/60 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
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
                        disabled={
                          isReadOnly || isLoadingInspection || !inspectionId
                        }
                        className="border border-purple-300 rounded-lg px-2 py-1 text-xs font-extrabold text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-800 flex-1 bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveRoomName(activeRoom.id)}
                        disabled={
                          isReadOnly || isLoadingInspection || !inspectionId
                        }
                        className="px-2 py-1 bg-[#4A1E6D] text-white rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-sm font-extrabold text-slate-900">
                        {activeRoom?.name}
                      </h2>
                      <button
                        type="button"
                        onClick={() => {
                          if (isReadOnly || isLoadingInspection) return;
                          setEditedRoomName(activeRoom.name);
                          setIsEditingRoomName(true);
                        }}
                        className="text-slate-400 hover:text-[#4A1E6D] p-1 cursor-pointer"
                        title="Rename Room"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Category:{" "}
                    <span className="font-bold text-slate-700">
                      {activeRoom?.category}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDeleteRoom(activeRoom.id)}
                    disabled={
                      isReadOnly || isLoadingInspection || !inspectionId
                    }
                    className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl cursor-pointer transition-colors"
                    title="Delete whole room"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      !isReadOnly &&
                      !isLoadingInspection &&
                      setAddItemModalOpen(true)
                    }
                    disabled={
                      isReadOnly || isLoadingInspection || !inspectionId
                    }
                    className="inline-flex items-center gap-1 text-xs font-bold bg-[#4A1E6D] text-white px-3 py-1.5 rounded-xl hover:bg-purple-950 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Amenity
                  </button>
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
                      {itemFilter === "disputed"
                        ? "No damaged or disputed items in this section 🎉"
                        : "No items listed."}
                    </p>
                  </div>
                ) : (
                  displayedItems.map((item) => {
                    const isDamagedOrDisputed =
                      item.status === "Under Review" ||
                      item.condition !== "no_issue" ||
                      !!item.dispute;
                    const activeSeverityObj = SEVERITIES.find(
                      (s) => s.id === item.dispute?.severity,
                    );

                    return (
                      <div
                        key={item.id}
                        className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3.5 relative"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-extrabold text-slate-900">
                            {item.name}
                          </h4>
                          <div className="flex items-center gap-2">
                            {isDamagedOrDisputed && (
                              <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {item.dispute
                                  ? "Dispute Filed"
                                  : "Flagged Issue"}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteItem(activeRoom.id, item.id)
                              }
                              disabled={
                                isReadOnly ||
                                isLoadingInspection ||
                                !inspectionId
                              }
                              aria-label="Remove item"
                              className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Integrated Active Dispute Badge */}
                        {item.dispute && (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1.5 relative">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <ShieldAlert className="w-4 h-4 text-amber-600" />
                                <span className="text-xs font-extrabold text-amber-900">
                                  Active Dispute Record ({item.dispute.raisedBy}
                                  )
                                </span>
                              </div>
                              {activeSeverityObj && (
                                <span
                                  className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${activeSeverityObj.style}`}
                                >
                                  {activeSeverityObj.label}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-amber-900 font-medium bg-white p-2 rounded-lg border border-amber-100">
                              "{item.dispute.description}"
                            </p>
                            <div className="flex items-center justify-between text-[10px] text-amber-700 pt-0.5 font-semibold">
                              <span>
                                By: {item.dispute.raisedBy || userRole} •{" "}
                                {item.dispute.timestamp}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleClearDispute(activeRoom.id, item.id)
                                }
                                disabled={
                                  isReadOnly ||
                                  isLoadingInspection ||
                                  !inspectionId
                                }
                                className="text-red-600 hover:underline cursor-pointer font-bold flex items-center gap-0.5"
                              >
                                <X className="w-3 h-3" /> Clear Dispute
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Photos with Camera Capture Enabled */}
                        <div className="grid grid-cols-2 gap-2">
                          {item.photos?.map((p, idx) => (
                            <img
                              key={p.id || idx}
                              src={p.url}
                              className="w-full h-20 rounded-xl object-cover border border-slate-200"
                              alt=""
                            />
                          ))}

                          <label className="w-full h-20 rounded-xl border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors">
                            <Plus className="w-4 h-4 text-[#4A1E6D]" />
                            <span className="text-[10px] font-bold text-[#4A1E6D] mt-0.5">
                              Photo
                            </span>
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              onChange={(e) =>
                                handlePhotoUpload(activeRoom.id, item.id, e)
                              }
                              disabled={
                                isReadOnly ||
                                isLoadingInspection ||
                                !inspectionId
                              }
                              className="hidden"
                            />
                          </label>
                        </div>

                        {/* Condition Selection */}
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-bold text-slate-700 block">
                            Condition
                          </span>
                          <div className="grid grid-cols-2 gap-2">
                            {CONDITION_OPTIONS.map((option) => {
                              const isChecked = item.condition === option.id;
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  onClick={() =>
                                    updateItemData(activeRoom.id, item.id, {
                                      condition: option.id,
                                    })
                                  }
                                  disabled={
                                    isReadOnly ||
                                    isLoadingInspection ||
                                    !inspectionId
                                  }
                                  className={`flex items-center gap-2 p-2 rounded-xl text-left border cursor-pointer transition-all ${
                                    isChecked
                                      ? "bg-[#4A1E6D] border-[#4A1E6D] text-white"
                                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                  }`}
                                >
                                  <div
                                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                                      isChecked
                                        ? "border-white bg-[#4A1E6D] text-white"
                                        : "border-slate-300 bg-white"
                                    }`}
                                  >
                                    {isChecked && (
                                      <Check className="w-2.5 h-2.5 text-white" />
                                    )}
                                  </div>
                                  <span className="text-[11px] font-extrabold">
                                    {option.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Description / Notes */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 block">
                            Note / Description
                          </label>
                          <textarea
                            rows={2}
                            value={item.notes || ""}
                            onChange={(e) =>
                              updateItemData(activeRoom.id, item.id, {
                                notes: e.target.value,
                              })
                            }
                            disabled={
                              isReadOnly || isLoadingInspection || !inspectionId
                            }
                            placeholder="Note condition details, scratches, stains..."
                            className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-800 text-slate-800 placeholder-slate-400"
                          />
                        </div>

                        {/* Dispute Trigger Button */}
                        <div className="pt-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              if (isReadOnly || isLoadingInspection) return;
                              setDisputeTarget({
                                roomId: activeRoom.id,
                                itemId: item.id,
                              });
                              setDisputeNote(
                                item.dispute?.description || item.notes || "",
                              );
                              setDisputeSeverity(
                                item.dispute?.severity || "Minor",
                              );
                              setDisputeModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg hover:bg-amber-100 cursor-pointer"
                          >
                            <MessageSquare className="w-3 h-3 text-amber-600" />
                            {item.dispute
                              ? "Edit Dispute / Add Comment"
                              : "Dispute Item / Comment"}
                          </button>
                        </div>
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
          <form
            onSubmit={handleAddRoom}
            className="bg-white p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl border border-slate-200"
          >
            <h3 className="font-extrabold text-base text-slate-900">
              Add New Section / Room
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Category Type
              </label>
              {!isAddingCustomCategory ? (
                <div className="space-y-2">
                  <select
                    value={newRoomCategory}
                    onChange={(e) => setNewRoomCategory(e.target.value)}
                    disabled={
                      isReadOnly || isLoadingInspection || !inspectionId
                    }
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
                    disabled={
                      isReadOnly || isLoadingInspection || !inspectionId
                    }
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
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Section/Room Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Bedroom 2, Guest Bath, Back Balcony"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                disabled={isReadOnly || isLoadingInspection || !inspectionId}
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
                disabled={isReadOnly || isLoadingInspection || !inspectionId}
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
          <form
            onSubmit={handleAddItem}
            className="bg-white p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl border border-slate-200"
          >
            <h3 className="font-extrabold text-base text-slate-900">
              Add Item / Amenity to {activeRoom?.name}
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Item / Feature Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Curtains, Wooden Cabinet, Sink, Railing"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                disabled={isReadOnly || isLoadingInspection || !inspectionId}
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
                disabled={isReadOnly || isLoadingInspection || !inspectionId}
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
          <form
            onSubmit={handleRaiseDispute}
            className="bg-white p-6 rounded-3xl max-w-md w-full space-y-4 shadow-2xl border border-slate-200"
          >
            <h3 className="font-extrabold text-base text-slate-900">
              Dispute / Comment on Item ({userRole})
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Severity Level / Concern Level
              </label>
              <div className="grid grid-cols-4 gap-2">
                {SEVERITIES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      !isReadOnly &&
                      !isLoadingInspection &&
                      setDisputeSeverity(s.id)
                    }
                    disabled={
                      isReadOnly || isLoadingInspection || !inspectionId
                    }
                    className={`py-2 px-2 text-[11px] font-bold rounded-xl border text-center transition-all cursor-pointer ${
                      disputeSeverity === s.id
                        ? `${s.style} ring-2 ring-purple-800`
                        : "bg-slate-50 text-slate-600 border-slate-200"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Your Comment / Objection
              </label>
              <textarea
                required
                rows={3}
                value={disputeNote}
                onChange={(e) => setDisputeNote(e.target.value)}
                disabled={isReadOnly || isLoadingInspection || !inspectionId}
                placeholder="State your perspective or condition disagreement..."
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
                disabled={isReadOnly || isLoadingInspection || !inspectionId}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl cursor-pointer shadow-sm"
              >
                Post Comment / Dispute
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Read-Only Warning Modal */}
      {showReadOnlyWarning && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="read-only-warning-title"
            className="w-full max-w-sm rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-2xl"
          >
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <ShieldAlert className="h-6 w-6 text-amber-700" />
            </div>

            <h3
              id="read-only-warning-title"
              className="text-lg font-extrabold text-slate-900"
            >
              Inspection Locked
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              This Move-Out inspection is read-only. You cannot make changes to
              the inspection or its evidence.
            </p>

            <button
              type="button"
              onClick={() => setShowReadOnlyWarning(false)}
              className="mt-5 w-full rounded-xl bg-[#4A1E6D] px-4 py-3 text-sm font-bold text-white hover:bg-purple-950"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
