/**
 * Almacén de sesiones en memoria.
 * En producción reemplazar por Redis u otra solución persistente.
 */
const sessions = new Map();

const INITIAL_STATE = {
  step: 'MENU',
  nombre: null,
  fecha: null,
  hora: null,
  eventId: null,
};

function getSession(userId) {
  if (!sessions.has(userId)) {
    sessions.set(userId, { ...INITIAL_STATE });
  }
  return sessions.get(userId);
}

function setSession(userId, data) {
  sessions.set(userId, { ...getSession(userId), ...data });
}

function resetSession(userId) {
  sessions.set(userId, { ...INITIAL_STATE });
}

module.exports = { getSession, setSession, resetSession };
