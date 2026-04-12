const UserNotification = require("../models/UserNotification");
const { emitToUser, emitToUserEventRoom } = require("../realtime/socketServer");

const serializeUserNotification = (notification) => ({
  id: notification._id.toString(),
  userId: notification.user?.toString?.() || notification.user,
  eventId: notification.event?.toString?.() || notification.event || null,
  type: notification.type,
  title: notification.title,
  message: notification.message,
  payload: notification.payload || {},
  isRead: Boolean(notification.isRead),
  readAt: notification.readAt,
  createdAt: notification.createdAt,
});

const createUserNotification = async ({
  userId,
  eventId = null,
  type,
  title,
  message,
  payload = {},
}) => {
  const notification = await UserNotification.create({
    user: userId,
    event: eventId,
    type,
    title,
    message,
    payload,
  });

  const serialized = serializeUserNotification(notification.toObject());
  emitToUser(userId, "user:notification", serialized);

  return serialized;
};

const emitLiveEventUpdate = ({
  eventId,
  type,
  title,
  message,
  payload = {},
}) => {
  if (!eventId) {
    return;
  }

  emitToUserEventRoom(eventId, "user:event-live-update", {
    eventId: String(eventId),
    type,
    title,
    message,
    payload,
    createdAt: new Date().toISOString(),
  });
};

module.exports = {
  createUserNotification,
  emitLiveEventUpdate,
  serializeUserNotification,
};
