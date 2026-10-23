import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import WelcomePage from "./pages/WelcomePage";
import AuthPage from "./pages/AuthPage";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import DashboardPage from "./pages/DashboardPage";
import PartyOnboardingPage from "./pages/PartyOnboardingPage";
import InspectionPage from "./pages/InspectionPage";
import MoveOutInspectionPage from "./pages/MoveOutInspectionPage";
import MoveOutEvidencePage from "./pages/MoveOutEvidencePage";
import MoveInOutRecordsView from "./components/MoveInOutRecordsView";
import InvitePartyModal from "./components/InvitePartyModal";
import InspectionReportPage from "./pages/InspectionReportPage";
import SignInspectionPage from "./pages/SignInspectionPage";
import EvidenceReviewPage from "./pages/EvidenceReviewPage";
import MoveOutSignaturesPage from "./pages/MoveOutSignaturesPage";
import MoveOutInspectionReportPage from "./pages/MoveOutInspectionReportPage";
import NotificationsPage from "./pages/NotificationsPage";
import ProfilePage from "./pages/ProfilePage";
import { triggerNotification } from "./utils/notifications";
import AdminStatsPage from "./pages/AdminStatsPage";
import api from "./api/client"; // Live API client connected to Render backend

const unwrapInspection = (response) =>
  response?.data?.inspection ||
  response?.data?.data?.inspection ||
  response?.data?.data ||
  response?.data ||
  response;

const isArchivedInspection = (inspection) =>
  inspection?.status === "ARCHIVED" || inspection?.state === "ARCHIVED";

// Older Move-In records may use mode "Full" or omit mode. Move-Out records
// are explicitly marked mode === "MoveOut" by the backend.
const isMoveOutInspection = (inspection) => inspection?.mode === "MoveOut";
const isMoveInInspection = (inspection) => !isMoveOutInspection(inspection);

const newestInspection = (inspections, predicate) =>
  (Array.isArray(inspections) ? inspections : [])
    .filter(
      (inspection) =>
        inspection?.inspectionId &&
        !isArchivedInspection(inspection) &&
        predicate(inspection),
    )
    .sort((a, b) => {
      const dateA = Date.parse(a.updatedAt || a.createdAt || 0) || 0;
      const dateB = Date.parse(b.updatedAt || b.createdAt || 0) || 0;
      return dateB - dateA;
    })[0] || null;

const hasSavedSignature = (signature) =>
  Boolean(signature && typeof signature === "object" && signature.uploadedAt);

// Dashboard status is derived from verified backend inspection records, never
// from stale property metadata or signatures left in browser state.

const applyInspectionStatus = (property, moveIn, moveOut) => {
  const moveInLocked = moveIn?.state === "READ_ONLY";
  const moveOutLocked = moveOut?.state === "READ_ONLY";

  const landlordSignature = hasSavedSignature(moveIn?.landlordSignature)
    ? moveIn.landlordSignature
    : null;

  const tenantSignature = hasSavedSignature(moveIn?.tenantSignature)
    ? moveIn.tenantSignature
    : null;

  return {
    ...property,

    status: moveInLocked
      ? "READ_ONLY"
      : moveIn
        ? moveIn.state || "IN_PROGRESS"
        : "NOT_STARTED",

    moveInStatus: moveInLocked
      ? "LOCKED"
      : moveIn
        ? "IN_PROGRESS"
        : "NOT_STARTED",

    progress: moveInLocked
      ? 100
      : moveIn
        ? Math.max(Number(property.progress) || 0, 50)
        : 0,

    signatures:
      moveInLocked && landlordSignature && tenantSignature
        ? { landlord: landlordSignature, tenant: tenantSignature }
        : { landlord: null, tenant: null },

    moveOutStatus: moveOutLocked
      ? "READ_ONLY"
      : moveOut
        ? "ACTIVE"
        : "NOT_STARTED",

    moveOutProgress: moveOutLocked ? 100 : moveOut ? 50 : 0,
  };
};

const fetchVerifiedInspection = async (id, propertyId, expectedMode) => {
  if (!id) return null;
  try {
    const response = await api.get(`/inspections/${id}`);
    const record = unwrapInspection(response);
    const returnedId = record?.inspectionId || record?.id;
    if (
      !returnedId ||
      String(returnedId) !== String(id) ||
      (record?.propertyId &&
        String(record.propertyId) !== String(propertyId)) ||
      isArchivedInspection(record) ||
      (expectedMode === "MoveOut" && !isMoveOutInspection(record)) ||
      (expectedMode === "MoveIn" && !isMoveInInspection(record))
    )
      return null;
    return record;
  } catch (error) {
    console.warn(
      "Could not verify inspection record:",
      error?.response?.data || error?.message,
    );
    return null;
  }
};

