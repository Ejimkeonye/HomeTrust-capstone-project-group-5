import { useState } from "react";
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

  const [inviteToken] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("propertyId") || params.get("token");
  });

  // Properties State (loads from local storage or defaults to an empty array)
  const [properties, setProperties] = useState(() => {
    try {
      const saved = localStorage.getItem("hometrust_properties");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Currently selected property for inspection/reports (defaults to null if list is empty)
  const [selectedProperty, setSelectedProperty] = useState(properties[0] || null);
  
  const [selectedInspectionData, setSelectedInspectionData] = useState({});
  const [moveOutInspectionData, setMoveOutInspectionData] = useState({}); 
  const [signatures, setSignatures] = useState({ landlord: null, tenant: null });
  const [moveOutSignatures, setMoveOutSignatures] = useState({ landlord: null, tenant: null });
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const [currentView, setCurrentView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("propertyId") || params.get("token");
    if (token || window.location.pathname.includes("/join")) return "onboarding";
    const activeSession = localStorage.getItem("hometrust_current_session");
    return activeSession ? "dashboard" : "landing";
  });

  const handleAuthSuccess = (userData) => {
    setCurrentUser(userData);
    localStorage.setItem("hometrust_current_session", JSON.stringify(userData));
    setCurrentView("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("hometrust_current_session");
    setCurrentUser(null);
    setCurrentView("login");
  };

  // Add a brand new property to the portfolio
  const handleAddNewProperty = (newPropData) => {
    const defaultImage = "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=400&q=80";
    const newProperty = {
      id: `prop-${Date.now()}`,
      createdById: currentUser?.id,
      name: newPropData.address || "New Property",
      address: newPropData.address,
      flatNo: newPropData.flatNo || "1",
      image: newPropData.image || defaultImage,
      progress: 0,
      rooms: [
        { name: "Living Room", category: "Rooms", items: [] },
        { name: "Master Bedroom", category: "Rooms", items: [] },
      ],
      ...newPropData,
    };

    const updatedList = [newProperty, ...properties];
    setProperties(updatedList);
    localStorage.setItem("hometrust_properties", JSON.stringify(updatedList));
    setSelectedProperty(newProperty);
  };

  // Delete a property from state, local storage, and handle active selection fallback
  const handleDeleteProperty = (propertyId) => {
    const updatedList = properties.filter((p) => p.id !== propertyId);
    
    // If all are deleted, active property becomes null
    const nextList = updatedList.length > 0 ? updatedList : [];
    const nextActive = selectedProperty?.id === propertyId ? (nextList[0] || null) : selectedProperty;

    setProperties(nextList);
    setSelectedProperty(nextActive);
    localStorage.setItem("hometrust_properties", JSON.stringify(nextList));
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
        <PartyOnboardingPage token={inviteToken} onCompleteOnboarding={(user) => { setCurrentUser(user); setCurrentView("dashboard"); }} />
      )}

      {/* Dashboard View with Multi-Property Support */}
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
        const updatedProperty = {
          ...selectedProperty,
          progress: 100,
          status: "READ_ONLY",
        };
        const updatedProperties = properties.map((p) =>
          p.id === selectedProperty.id ? updatedProperty : p
        );
        setProperties(updatedProperties);
        localStorage.setItem("hometrust_properties", JSON.stringify(updatedProperties));
        setSelectedProperty(updatedProperty);
      }
            setCurrentView("evidence-review");
          }}
        />
      )}

      {/* Move-Out Inspection Route */}
      {currentView === "move-out-inspection" && (
        <MoveOutInspectionPage
          property={selectedProperty}
          userRole={currentUser?.role || "tenant"}
          onBack={() => setCurrentView("dashboard")}
          onCompleteMoveOutInspection={(moveOutData) => {
            setMoveOutInspectionData(moveOutData);
            if (selectedProperty) {
        const updatedProperties = properties.map((prop) =>
          prop.id === selectedProperty.id
            ? { ...prop, moveOutProgress: 100 }
            : prop
        );
        setProperties(updatedProperties);
        localStorage.setItem("hometrust_properties", JSON.stringify(updatedProperties));
        setSelectedProperty({ ...selectedProperty, moveOutProgress: 100 });
      }
            setCurrentView("move-out-evidence"); 
          }}
        />
      )}

      {/* Move-Out Evidence Library Route */}
      {currentView === "move-out-evidence" && (
        <MoveOutEvidencePage
          property={selectedProperty}
          inspectionData={moveOutInspectionData}
          onBack={() => setCurrentView("move-out-inspection")}
          onSubmitEvidence={() => setCurrentView("move-in-out-records")} 
        />
      )}

      {/* Combined Move-In & Move-Out Side-by-Side View Route */}
      {currentView === "move-in-out-records" && (
        <MoveInOutRecordsView
          property={selectedProperty}
          moveInInspectionData={selectedInspectionData}
          moveOutInspectionData={moveOutInspectionData}
          onBack={() => setCurrentView("move-out-evidence")}
          onProceedToSignatures={() => setCurrentView("move-out-signatures")}
        />
      )}

      {/* Move-Out Signatures Route */}
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

      {/* Move-Out Final Inspection Report Route */}
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
          onSubmitEvidence={() => setCurrentView("sign-inspection")}
        />
      )}

      {currentView === "sign-inspection" && (
        <SignInspectionPage
          initialSignatures={signatures}
          onBack={() => setCurrentView("move-in-out-records")}
          onSignaturesComplete={(sigs) => {
            setSignatures(sigs);
            setCurrentView("inspection-report");
          }}
        />
      )}

      {currentView === "inspection-report" && (
        <InspectionReportPage
          property={selectedProperty}
          inspectionData={moveOutInspectionData}
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