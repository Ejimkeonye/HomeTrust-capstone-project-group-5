// 🛠️ Property-Scoped Dynamic Notification Helper with Deduplication
export const triggerNotification = (propertyKey, title, description, type = "invite") => {
  if (!propertyKey) return;
  try {
    const storageKey = `hometrust_notifications_${propertyKey}`;
    const existing = JSON.parse(localStorage.getItem(storageKey) || "[]");

    // 🛑 DEDUPLICATION CHECK: Prevent identical notifications fired within the last 2 seconds
    const now = Date.now();
    const isDuplicate = existing.some(n => 
      n.title === title && 
      n.description === description && 
      (now - Number(n.id.replace('notif-', ''))) < 2000
    );

    if (isDuplicate) return; // Skip duplicate trigger

    const newNotif = {
      id: `notif-${now}`,
      type, // "invite", "dispute", "system"
      title,
      description,
      timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }),
      read: false
    };

    localStorage.setItem(storageKey, JSON.stringify([newNotif, ...existing]));
  } catch (err) {
    console.error("Failed to push notification:", err);
  }
};