import { useState, useEffect } from "react";
import { ArrowLeft, Bell, CheckCircle2, ShieldAlert, UserPlus, Clock, Trash2 } from "lucide-react";

export default function NotificationsPage({ activeProperty, onBack, onSelectNotification }) {
  const propertyKey = activeProperty?.propertyId || activeProperty?.id || "global";
  const storageKey = `hometrust_notifications_${propertyKey}`;

  // 🛠️ Load notifications scoped strictly to the current active property
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save changes to localStorage under this specific property key
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(notifications));
  }, [notifications, storageKey]);

  const markAllAsRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    localStorage.removeItem(storageKey);
  };

  const handleNotificationClick = (notif) => {
    const updated = notifications.map((n) => 
      n.id === notif.id ? { ...n, read: true } : n
    );
    setNotifications(updated);
    if (onSelectNotification) onSelectNotification(notif);
  };

  const getIcon = (type) => {
    switch (type) {
      case "dispute":
        return <ShieldAlert className="w-4 h-4 text-amber-600" />;
      case "invite":
        return <UserPlus className="w-4 h-4 text-[#4A1E6D]" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    }
  };

  const hasUnread = notifications.some((n) => !n.read);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-0 sm:p-6 font-sans">
      <div className="w-full max-w-md bg-white min-h-screen sm:min-h-200 sm:rounded-[48px] shadow-2xl border border-slate-200 flex flex-col justify-between overflow-hidden relative text-slate-900">
        
        {/* Top Header */}
        <div className="p-4 flex items-center justify-between z-10 gap-2 bg-[#4A1E6D] text-white">
          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-center truncate">
            <h1 className="text-base font-extrabold text-white">Notifications</h1>
            <p className="text-[10px] text-purple-200 truncate max-w-50">
              {activeProperty?.address || "Portfolio Overview"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasUnread && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-[10px] font-bold text-purple-200 hover:text-white transition-colors cursor-pointer"
              >
                Mark read
              </button>
            )}
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={clearAllNotifications}
                className="text-white/70 hover:text-red-300 p-1 transition-colors cursor-pointer"
                title="Clear all notifications"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Content Scroll Area */}
        <div className="px-6 py-4 flex-1 overflow-y-auto space-y-3 bg-white">
          {notifications.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs font-medium space-y-2">
              <Bell className="w-8 h-8 mx-auto text-slate-300" />
              <p>No activity alerts for this property yet. Actions like adding rooms, submitting evidence, or signing will appear here.</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                  notif.read
                    ? "bg-slate-50 border-slate-200 text-slate-700"
                    : "bg-purple-50/60 border-purple-200 text-slate-900 shadow-xs"
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                  {getIcon(notif.type)}
                </div>
                
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <h3 className="text-xs font-extrabold truncate">{notif.title}</h3>
                    {!notif.read && (
                      <span className="w-2 h-2 rounded-full bg-[#4A1E6D] shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug font-medium">
                    {notif.description}
                  </p>
                  <div className="flex items-center gap-1 text-[9px] text-slate-400 font-semibold pt-0.5">
                    <Clock className="w-3 h-3" />
                    <span>{notif.timestamp}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Action */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <button
            type="button"
            onClick={onBack}
            className="w-full bg-[#4A1E6D] hover:bg-purple-950 text-white font-extrabold py-3.5 rounded-2xl text-xs transition-colors shadow-lg cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>

      </div>
    </div>
  );
}