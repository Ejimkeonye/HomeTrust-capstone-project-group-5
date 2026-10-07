import { useState } from "react";
import LandingPage from "./pages/LandingPage";
import WelcomePage from "./pages/WelcomePage";
import AuthPage from "./pages/AuthPage";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import DashboardPage from "./pages/DashboardPage";
import PartyOnboardingPage from "./pages/PartyOnboardingPage";
import InspectionPage from "./pages/InspectionPage";
import InvitePartyModal from "./components/InvitePartyModal";
import InspectionReportPage from "./pages/InspectionReportPage";
import SignInspectionPage from "./pages/SignInspectionPage";
import EvidenceReviewPage from "./pages/EvidenceReviewPage";

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
  const [signatures, setSignatures] = useState({ landlord: null, tenant: null });
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
            setCurrentView("evidence-review");
          }}
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
          onBack={() => setCurrentView("evidence-review")}
          onSignaturesComplete={(sigs) => {
            setSignatures(sigs);
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