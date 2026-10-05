export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400 py-8 text-center text-sm border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p>© {new Date().getFullYear()} HomeTrust. All rights reserved.</p>
      </div>
    </footer>
  );
}