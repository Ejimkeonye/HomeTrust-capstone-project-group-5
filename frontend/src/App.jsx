import { useState, useEffect } from "react";

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



  const handleSelectProperty = (prop) => {

    const nextKey = prop?.propertyId || prop?.id;

    const currentKey = selectedProperty?.propertyId || selectedProperty?.id;



    if (nextKey !== currentKey) {

      setInspectionId(null);

      setSelectedInspectionData([]);

    }



    setSelectedProperty(prop);

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
          signatures: matchedProp.signatures || { landlord: null, tenant: null },
        };

        setSelectedProperty(mergedProp);



        // Restore the real inspection for this property after refresh.
        // React state is memory-only, so it must not be the only source of the ID.
        const inspectionCacheKey = `hometrust_active_inspection_v1_${propKey}`;
        let restoredInspectionId = null;
        let cachedInspectionId = null;

        try {
          cachedInspectionId =
            localStorage.getItem(inspectionCacheKey) ||
            currentUser.activeInspectionId ||
            null;
        } catch (storageError) {
          console.warn("Could not read cached inspection ID:", storageError);
          cachedInspectionId = currentUser.activeInspectionId || null;
        }

        // Verify a cached ID against the backend before using it.
        if (cachedInspectionId) {
          try {
            const detailResponse = await api.get(
              `/inspections/${cachedInspectionId}`,
            );
            if (cancelled) return;

            const cachedInspection =
              detailResponse.data?.inspection ||
              detailResponse.data?.data?.inspection ||
              detailResponse.data?.data ||
              detailResponse.data;

            const returnedInspectionId = cachedInspection?.inspectionId;
            const returnedPropertyId = cachedInspection?.propertyId;

            if (
              returnedInspectionId &&
              String(returnedInspectionId) === String(cachedInspectionId) &&
              (!returnedPropertyId || String(returnedPropertyId) === String(propKey)) &&
              cachedInspection.status !== "ARCHIVED"
            ) {
              restoredInspectionId = returnedInspectionId;
            }
          } catch (cacheLookupError) {
            console.warn(
              "Cached inspection could not be verified; looking up this property's inspection:",
              cacheLookupError?.response?.data || cacheLookupError?.message,
            );
          }
        }

        // If storage was cleared or the cached ID is stale, ask the backend
        // for an existing inspection belonging to this property.
        if (!restoredInspectionId) {
          try {
            const listResponse = await api.get(
              `/inspections/property/${propKey}`,
            );
            if (cancelled) return;

            const inspections =
              listResponse.data?.inspections ||
              listResponse.data?.data?.inspections ||
              [];

            const existingInspections = inspections
              .filter(
                (inspection) =>
                  inspection?.inspectionId &&
                  inspection.status !== "ARCHIVED" &&
                  (!inspection.propertyId ||
                    String(inspection.propertyId) === String(propKey)),
              )
              .sort((a, b) => {
                const dateA = Date.parse(a.updatedAt || a.createdAt || 0) || 0;
                const dateB = Date.parse(b.updatedAt || b.createdAt || 0) || 0;
                return dateB - dateA;
              });

            restoredInspectionId = existingInspections[0]?.inspectionId || null;
          } catch (lookupError) {
            console.warn(
              "Could not restore an inspection for this property:",
              lookupError?.response?.data || lookupError?.message,
            );
          }
        }

        if (cancelled) return;
        setInspectionId(restoredInspectionId);

        try {
          if (restoredInspectionId) {
            localStorage.setItem(inspectionCacheKey, String(restoredInspectionId));
          } else {
            localStorage.removeItem(inspectionCacheKey);
          }
        } catch (storageError) {
          console.warn("Could not update cached inspection ID:", storageError);
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



  const handleProfileUpdate = (updates) => {

    if (!currentUser) return;



    const updatedUser = {

      ...currentUser,

      ...updates,

    };



    setCurrentUser(updatedUser);



    localStorage.setItem(

      "hometrust_current_session",

      JSON.stringify(updatedUser),

    );



    // Keep the separate user record in sync if it exists.

    const savedUser = localStorage.getItem("user");



    if (savedUser) {

      try {

        localStorage.setItem(

          "user",

          JSON.stringify({

            ...JSON.parse(savedUser),

            ...updates,

          }),

        );

      } catch {

        // The current session remains the source of truth.

      }

    }

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

    const uniqueProp = {

      ...newPropData,

      propertyId:

        newPropData.propertyId || newPropData.id || `prop-${Date.now()}`,

      id: newPropData.id || newPropData.propertyId || `prop-${Date.now()}`,

    };

    const updatedList = [uniqueProp, ...properties];

    setProperties(updatedList);

    setSelectedProperty(uniqueProp);

    setSelectedInspectionData([]);

    setMoveOutInspectionData([]);



    if (currentUser) {

      const userStorageKey = `hometrust_properties_${currentUser.email || currentUser.id || "default"}`;

      localStorage.setItem(userStorageKey, JSON.stringify(updatedList));

    }



    const propKey = uniqueProp.propertyId || uniqueProp.id;

    triggerNotification(

      propKey,

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



    // Reuse the inspection already associated with this workspace.

    const activeInspectionId = inspectionId || currentUser?.activeInspectionId;



    if (activeInspectionId) {

      if (activeInspectionId !== inspectionId) {

        setInspectionId(activeInspectionId);

      }



      setCurrentView("inspection-report");

      return;

    }



    // If there is no known ID, find the property's saved inspection.

    const propertyId = selectedProperty.propertyId || selectedProperty.id;



    try {

      const response = await api.get(`/inspections/property/${propertyId}`);



      const inspections =

        response.data?.inspections || response.data?.data?.inspections || [];



      if (!Array.isArray(inspections) || inspections.length === 0) {

        alert("No saved inspection was found for this property.");

        return;

      }



      // Prefer an inspection that is not archived, then the newest.

      const candidates = inspections

        .filter(

          (item) =>

            item.inspectionId &&

            item.state !== "ARCHIVED" &&

            item.status !== "ARCHIVED",

        )

        .sort(

          (a, b) =>

            new Date(b.updatedAt || b.createdAt || 0).getTime() -

            new Date(a.updatedAt || a.createdAt || 0).getTime(),

        );



      const latestInspection = candidates[0];



      if (!latestInspection) {

        alert("No active inspection was found for this property.");

        return;

      }



      setInspectionId(latestInspection.inspectionId);

      setCurrentView("inspection-report");

    } catch (error) {

      console.error(

        "Failed to locate the inspection report:",

        error?.response?.data || error?.message,

      );



      alert("Could not locate the saved inspection. Please try again.");

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

              // Reuse the known inspection ID when it belongs to the active property.

              if (inspectionId) {

                setCurrentView("evidence-review");

                return;

              }



              // Look for an existing inspection belonging to this property.

              const response = await api.get(

                `/inspections/property/${propertyId}`,

              );



              const inspections =

                response.data?.inspections ||

                response.data?.data?.inspections ||

                [];



              const existingInspection = inspections.find(

                (inspection) =>

                  inspection.inspectionId && inspection.status !== "ARCHIVED",

              );



              if (existingInspection) {

                setInspectionId(existingInspection.inspectionId);



                // Load the full inspection, including its items and evidence.

                const detailResponse = await api.get(

                  `/inspections/${existingInspection.inspectionId}`,

                );



                const inspection =

                  detailResponse.data?.inspection ||

                  detailResponse.data?.data?.inspection ||

                  detailResponse.data;



                if (Array.isArray(inspection?.items)) {

                  const propertyRooms = Array.isArray(selectedProperty.rooms)

                    ? selectedProperty.rooms

                    : [];



                  const groupedRooms = propertyRooms.map((room) => ({

                    ...room,

                    roomId: room.roomId || room.id,

                    items: inspection.items

                      .filter(

                        (item) => item.roomId === (room.roomId || room.id),

                      )

                      .map((item) => ({

                        ...item,

                        id: item.roomItemId || item.itemId,

                        name: item.name || item.itemName,

                        evidence: item.evidence || [],

                      })),

                  }));



                  setSelectedInspectionData(groupedRooms);



                  localStorage.setItem(

                    `hometrust_inspection_v6_${propertyId}`,

                    JSON.stringify(groupedRooms),

                  );

                }



                setCurrentView("evidence-review");

              } else {

                alert(

                  "No existing inspection was found for this property. Start an inspection first.",

                );

              }

            } catch (error) {

              console.error("Failed to open evidence review:", error);

              alert(

                "Could not load this property's inspection. Please try again.",

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

              const propertyKey = selectedProperty?.propertyId || selectedProperty?.id;
              if (propertyKey) {
                try {
                  localStorage.setItem(
                    `hometrust_active_inspection_v1_${propertyKey}`,
                    String(completedInspectionId),
                  );
                } catch (storageError) {
                  console.warn("Could not cache active inspection ID:", storageError);
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

          onCompleteMoveOutInspection={(moveOutData) => {

            setMoveOutInspectionData(moveOutData);

            if (selectedProperty) {

              const updatedProperties = properties.map((prop) =>

                prop.propertyId === selectedProperty.propertyId ||

                prop.id === selectedProperty.id

                  ? { ...prop, moveOutProgress: 100, moveOutStatus: "ACTIVE" }

                  : prop,

              );

              setProperties(updatedProperties);

              setSelectedProperty({

                ...selectedProperty,

                moveOutProgress: 100,

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

          inspectionData={selectedMoveOutData}

          onBack={() => setCurrentView("move-out-inspection")}

          onSubmitEvidence={() => {

            triggerNotification(

              selectedPropertyKey,

              "Move-Out Evidence Submitted",

              "Evidence library submitted for review.",

              "system",

            );

            setCurrentView("move-in-out-records");

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

          userRole={currentUser?.role || "tenant"}

          initialSignatures={moveOutSignatures}

          onBack={() => setCurrentView("move-in-out-records")}

          onSignaturesComplete={(sigs) => {

            setMoveOutSignatures(sigs);

            triggerNotification(

              selectedPropertyKey,

              "Move-Out Signed",

              "Departure signatures recorded.",

              "invite",

            );

            setCurrentView("move-out-report");

          }}

        />

      )}



      {currentView === "move-out-report" && (

        <MoveOutInspectionReportPage

          property={selectedProperty}

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

          onSubmitEvidence={(activeId) => {

            const propertyKey = selectedProperty?.propertyId || selectedProperty?.id;
            let cachedInspectionId = null;
            try {
              if (propertyKey) {
                cachedInspectionId = localStorage.getItem(
                  `hometrust_active_inspection_v1_${propertyKey}`,
                );
              }
            } catch (storageError) {
              console.warn("Could not read cached inspection ID:", storageError);
            }

            const confirmedInspectionId = activeId || inspectionId || cachedInspectionId;

            if (!confirmedInspectionId) {
              alert(
                "The inspection ID is missing. Return to the inspection page, submit the inspection, and try again."
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
                console.warn("Could not cache active inspection ID:", storageError);
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

          onSignaturesComplete={(confirmedSignatures, metadata = {}) => {

            const mergedSigs = {

              ...signatures,

              ...confirmedSignatures,

            };



            setSignatures(mergedSigs);



            const backendState =
              metadata.state || metadata.inspection?.state || null;



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
