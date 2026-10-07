import { Shield, ArrowLeft } from "lucide-react";

export default function WelcomePage({ onCreateAccount, onSignIn, onBack }) {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col border border-slate-200 relative">
        {/* Top Hero Section with Background Image */}
        <div
          className="relative h-96 bg-cover bg-center flex flex-col items-center justify-start pt-8 text-center px-6"
          style={{
            backgroundImage: `linear-gradient(to bottom, rgba(255,255,255,0.85), rgba(255,255,255,0.2)), url('https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80')`,
          }}
        >
          {/* Back Button to Landing Page */}
          {onBack && (
            <button
              onClick={onBack}
              className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white/80 hover:bg-white text-purple-900 shadow-md flex items-center justify-center transition-all cursor-pointer backdrop-blur-sm z-20"
              title="Back to Landing Page"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="w-10 h-10 rounded-2xl bg-purple-700 flex items-center justify-center text-white mb-2 shadow-md">
            <Shield className="w-6 h-6" />
          </div>

          <h1 className="text-3xl font-black text-purple-900 tracking-tight">
            Hometrust
          </h1>
          <p className="text-sm font-bold text-slate-700 mt-0.5">
            Move In Evidence
          </p>

          <p className="text-xs font-medium text-slate-600 max-w-xs mt-2 leading-relaxed">
            Capture, record and protect your move in evidence
          </p>
        </div>

        {/* Bottom Bottom Sheet Modal */}
        <div className="bg-white px-6 pt-6 pb-8 rounded-t-3xl -mt-6 z-10 shadow-lg border-t border-slate-100">
          <h2 className="text-xl font-extrabold text-slate-900">Welcome</h2>
          <p className="text-xs text-slate-500 font-medium mt-1 mb-6 leading-normal">
            Sign in to access your property and manage your move in evidence
          </p>

          <div className="space-y-3">
            <button
              onClick={onCreateAccount}
              className="w-full bg-purple-700 hover:bg-purple-800 text-white font-bold text-base py-3.5 rounded-2xl shadow-md transition-all cursor-pointer"
            >
              Create account
            </button>

            <button
              onClick={onSignIn}
              className="w-full bg-white hover:bg-slate-50 text-purple-900 font-bold text-base py-3.5 rounded-2xl border-2 border-purple-700 shadow-sm transition-all cursor-pointer"
            >
              Sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}