import { useState } from 'react';
import LandingPage from './pages/LandingPage';
import WelcomePage from './pages/WelcomePage';
import AuthPage from './pages/AuthPage';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import DashboardPage from './pages/DashboardPage';
import PartyOnboardingPage from './pages/PartyOnboardingPage';
import InspectionPage from './pages/InspectionPage';
import InvitePartyModal from './components/InvitePartyModal';
import InspectionReportPage from './pages/InspectionReportPage';
import SignatureCanvas from './components/SignatureCanvas'; // <-- 1. Import your signature component (adjust path if needed)

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const activeSession = localStorage.getItem('hometrust_current_session');
      return activeSession ? JSON.parse(activeSession) : null;
    } catch (e) {
      console.error(e);
      return null;
    }
  });

  const [inviteToken] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('propertyId') || params.get('token');
  });

  const defaultProperty = {
    id: "demo-1",
    name: "No 2, sunshine estate, Ikeja city, Lagos",
    address: "No 2, sunshine estate, Ikeja city, Lagos",
    flatNo: "2",
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=400&q=80",
    progress: 80,
  };

  const [selectedProperty, setSelectedProperty] = useState(defaultProperty);
  const [selectedInspectionData, setSelectedInspectionData] = useState({}); 
  const [signatures, setSignatures] = useState({ landlord: null, tenant: null }); // <-- Track signatures here
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const [currentView, setCurrentView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('propertyId') || params.get('token');

    if (token || window.location.pathname.includes('/join')) {
      return 'onboarding';
    }

    const activeSession = localStorage.getItem('hometrust_current_session');
    return activeSession ? 'dashboard' : 'landing';
  });

  const handleAuthSuccess = (userData) => {
    setCurrentUser(userData);
    localStorage.setItem('hometrust_current_session', JSON.stringify(userData));
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('hometrust_token');
    localStorage.removeItem('hometrust_user');
    localStorage.removeItem('hometrust_current_session');
    setCurrentUser(null);
    setCurrentView('login');
  };

  const handleOnboardingComplete = (sessionUser) => {
    setCurrentUser(sessionUser);
    window.history.replaceState({}, document.title, window.location.pathname);
    setCurrentView('dashboard');
  };

  const handleStartInspection = (property) => {
    setSelectedProperty(property || defaultProperty);
    setCurrentView('inspection');
  };

  // Step 1: When "Review & Lock" is clicked on InspectionPage
  const handleCompleteInspection = (updatedData) => {
    setSelectedInspectionData(updatedData);
    setCurrentView('sign-inspection'); // <-- Redirects to Signature component first instead of locking immediately
  };

  // Step 2: When signatures are completed/saved
  const handleSignaturesComplete = (completedSignatures) => {
    setSignatures(completedSignatures);
    setCurrentView('inspection-report'); // <-- Now goes to report page, which displays the signatures and is locked
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 1. Landing Page */}
      {currentView === 'landing' && (
        <LandingPage
          onGetStarted={() => setCurrentView('welcome')}
          onLogin={() => setCurrentView('login')}
        />
      )}

      {/* 2. Welcome Gateway */}
      {currentView === 'welcome' && (
        <WelcomePage
          onCreateAccount={() => setCurrentView('signup')}
          onSignIn={() => setCurrentView('login')}
        />
      )}

      {/* 3. Auth / Registration Page */}
      {currentView === 'signup' && (
        <AuthPage
          onBack={() => setCurrentView('welcome')}
          onSuccess={handleAuthSuccess}
        />
      )}

      {/* 4. Login Page */}
      {currentView === 'login' && (
        <LoginPage
          onAuthSuccess={handleAuthSuccess}
          onBack={() => setCurrentView('welcome')}
          onNavigateToSignUp={() => setCurrentView('signup')}
          onForgotPassword={() => setCurrentView('forgot-password')}
        />
      )}

      {/* 5. Forgot Password Page */}
      {currentView === 'forgot-password' && (
        <ForgotPasswordPage
          onBack={() => setCurrentView('login')}
          onNavigateToLogin={() => setCurrentView('login')}
        />
      )}

      {/* 6. Invitation Onboarding */}
      {currentView === 'onboarding' && (
        <PartyOnboardingPage
          token={inviteToken}
          onCompleteOnboarding={handleOnboardingComplete}
        />
      )}

      {/* 7. Dashboard View */}
      {currentView === 'dashboard' && (
        <DashboardPage
          user={currentUser}
          onLogout={handleLogout}
          onStartInspection={handleStartInspection}
          onViewReport={() => setCurrentView('inspection-report')}
          onOpenInviteModal={(prop) => {
            setSelectedProperty(prop || defaultProperty);
            setIsInviteModalOpen(true);
          }}
        />
      )}

      {/* 8. Inspection View */}
      {currentView === 'inspection' && (
        <InspectionPage
          property={selectedProperty || defaultProperty}
          userRole={currentUser?.role || 'tenant'}
          onBack={() => setCurrentView('dashboard')}
          onCompleteInspection={handleCompleteInspection}
        />
      )}

      {/* 9. Standalone Signature Component View (Inserted before locking) */}
      {currentView === 'sign-inspection' && (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 font-sans">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <button 
                onClick={() => setCurrentView('inspection')}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                ← Back to Inspection
              </button>
              <h2 className="text-sm font-extrabold text-[#4A1E6D]">Signatures Required</h2>
            </div>

            <p className="text-xs text-slate-600 font-medium">
              Please provide digital signatures to lock and seal this inspection report.
            </p>

            {/* Your Signature Component */}
            <div className="space-y-4">
              <SignatureCanvas 
                label="Landlord Signature"
                savedSignature={signatures.landlord}
                onSave={(sig) => setSignatures(prev => ({ ...prev, landlord: sig }))}
              />
              <SignatureCanvas 
                label="Tenant Signature"
                savedSignature={signatures.tenant}
                onSave={(sig) => setSignatures(prev => ({ ...prev, tenant: sig }))}
              />
            </div>

            <button
              type="button"
              disabled={!signatures.landlord && !signatures.tenant} // Adjust based on your signature component logic
              onClick={() => handleSignaturesComplete(signatures)}
              className="w-full bg-[#4A1E6D] hover:bg-purple-950 disabled:opacity-40 text-white font-extrabold py-3.5 rounded-2xl text-xs transition-colors shadow-lg cursor-pointer"
            >
              Lock & Proceed to Final Report →
            </button>
          </div>
        </div>
      )}

      {/* 10. Inspection Report View (Now Locked with Signatures) */}
      {currentView === 'inspection-report' && (
        <InspectionReportPage
          property={selectedProperty || defaultProperty}
          inspectionData={selectedInspectionData}
          signatures={signatures}
          isLocked={true}
          onBack={() => setCurrentView('sign-inspection')}
          onFinalize={() => setCurrentView('dashboard')}
        />
      )}

      {/* Global Invite Modal */}
      <InvitePartyModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onSuccess={() => {
          setIsInviteModalOpen(false);
        }}
        property={selectedProperty || defaultProperty}
        currentUserRole={currentUser?.role || 'landlord'}
      />
    </div>
  );
}