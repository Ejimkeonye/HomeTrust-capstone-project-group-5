import { CheckCircle2, Flame, Sparkles } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 space-y-6">
      {/* Lucide Icon Header */}
      <div className="flex items-center gap-3 bg-slate-800 border border-slate-700 px-5 py-2.5 rounded-full shadow-lg">
        <Sparkles className="w-6 h-6 text-yellow-400 animate-pulse" />
        <span className="text-sm font-bold tracking-wide text-slate-200">
          Environment Setup Test
        </span>
      </div>

      {/* Main Card testing Tailwind Styling */}
      <div className="max-w-sm w-full bg-slate-800/80 backdrop-blur border border-slate-700 rounded-2xl p-6 shadow-2xl text-center space-y-4">
        <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center mx-auto border border-emerald-500/20">
          <CheckCircle2 className="w-7 h-7" />
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-extrabold text-slate-100">
            It's Working!
          </h1>
          <p className="text-xs text-slate-400">
            Tailwind CSS styling and Lucide icons are rendering smoothly.
          </p>
        </div>

        {/* Test Button with hover & dynamic state */}
        <button className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all cursor-pointer text-sm">
          <Flame className="w-4 h-4 text-orange-400" /> Test Button
        </button>
      </div>
    </div>
  );
}
