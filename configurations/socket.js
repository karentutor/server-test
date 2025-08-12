//configuartions/socket.js
import { Server } from 'socket.io';
import HangoutUser from '../models/HangoutUser.js';
import Message from '../models/Message.js';

/* In‑memory user store:
 * users = {
 *   "userId": {
 *     socketIds: Set<string>,
 *     firstName, lastName, x, y, tableId
 *   }
 * }
 */
export const users = {};

let io = null;

/* ---------- init ---------- */
export const initSocket = (server, allowedOrigins) => {
  io = new Server(server, {
    path: '/socket.io/',
    cors: {
      origin: allowedOrigins,           // ["http://localhost:19006", …]
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log('🔗 New socket', socket.id);

    /* ----- 1. registerUser ----- */
    socket.on('registerUser', async ({ userId, firstName, lastName, x, y }) => {
      console.log('👤 registerUser', userId, 'socket', socket.id);

      const entry = users[userId] ?? {
        socketIds: new Set(),
        firstName: firstName || 'Anon',
        lastName: lastName || '',
        x: typeof x === 'number' ? x : 100,
        y: typeof y === 'number' ? y : 100,
        tableId: null,
      };
      entry.socketIds.add(socket.id);
      users[userId] = entry;
      console.log('users map now has', Object.keys(users));

      /* (persist HangoutUser unchanged) … */
      try {
        let rec = await HangoutUser.findOne({ userId });
        if (!rec) rec = new HangoutUser({ userId });
        rec.x = entry.x;
        rec.y = entry.y;
        rec.tableId = null;
        await rec.save();
      } catch (err) {
        console.error('DB error in registerUser:', err);
      }

      /* send roster to this client */
      socket.emit(
        'existingUsers',
        Object.entries(users).map(([uid, data]) => ({
          _id: uid,
          firstName: data.firstName,
          lastName: data.lastName,
          x: data.x,
          y: data.y,
          tableId: data.tableId,
        })),
      );

      /* broadcast “userJoined” to others */
      socket.broadcast.emit('userJoined', {
        userId,
        firstName,
        lastName,
        x: entry.x,
        y: entry.y,
      });
    });

    /* ----- 2. userMoved ----- */
    socket.on('userMoved', async ({ userId, x, y }) => {
      if (users[userId]) {
        users[userId].x = x;
        users[userId].y = y;
      }
      socket.broadcast.emit('userMoved', { userId, x, y });

      try {
        await HangoutUser.findOneAndUpdate({ userId }, { x, y }, { upsert: true });
      } catch (err) {
        console.error('userMoved DB error:', err);
      }
    });

    /* ----- 3. joinTable ----- */
    socket.on('joinTable', async ({ userId, tableId }) => {
      if (users[userId]) users[userId].tableId = tableId;
      socket.broadcast.emit('tableJoined', { userId, tableId });
      try {
        await HangoutUser.findOneAndUpdate({ userId }, { tableId }, { upsert: true });
      } catch (err) {
        console.error('joinTable DB error:', err);
      }
    });

    /* ----- 4. tableCreated ----- */
    socket.on('tableCreated', (newTable) => {
      socket.broadcast.emit('tableCreated', newTable);
    });

    /* ----- 5. markMessagesAsRead ----- */
    socket.on('markMessagesAsRead', async ({ chatId, userId }) => {
      try {
        await Message.updateMany(
          { chatId, isReadBy: { $ne: userId }, senderId: { $ne: userId } },
          { $push: { isReadBy: userId } },
        );
        users[userId]?.socketIds?.forEach((sid) =>
          io.to(sid).emit('messagesRead', { chatId, userId }),
        );
      } catch (err) {
        console.error('markMessagesAsRead error:', err);
      }
    });

    /* ------------------------------------------------------------------
     *  VIDEO‑CALL SIGNALLING RELAYS
     *  Simply forward the payload to every socket that belongs to `to`
     * ----------------------------------------------------------------- */
    const relay = (event, data) => {
      const entry = users[data.to];
  if (!entry) {
    console.log(`[server] user ${data.to} offline – dropping ${event}`);
    return;
  }
      entry.socketIds.forEach((sid) => io.to(sid).emit(event, data));
    };

    // socket.on('video-offer',         (d) => relay('video-offer',         d));
socket.on('video-offer', (d) => {
  console.log('[server] video-offer from', d.from, 'to', d.to);
  relay('video-offer', d);
});
    socket.on('video-answer',        (d) => relay('video-answer',        d));
    socket.on('video-ice-candidate', (d) => relay('video-ice-candidate', d));
    socket.on('video-end',           (d) => relay('video-end',           d));


    /* ----- 6. disconnect ----- */
    socket.on('disconnect', () => {
      console.log('❌ socket disconnected', socket.id);

      for (const [uid, data] of Object.entries(users)) {
        if (data.socketIds.has(socket.id)) {
          data.socketIds.delete(socket.id);
          if (data.socketIds.size === 0) {
            console.log('👋 user', uid, 'now completely offline');
            delete users[uid];
            socket.broadcast.emit('userLeft', { userId: uid });
          }
          break;
        }
      }
    });
  });
};

/* helper */
export const getSocketIO = () => io;

/* =========================================================
 * One‑off helper: notifyUserFollowed
 *   Emit "userFollowed" to every online socket that belongs
 *   to the followed user.  Imported by userService.js.
 * ======================================================= */

/**
 * @param {string} followedUserId – Mongo _id of the user being followed
 * @param {object} payload        – Any JSON you want the client to receive
 */
export function notifyUserFollowed(followedUserId, payload) {
  if (!io) return;                         // Socket.io not initialised yet

  const entry = users[followedUserId];
  if (!entry || !entry.socketIds || entry.socketIds.size === 0) {
    console.log('notifyUserFollowed → user offline', followedUserId);
    return;
  }

  console.log(
    'notifyUserFollowed → delivering to',
    followedUserId,
    'sockets',
    [...entry.socketIds],
  );

  entry.socketIds.forEach((sid) => {
    io.to(sid).emit('userFollowed', payload);
  });
}
