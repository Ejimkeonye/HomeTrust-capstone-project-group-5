import { useState, useEffect } from "react";
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

  const selectedPropertyKey = selectedProperty?.propertyId || selectedProperty?.id || null;

  // 🛠️ PROPERTY-KEYED SIGNATURE PERSISTENCE
  const [signatureState, setSignatureState] = useState({ propertyKey: null, data: null });
  const signatures = signatureState.propertyKey === selectedPropertyKey && signatureState.data
    ? signatureState.data
    : (() => {
        if (!selectedPropertyKey) return { landlord: null, tenant: null };
        try {
          const saved = localStorage.getItem(`hometrust_signatures_${selectedPropertyKey}`);
          return saved ? JSON.parse(saved) : selectedProperty?.signatures || { landlord: null, tenant: null };
        } catch {
          return { landlord: null, tenant: null };
        }
      })();

  const setSignatures = (newSigs) => {
    const updated = typeof newSigs === "function" ? newSigs(signatures) : newSigs;
    setSignatureState({ propertyKey: selectedPropertyKey, data: updated });
    if (selectedPropertyKey) {
      localStorage.setItem(`hometrust_signatures_${selectedPropertyKey}`, JSON.stringify(updated));
    }
  };

  // 🛠️ MULTI-TAB LIVE SYNC LISTENER
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (selectedPropertyKey && e.key === `hometrust_signatures_${selectedPropertyKey}`) {
        if (e.newValue) {
          setSignatureState({ propertyKey: selectedPropertyKey, data: JSON.parse(e.newValue) });
        }
      }
      if (e.key === "hometrust_current_session") {
        if (e.newValue) {
          setCurrentUser(JSON.parse(e.newValue));
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [selectedPropertyKey]);

  // Track active property's inspection data securely in state
  const [inspectionDataState, setInspectionDataState] = useState({ propertyKey: null, data: [] });
  const selectedInspectionData = inspectionDataState.propertyKey === selectedPropertyKey
    ? inspectionDataState.data
    : (() => {
        if (!selectedPropertyKey) return [];
        try {
          const saved = localStorage.getItem(`hometrust_inspection_v6_${selectedPropertyKey}`);
          return saved ? JSON.parse(saved) : [];
        } catch {
          return [];
        }
      })();
  const setSelectedInspectionData = (data) => {
    setInspectionDataState({ propertyKey: selectedPropertyKey, data });
  };

  // Move-Out inspection data scoped safely by property key
  const [moveOutDataState, setMoveOutDataState] = useState({ propertyKey: null, data: [] });
  const selectedMoveOutData = moveOutDataState.propertyKey === selectedPropertyKey
    ? moveOutDataState.data
    : (() => {
        if (!selectedPropertyKey) return [];
        try {
          const saved = localStorage.getItem(`hometrust_moveout_inspection_v6_${selectedPropertyKey}`);
          if (saved) return JSON.parse(saved);
          
          const savedReport = localStorage.getItem(`hometrust_moveout_report_${selectedPropertyKey}`);
          if (savedReport) {
            const parsed = JSON.parse(savedReport);
            if (parsed.moveOutInspectionData) return parsed.moveOutInspectionData;
          }
        } catch {
          // ignore
        }
        return [];
      })();
  const setMoveOutInspectionData = (data) => {
    setMoveOutDataState({ propertyKey: selectedPropertyKey, data });
  };

  const [moveOutSignatures, setMoveOutSignatures] = useState({ landlord: null, tenant: null });
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const [inviteToken] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("token") || params.get("propertyId");
  });

  const [currentView, setCurrentView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") || params.get("propertyId");
    if (token || window.location.pathname.includes("/join") || window.location.pathname.includes("/invite")) {
      return "onboarding";
    }
    const activeSession = localStorage.getItem("hometrust_current_session");
    return activeSession ? "dashboard" : "landing";
  });

  // Fetch properties from backend database with User-Scoped Isolation
  useEffect(() => {
    const fetchCloudProperties = async () => {
      if (!currentUser) {
        setProperties([]);
        setSelectedProperty(null);
        return;
      }

      const userStorageKey = `hometrust_properties_${currentUser.email || currentUser.id || 'default'}`;

      try {
        const response = await api.get("/properties");
        let cloudProps = response.data?.properties || response.data || [];
        
        const targetId = currentUser.activePropertyId;

        if (targetId && !cloudProps.some(p => p.propertyId === targetId || p.id === targetId)) {
          try {
            const singleRes = await api.get(`/properties/${targetId}`);
            const singleProp = singleRes.data?.property || singleRes.data;
            if (singleProp) {
              cloudProps = [singleProp, ...cloudProps];
            }
          } catch (err) {
            console.warn("Direct property fetch fallback:", err);
            if (!cloudProps.some(p => p.propertyId === targetId)) {
              const fallbackProp = {
                propertyId: targetId,
                id: targetId,
                address: currentUser.isInvitedParticipant ? "Shared Inspection Workspace" : "Primary Property Unit",
                flatNo: "1",
                type: "Apartment",
              };
              cloudProps = [fallbackProp, ...cloudProps];
            }
          }
        }

        setProperties(cloudProps);
        localStorage.setItem(userStorageKey, JSON.stringify(cloudProps));

        if (cloudProps.length > 0) {
          const matchedProp = cloudProps.find(p => (p.propertyId === targetId || p.id === targetId)) || cloudProps[0];
          
          const propKey = matchedProp.propertyId || matchedProp.id;
          const savedSigs = localStorage.getItem(`hometrust_signatures_${propKey}`);
          const mergedProp = {
            ...matchedProp,
            signatures: savedSigs ? JSON.parse(savedSigs) : matchedProp.signatures || { landlord: null, tenant: null },
            status: savedSigs && JSON.parse(savedSigs).landlord && JSON.parse(savedSigs).tenant ? "READ_ONLY" : matchedProp.status
          };

          setSelectedProperty(mergedProp);
        }
      } catch (err) {
        console.error("Failed to load properties from backend:", err);
        try {
          const localSaved = localStorage.getItem(userStorageKey);
          if (localSaved) {
            const parsed = JSON.parse(localSaved);
            setProperties(parsed);
            if (parsed.length > 0) setSelectedProperty(parsed[0]);
          }
        } catch (e) {
          console.error(e);
        }
      }
    };

    fetchCloudProperties();
  }, [currentUser]);

  const handleAuthSuccess = (userData) => {
    setCurrentUser(userData);
    localStorage.setItem("hometrust_current_session", JSON.stringify(userData));
    setCurrentView("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("hometrust_current_session");
    localStorage.removeItem("hometrust_token");
    setCurrentUser(null);
    setProperties([]);
    setSelectedProperty(null);
    setCurrentView("login");
  };

  const handleAddNewProperty = (newPropData) => {
    const uniqueProp = {
      ...newPropData,
      propertyId: newPropData.propertyId || newPropData.id || `prop-${Date.now()}`,
      id: newPropData.id || newPropData.propertyId || `prop-${Date.now()}`,
    };
    const updatedList = [uniqueProp, ...properties];
    setProperties(updatedList);
    setSelectedProperty(uniqueProp);
    setSelectedInspectionData([]);
    setMoveOutInspectionData([]);

    if (currentUser) {
      const userStorageKey = `hometrust_properties_${currentUser.email || currentUser.id || 'default'}`;
      localStorage.setItem(userStorageKey, JSON.stringify(updatedList));
    }

    const propKey = uniqueProp.propertyId || uniqueProp.id;
    triggerNotification(propKey, "New Property Added", `Successfully registered ${uniqueProp.address}.`, "system");
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
    localStorage.removeItem(`hometrust_signatures_${propertyId}`);
    localStorage.removeItem(`hometrust_report_${propertyId}`);
    localStorage.removeItem(`hometrust_moveout_report_${propertyId}`);
    localStorage.removeItem(`hometrust_notifications_${propertyId}`);

    const updatedList = properties.filter((p) => p.propertyId !== propertyId && p.id !== propertyId);
    const nextActive = updatedList.length > 0 ? updatedList[0] : null;

    setProperties(updatedList);
    setSelectedProperty(nextActive);

    if (currentUser) {
      const userStorageKey = `hometrust_properties_${currentUser.email || currentUser.id || 'default'}`;
      localStorage.setItem(userStorageKey, JSON.stringify(updatedList));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {currentView === "landing" && (
        <LandingPage onGetStarted={() => setCurrentView("welcome")} onLogin={() => setCurrentView("login")} />
      )}
      {currentView === "welcome" && (
        <WelcomePage 
          onCreateAccount={() => setCurrentView("signup")} 
          onSignIn={() => setCurrentView("login")} 
          onBack={() => setCurrentView("landing")} 
        />
      )}
      {currentView === "signup" && (
        <AuthPage onBack={() => setCurrentView("welcome")} onSuccess={handleAuthSuccess} />
      )}
      {currentView === "login" && (
        <LoginPage onAuthSuccess={handleAuthSuccess} onBack={() => setCurrentView("welcome")} onNavigateToSignUp={() => setCurrentView("signup")} onForgotPassword={() => setCurrentView("forgot-password")} />
      )}
      {currentView === "forgot-password" && (
        <ForgotPasswordPage onBack={() => setCurrentView("login")} onNavigateToLogin={() => setCurrentView("login")} />
      )}
      
      {currentView === "onboarding" && (
        <PartyOnboardingPage 
          token={inviteToken} 
          onCompleteOnboarding={async (sessionData) => { 
            setCurrentUser(sessionData);
            localStorage.setItem("hometrust_current_session", JSON.stringify(sessionData));
            
            try {
              const response = await api.get("/properties");
              let cloudProps = response.data?.properties || response.data || [];
              
              const targetId = sessionData.activePropertyId;
              let targetProp = cloudProps.find(prop => prop.propertyId === targetId || prop.id === targetId);

              if (!targetProp && targetId) {
                try {
                  const singleRes = await api.get(`/properties/${targetId}`);
                  targetProp = singleRes.data?.property || singleRes.data;
                  if (targetProp) cloudProps = [targetProp, ...cloudProps];
                } catch (err) {
                  console.warn("Direct property fetch fallback during onboarding:", err);
                  targetProp = {
                    propertyId: targetId,
                    id: targetId,
                    address: "Shared Inspection Workspace",
                    flatNo: "1",
                    type: "Apartment",
                  };
                  cloudProps = [targetProp, ...cloudProps];
                }
              }

              setProperties(cloudProps);
              if (targetProp) {
                setSelectedProperty(targetProp);
                triggerNotification(targetProp.propertyId || targetProp.id, "Workspace Joined", "You successfully joined the inspection workspace.", "invite");
              }
            } catch (err) {
              console.error("Failed to fetch properties post-onboarding:", err);
            }

            window.history.replaceState({}, document.title, window.location.pathname);
            setCurrentView("dashboard"); 
          }} 
        />
      )}

      {currentView === "dashboard" && (
        <DashboardPage
          user={currentUser}
          properties={properties}
          activeProperty={selectedProperty}
          onSelectProperty={(prop) => setSelectedProperty(prop)}
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
          onViewReport={() => setCurrentView("inspection-report")}
          onViewMoveOutReport={(prop) => {
            if (prop) setSelectedProperty(prop);
            setCurrentView("move-out-report");
          }}
          onViewEvidence={() => setCurrentView("evidence-review")}
          onOpenInviteModal={(prop) => {
            setSelectedProperty(prop || selectedProperty);
            setIsInviteModalOpen(true);
            if (prop || selectedProperty) {
              const pKey = (prop || selectedProperty).propertyId || (prop || selectedProperty).id;
              triggerNotification(pKey, "Participant Invite Sent", "An invitation link was generated for this property.", "invite");
            }
          }}
          onOpenNotifications={() => setCurrentView("notifications")}
          onOpenProfile={() => setCurrentView("profile")}
        />
      )}

      {currentView === "notifications" && (
        <NotificationsPage activeProperty={selectedProperty} onBack={() => setCurrentView("dashboard")} />
      )}

      {currentView === "profile" && (
        <ProfilePage 
          user={currentUser} 
          onBack={() => setCurrentView("dashboard")} 
          onLogout={handleLogout} 
        />
      )}

      {currentView === "inspection" && (
        <InspectionPage
          property={selectedProperty}
          userRole={currentUser?.role || "tenant"}
          onBack={() => setCurrentView("dashboard")}
          onCompleteInspection={(data) => {
            setSelectedInspectionData(data);
            if (selectedProperty) {
              const updatedProperty = { ...selectedProperty, progress: 100 };
              const updatedProperties = properties.map((prop) =>
                (prop.propertyId === selectedProperty.propertyId || prop.id === selectedProperty.id) ? updatedProperty : prop
              );
              setProperties(updatedProperties);
              setSelectedProperty(updatedProperty);
              triggerNotification(selectedPropertyKey, "Inspection Walkthrough Completed", "All room items have been inspected and logged.", "system");
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
                (prop.propertyId === selectedProperty.propertyId || prop.id === selectedProperty.id)
                  ? { ...prop, moveOutProgress: 100, moveOutStatus: "ACTIVE" }
                  : prop
              );
              setProperties(updatedProperties);
              setSelectedProperty({ ...selectedProperty, moveOutProgress: 100, moveOutStatus: "ACTIVE" });
              triggerNotification(selectedPropertyKey, "Move-Out Walkthrough Completed", "Departure condition has been recorded.", "system");
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
            triggerNotification(selectedPropertyKey, "Move-Out Evidence Submitted", "Evidence library submitted for review.", "system");
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
            triggerNotification(selectedPropertyKey, "Move-Out Signed", "Departure signatures recorded.", "invite");
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
          inspectionData={selectedInspectionData}
          onBack={() => setCurrentView("inspection")}
          onSubmitEvidence={(activeId) => {
            if (activeId) setInspectionId(activeId);
            triggerNotification(selectedPropertyKey, "Evidence Review Submitted", "Evidence uploaded and sent for acknowledgment.", "system");
            setCurrentView("sign-inspection");
          }}
          onUpdateInspectionData={(updatedData) => {
            setSelectedInspectionData(updatedData);
            triggerNotification(selectedPropertyKey, "New Evidence Added", "A new room or item evidence was added.", "system");
          }}
        />
      )}

      {currentView === "sign-inspection" && (
        <SignInspectionPage
          inspectionId={inspectionId}
          userRole={currentUser?.role || "tenant"}
          initialSignatures={signatures}
          onBack={() => setCurrentView("evidence-review")}
          onSignaturesComplete={(newSigs) => {
            const mergedSigs = {
              ...signatures,
              ...newSigs,
            };

            setSignatures(mergedSigs);

            if (selectedProperty) {
              const propKey = selectedProperty.propertyId || selectedProperty.id;
              const isBothSigned = Boolean(mergedSigs.landlord && mergedSigs.tenant);

              const updatedProp = {
                ...selectedProperty,
                signatures: mergedSigs,
                status: isBothSigned ? "READ_ONLY" : selectedProperty.status || "ACTIVE",
              };

              setSelectedProperty(updatedProp);
              setProperties(prev => prev.map(p => (p.propertyId === propKey || p.id === propKey) ? updatedProp : p));

              triggerNotification(propKey, "Signature Logged", `${currentUser?.role || "Party"} signed the inspection report.`, "invite");

              if (isBothSigned) {
                triggerNotification(propKey, "Inspection Sealed", "Both parties have signed. Move-out compartment is now unlocked.", "system");
              }
            }

            setCurrentView("inspection-report");
          }}
        />
      )}

      {currentView === "inspection-report" && (
        <InspectionReportPage
          property={selectedProperty}
          inspectionData={selectedInspectionData}
          signatures={signatures}
          isLocked={Boolean(signatures.landlord && signatures.tenant)}
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