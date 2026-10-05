import { Shield } from "lucide-react";

export default function Navbar({ onGetStarted, onLogin }) {
  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-purple-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <div className="w-9 h-9 rounded-xl bg-purple-700 flex items-center justify-center text-white shadow-md">
            <Shield className="w-5 h-5" />
          </div>
          <span className="text-xl font-black text-slate-900 tracking-tight">
            Home<span className="text-purple-700">Trust</span>
          </span>
        </div>

        {/* Nav Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
          <button
            onClick={() => scrollToSection("value-prop")}
            className="hover:text-purple-700 transition-colors cursor-pointer"
          >
            Why HomeTrust
          </button>
          <button
            onClick={() => scrollToSection("roles")}
            className="hover:text-purple-700 transition-colors cursor-pointer"
          >
            Who It's For
          </button>
          <button
            onClick={() => scrollToSection("how-it-works")}
            className="hover:text-purple-700 transition-colors cursor-pointer"
          >
            How It Works
          </button>
        </nav>

        {/* Action CTAs */}
        <div className="flex items-center gap-3">
          <button
            onClick={onLogin}
            className="text-sm font-bold text-slate-700 hover:text-purple-700 px-3 py-2 transition-colors cursor-pointer"
          >
            Login
          </button>
          <button
            onClick={onGetStarted}
            className="bg-purple-700 hover:bg-purple-800 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            Get Started
          </button>
        </div>
      </div>
    </header>
  );
}