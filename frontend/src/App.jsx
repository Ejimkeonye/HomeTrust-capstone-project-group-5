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
import api from "./api/client"; // Live API client connected to Render backend

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const activeSession = localStorage.getItem("hometrust_current_session");
      return activeSession ? JSON.parse(activeSession) : null;
    } catch (e) {
      console.error(e);
      return null;
    }
  });

  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [inspectionId, setInspectionId] = useState(null);
  
  // 🛠️ Track active property's inspection data securely in state keyed by property ID
  const [inspectionDataState, setInspectionDataState] = useState({ propertyKey: null, data: [] });
  const selectedPropertyKey = selectedProperty?.propertyId || selectedProperty?.id || null;
  const selectedInspectionData = inspectionDataState.propertyKey === selectedPropertyKey
    ? inspectionDataState.data
    : (() => {
        if (!selectedPropertyKey) return [];
        try {
          const saved = localStorage.getItem(`hometrust_inspection_v6_${selectedPropertyKey}`);
          return saved ? JSON.parse(saved) : [];
        } catch (e) {
          console.error(e);
          return [];
        }
      })();
  const setSelectedInspectionData = (data) => {
    setInspectionDataState({ propertyKey: selectedPropertyKey, data });
  };
  const [moveOutInspectionData, setMoveOutInspectionData] = useState({}); 
  const [signatures, setSignatures] = useState({ landlord: null, tenant: null });
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

  // Fetch properties from backend database
  useEffect(() => {
    const fetchCloudProperties = async () => {
      if (!currentUser) {
        setProperties([]);
        setSelectedProperty(null);
        return;
      }

      try {
        const response = await api.get("/properties");
        const cloudProps = response.data?.properties || response.data || [];
        setProperties(cloudProps);
        
        if (cloudProps.length > 0) {
          const targetId = currentUser.activePropertyId;
          const matchedProp = cloudProps.find(p => (p.propertyId === targetId || p.id === targetId)) || cloudProps[0];
          setSelectedProperty(matchedProp);
        }
      } catch (err) {
        console.error("Failed to load properties from backend:", err);
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
    setCurrentUser(null);
    setProperties([]);
    setSelectedProperty(null);
    setCurrentView("login");
  };

  const handleAddNewProperty = (newPropData) => {
    // Ensure new property has a guaranteed unique ID
    const uniqueProp = {
      ...newPropData,
      propertyId: newPropData.propertyId || newPropData.id || `prop-${Date.now()}`,
      id: newPropData.id || newPropData.propertyId || `prop-${Date.now()}`,
    };
    const updatedList = [uniqueProp, ...properties];
    setProperties(updatedList);
    setSelectedProperty(uniqueProp);
    setSelectedInspectionData([]); // Fresh property starts completely blank
  };

  const handleDeleteProperty = async (propertyId) => {
    try {
      await api.delete(`/properties/${propertyId}`);
    } catch (err) {
      console.warn("Backend deletion warning (proceeding with local cleanup):", err?.message);
    }

    // Clean up local storage for this specific property only
    localStorage.removeItem(`hometrust_inspection_v6_${propertyId}`);
    localStorage.removeItem(`hometrust_property_image_${propertyId}`);
    localStorage.removeItem(`hometrust_report_${propertyId}`);

    const updatedList = properties.filter((p) => p.propertyId !== propertyId && p.id !== propertyId);
    const nextActive = updatedList.length > 0 ? updatedList[0] : null;

    setProperties(updatedList);
    setSelectedProperty(nextActive);
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
              const cloudProps = response.data?.properties || response.data || [];
              setProperties(cloudProps);
              
              const targetProp = cloudProps.find(p => p.propertyId === sessionData.activePropertyId || p.id === sessionData.activePropertyId) || cloudProps[0];
              if (targetProp) {
                setSelectedProperty(targetProp);
              }
            } catch (err) {
              console.error("Failed to fetch properties post-onboarding:", err);
            }

            window.history.replaceState({}, document.title, window.location.pathname);
            setCurrentView("dashboard"); 
          }} 
        />
      )}

      {/* Dashboard View */}
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
          onViewEvidence={() => setCurrentView("evidence-review")}
          onOpenInviteModal={(prop) => {
            setSelectedProperty(prop || selectedProperty);
            setIsInviteModalOpen(true);
          }}
          onOpenNotifications={() => setCurrentView("notifications")}
          onOpenProfile={() => setCurrentView("profile")}
        />
      )}

      {currentView === "notifications" && (
        <NotificationsPage onBack={() => setCurrentView("dashboard")} />
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
              const updatedProperties = properties.map((p) =>
                (p.propertyId === selectedProperty.propertyId || p.id === selectedProperty.id) ? updatedProperty : p
              );
              setProperties(updatedProperties);
              setSelectedProperty(updatedProperty);
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
            }
            setCurrentView("move-out-evidence"); 
          }}
        />
      )}

      {currentView === "move-out-evidence" && (
        <MoveOutEvidencePage
          property={selectedProperty}
          inspectionData={moveOutInspectionData}
          onBack={() => setCurrentView("move-out-inspection")}
          onSubmitEvidence={() => setCurrentView("move-in-out-records")} 
        />
      )}

      {currentView === "move-in-out-records" && (
        <MoveInOutRecordsView
          property={selectedProperty}
          moveInInspectionData={selectedInspectionData}
          moveOutInspectionData={moveOutInspectionData}
          onBack={() => setCurrentView("move-out-evidence")}
          onProceedToSignatures={() => setCurrentView("move-out-signatures")}
        />
      )}

      {currentView === "move-out-signatures" && (
        <MoveOutSignaturesPage
          property={selectedProperty}
          initialSignatures={moveOutSignatures}
          onBack={() => setCurrentView("move-in-out-records")}
          onSignaturesComplete={(sigs) => {
            setMoveOutSignatures(sigs);
            setCurrentView("move-out-report");
          }}
        />
      )}

      {currentView === "move-out-report" && (
        <MoveOutInspectionReportPage
          property={selectedProperty}
          moveInInspectionData={selectedInspectionData}
          moveOutInspectionData={moveOutInspectionData}
          signatures={moveOutSignatures}
          onBack={() => setCurrentView("move-out-signatures")}
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
            setCurrentView("sign-inspection");
          }}
          onUpdateInspectionData={(updatedData) => {
            setSelectedInspectionData(updatedData);
          }}
        />
      )}

      {currentView === "sign-inspection" && (
        <SignInspectionPage
          inspectionId={inspectionId}
          initialSignatures={signatures}
          onBack={() => setCurrentView("evidence-review")}
          onSignaturesComplete={(sigs) => {
            setSignatures(sigs);
            if (selectedProperty) {
              const lockedProp = { ...selectedProperty, status: "READ_ONLY" };
              setSelectedProperty(lockedProp);
              const updatedList = properties.map(p => (p.propertyId === lockedProp.propertyId || p.id === lockedProp.id) ? lockedProp : p);
              setProperties(updatedList);
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
          isLocked={true}
          onBack={() => setCurrentView("sign-inspection")}
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