const groupInspectionItems = (inspection, propertyRooms = []) => {
  const rooms = Array.isArray(propertyRooms) ? propertyRooms : [];
  const items = Array.isArray(inspection?.items) ? inspection.items : [];
  const grouped = new Map();
  rooms.forEach((room) => {
    const roomId = room.roomId || room.id || room.name;
    grouped.set(String(roomId), {
      ...room,
      id: roomId,
      roomId,
      name: room.name || room.roomName || "Unnamed Room",
      category: room.category || "Room",
      items: [],
    });
  });
  items.forEach((item, index) => {
    const roomId = String(item.roomId || "unassigned");
    if (!grouped.has(roomId)) {
      grouped.set(roomId, {
        id: roomId,
        roomId,
        name: item.roomName || "Other / Unassigned Items",
        category: "Room",
        items: [],
      });
    }
    grouped.get(roomId).items.push({
      ...item,
      id: item.roomItemId || item.itemId || item.id || index,
      name: item.itemName || item.name || "Unnamed Item",
      evidence: Array.isArray(item.evidence) ? item.evidence : [],
      photos: Array.isArray(item.photos) ? item.photos : [],
    });
  });
  return Array.from(grouped.values());
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const activeSession = localStorage.getItem("hometrust_current_session");

      return activeSession ? JSON.parse(activeSession) : null;
    } catch {
      return null;
    }
  });

  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [inspectionId, setInspectionId] = useState(null);
  const [moveOutInspectionId, setMoveOutInspectionId] = useState(null);
  const propertySelectionRequest = useRef(0);
  const selectedPropertyKey =
    selectedProperty?.propertyId || selectedProperty?.id || null;
  // Keep signatures in memory for UI coordination only. The backend inspection
  // endpoint remains the source of truth for saved signatures and finalization.

  const [signatureState, setSignatureState] = useState({
    propertyKey: null,

    data: null,
  });

  const signatures =
    signatureState.propertyKey === selectedPropertyKey && signatureState.data
      ? signatureState.data
      : { landlord: null, tenant: null };

  const setSignatures = (newSigs) => {
    const updated =
      typeof newSigs === "function" ? newSigs(signatures) : newSigs;

    setSignatureState({ propertyKey: selectedPropertyKey, data: updated });
  };
  // Sync login state across tabs. Signature data is deliberately not synced
  // through localStorage; each signing/report page reloads it from the API.

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "hometrust_current_session") {
        try {
          setCurrentUser(e.newValue ? JSON.parse(e.newValue) : null);
        } catch {
          setCurrentUser(null);
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);
  // Track active property's inspection data securely in state

  const [inspectionDataState, setInspectionDataState] = useState({
    propertyKey: null,

    data: [],
  });

  const selectedInspectionData =
    inspectionDataState.propertyKey === selectedPropertyKey
      ? inspectionDataState.data
      : (() => {
          if (!selectedPropertyKey) return [];

          try {
            const saved = localStorage.getItem(
              `hometrust_inspection_v6_${selectedPropertyKey}`,
            );

            return saved ? JSON.parse(saved) : [];
          } catch {
            return [];
          }
        })();

  const setSelectedInspectionData = (data) => {
    setInspectionDataState({ propertyKey: selectedPropertyKey, data });
  };
  // Move-Out inspection data scoped safely by property key
  const [moveOutDataState, setMoveOutDataState] = useState({
    propertyKey: null,
    data: [],
  });

  const selectedMoveOutData =
    moveOutDataState.propertyKey === selectedPropertyKey
      ? moveOutDataState.data
      : (() => {
          if (!selectedPropertyKey) return [];

          try {
            const saved = localStorage.getItem(
              `hometrust_moveout_inspection_v6_${selectedPropertyKey}`,
            );
            if (saved) return JSON.parse(saved);
            const savedReport = localStorage.getItem(
              `hometrust_moveout_report_${selectedPropertyKey}`,
            );

            if (savedReport) {
              const parsed = JSON.parse(savedReport);

              if (parsed.moveOutInspectionData)
                return parsed.moveOutInspectionData;
            }
          } catch {
            // ignore
          }
          return [];
        })();

  const setMoveOutInspectionData = (data) => {
    setMoveOutDataState({ propertyKey: selectedPropertyKey, data });
  };
  const handleSelectProperty = async (prop) => {
    const requestId = ++propertySelectionRequest.current;
    const nextKey = prop?.propertyId || prop?.id;
    const currentKey = selectedProperty?.propertyId || selectedProperty?.id;
    if (nextKey !== currentKey) {
      setInspectionId(null);
      setMoveOutInspectionId(null);
      setInspectionDataState({ propertyKey: nextKey || null, data: [] });
      setMoveOutDataState({ propertyKey: nextKey || null, data: [] });
      setMoveOutSignatures({ landlord: null, tenant: null });
    }
    setSelectedProperty(prop);
    if (!nextKey) return;

    try {
      const response = await api.get(`/inspections/property/${nextKey}`);
      const records =
        response.data?.inspections || response.data?.data?.inspections || [];
      const propertyRecords = records.filter(
        (record) =>
          record?.inspectionId &&
          !isArchivedInspection(record) &&
          (!record.propertyId || String(record.propertyId) === String(nextKey)),
      );
      const latestMoveIn = newestInspection(
        propertyRecords,
        isMoveInInspection,
      );
      const latestMoveOut = newestInspection(
        propertyRecords,
        isMoveOutInspection,
      );
      const [moveIn, moveOut] = await Promise.all([
        fetchVerifiedInspection(latestMoveIn?.inspectionId, nextKey, "MoveIn"),
        fetchVerifiedInspection(
          latestMoveOut?.inspectionId,
          nextKey,
          "MoveOut",
        ),
      ]);
      if (requestId !== propertySelectionRequest.current) return;
      // Ignore an older async response after the user has switched properties again.
      const hydratedProperty = applyInspectionStatus(prop, moveIn, moveOut);
      setSelectedProperty(hydratedProperty);
      setProperties((previous) =>
        previous.map((item) =>
          String(item.propertyId || item.id) === String(nextKey)
            ? hydratedProperty
            : item,
        ),
      );
      setInspectionId(moveIn?.inspectionId || null);
      setMoveOutInspectionId(moveOut?.inspectionId || null);
      try {
        if (moveIn?.inspectionId) {
          localStorage.setItem(
            `hometrust_movein_inspection_v1_${nextKey}`,
            String(moveIn.inspectionId),
          );
          localStorage.setItem(
            `hometrust_active_inspection_v1_${nextKey}`,
            String(moveIn.inspectionId),
          );
        } else {
          localStorage.removeItem(`hometrust_movein_inspection_v1_${nextKey}`);
          localStorage.removeItem(`hometrust_active_inspection_v1_${nextKey}`);
        }
        if (moveOut?.inspectionId)
          localStorage.setItem(
            `hometrust_moveout_inspection_v1_${nextKey}`,
            String(moveOut.inspectionId),
          );
        else
          localStorage.removeItem(`hometrust_moveout_inspection_v1_${nextKey}`);
      } catch (storageError) {
        console.warn(
          "Could not cache selected property's inspection IDs:",
          storageError,
        );
      }
    } catch (error) {
      console.warn(
        "Could not load inspection IDs for the selected property:",
        error?.response?.data || error?.message,
      );
      if (requestId === propertySelectionRequest.current) {
        setInspectionId(null);
        setMoveOutInspectionId(null);
        const unverifiedProperty = applyInspectionStatus(prop, null, null);
        setSelectedProperty(unverifiedProperty);
        setProperties((previous) =>
          previous.map((item) =>
            String(item.propertyId || item.id) === String(nextKey)
              ? unverifiedProperty
              : item,
          ),
        );
      }
    }
  };
  const [moveOutSignatures, setMoveOutSignatures] = useState({
    landlord: null,

    tenant: null,
  });
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const inviteToken = params.get("token");
  const routeToView = {
    "/": "landing",
    "/welcome": "welcome",
    "/signup": "signup",
    "/login": "login",
    "/forgot-password": "forgot-password",
    "/dashboard": "dashboard",
    "/join": "onboarding",
    "/invite": "onboarding",
    "/inspection": "inspection",
    "/move-out-inspection": "move-out-inspection",
    "/move-out-evidence": "move-out-evidence",
    "/move-in-out-records": "move-in-out-records",
    "/move-out-signatures": "move-out-signatures",
    "/move-out-report": "move-out-report",
    "/evidence-review": "evidence-review",
    "/sign-inspection": "sign-inspection",
    "/inspection-report": "inspection-report",
    "/notifications": "notifications",
    "/profile": "profile",
    "/admin": "admin",
  };

  const currentView =
    inviteToken ||
    location.pathname === "/join" ||
    location.pathname === "/invite"
      ? "onboarding"
      : routeToView[location.pathname] || "landing";

  const viewToRoute = {
    landing: "/",
    welcome: "/welcome",
    signup: "/signup",
    login: "/login",
    "forgot-password": "/forgot-password",
    onboarding: "/join",
    dashboard: "/dashboard",
    inspection: "/inspection",
    "move-out-inspection": "/move-out-inspection",
    "move-out-evidence": "/move-out-evidence",
    "move-in-out-records": "/move-in-out-records",
    "move-out-signatures": "/move-out-signatures",
    "move-out-report": "/move-out-report",
    "evidence-review": "/evidence-review",
    "sign-inspection": "/sign-inspection",
    "inspection-report": "/inspection-report",
    notifications: "/notifications",
    profile: "/profile",
    admin: "/admin",
  };

  const setCurrentView = (view) => {
    const nextRoute = viewToRoute[view];
    if (nextRoute) {
      navigate(nextRoute);
    }
  };
  useEffect(() => {
    if (location.pathname === "/" && currentUser?.token && !inviteToken) {
      navigate("/dashboard", { replace: true });
    }
  }, [location.pathname, currentUser, inviteToken, navigate]);

  // Fetch properties from backend database with User-Scoped Isolation
  useEffect(() => {
    let cancelled = false;
    const fetchCloudProperties = async () => {
      if (!currentUser) {
        setProperties([]);
        setSelectedProperty(null);
        setInspectionId(null);
        return;
      }

      const userStorageKey = `hometrust_properties_${
        currentUser.email || currentUser.id || "default"
      }`;
      try {
        const response = await api.get("/properties");
        if (cancelled) return;
        let cloudProps = response.data?.properties || response.data || [];
        if (!Array.isArray(cloudProps)) {
          throw new Error("The properties API returned an invalid response.");
        }
        const targetId = currentUser.activePropertyId;
        let targetProp = targetId
          ? cloudProps.find(
              (prop) => prop.propertyId === targetId || prop.id === targetId,
            )
          : null;

        // If the invited property wasn't in the list, fetch the real property.
        if (targetId && !targetProp) {
          try {
            const singleRes = await api.get(`/properties/${targetId}`);
            if (cancelled) return;
            const candidate = singleRes.data?.property || singleRes.data;

            // Don't accept an empty response or an unrelated property.
            if (
              candidate &&
              (candidate.propertyId === targetId || candidate.id === targetId)
            ) {
              targetProp = candidate;
              cloudProps = [candidate, ...cloudProps];
            }
          } catch (err) {
            console.error(
              "Could not load the active property:",

              err?.response?.data || err?.message,
            );
          }
        }
        if (cancelled) return;

        // An invited participant must have the actual property, not a placeholder.

        if (currentUser.isInvitedParticipant && !targetProp) {
          setProperties([]);
          setSelectedProperty(null);
          setInspectionId(null);
          console.error(
            "The invited property could not be loaded. The workspace cannot be opened.",
          );

          return;
        }

        setProperties(cloudProps);
        localStorage.setItem(userStorageKey, JSON.stringify(cloudProps));

        const matchedProp =
          targetProp ||
          cloudProps.find(
            (prop) => prop.propertyId === targetId || prop.id === targetId,
          ) ||
          cloudProps[0] ||
          null;

        if (!matchedProp) {
          setSelectedProperty(null);

          setInspectionId(null);
          return;
        }

        const propKey = matchedProp.propertyId || matchedProp.id;
        const mergedProp = {
          ...matchedProp,

          signatures: matchedProp.signatures || {
            landlord: null,
            tenant: null,
          },
        };

        setSelectedProperty(mergedProp);
        // Restore Move-In and Move-Out independently; never let one mode's ID
        // overwrite the other mode after refresh or when switching properties.
        const moveInCacheKey = `hometrust_movein_inspection_v1_${propKey}`;
        const moveOutCacheKey = `hometrust_moveout_inspection_v1_${propKey}`;
        let cachedMoveInId = null;
        let cachedMoveOutId = null;
        try {
          cachedMoveInId = localStorage.getItem(moveInCacheKey);
          cachedMoveOutId = localStorage.getItem(moveOutCacheKey);
        } catch (storageError) {
          console.warn("Could not read cached inspection IDs:", storageError);
        }

        let moveInInspection = null;
        let moveOutInspection = null;
        const verifyCached = async (id, expectedMode) => {
          if (!id) return null;
          try {
            const detailResponse = await api.get(`/inspections/${id}`);
            if (cancelled) return null;
            const record = unwrapInspection(detailResponse);
            const returnedId = record?.inspectionId || record?.id;
            const returnedPropertyId = record?.propertyId;
            if (
              !returnedId ||
              String(returnedId) !== String(id) ||
              (returnedPropertyId &&
                String(returnedPropertyId) !== String(propKey)) ||
              isArchivedInspection(record)
            )
              return null;
            if (expectedMode === "MoveOut" && !isMoveOutInspection(record))
              return null;
            if (expectedMode === "MoveIn" && !isMoveInInspection(record))
              return null;
            return record;
          } catch (error) {
            console.warn(
              "Cached inspection could not be verified:",
              error?.response?.data || error?.message,
            );
            return null;
          }
        };
        moveInInspection = await verifyCached(cachedMoveInId, "MoveIn");
        moveOutInspection = await verifyCached(cachedMoveOutId, "MoveOut");

        // Backward compatibility: an older generic cache/session ID is only
        // accepted after fetching the record and checking its actual mode.
        if (!moveInInspection && !moveOutInspection) {
          const legacyId = (() => {
            try {
              return (
                localStorage.getItem(
                  `hometrust_active_inspection_v1_${propKey}`,
                ) ||
                currentUser.activeInspectionId ||
                null
              );
            } catch {
              return currentUser.activeInspectionId || null;
            }
          })();
          const legacyRecord = await verifyCached(legacyId, null);
          if (legacyRecord) {
            if (isMoveOutInspection(legacyRecord))
              moveOutInspection = legacyRecord;
            else moveInInspection = legacyRecord;
          }
        }

        // Query the property list once, then choose the newest record per mode.
        if (!moveInInspection || !moveOutInspection) {
          try {
            const listResponse = await api.get(
              `/inspections/property/${propKey}`,
            );
            if (cancelled) return;
            const inspections =
              listResponse.data?.inspections ||
              listResponse.data?.data?.inspections ||
              [];
            const propertyRecords = inspections.filter(
              (record) =>
                record?.inspectionId &&
                !isArchivedInspection(record) &&
                (!record.propertyId ||
                  String(record.propertyId) === String(propKey)),
            );
            if (!moveInInspection)
              moveInInspection = newestInspection(
                propertyRecords,
                isMoveInInspection,
              );
            if (!moveOutInspection)
              moveOutInspection = newestInspection(
                propertyRecords,
                isMoveOutInspection,
              );
          } catch (lookupError) {
            console.warn(
              "Could not restore inspections for this property:",
              lookupError?.response?.data || lookupError?.message,
            );
          }
        }

        if (cancelled) return;
        // The property inspection list may omit signature objects; reload each
        // chosen record so dashboard gates use saved backend signatures and state.
        const [verifiedMoveIn, verifiedMoveOut] = await Promise.all([
          fetchVerifiedInspection(
            moveInInspection?.inspectionId,
            propKey,
            "MoveIn",
          ),
          fetchVerifiedInspection(
            moveOutInspection?.inspectionId,
            propKey,
            "MoveOut",
          ),
        ]);
        if (cancelled) return;
        moveInInspection = verifiedMoveIn;
        moveOutInspection = verifiedMoveOut;
        const restoredMoveInId = moveInInspection?.inspectionId || null;
        const restoredMoveOutId = moveOutInspection?.inspectionId || null;
        const statusProperty = applyInspectionStatus(
          mergedProp,
          moveInInspection,
          moveOutInspection,
        );
        setSelectedProperty(statusProperty);
        setProperties((previous) =>
          previous.map((item) =>
            String(item.propertyId || item.id) === String(propKey)
              ? statusProperty
              : item,
          ),
        );
        setInspectionId(restoredMoveInId);
        setMoveOutInspectionId(restoredMoveOutId);
        try {
          if (restoredMoveInId)
            localStorage.setItem(moveInCacheKey, String(restoredMoveInId));
          else localStorage.removeItem(moveInCacheKey);
          if (restoredMoveOutId)
            localStorage.setItem(moveOutCacheKey, String(restoredMoveOutId));
          else localStorage.removeItem(moveOutCacheKey);
          // Keep the legacy key Move-In-only so old callers cannot accidentally
          // route to the Move-Out inspection.
          if (restoredMoveInId)
            localStorage.setItem(
              `hometrust_active_inspection_v1_${propKey}`,
              String(restoredMoveInId),
            );
          else
            localStorage.removeItem(
              `hometrust_active_inspection_v1_${propKey}`,
            );
        } catch (storageError) {
          console.warn("Could not update cached inspection IDs:", storageError);
        }
      } catch (err) {
        if (cancelled) return;

        console.error("Failed to load properties from backend:", err);

        // Never substitute cached or fabricated properties for an invited workspace.

        if (currentUser.isInvitedParticipant) {
          setProperties([]);

          setSelectedProperty(null);

          setInspectionId(null);

          return;
        }
        // Preserve the existing local-cache fallback for ordinary users.
        try {
          const localSaved = localStorage.getItem(userStorageKey);

          if (localSaved) {
            const parsed = JSON.parse(localSaved);

            if (cancelled) return;

            setProperties(parsed);

            if (parsed.length > 0) {
              setSelectedProperty(parsed[0]);
            } else {
              setSelectedProperty(null);
            }
          }
        } catch (cacheError) {
          console.error("Failed to load cached properties:", cacheError);
        }
      }
    };
    fetchCloudProperties();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const handleAuthSuccess = (userData) => {
    if (!userData || !userData.token) {
      console.error(
        "Authentication failed: the response is missing a user session or JWT token.",
      );

      return;
    }
    try {
      // Save the JWT where api/client.js expects to find it.

      localStorage.setItem("token", userData.token);

      // Save the full session so App.jsx can restore it after a refresh.

      localStorage.setItem(
        "hometrust_current_session",

        JSON.stringify(userData),
      );

      // Update React state and navigate to the dashboard.

      setCurrentUser(userData);

      setCurrentView("dashboard");
    } catch (error) {
      console.error("Unable to save the authenticated session:", error);
    }
  };
  const handleProfileUpdate = async (updates) => {
    if (!currentUser)
      throw new Error("You must be signed in to update your profile.");

    // Persist the allowed fields through the authenticated backend endpoint first.
    const response = await api.patch("/users/me", updates);
    const savedUser = response?.data?.user;
    if (!savedUser)
      throw new Error("The server did not return the updated profile.");

    // Preserve session-only fields (such as token) while replacing profile fields
    // with the authoritative values returned by the backend.
    const updatedUser = { ...currentUser, ...savedUser };
    setCurrentUser(updatedUser);
    localStorage.setItem(
      "hometrust_current_session",
      JSON.stringify(updatedUser),
    );

    // Keep the optional legacy user cache in sync without making it authoritative.
    try {
      const cachedUser = localStorage.getItem("user");
      if (cachedUser) {
        localStorage.setItem(
          "user",
          JSON.stringify({ ...JSON.parse(cachedUser), ...savedUser }),
        );
      }
    } catch {
      // The saved backend profile and current session remain authoritative.
    }

    return savedUser;
  };

  const handleLogout = () => {
    localStorage.removeItem("hometrust_current_session");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("hometrust_token");
    setCurrentUser(null);
    setProperties([]);
    setSelectedProperty(null);
    setInspectionId(null);
    setCurrentView("login");
  };

  const handleAddNewProperty = (newPropData) => {
    const stableId =
      newPropData.propertyId ||
      newPropData.id ||
      `prop-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const uniqueProp = {
      ...newPropData,
      propertyId: stableId,
      id: stableId,
      progress: 0,
      moveOutProgress: 0,
      status: "NOT_STARTED",
      moveInStatus: "NOT_STARTED",
      moveOutStatus: "NOT_STARTED",
      signatures: { landlord: null, tenant: null },
    };

    const updatedList = [uniqueProp, ...properties];

    setProperties(updatedList);
    setSelectedProperty(uniqueProp);
    setInspectionId(null);
    setMoveOutInspectionId(null);
    setSelectedInspectionData([]);
    setMoveOutInspectionData([]);
    setSignatures({ landlord: null, tenant: null });
    setMoveOutSignatures({ landlord: null, tenant: null });

    if (currentUser) {
      const userStorageKey = `hometrust_properties_${
        currentUser.email || currentUser.id || "default"
      }`;
      localStorage.setItem(userStorageKey, JSON.stringify(updatedList));
    }

    triggerNotification(
      stableId,
      "New Property Added",
      `Successfully registered ${uniqueProp.address}.`,
      "system",
    );
  };

  const handleDeleteProperty = async (propertyId) => {
    try {
      await api.delete(`/properties/${propertyId}`);
    } catch (err) {
      console.warn("Backend deletion warning:", err?.message);
    }
    localStorage.removeItem(`hometrust_inspection_v6_${propertyId}`);
    localStorage.removeItem(`hometrust_moveout_inspection_v6_${propertyId}`);
    localStorage.removeItem(`hometrust_movein_inspection_v1_${propertyId}`);
    localStorage.removeItem(`hometrust_moveout_inspection_v1_${propertyId}`);
    localStorage.removeItem(`hometrust_active_inspection_v1_${propertyId}`);
    localStorage.removeItem(`hometrust_property_image_${propertyId}`);
    localStorage.removeItem(`hometrust_moveout_property_image_${propertyId}`);
    localStorage.removeItem(`hometrust_report_${propertyId}`);
    localStorage.removeItem(`hometrust_moveout_report_${propertyId}`);
    localStorage.removeItem(`hometrust_notifications_${propertyId}`);

    const updatedList = properties.filter(
      (p) => p.propertyId !== propertyId && p.id !== propertyId,
    );

    const nextActive = updatedList.length > 0 ? updatedList[0] : null;
    setProperties(updatedList);
    setSelectedProperty(nextActive);

    if (currentUser) {
      const userStorageKey = `hometrust_properties_${currentUser.email || currentUser.id || "default"}`;

      localStorage.setItem(userStorageKey, JSON.stringify(updatedList));
    }
  };

  const handleViewInspectionReport = async () => {
    if (!selectedProperty) {
      alert("Please select a property first.");
      return;
    }
    const propertyId = selectedProperty.propertyId || selectedProperty.id;
    try {
      // A report is Move-In only. Verify any in-memory ID before opening it.
      if (inspectionId) {
        const detailResponse = await api.get(`/inspections/${inspectionId}`);
        const record = unwrapInspection(detailResponse);
        if (
          String(record?.inspectionId || record?.id || "") ===
            String(inspectionId) &&
          (!record?.propertyId ||
            String(record.propertyId) === String(propertyId)) &&
          !isArchivedInspection(record) &&
          isMoveInInspection(record)
        ) {
          setCurrentView("inspection-report");
          return;
        }
        setInspectionId(null);
      }

      const response = await api.get(`/inspections/property/${propertyId}`);
      const inspections =
        response.data?.inspections || response.data?.data?.inspections || [];
      const latestMoveIn = newestInspection(
        inspections.filter(
          (record) =>
            !record.propertyId ||
            String(record.propertyId) === String(propertyId),
        ),
        isMoveInInspection,
      );
      if (!latestMoveIn) {
        alert("No saved Move-In inspection was found for this property.");
        return;
      }
      setInspectionId(latestMoveIn.inspectionId);
      try {
        localStorage.setItem(
          `hometrust_movein_inspection_v1_${propertyId}`,
          String(latestMoveIn.inspectionId),
        );
        localStorage.setItem(
          `hometrust_active_inspection_v1_${propertyId}`,
          String(latestMoveIn.inspectionId),
        );
      } catch (storageError) {
        console.warn("Could not cache Move-In inspection ID:", storageError);
      }
      setCurrentView("inspection-report");
    } catch (error) {
      console.error(
        "Failed to locate the Move-In inspection report:",
        error?.response?.data || error?.message,
      );
      alert("Could not verify the saved Move-In inspection. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {currentView === "landing" && (
        <LandingPage
          onGetStarted={() => setCurrentView("welcome")}
          onLogin={() => setCurrentView("login")}
        />
      )}

      {currentView === "welcome" && (
        <WelcomePage
          onCreateAccount={() => setCurrentView("signup")}
          onSignIn={() => setCurrentView("login")}
          onBack={() => setCurrentView("landing")}
        />
      )}

      {currentView === "signup" && (
        <AuthPage
          onBack={() => setCurrentView("welcome")}
          onSuccess={handleAuthSuccess}
        />
      )}

      {currentView === "login" && (
        <LoginPage
          onAuthSuccess={handleAuthSuccess}
          onBack={() => setCurrentView("welcome")}
          onNavigateToSignUp={() => setCurrentView("signup")}
          onForgotPassword={() => setCurrentView("forgot-password")}
        />
      )}

      {currentView === "forgot-password" && (
        <ForgotPasswordPage
          onBack={() => setCurrentView("login")}
          onNavigateToLogin={() => setCurrentView("login")}
        />
      )}

      {currentView === "admin" && <AdminStatsPage />}

      {currentView === "onboarding" && (
        <PartyOnboardingPage
          token={inviteToken}
          onCompleteOnboarding={async (sessionData) => {
            try {
              const response = await api.get("/properties");

              let cloudProps = response.data?.properties || response.data || [];

              const targetId = sessionData.activePropertyId;

              let targetProp = cloudProps.find(
                (prop) => prop.propertyId === targetId || prop.id === targetId,
              );

              if (!targetProp && targetId) {
                try {
                  const singleRes = await api.get(`/properties/${targetId}`);

                  targetProp = singleRes.data?.property || singleRes.data;

                  if (targetProp) {
                    cloudProps = [targetProp, ...cloudProps];
                  }
                } catch (err) {
                  console.error(
                    "Could not load the invited property's details:",

                    err?.response?.data || err?.message,
                  );
                }
              }

              if (!targetProp) {
                throw new Error(
                  "The invited property could not be loaded. Please try again.",
                );
              }

              if (!targetProp) {
                throw new Error(
                  "The invited property could not be loaded. Please try again.",
                );
              }

              // The actual property has been retrieved. Now activate the session.

              setCurrentUser(sessionData);

              localStorage.setItem(
                "hometrust_current_session",

                JSON.stringify(sessionData),
              );

              setProperties(cloudProps);

              setSelectedProperty(targetProp);

              setInspectionId(sessionData.activeInspectionId || null);

              triggerNotification(
                targetProp.propertyId || targetProp.id,

                "Workspace Joined",

                "You successfully joined the inspection workspace.",

                "invite",
              );
            } catch (err) {
              console.error("Failed to complete onboarding:", err);

              alert(
                "We couldn't load your inspection workspace. Please try again.",
              );

              return;
            }

            setCurrentView("dashboard");
          }}
        />
      )}

      {currentView === "dashboard" && (
        <DashboardPage
          user={currentUser}
          properties={properties}
          activeProperty={selectedProperty}
          onSelectProperty={handleSelectProperty}
          onAddNewProperty={handleAddNewProperty}
          onDeleteProperty={handleDeleteProperty}
          onLogout={handleLogout}
          onStartInspection={(prop) => {
            setSelectedProperty(prop);

            setCurrentView("inspection");
          }}
          onStartMoveOutInspection={(prop) => {
            setSelectedProperty(prop);

            setCurrentView("move-out-inspection");
          }}
          onViewReport={handleViewInspectionReport}
          onViewMoveOutReport={(prop) => {
            if (prop) setSelectedProperty(prop);

            setCurrentView("move-out-report");
          }}
          onViewEvidence={async () => {
            if (!selectedProperty) {
              alert("Please select a property first.");
              return;
            }
            const propertyId =
              selectedProperty.propertyId || selectedProperty.id;
            try {
              let record = null;
              if (inspectionId) {
                const detailResponse = await api.get(
                  `/inspections/${inspectionId}`,
                );
                const candidate = unwrapInspection(detailResponse);
                if (
                  String(candidate?.inspectionId || candidate?.id || "") ===
                    String(inspectionId) &&
                  (!candidate?.propertyId ||
                    String(candidate.propertyId) === String(propertyId)) &&
                  !isArchivedInspection(candidate) &&
                  isMoveInInspection(candidate)
                )
                  record = candidate;
              }
              if (!record) {
                const response = await api.get(
                  `/inspections/property/${propertyId}`,
                );
                const inspections =
                  response.data?.inspections ||
                  response.data?.data?.inspections ||
                  [];
                const candidate = newestInspection(
                  inspections.filter(
                    (item) =>
                      !item.propertyId ||
                      String(item.propertyId) === String(propertyId),
                  ),
                  isMoveInInspection,
                );
                if (candidate) {
                  const detailResponse = await api.get(
                    `/inspections/${candidate.inspectionId}`,
                  );
                  const verified = unwrapInspection(detailResponse);
                  if (
                    String(verified?.inspectionId || verified?.id || "") ===
                      String(candidate.inspectionId) &&
                    (!verified?.propertyId ||
                      String(verified.propertyId) === String(propertyId)) &&
                    !isArchivedInspection(verified) &&
                    isMoveInInspection(verified)
                  )
                    record = verified;
                }
              }
              if (!record?.inspectionId) {
                alert(
                  "No saved Move-In inspection was found for this property. Start a Move-In inspection first.",
                );
                return;
              }
              setInspectionId(record.inspectionId);
              try {
                localStorage.setItem(
                  `hometrust_movein_inspection_v1_${propertyId}`,
                  String(record.inspectionId),
                );
                localStorage.setItem(
                  `hometrust_active_inspection_v1_${propertyId}`,
                  String(record.inspectionId),
                );
              } catch (storageError) {
                console.warn(
                  "Could not cache Move-In inspection ID:",
                  storageError,
                );
              }
              const propertyRooms = Array.isArray(selectedProperty.rooms)
                ? selectedProperty.rooms
                : [];
              const groupedRooms = propertyRooms.map((room) => ({
                ...room,
                roomId: room.roomId || room.id,
                items: (Array.isArray(record.items) ? record.items : [])
                  .filter(
                    (item) =>
                      String(item.roomId) === String(room.roomId || room.id),
                  )
                  .map((item) => ({
                    ...item,
                    id: item.roomItemId || item.itemId || item.id,
                    name: item.itemName || item.name,
                    evidence: item.evidence || [],
                    photos: item.photos || [],
                  })),
              }));
              setSelectedInspectionData(groupedRooms);
              localStorage.setItem(
                `hometrust_inspection_v6_${propertyId}`,
                JSON.stringify(groupedRooms),
              );
              setCurrentView("evidence-review");
            } catch (error) {
              console.error(
                "Failed to open Move-In evidence review:",
                error?.response?.data || error?.message,
              );
              alert(
                "Could not verify or load this property's Move-In inspection. Please try again.",
              );
            }
          }}
          onOpenInviteModal={(prop) => {
            setSelectedProperty(prop || selectedProperty);

            setIsInviteModalOpen(true);

            if (prop || selectedProperty) {
              const pKey =
                (prop || selectedProperty).propertyId ||
                (prop || selectedProperty).id;

              triggerNotification(
                pKey,
                "Participant Invite Sent",
                "An invitation link was generated for this property.",
                "invite",
              );
            }
          }}
          onOpenNotifications={() => setCurrentView("notifications")}
          onOpenProfile={() => setCurrentView("profile")}
        />
      )}

      {currentView === "notifications" && (
        <NotificationsPage
          activeProperty={selectedProperty}
          onBack={() => setCurrentView("dashboard")}
        />
      )}

      {currentView === "profile" && (
        <ProfilePage
          user={currentUser}
          properties={properties}
          onBack={() => setCurrentView("dashboard")}
          onLogout={handleLogout}
          onUpdateProfile={handleProfileUpdate}
        />
      )}

      {currentView === "inspection" && (
        <InspectionPage
          property={selectedProperty}
          userRole={currentUser?.role || "tenant"}
          onBack={() => setCurrentView("dashboard")}
          onCompleteInspection={(data, completedInspectionId) => {
            // Keep the latest inspection data in app state.

            setSelectedInspectionData(data);

            if (completedInspectionId) {
              setInspectionId(completedInspectionId);
              const propertyKey =
                selectedProperty?.propertyId || selectedProperty?.id;

              if (propertyKey) {
                try {
                  localStorage.setItem(
                    `hometrust_active_inspection_v1_${propertyKey}`,

                    String(completedInspectionId),
                  );

                  localStorage.setItem(
                    `hometrust_movein_inspection_v1_${propertyKey}`,
                    String(completedInspectionId),
                  );
                } catch (storageError) {
                  console.warn(
                    "Could not cache active inspection ID:",
                    storageError,
                  );
                }
              }
            }

            if (selectedProperty) {
              const updatedProperty = {
                ...selectedProperty,

                progress: 50,
              };

              const updatedProperties = properties.map((prop) =>
                prop.propertyId === selectedProperty.propertyId ||
                prop.id === selectedProperty.id
                  ? updatedProperty
                  : prop,
              );

              setProperties(updatedProperties);

              setSelectedProperty(updatedProperty);

              triggerNotification(
                selectedPropertyKey,

                "Inspection Walkthrough Completed",

                "The inspection walkthrough was completed.",

                "system",
              );
            }

            setCurrentView("evidence-review");
          }}
        />
      )}

      {currentView === "move-out-inspection" && (
        <MoveOutInspectionPage
          property={selectedProperty}
          userRole={currentUser?.role || "tenant"}
          onBack={() => setCurrentView("dashboard")}
          onCompleteMoveOutInspection={(moveOutData, completedInspectionId) => {
            setMoveOutInspectionData(moveOutData);
            if (completedInspectionId) {
              setMoveOutInspectionId(completedInspectionId);
              const propertyKey =
                selectedProperty?.propertyId || selectedProperty?.id;
              if (propertyKey) {
                try {
                  localStorage.setItem(
                    `hometrust_moveout_inspection_v1_${propertyKey}`,
                    String(completedInspectionId),
                  );
                } catch (storageError) {
                  console.warn(
                    "Could not cache Move-Out inspection ID:",
                    storageError,
                  );
                }
              }
            }
            if (selectedProperty) {
              const updatedProperties = properties.map((prop) =>
                prop.propertyId === selectedProperty.propertyId ||
                prop.id === selectedProperty.id
                 ? { ...prop, moveOutProgress: 50, moveOutStatus: "ACTIVE" }
                  : prop,
              );

              setProperties(updatedProperties);

              setSelectedProperty({
                ...selectedProperty,

                moveOutProgress: 50,

                moveOutStatus: "ACTIVE",
              });

              triggerNotification(
                selectedPropertyKey,

                "Move-Out Walkthrough Completed",

                "Departure condition has been recorded.",

                "system",
              );
            }

            setCurrentView("move-out-evidence");
          }}
        />
      )}

      {currentView === "move-out-evidence" && (
        <MoveOutEvidencePage
          property={selectedProperty}
          inspectionId={moveOutInspectionId}
          onBack={() => setCurrentView("move-out-inspection")}
          onDashboard={() => setCurrentView("dashboard")}
          onSubmitEvidence={async () => {
            const propertyId =
              selectedProperty?.propertyId || selectedProperty?.id;
            try {
              if (!propertyId || !inspectionId || !moveOutInspectionId) {
                alert(
                  "Both the saved Move-In and Move-Out inspection IDs are required for comparison. Please verify both walkthroughs first.",
                );
                return;
              }
              const [moveInResponse, moveOutResponse] = await Promise.all([
                api.get(`/inspections/${inspectionId}`),
                api.get(`/inspections/${moveOutInspectionId}`),
              ]);
              const moveInRecord = unwrapInspection(moveInResponse);
              const moveOutRecord = unwrapInspection(moveOutResponse);
              const validRecord = (record, id) =>
                String(record?.inspectionId || record?.id || "") ===
                  String(id) &&
                (!record?.propertyId ||
                  String(record.propertyId) === String(propertyId)) &&
                !isArchivedInspection(record);
              if (
                !validRecord(moveInRecord, inspectionId) ||
                !isMoveInInspection(moveInRecord)
              ) {
                throw new Error(
                  "The Move-In inspection could not be verified for this property.",
                );
              }
              if (
                !validRecord(moveOutRecord, moveOutInspectionId) ||
                !isMoveOutInspection(moveOutRecord)
              ) {
                throw new Error(
                  "The Move-Out inspection could not be verified for this property.",
                );
              }
              const rooms = Array.isArray(selectedProperty?.rooms)
                ? selectedProperty.rooms
                : [];
              const moveInGroups = groupInspectionItems(moveInRecord, rooms);
              const moveOutGroups = groupInspectionItems(moveOutRecord, rooms);
              setSelectedInspectionData(moveInGroups);
              setMoveOutInspectionData(moveOutGroups);
              try {
                localStorage.setItem(
                  `hometrust_inspection_v6_${propertyId}`,
                  JSON.stringify(moveInGroups),
                );
                localStorage.setItem(
                  `hometrust_moveout_inspection_v6_${propertyId}`,
                  JSON.stringify(moveOutGroups),
                );
              } catch (storageError) {
                console.warn(
                  "Could not cache comparison records:",
                  storageError,
                );
              }
              triggerNotification(
                propertyId,
                "Move-Out Evidence Submitted",
                "Evidence library submitted for review.",
                "system",
              );
              setCurrentView("move-in-out-records");
            } catch (error) {
              console.error(
                "Could not load the saved comparison records:",
                error?.response?.data || error?.message,
              );
              alert(
                error?.message ||
                  "Could not load both inspection records for comparison. Please try again.",
              );
            }
          }}
          onUpdateInspectionData={(updatedData) => {
            setMoveOutInspectionData(updatedData);
          }}
        />
      )}

      {currentView === "move-in-out-records" && (
        <MoveInOutRecordsView
          property={selectedProperty}
          moveInInspectionData={selectedInspectionData}
          moveOutInspectionData={selectedMoveOutData}
          onBack={() => setCurrentView("move-out-evidence")}
          onProceedToSignatures={() => setCurrentView("move-out-signatures")}
        />
      )}

      {currentView === "move-out-signatures" && (
        <MoveOutSignaturesPage
          property={selectedProperty}
          inspectionId={moveOutInspectionId}
          userRole={currentUser?.role || "tenant"}
          initialSignatures={moveOutSignatures}
          onBack={() => setCurrentView("move-in-out-records")}
          onDashboard={() => setCurrentView("dashboard")}
          onSignaturesComplete={(sigs, metadata = {}) => {
            const confirmedInspection = metadata.inspection;
            const confirmedId =
              confirmedInspection?.inspectionId || confirmedInspection?.id;
            const role = String(currentUser?.role || "").toLowerCase();
            const savedCurrentSignature = role.includes("landlord")
              ? confirmedInspection?.landlordSignature
              : role.includes("tenant")
                ? confirmedInspection?.tenantSignature
                : null;
            if (
              !confirmedInspection ||
              !moveOutInspectionId ||
              String(confirmedId || "") !== String(moveOutInspectionId) ||
              !confirmedInspection.propertyId ||
              String(confirmedInspection.propertyId) !==
                String(selectedPropertyKey) ||
              !isMoveOutInspection(confirmedInspection) ||
              !hasSavedSignature(savedCurrentSignature)
            ) {
              console.error(
                "Move-Out signature response could not be verified against the saved backend inspection.",
              );
              alert(
                "The server did not confirm that your signature was saved to this Move-Out inspection. Please reload and try again.",
              );
              return;
            }
            setMoveOutSignatures(sigs);
            const moveOutLocked = confirmedInspection.state === "READ_ONLY";
            setSelectedProperty((previous) =>
              previous
                ? {
                    ...previous,
                    moveOutStatus: moveOutLocked ? "READ_ONLY" : "ACTIVE",
                    moveOutProgress: 100,
                  }
                : previous,
            );
            setProperties((previous) =>
              previous.map((item) =>
                String(item.propertyId || item.id) ===
                String(selectedPropertyKey)
                  ? {
                      ...item,
                      moveOutStatus: moveOutLocked ? "READ_ONLY" : "ACTIVE",
                      moveOutProgress: 100,
                    }
                  : item,
              ),
            );

            triggerNotification(
              selectedPropertyKey,
              moveOutLocked
                ? "Move-Out Report Finalised"
                : "Move-Out Signature Saved",
              moveOutLocked
                ? "Both parties have signed. The Move-Out report is now locked."
                : "Your signature was saved. The Move-Out report is awaiting the other party's signature.",
              "system",
            );

            setCurrentView("move-out-report");
          }}
        />
      )}

      {currentView === "move-out-report" && (
        <MoveOutInspectionReportPage
          key={`${inspectionId || "no-move-in"}-${moveOutInspectionId || "no-move-out"}`}
          property={selectedProperty}
          moveInInspectionId={inspectionId}
          inspectionId={moveOutInspectionId}
          moveInInspectionData={selectedInspectionData}
          moveOutInspectionData={selectedMoveOutData}
          signatures={moveOutSignatures}
          onBack={() => setCurrentView("dashboard")}
          onFinalize={() => setCurrentView("dashboard")}
        />
      )}

      {currentView === "evidence-review" && (
        <EvidenceReviewPage
          property={selectedProperty}
          inspectionId={inspectionId}
          inspectionData={selectedInspectionData}
          user={currentUser}
          userRole={currentUser?.role || "tenant"}
          onBack={() => setCurrentView("inspection")}
          onDashboard={() => setCurrentView("dashboard")}
          onSubmitEvidence={(activeId) => {
            const propertyKey =
              selectedProperty?.propertyId || selectedProperty?.id;

            let cachedInspectionId = null;

            try {
              if (propertyKey) {
                cachedInspectionId = localStorage.getItem(
                  `hometrust_active_inspection_v1_${propertyKey}`,
                );
              }
            } catch (storageError) {
              console.warn(
                "Could not read cached inspection ID:",
                storageError,
              );
            }

            const confirmedInspectionId =
              activeId || inspectionId || cachedInspectionId;

            if (!confirmedInspectionId) {
              alert(
                "The inspection ID is missing. Return to the inspection page, submit the inspection, and try again.",
              );

              setCurrentView("inspection");

              return;
            }

            setInspectionId(confirmedInspectionId);

            if (propertyKey) {
              try {
                localStorage.setItem(
                  `hometrust_active_inspection_v1_${propertyKey}`,

                  String(confirmedInspectionId),
                );
              } catch (storageError) {
                console.warn(
                  "Could not cache active inspection ID:",
                  storageError,
                );
              }
            }

            if (selectedProperty) {
              const propertyKey =
                selectedProperty.propertyId || selectedProperty.id;

              const updatedProperty = {
                ...selectedProperty,

                progress: Math.max(selectedProperty.progress || 0, 75),
              };

              setSelectedProperty(updatedProperty);

              setProperties((prev) =>
                prev.map((prop) =>
                  (prop.propertyId || prop.id) === propertyKey
                    ? updatedProperty
                    : prop,
                ),
              );
            }

            triggerNotification(
              selectedPropertyKey,

              "Evidence Review Submitted",

              "Evidence review was submitted.",

              "system",
            );

            setCurrentView("sign-inspection");
          }}
          onUpdateInspectionData={(updatedData) => {
            setSelectedInspectionData(updatedData);

            const propertyKey =
              selectedProperty?.propertyId || selectedProperty?.id;

            if (propertyKey) {
              localStorage.setItem(
                `hometrust_inspection_v6_${propertyKey}`,

                JSON.stringify(updatedData),
              );
            }
          }}
        />
      )}

      {currentView === "sign-inspection" && (
        <SignInspectionPage
          property={selectedProperty}
          inspectionId={inspectionId}
          userRole={currentUser?.role || "tenant"}
          onBack={() => setCurrentView("evidence-review")}
          onDashboard={() => setCurrentView("dashboard")}
          onSignaturesComplete={(confirmedSignatures, metadata = {}) => {
            const confirmedInspection = metadata?.inspection;
            if (
              !confirmedInspection?.inspectionId ||
              String(confirmedInspection.inspectionId) !==
                String(inspectionId) ||
              String(confirmedInspection.propertyId || "") !==
                String(selectedPropertyKey) ||
              isMoveOutInspection(confirmedInspection) ||
              !hasSavedSignature(
                String(currentUser?.role || "")
                  .toLowerCase()
                  .includes("landlord")
                  ? confirmedInspection.landlordSignature
                  : String(currentUser?.role || "")
                        .toLowerCase()
                        .includes("tenant")
                    ? confirmedInspection.tenantSignature
                    : null,
              )
            ) {
              console.error(
                "Move-In signature could not be verified against the saved backend inspection.",
              );
              alert(
                "The server did not confirm that your signature was saved to this Move-In inspection. Please reload and try again.",
              );
              return;
            }
            const mergedSigs = {
              ...signatures,

              ...confirmedSignatures,
            };

            setSignatures(mergedSigs);
            const backendState = confirmedInspection.state || null;

            if (selectedProperty) {
              const propKey =
                selectedProperty.propertyId || selectedProperty.id;

              const updatedProp = {
                ...selectedProperty,

                signatures: mergedSigs,

                progress:
                  backendState === "READ_ONLY"
                    ? 100
                    : selectedProperty.progress || 0,

                status: backendState || selectedProperty.status,
              };

              setSelectedProperty(updatedProp);

              setProperties((prev) =>
                prev.map((p) =>
                  p.propertyId === propKey || p.id === propKey
                    ? updatedProp
                    : p,
                ),
              );
            }

            setCurrentView("inspection-report");
          }}
        />
      )}

      {currentView === "inspection-report" && (
        <InspectionReportPage
          key={inspectionId || selectedPropertyKey || "inspection-report"}
          property={selectedProperty}
          inspectionId={inspectionId}
          inspectionData={selectedInspectionData}
          signatures={signatures}
          onBack={() => setCurrentView("dashboard")}
          onFinalize={() => setCurrentView("dashboard")}
        />
      )}

      <InvitePartyModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        property={selectedProperty}
        currentUserRole={currentUser?.role || "landlord"}
      />
    </div>
  );
}
