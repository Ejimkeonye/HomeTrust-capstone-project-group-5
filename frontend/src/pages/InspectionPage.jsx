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
  UserPlus,
} from "lucide-react";
import api from "../api/client"; // Live API client connected to Render backend
import InvitePartyModal from "../components/InvitePartyModal";
import InviteLinkSent from "../components/InviteLinkSent";
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
const inferRoomCategory = (category, roomName = "") => {
  const value = String(category || "").trim();
  const normalized = value ? normalizeCategory(value) : "";

  const name = String(roomName).trim().toLowerCase();

  // Infer the obvious categories from the room name when the saved
  // category is missing OR is only the generic "Rooms" category.
  if (!normalized || normalized === "Rooms") {
    if (name.includes("kitchen")) return "Kitchen";

    if (
      name.includes("bathroom") ||
      name.includes("bath room") ||
      name.includes("toilet") ||
      name.includes("shower")
    ) {
      return "Bathrooms";
    }

    if (name.includes("balcony") || name.includes("terrace")) {
      return "Balcony";
    }
  }

  // Preserve specific and custom categories when they are already saved.
  return normalized || "Rooms";
};
const normalizePropertyRooms = (rooms = []) =>
  (Array.isArray(rooms) ? rooms : []).map((room, index) => {
    const roomObject = typeof room === "string" ? { name: room } : room;

    const name = String(roomObject?.name || `Room ${index + 1}`).trim();

    const roomId =
      roomObject?.roomId || roomObject?.id || `room-${index}-${name}`;

    return {
      ...roomObject,
      id: roomId,
      roomId,
      name,
      category: inferRoomCategory(roomObject?.category, name),
      items: [],
    };
  });

const normalizeCategory = (category, roomName = "") => {
  const value = String(category || "")
    .trim()
    .toLowerCase();

  const standardCategories = {
    all: "All",
    room: "Rooms",
    rooms: "Rooms",
    bedroom: "Rooms",
    bedrooms: "Rooms",
    kitchen: "Kitchen",
    kitchens: "Kitchen",
    bathroom: "Bathrooms",
    bathrooms: "Bathrooms",
    bath: "Bathrooms",
    balcony: "Balcony",
    "balcony / outdoor": "Balcony",
    outdoor: "Balcony",
    "living room": "Living Room",
  };

  if (standardCategories[value]) {
    return standardCategories[value];
  }

  // If the category is missing, infer it from the section name.
  // This is a fallback, not a replacement for saving the category correctly.
  if (!value) {
    const name = String(roomName).trim().toLowerCase();

    if (name.includes("kitchen")) return "Kitchen";

    if (
      name.includes("bathroom") ||
      name.includes("bath room") ||
      name.includes("toilet") ||
      name.includes("shower")
    ) {
      return "Bathrooms";
    }

    if (name.includes("balcony") || name.includes("terrace")) {
      return "Balcony";
    }

    return "Rooms";
  }

  // Preserve custom categories such as "Store Room" or "Study".
  return value.charAt(0).toUpperCase() + value.slice(1);
};

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
        canvas.height =
          img.width > MAX_WIDTH ? img.height * scaleFactor : img.height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
    };
  });
};

