export default function LoadingScreen({
  message = "Loading...",
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="flex flex-col items-center text-center">
        <div className="relative w-12 h-12 mb-5">
          <div className="absolute inset-0 rounded-full border-4 border-purple-100" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-800 animate-spin" />
        </div>
        <p className="text-sm font-semibold text-slate-700">
          {message}
        </p>
        <p className="text-xs text-slate-400 mt-2">
          Please wait...
        </p>
      </div>
    </div>
  );
}
