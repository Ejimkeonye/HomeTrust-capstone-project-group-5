import { useState, useEffect } from "react";
import { ArrowLeft, Bell, CheckCircle2, ShieldAlert, UserPlus, Clock } from "lucide-react";

export default function NotificationsPage({ onBack, onSelectNotification }) {
  // Generate real-time dynamic timestamps for realistic display
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const formatTime = (dateObj) => {
    return dateObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const initialNotifications = [
    {
      id: "notif-1",
      type: "dispute",
      title: "New Dispute / Comment Raised",
      description: "A party added a note or dispute on the property inspection.",
      timestamp: `Today, ${formatTime(now)}`,
    },
    {
      id: "notif-2",
      type: "invite",
      title: "Party Invite Accepted",
      description: "Your invited participant successfully joined the inspection flow.",
      timestamp: `Yesterday, ${formatTime(yesterday)}`,
    },
    {
      id: "notif-3",
      type: "system",
      title: "Baseline Inspection Locked",
      description: "Property inspection report has been verified and sealed.",
      timestamp: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    },
  ];

  // Load read status from localStorage so it persists permanently
  const [readIds, setReadIds] = useState(() => {
    return JSON.parse(localStorage.getItem("hometrust_read_notifications") || "[]");
  });

  // Save to localStorage whenever readIds changes
  useEffect(() => {
    localStorage.setItem("hometrust_read_notifications", JSON.stringify(readIds));
  }, [readIds]);

  const markAllAsRead = () => {
    const allIds = initialNotifications.map((n) => n.id);
    setReadIds(allIds);
  };

  const handleNotificationClick = (notif) => {
    if (!readIds.includes(notif.id)) {
      setReadIds([...readIds, notif.id]);
    }
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

  // Map state to include dynamic read property based on saved IDs
  const notifications = initialNotifications.map((n) => ({
    ...n,
    read: readIds.includes(n.id),
  }));

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
          <h1 className="text-base font-extrabold text-white text-center truncate">
            Notifications
          </h1>
          {hasUnread && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="text-[10px] font-bold text-purple-200 hover:text-white transition-colors cursor-pointer"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Content Scroll Area */}
        <div className="px-6 py-4 flex-1 overflow-y-auto space-y-3 bg-white">
          {notifications.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs font-medium space-y-2">
              <Bell className="w-8 h-8 mx-auto text-slate-300" />
              <p>No new notifications right now.</p>
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