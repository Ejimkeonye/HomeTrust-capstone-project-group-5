const NOTIFICATION_EVENT = "hometrust-notifications-changed";

const getStorageKey = (propertyKey) =>
  `hometrust_notifications_${propertyKey}`;

export const getNotifications = (propertyKey) => {
  if (!propertyKey) return [];

  try {
    const saved = localStorage.getItem(getStorageKey(propertyKey));
    const parsed = saved ? JSON.parse(saved) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Failed to read notifications:", err);
    return [];
  }
};

const announceNotificationChange = (propertyKey) => {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(NOTIFICATION_EVENT, {
      detail: { propertyKey },
    }),
  );
};

export const subscribeToNotificationChanges = (callback) => {
  if (typeof window === "undefined") return () => {};

  const handleChange = (event) => {
    callback(event.detail?.propertyKey ?? null);
  };

  window.addEventListener(NOTIFICATION_EVENT, handleChange);

  return () => {
    window.removeEventListener(NOTIFICATION_EVENT, handleChange);
  };
};

// Save all notifications for one property and notify subscribers.
export const saveNotifications = (propertyKey, notifications) => {
  if (!propertyKey || !Array.isArray(notifications)) return false;

  try {
    localStorage.setItem(
      getStorageKey(propertyKey),
      JSON.stringify(notifications),
    );

    announceNotificationChange(propertyKey);
    return true;
  } catch (err) {
    console.error("Failed to save notifications:", err);
    return false;
  }
};

export const triggerNotification = (
  propertyKey,
  title,
  description,
  type = "invite",
) => {
  if (!propertyKey) return;

  const existing = getNotifications(propertyKey);
  const now = Date.now();

  const isDuplicate = existing.some((notification) => {
    if (
      notification.title !== title ||
      notification.description !== description
    ) {
      return false;
    }

    const createdAt =
      Number(notification.createdAt) ||
      Number(String(notification.id ?? "").replace(/^notif-/, ""));

    return (
      Number.isFinite(createdAt) &&
      createdAt > 0 &&
      now >= createdAt &&
      now - createdAt < 2000
    );
  });

  if (isDuplicate) return;

  const newNotification = {
    id: `notif-${now}`,
    type,
    title,
    description,
    timestamp: new Date(now).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
    createdAt: now,
    read: false,
  };

  saveNotifications(propertyKey, [newNotification, ...existing]);
};
