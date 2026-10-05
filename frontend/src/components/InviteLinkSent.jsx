import { ShieldCheck } from "lucide-react";

export default function Frame706({ onBackHome, date = "13th May, 2025" }) {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-0 sm:p-6 font-sans">
      <div className="w-full max-w-md bg-[#501353] min-h-screen sm:min-h-210 sm:rounded-[48px] shadow-2xl flex flex-col items-center justify-between p-8 text-white relative overflow-hidden">
        
        {/* Status Bar Spacer / Header */}
        <div className="w-full flex justify-between items-center text-xs font-semibold opacity-80 pt-2">
          <span>9:41</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-white/40 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/40 inline-block" />
          </div>
        </div>

        {/* Center Content */}
        <div className="flex flex-col items-center text-center space-y-6 my-auto max-w-xs">
          {/* Shield Icon Container */}
          <div className="relative flex items-center justify-center">
            <div className="w-36 h-40 border-4 border-white/90 rounded-[40px] flex items-center justify-center rotate-45 transform scale-90 shadow-lg">
              <ShieldCheck className="w-20 h-20 text-white -rotate-45" strokeWidth={1.8} />
            </div>
          </div>

          <div className="space-y-2 pt-4">
            <h1 className="text-2xl font-black tracking-tight text-white">
              Congratulations!
            </h1>
            <p className="text-xs font-medium text-purple-100/90 leading-relaxed px-4">
              Your inspection link has successfully been sent
            </p>
            <p className="text-[11px] font-semibold text-purple-200/70 pt-1">
              {date}
            </p>
          </div>
        </div>

        {/* Bottom CTA Button */}
        <div className="w-full pb-6">
          <button
            type="button"
            onClick={onBackHome}
            className="w-full py-3.5 px-6 bg-white hover:bg-slate-100 text-[#501353] font-extrabold text-sm rounded-2xl shadow-lg transition-all active:scale-[0.98] cursor-pointer"
          >
            Back home
          </button>
        </div>

      </div>
    </div>
  );
}