export default function InspectionPage({
  property,
  userRole = "tenant",
  onBack,
  onCompleteInspection,
}) {
  const safeProperty = property || null;

  const isReadOnly = safeProperty?.status === "READ_ONLY";
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [inspectionId, setInspectionId] = useState(null);
  const [zoomedPhoto, setZoomedPhoto] = useState(null);
  const [uploadingItemIds, setUploadingItemIds] = useState([]);
  const [isLoadingInspection, setIsLoadingInspection] = useState(true);

  // Property Custom Banner Photo State (Scoped strictly to current property ID, no Sabo bleed)
  const [propertyImage, setPropertyImage] = useState(() => {
    const propIdKey = safeProperty?.propertyId || safeProperty?.id;
    if (!propIdKey) return DEFAULT_IMAGE;
    try {
      const saved = localStorage.getItem(
        `hometrust_property_image_${propIdKey}`,
      );
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

  // Main Inspection Data State (Initialized strictly from current property key, defaults to [] so new properties start blank)
  const [roomsData, setRoomsData] = useState(() => {
    const propIdKey = safeProperty?.propertyId || safeProperty?.id;
    if (!propIdKey) return [];

    try {
      const saved = localStorage.getItem(
        `hometrust_inspection_v6_${propIdKey}`,
      );
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }

    // Brand new properties start completely blank as requested by project manager
    return [];
  });

  useEffect(() => {
    let cancelled = false;

    const initInspectionBackend = async () => {
      const targetPropId = safeProperty?.propertyId || safeProperty?.id;
      setIsLoadingInspection(true);

      // Never display the previous property's rooms while switching properties.
      setRoomsData([]);
      setInspectionId(null);
      if (!targetPropId) {
        setRoomsData([]);
        setIsLoadingInspection(false);
        return;
      }
      try {
        // 1. Fetch the canonical property record selected on the dashboard.
        const propertyResponse = await api.get(`/properties/${targetPropId}`);

        const propertyRecord =
          propertyResponse.data?.property || propertyResponse.data;

        if (cancelled) return;

        const propertyRooms = normalizePropertyRooms(
          propertyRecord?.rooms || [],
        );

        // 2. Fetch the inspections belonging to this exact property.
        const listResponse = await api.get(
          `/inspections/property/${targetPropId}`,
        );

        const inspections =
          listResponse.data?.inspections || listResponse.data || [];

        let inspection = inspections.find(
          (entry) =>
            entry.state !== "READ_ONLY" && entry.status !== "READ_ONLY",
        );

        if (!inspection && inspections.length) {
          inspection = inspections[0];
        }

        // 3. Create an inspection only if this property has none.
        if (!inspection) {
          const createResponse = await api.post("/inspections", {
            propertyId: targetPropId,
            mode: "Full",
          });

          inspection = createResponse.data?.inspection || createResponse.data;
        }

        const id = inspection?.inspectionId || inspection?.id;

        if (!id) {
          throw new Error("The backend did not return an inspection ID.");
        }

        // 4. Fetch the saved inspection items and evidence.
        const detailResponse = await api.get(`/inspections/${id}`);

        const detail = detailResponse.data?.inspection || detailResponse.data;

        if (cancelled) return;

        setInspectionId(id);

        const backendItems = Array.isArray(detail?.items) ? detail.items : [];

        // 5. Property rooms define the sections; inspection records define their items.
        const mergedRooms = propertyRooms.map((room) => {
          const matchingItems = backendItems.filter((item) => {
            const backendRoomId = item.roomId || item.room?.roomId;

            const backendRoomName = item.roomName || item.room?.name;

            return (
              (backendRoomId &&
                String(backendRoomId) === String(room.roomId)) ||
              (backendRoomName &&
                String(backendRoomName).trim().toLowerCase() ===
                  room.name.toLowerCase())
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
              photos: evidence.map((entry) => ({
                id: entry.evidenceId || entry.id,
                evidenceId: entry.evidenceId || entry.id,
                objectKey: entry.objectKey,
                url: entry.url,
                fileName: entry.metadata?.fileName || "",
                type: entry.contentType || entry.content_type || "",
                timestamp: entry.createdAt || entry.timestamp || "",
              })),
              status:
                item.status ||
                (item.condition && item.condition !== "no_issue"
                  ? "Under Review"
                  : "Normal"),
            };
          });

          return { ...room, items };
        });

        setRoomsData(mergedRooms);

        try {
          localStorage.setItem(
            `hometrust_inspection_v6_${targetPropId}`,
            JSON.stringify(mergedRooms),
          );
        } catch (storageError) {
          console.warn("Could not cache inspection data:", storageError);
        }
      } catch (err) {
        if (cancelled) return;

        console.error(
          "Inspection initialization failed:",
          err?.response?.data || err?.message,
        );

        // The cache is only a fallback; prefer the selected property's rooms
        // over cached room definitions whenever those are available.
        const propertyRooms = normalizePropertyRooms(safeProperty?.rooms || []);

        try {
          const saved = localStorage.getItem(
            `hometrust_inspection_v6_${targetPropId}`,
          );

          const cachedRooms = saved ? JSON.parse(saved) : [];

          const fallbackRooms = propertyRooms.map((room) => {
            const cachedRoom = cachedRooms.find(
              (entry) =>
                String(entry.roomId || entry.id) === String(room.roomId) ||
                entry.name?.trim().toLowerCase() === room.name.toLowerCase(),
            );

            return {
              ...room,
              items: cachedRoom?.items || [],
            };
          });

          setRoomsData(fallbackRooms);
        } catch {
          setRoomsData(propertyRooms);
        }
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
  }, [safeProperty?.propertyId, safeProperty?.id, safeProperty?.rooms]);
  const saveRooms = (updatedData) => {
    setRoomsData(updatedData);
    try {
      const propIdKey = safeProperty?.propertyId || safeProperty?.id;
      if (propIdKey) {
        localStorage.setItem(
          `hometrust_inspection_v6_${propIdKey}`,
          JSON.stringify(updatedData),
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePropertyPhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const compressedUrl = await compressImage(file);
    setPropertyImage(compressedUrl);
    try {
      const propIdKey = safeProperty?.propertyId || safeProperty?.id;
      if (propIdKey) {
        localStorage.setItem(
          `hometrust_property_image_${propIdKey}`,
          compressedUrl,
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddRoom = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    const finalCategory = normalizeCategory(
      isAddingCustomCategory && customCategory.trim()
        ? customCategory.trim()
        : newRoomCategory,
    );

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

    // 🛠️ Trigger notification for newly added section
    const targetPropId = safeProperty?.propertyId || safeProperty?.id;
    if (targetPropId) {
      triggerNotification(
        targetPropId,
        "Inspection Section Added",
        `Added new section: "${roomNameTrimmed}" to checklist.`,
        "system",
      );

      try {
        const currentRoomsList = updated.map((r) => ({
          roomId: r.id || r.roomId,
          name: r.name,
          category: r.category,
        }));

        await api.put(`/properties/${targetPropId}`, {
          name: safeProperty.name || "Property",
          address: safeProperty.address,
          type: safeProperty.type || "Apartment",
          flatNo: safeProperty.flatNo || "1",
          image: safeProperty.image || DEFAULT_IMAGE,
          rooms: currentRoomsList,
        });
      } catch (err) {
        console.warn(
          "Failed to register custom room on backend property:",
          err?.response?.data || err?.message,
        );
      }
    }
  };
  const handleDeleteRoom = async (roomId, e) => {
    e?.stopPropagation();

    const roomToDelete = roomsData.find(
      (room) => (room.roomId || room.id) === roomId || room.id === roomId,
    );

    if (!roomToDelete) return;

    if (isReadOnly) {
      alert("This inspection is read-only. Sections cannot be deleted.");
      return;
    }

    if (
      !window.confirm(
        `Delete "${roomToDelete.name}" and all its items from this inspection?`,
      )
    ) {
      return;
    }

    const targetPropId = safeProperty?.propertyId || safeProperty?.id;

    const updated = roomsData.filter(
      (room) => (room.roomId || room.id) !== roomId && room.id !== roomId,
    );

    try {
      if (targetPropId) {
        const backendRooms = updated.map((room) => ({
          roomId: room.roomId || room.id,
          name: room.name,
          category: normalizeCategory(room.category),
        }));

        await api.put(`/properties/${targetPropId}`, {
          name: safeProperty?.name || "Property",
          address: safeProperty?.address,
          type: safeProperty?.type || "Apartment",
          ...(safeProperty?.flatNo != null
            ? { flatNo: safeProperty.flatNo }
            : {}),
          rooms: backendRooms,
        });
      }

      saveRooms(updated);

      if (
        selectedRoomId === roomId ||
        selectedRoomId === roomToDelete.id ||
        selectedRoomId === roomToDelete.roomId
      ) {
        setSelectedRoomId(null);
      }

      setSelectedCategory("All");
    } catch (err) {
      console.error(
        "Failed to delete section:",
        err?.response?.data || err?.message,
      );

      alert(
        err?.response?.data?.message ||
          "The section could not be deleted from the property. Your local list has not been changed.",
      );
    }
  };

  const handleSaveRoomName = (roomId) => {
    if (!editedRoomName.trim()) return;
    const updated = roomsData.map((r) =>
      r.id === roomId ? { ...r, name: editedRoomName.trim() } : r,
    );
    saveRooms(updated);
    setIsEditingRoomName(false);
  };

  const handleAddItem = async (e) => {
    e.preventDefault();

    if (!newItemName.trim() || !selectedRoomId) return;

    if (isReadOnly) {
      alert("This inspection is read-only. Items cannot be added.");
      return;
    }

    if (!inspectionId) {
      alert(
        "The inspection has not connected to the backend yet. Please try again.",
      );
      return;
    }

    const targetRoom = roomsData.find((room) => room.id === selectedRoomId);

    if (!targetRoom) return;

    const itemName = newItemName.trim();

    try {
      const response = await api.post(`/inspections/${inspectionId}/items`, {
        roomId: targetRoom.roomId || targetRoom.id || targetRoom.name,
        itemName,
        condition: "no_issue",
        notes: "",
      });

      const savedItem =
        response.data?.item || response.data?.roomItem || response.data;

      const backendItemId = savedItem?.roomItemId || savedItem?.id;

      if (!backendItemId) {
        throw new Error("The backend did not return a room item ID.");
      }

      const newItem = {
        id: backendItemId,
        roomItemId: backendItemId,
        name: savedItem.itemName || savedItem.name || itemName,
        condition: savedItem.condition || "no_issue",
        notes: savedItem.notes || "",
        photos: [],
        status: "Normal",
      };

      const updated = roomsData.map((room) =>
        room.id === selectedRoomId
          ? {
              ...room,
              items: [...(room.items || []), newItem],
            }
          : room,
      );

      saveRooms(updated);
      setNewItemName("");
      setAddItemModalOpen(false);

      const targetPropId = safeProperty?.propertyId || safeProperty?.id;

      if (targetPropId) {
        triggerNotification(
          targetPropId,
          "Amenity Added",
          `Added "${itemName}" to ${targetRoom.name}.`,
          "system",
        );
      }
    } catch (err) {
      console.error(
        "Failed to add inspection item:",
        err?.response?.data || err?.message,
      );

      alert(
        err?.response?.data?.message ||
          err?.message ||
          "The item could not be saved. Please try again.",
      );
    }
  };
  const handleDeleteItem = async (roomId, itemId) => {
    const room = roomsData.find((r) => r.id === roomId);
    const item = room?.items?.find(
      (i) => i.id === itemId || i.roomItemId === itemId,
    );
    if (!room || !item) return;
    const backendId = item.roomItemId || item.id;
    try {
      if (inspectionId && backendId && !String(backendId).startsWith("item-")) {
        await api.delete(`/inspections/${inspectionId}/items/${backendId}`);
      }
      saveRooms(
        roomsData.map((r) =>
          r.id === roomId
            ? {
                ...r,
                items: r.items.filter(
                  (i) => i.id !== itemId && i.roomItemId !== itemId,
                ),
              }
            : r,
        ),
      );
    } catch (err) {
      alert(
        err?.response?.data?.message ||
          "The item could not be deleted. Please try again.",
      );
    }
  };
  const updateItemData = async (roomId, itemId, fields) => {
    const targetRoom = roomsData.find((r) => r.id === roomId);
    const targetItem = targetRoom?.items.find(
      (i) => i.id === itemId || i.roomItemId === itemId,
    );

    const updated = roomsData.map((room) => {
      if (room.id === roomId) {
        return {
          ...room,
          items: room.items.map((item) => {
            if (item.id === itemId || item.roomItemId === itemId) {
              const updatedItem = { ...item, ...fields };

              if (fields.status !== undefined) {
                updatedItem.status = fields.status;
              } else if (fields.condition === "no_issue") {
                updatedItem.status = fields.dispute ? "Under Review" : "Normal";
              } else if (fields.condition) {
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
        let backendRoomItemId = targetItem?.roomItemId;

        if (
          !backendRoomItemId ||
          String(backendRoomItemId).startsWith("item-")
        ) {
          const createRes = await api.post(
            `/inspections/${inspectionId}/items`,
            {
              roomId:
                targetRoom?.roomId ||
                targetRoom?.id ||
                targetRoom?.name ||
                "Living Room",
              itemName: targetItem?.name || "General Amenity",
              condition:
                fields.condition || targetItem?.condition || "no_issue",
              notes:
                fields.notes !== undefined
                  ? fields.notes
                  : targetItem?.notes || "",
            },
          );

          const savedItem =
            createRes.data?.item || createRes.data?.roomItem || createRes.data;

          backendRoomItemId = savedItem?.roomItemId || savedItem?.id;

          if (backendRoomItemId) {
            const roomsWithBackendId = updated.map((room) => ({
              ...room,
              items: (room.items || []).map((item) => {
                if (
                  room.id === roomId &&
                  (item.id === itemId || item.roomItemId === itemId)
                ) {
                  return {
                    ...item,
                    id: backendRoomItemId,
                    roomItemId: backendRoomItemId,
                  };
                }

                return item;
              }),
            }));

            saveRooms(roomsWithBackendId);
          }
        }
        await api.patch(
  `/inspections/${inspectionId}/items/${backendRoomItemId}`,
  {
    condition:
      fields.condition !== undefined ? fields.condition : undefined,
    notes:
      fields.notes !== undefined ? fields.notes : undefined,
    dispute:
      fields.dispute !== undefined ? fields.dispute : undefined,
    status:
      fields.status !== undefined ? fields.status : undefined,
  },
);
      } catch (err) {
        console.warn(
          "Backend sync notice:",
          err?.response?.data || err?.message,
        );
      }
    }
  };

  const handleClearDispute = (roomId, itemId) => {
  updateItemData(roomId, itemId, {
    condition: "no_issue",
    notes: "",
    dispute: null,
    status: "Normal",
  });
};

  const ensureBackendItemId = async (roomId, itemId) => {
    const room = roomsData.find(
      (entry) => entry.id === roomId || entry.roomId === roomId,
    );

    const item = room?.items?.find(
      (entry) => entry.id === itemId || entry.roomItemId === itemId,
    );

    if (!room || !item) {
      throw new Error("Could not find the room or item for this upload.");
    }

    if (!inspectionId) {
      throw new Error("No backend inspection is available yet.");
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
      items: (entry.items || []).map((existingItem) => {
        if (
          entry.id === roomId &&
          (existingItem.id === itemId || existingItem.roomItemId === itemId)
        ) {
          return {
            ...existingItem,
            id: backendItemId,
            roomItemId: backendItemId,
          };
        }

        return existingItem;
      }),
    }));

    saveRooms(updatedRooms);

    return backendItemId;
  };

  const handlePhotoUpload = async (roomId, itemId, e) => {
    const input = e.target;
    const files = Array.from(input.files || []);

    if (!files.length) return;

    if (isReadOnly) {
      alert("This inspection is read-only. Evidence cannot be uploaded.");
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

    const unsupported = files.filter((file) => !supportedTypes.has(file.type));

    if (unsupported.length) {
      alert(
        "Some files have unsupported formats. Use JPEG, PNG, WebP, HEIC, MP4, or QuickTime video.",
      );
      input.value = "";
      return;
    }

    const uploadKey = `${roomId}:${itemId}`;

    setUploadingItemIds((current) =>
      current.includes(uploadKey) ? current : [...current, uploadKey],
    );

    try {
      const backendItemId = await ensureBackendItemId(roomId, itemId);

      for (const file of files) {
        // Step 1: Request a presigned S3 upload URL.
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

        // Step 2: Upload the binary file directly to S3.
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

        // Step 3: Confirm the upload with your backend.
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
            "The evidence was uploaded, but the confirmation response did not include the expected evidence ID and URL.",
          );
        }

        const photo = {
          id: evidenceId,
          evidenceId,
          objectKey: evidence.objectKey || objectKey,
          url: evidenceUrl,
          type: file.type,
          fileName: file.name,
          timestamp: new Date().toLocaleString(),
        };

        // Save each confirmed evidence record in the corresponding item.
        setRoomsData((currentRooms) => {
          const updatedRooms = currentRooms.map((room) => ({
            ...room,
            items: (room.items || []).map((item) => {
              const matches =
                (room.id === roomId || room.roomId === roomId) &&
                (item.roomItemId === backendItemId ||
                  item.id === backendItemId ||
                  item.id === itemId);

              if (!matches) return item;

              const existingPhotos = item.photos || [];

              if (
                existingPhotos.some(
                  (existing) =>
                    existing.evidenceId === evidenceId ||
                    existing.id === evidenceId,
                )
              ) {
                return item;
              }

              return {
                ...item,
                id: backendItemId,
                roomItemId: backendItemId,
                photos: [...existingPhotos, photo],
              };
            }),
          }));

          try {
            const propertyId = safeProperty?.propertyId || safeProperty?.id;

            if (propertyId) {
              localStorage.setItem(
                `hometrust_inspection_v6_${propertyId}`,
                JSON.stringify(updatedRooms),
              );
            }
          } catch (storageError) {
            console.warn(
              "Could not cache evidence details locally:",
              storageError,
            );
          }

          return updatedRooms;
        });
      }
    } catch (err) {
      console.error(
        "Evidence upload failed:",
        err?.response?.data || err?.message,
      );

      alert(
        err?.response?.data?.message ||
          err?.message ||
          "The evidence could not be uploaded. Please try again.",
      );
    } finally {
      setUploadingItemIds((current) =>
        current.filter((key) => key !== uploadKey),
      );

      // Allows selecting the same file again after an upload attempt.
      input.value = "";
    }
  };

  const handleRaiseDispute = (e) => {
    e.preventDefault();
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

    const targetPropId = safeProperty?.propertyId || safeProperty?.id;
    if (targetPropId) {
      triggerNotification(
        targetPropId,
        "Dispute Flagged",
        `Issue recorded on ${targetItem?.name || "item"} (${disputeSeverity} severity).`,
        "dispute",
      );
    }

    setDisputeModalOpen(false);
    setDisputeNote("");
    setDisputeSeverity("Minor");
    setDisputeTarget(null);
  };

  const normalizedRooms = roomsData.map((room) => ({
    ...room,
    id: room.id || room.roomId,
    roomId: room.roomId || room.id,
    category: normalizeCategory(room.category, room.name),
    items: Array.isArray(room.items) ? room.items : [],
  }));

  console.table(
    normalizedRooms.map((room) => ({
      name: room.name,
      category: room.category,
      id: room.id,
    })),
  );

  const dynamicCategories = [
    ...new Set([
      ...INITIAL_CATEGORIES,
      ...normalizedRooms.map((room) => room.category),
    ]),
  ];

  const filteredRooms = normalizedRooms.filter((room) => {
    if (selectedCategory === "All") return true;

    return room.category === selectedCategory;
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

  if (showInviteSuccess) {
    return (
      <InviteLinkSent
        onBackHome={() => setShowInviteSuccess(false)}
        date={new Date().toLocaleDateString()}
      />
    );
  }
  const isPropertyValid = Boolean(safeProperty?.propertyId || safeProperty?.id);
  if (isLoadingInspection) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6 text-center">
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-purple-100 border-t-purple-800"
          aria-hidden="true"
        />
        <h2 className="mt-5 text-lg font-bold text-slate-800">
          Loading your inspection
        </h2>
        <p role="status" className="mt-2 max-w-xs text-sm text-slate-500">
          Retrieving the property rooms and saved inspection details. Please
          wait…
        </p>
      </div>
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
            {activeRoom ? activeRoom.name : safeProperty?.name || "Inspection"}
          </h1>

          <div className="flex items-center gap-2">
            {/* Invite Button Disabled Until Property is Added */}
            <button
              type="button"
              disabled={!isPropertyValid}
              onClick={() => setInviteModalOpen(true)}
              className="inline-flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 px-3 py-1.5 rounded-full text-[11px] font-black shadow-md transition-all cursor-pointer"
              title={
                !isPropertyValid
                  ? "Save property before inviting"
                  : "Invite Tenant/Landlord"
              }
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Invite</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                if (isReadOnly) {
                  alert("This inspection is read-only.");
                  return;
                }

                if (!inspectionId) {
                  alert("No backend inspection is available yet.");
                  return;
                }

                try {
                  await api.post(`/inspections/${inspectionId}/submit`);

                  const targetPropId =
                    safeProperty?.propertyId || safeProperty?.id;

                  if (targetPropId) {
                    triggerNotification(
                      targetPropId,
                      "Inspection Walkthrough Completed",
                      "The inspection was submitted for review.",
                      "system",
                    );
                  }

                  onCompleteInspection?.(roomsData, inspectionId);
                } catch (err) {
                  console.error(
                    "Inspection submission failed:",
                    err?.response?.data || err?.message,
                  );

                  alert(
                    err?.response?.data?.message ||
                      "The inspection could not be submitted. Please try again.",
                  );
                }
              }}
              className="text-xs font-extrabold text-[#4A1E6D] bg-white hover:bg-slate-100 px-3.5 py-1.5 rounded-full cursor-pointer shrink-0 transition-colors shadow-md"
            >
              Review & Sign
            </button>
          </div>
        </div>

        {/* Collaborative Notice Banner */}
        {isReadOnly && (
          <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-2 text-center text-amber-900 text-xs font-medium backdrop-blur-md">
            <strong>Read-only inspection:</strong> This inspection is locked.
            You can review the recorded condition and evidence, but cannot make
            changes.
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
                Change Apartment Photo
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePropertyPhotoChange}
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
                    setIsAddingCustomCategory(false);
                    setAddRoomModalOpen(true);
                  }}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-[#4A1E6D] border border-slate-200 rounded-xl transition-all cursor-pointer shrink-0 shadow-xs flex items-center gap-1 text-xs font-bold"
                >
                  <Plus className="w-4 h-4" /> Add Section
                </button>
              </div>

              {/* Room Cards */}
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
                              disabled={isReadOnly}
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
                      <h2 className="text-sm font-extrabold text-slate-900">
                        {activeRoom?.name}
                      </h2>
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
                    disabled={isReadOnly}
                    className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl cursor-pointer transition-colors"
                    title="Delete whole room"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setAddItemModalOpen(true)}
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
                            <button
                              key={p.evidenceId || p.id || idx}
                              type="button"
                              onClick={() => setZoomedPhoto(p)}
                              className="relative w-full h-20 rounded-xl overflow-hidden border border-slate-200 cursor-zoom-in"
                              title="Click to enlarge evidence"
                              aria-label={`Enlarge evidence ${idx + 1} for ${item.name}`}
                            >
                              <img
                                src={p.url}
                                alt={`Evidence for ${item.name}`}
                                className="w-full h-full object-cover"
                              />

                              <span className="absolute bottom-1 right-1 rounded-md bg-black/60 text-white p-1">
                                <Camera className="w-3 h-3" />
                              </span>
                            </button>
                          ))}
                          <label className="w-full h-20 rounded-xl border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors">
                            <Plus className="w-4 h-4 text-[#4A1E6D]" />
                            <span className="text-[10px] font-bold text-[#4A1E6D] mt-0.5">
                              Photo
                            </span>
                            <input
                              type="file"
                              multiple
                              accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime"
                              capture="environment"
                              disabled={
                                isReadOnly ||
                                uploadingItemIds.includes(
                                  `${activeRoom.id}:${item.id}`,
                                )
                              }
                              onChange={(e) =>
                                handlePhotoUpload(activeRoom.id, item.id, e)
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
                            placeholder="Note condition details, scratches, stains..."
                            className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-800 text-slate-800 placeholder-slate-400"
                          />
                        </div>

                        {/* Dispute Trigger Button */}
                        <div className="pt-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
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
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Section/Room Name
              </label>
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
                    onClick={() => setDisputeSeverity(s.id)}
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
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl cursor-pointer shadow-sm"
              >
                Post Comment / Dispute
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Enlarged Evidence Viewer */}
      {zoomedPhoto && (
        <div
          className="fixed inset-0 z-100 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setZoomedPhoto(null)}
          role="presentation"
        >
          <button
            type="button"
            onClick={() => setZoomedPhoto(null)}
            className="absolute top-4 right-4 text-white bg-white/15 hover:bg-white/25 rounded-full p-3"
            aria-label="Close enlarged image"
          >
            <X className="w-6 h-6" />
          </button>

          <img
            src={zoomedPhoto.url}
            alt={zoomedPhoto.fileName || "Enlarged inspection evidence"}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[85vh] object-contain rounded-lg cursor-zoom-out"
          />
        </div>
      )}

      <InvitePartyModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        onInviteSent={() => {
          setInviteModalOpen(false);
          setShowInviteSuccess(true);
        }}
        property={safeProperty}
        inspectionId={inspectionId}
        currentUserRole={userRole}
      />
    </div>
  );
}
