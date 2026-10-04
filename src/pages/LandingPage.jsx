import {
  Building2,
  Users,
  CheckCircle2,
  ClipboardCheck,
  Camera,
  FileCheck,
  Shield,
} from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function LandingPage({ onGetStarted, onLogin }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col justify-between">
      <div>
        {/* Navigation Bar */}
        <Navbar onGetStarted={onGetStarted} onLogin={onLogin} />
{/* Hero Section - Matched to Figma Design */}
<section className="pt-8 pb-16 px-4 max-w-sm sm:max-w-md mx-auto text-center font-sans">
  {/* Logo & Subtitle */}
  <div className="flex flex-col items-center justify-center mb-6">
    <div className="w-10 h-10 rounded-2xl bg-purple-700 flex items-center justify-center text-white mb-2 shadow-md">
      <Shield className="w-6 h-6" />
    </div>
    <h1 className="text-3xl font-bold text-purple-900 tracking-tight">
      Hometrust
    </h1>
    <p className="text-sm font-semibold text-slate-500 mt-0.5">
      Move In Evidence
    </p>
  </div>

  {/* Bullet Point List */}
  <div className="text-left space-y-2 mb-6 max-w-xs mx-auto text-slate-800 text-sm font-semibold">
    <div className="flex items-center gap-2.5">
      <span className="w-2.5 h-2.5 rounded-full bg-black shrink-0"></span>
      <span>Protect your space from day one</span>
    </div>
    <div className="flex items-center gap-2.5">
      <span className="w-2.5 h-2.5 rounded-full bg-black shrink-0"></span>
      <span>Document before you settle in</span>
    </div>
    <div className="flex items-center gap-2.5">
      <span className="w-2.5 h-2.5 rounded-full bg-black shrink-0"></span>
      <span>Record it. Protect it</span>
    </div>
  </div>

  {/* 4-Image Grid Showcase Frame */}
  <div className="bg-white p-2 rounded-3xl border-2 border-purple-600 shadow-md mb-6">
    <div className="grid grid-cols-2 gap-2">
      <img
        src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80"
        alt="Living Room POP Ceiling"
        className="w-full h-36 object-cover rounded-2xl"
      />
      <img
        src="https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80"
        alt="Bathroom Fixtures"
        className="w-full h-36 object-cover rounded-2xl"
      />
      <img
        src="https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=600&q=80"
        alt="Kitchen Cabinets & Countertop"
        className="w-full h-36 object-cover rounded-2xl"
      />
      <img
        src="https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=600&q=80"
        alt="Bedroom Wardrobe"
        className="w-full h-36 object-cover rounded-2xl"
      />
    </div>
  </div>

  {/* Primary Action Button */}
  <button
    onClick={onGetStarted}
    className="w-full bg-purple-700 hover:bg-purple-800 text-white font-bold text-base py-3.5 px-6 rounded-2xl shadow-md transition-all cursor-pointer"
  >
    Get started
  </button>
</section>

        {/* Value Proposition */}
        <section id="value-prop" className="bg-white py-16 px-4 sm:px-6 lg:px-8 border-t border-purple-100">
          <div className="max-w-4xl mx-auto bg-purple-50/60 rounded-3xl border border-purple-200 shadow-sm p-8 sm:p-12 text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full border border-purple-200">
              <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse"></span>
              HomeTrust Platform
            </div>

            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              A simple digital property handover tool
            </h2>

            <p className="text-slate-700 text-base sm:text-lg leading-relaxed max-w-3xl mx-auto">
              Helps a landlord/property manager and tenant jointly document a property's condition at move-in. It guides both parties through a room-by-room inspection, captures timestamped photos and notes, and creates a shared condition record. At move-out, the same structure is reused to capture current condition and track changes.
            </p>

            <div className="pt-2 flex justify-center">
              <button
                onClick={onGetStarted}
                className="bg-purple-700 hover:bg-purple-800 text-white font-bold text-base px-8 py-3.5 rounded-xl shadow-md transition-colors cursor-pointer"
              >
                Create Property & Inspect
              </button>
            </div>
          </div>
        </section>

        {/* Roles Section */}
        <section id="roles" className="py-16 bg-slate-50 border-t border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-purple-700">
                Designed For Both Parties
              </h2>
              <p className="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl">
                Built for Landlords & Tenants Alike
              </p>
              <p className="text-slate-600 text-base">
                HomeTrust creates transparency and eliminates deposit disputes by providing a shared, indisputable record of property conditions.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              <div className="bg-white border border-slate-200 rounded-3xl p-8 flex flex-col justify-between hover:shadow-xl transition-shadow">
                <div className="space-y-6">
                  <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">
                      Landlords, Realtors & Agents
                    </h3>
                    <p className="text-slate-600 text-sm mt-2">
                      Protect your asset investments and standardise move-in/move-out handover across all your properties.
                    </p>
                  </div>
                  <ul className="space-y-3 pt-2">
                    <li className="flex items-start gap-3 text-sm text-slate-700">
                      <CheckCircle2 className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
                      <span>Timestamped photo evidence attached to specific rooms</span>
                    </li>
                    <li className="flex items-start gap-3 text-sm text-slate-700">
                      <CheckCircle2 className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
                      <span>Automated comparison reports at move-out to assess damages</span>
                    </li>
                    <li className="flex items-start gap-3 text-sm text-slate-700">
                      <CheckCircle2 className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
                      <span>Digital tenant sign-off and cloud storage</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-3xl p-8 flex flex-col justify-between hover:shadow-xl transition-shadow">
                <div className="space-y-6">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Tenants</h3>
                    <p className="text-slate-600 text-sm mt-2">
                      Safeguard your security deposit with detailed move-in documentation that both parties sign off on.
                    </p>
                  </div>
                  <ul className="space-y-3 pt-2">
                    <li className="flex items-start gap-3 text-sm text-slate-700">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Guided step-by-step room inspection workflow</span>
                    </li>
                    <li className="flex items-start gap-3 text-sm text-slate-700">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Pre-existing defect logging prior to lease start</span>
                    </li>
                    <li className="flex items-start gap-3 text-sm text-slate-700">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Shared access to final condition reports anytime</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-16 bg-white border-t border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-purple-700">
                Simple 3-Step Process
              </h2>
              <p className="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl">
                How HomeTrust Works
              </p>
              <p className="text-slate-600 text-base">
                A seamless digital workflow connecting landlords and tenants for transparent handovers.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              <div className="bg-purple-50/50 border border-purple-100 rounded-3xl p-8 text-center space-y-4 flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl bg-purple-700 text-white flex items-center justify-center font-bold text-xl shadow-md">
                  <ClipboardCheck className="w-7 h-7" />
                </div>
                <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full">
                  Step 01
                </span>
                <h3 className="text-lg font-bold text-slate-900">Initiate Move-In</h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Either party sets up the property layout and sends an instant invitation link to join.
                </p>
              </div>

              <div className="bg-purple-50/50 border border-purple-100 rounded-3xl p-8 text-center space-y-4 flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl bg-purple-700 text-white flex items-center justify-center font-bold text-xl shadow-md">
                  <Camera className="w-7 h-7" />
                </div>
                <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full">
                  Step 02
                </span>
                <h3 className="text-lg font-bold text-slate-900">Room Inspection & Photos</h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Both parties complete a guided room-by-room walkthrough, logging notes and timestamped photos.
                </p>
              </div>

              <div className="bg-purple-50/50 border border-purple-100 rounded-3xl p-8 text-center space-y-4 flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl bg-purple-700 text-white flex items-center justify-center font-bold text-xl shadow-md">
                  <FileCheck className="w-7 h-7" />
                </div>
                <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full">
                  Step 03
                </span>
                <h3 className="text-lg font-bold text-slate-900">Sign & Lock Baseline</h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Digitally sign the initial report, then reuse the locked baseline record at move-out for easy comparison.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
}