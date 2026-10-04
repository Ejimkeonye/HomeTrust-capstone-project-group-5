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

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const activeSession = localStorage.getItem('homecompa_current_session');
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
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const [currentView, setCurrentView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('propertyId') || params.get('token');

    if (token || window.location.pathname.includes('/join')) {
      return 'onboarding';
    }

    const activeSession = localStorage.getItem('homecompa_current_session');
    return activeSession ? 'dashboard' : 'landing';
  });

  const handleAuthSuccess = (userData) => {
    setCurrentUser(userData);
    localStorage.setItem('homecompa_current_session', JSON.stringify(userData));
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('homecompa_token');
    localStorage.removeItem('homecompa_user');
    localStorage.removeItem('homecompa_current_session');
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

  const handleCompleteInspection = (updatedData) => {
    if (selectedProperty) {
      const saved = JSON.parse(localStorage.getItem('homecompa_properties') || '[]');
      const updated = saved.map((p) =>
        p.id === selectedProperty.id
          ? { ...p, inspectionData: updatedData, status: 'READ_ONLY', progress: 100 }
          : p
      );
      localStorage.setItem('homecompa_properties', JSON.stringify(updated));
    }
    setCurrentView('dashboard');
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

      {/* Global Invite Modal */}
      <InvitePartyModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        property={selectedProperty || defaultProperty}
        currentUserRole={currentUser?.role || 'landlord'}
      />
    </div>
  );
}