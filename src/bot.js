const twilio = require('twilio');
const { getSession, setSession, resetSession } = require('./sessions');
const {
  getAvailableSlots,
  createAppointment,
  cancelAppointment,
  findNextAppointment,
} = require('./calendar');

const MessagingResponse = twilio.twiml.MessagingResponse;

// Regex para validar fecha DD/MM/YYYY o YYYY-MM-DD
const DATE_REGEX_SLASH = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const DATE_REGEX_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

function toISODate(input) {
  const slash = input.match(DATE_REGEX_SLASH);
  if (slash) return `${slash[3]}-${slash[2]}-${slash[1]}`;
  if (DATE_REGEX_ISO.test(input)) return input;
  return null;
}

function reply(text) {
  const twiml = new MessagingResponse();
  twiml.message(text);
  return twiml.toString();
}

const MENU_TEXT = `👋 Hola! Soy el asistente del *Consultorio Psicológico*.

¿En qué puedo ayudarte?

1️⃣ Agendar un turno
2️⃣ Consultar mi próximo turno
3️⃣ Cancelar mi turno

Respondé con el número de la opción.`;

async function handleIncomingMessage(from, body) {
  const session = getSession(from);
  const text = body.toLowerCase().trim();

  // Siempre permitir volver al menú
  if (['menu', 'menú', 'inicio', '0', 'salir'].includes(text)) {
    resetSession(from);
    return reply(MENU_TEXT);
  }

  switch (session.step) {
    case 'MENU':
      return handleMenu(from, text);

    // --- AGENDAR ---
    case 'AGENDAR_NOMBRE':
      return handleAgendarNombre(from, body);
    case 'AGENDAR_FECHA':
      return handleAgendarFecha(from, body);
    case 'AGENDAR_HORA':
      return handleAgendarHora(from, body);
    case 'AGENDAR_CONFIRMAR':
      return handleAgendarConfirmar(from, text);

    // --- CONSULTAR ---
    case 'CONSULTAR_NOMBRE':
      return handleConsultarNombre(from, body);

    // --- CANCELAR ---
    case 'CANCELAR_NOMBRE':
      return handleCancelarNombre(from, body);
    case 'CANCELAR_CONFIRMAR':
      return handleCancelarConfirmar(from, text);

    default:
      resetSession(from);
      return reply(MENU_TEXT);
  }
}

// ─── MENU ────────────────────────────────────────────────────────────────────

function handleMenu(from, text) {
  if (text === '1') {
    setSession(from, { step: 'AGENDAR_NOMBRE' });
    return reply('Para agendar un turno necesito algunos datos.\n\n¿Cuál es tu nombre y apellido?');
  }
  if (text === '2') {
    setSession(from, { step: 'CONSULTAR_NOMBRE' });
    return reply('¿Cuál es tu nombre y apellido para buscar tu turno?');
  }
  if (text === '3') {
    setSession(from, { step: 'CANCELAR_NOMBRE' });
    return reply('¿Cuál es tu nombre y apellido para cancelar tu turno?');
  }
  return reply(MENU_TEXT);
}

// ─── AGENDAR ─────────────────────────────────────────────────────────────────

function handleAgendarNombre(from, body) {
  const nombre = body.trim();
  if (nombre.length < 3) {
    return reply('Por favor ingresá tu nombre completo.');
  }
  setSession(from, { step: 'AGENDAR_FECHA', nombre });
  return reply(
    `Hola *${nombre}*! 📅\n\n¿Qué día preferís? Ingresá la fecha en formato *DD/MM/YYYY*.\n_(ej: 25/04/2025)_`
  );
}

async function handleAgendarFecha(from, body) {
  const iso = toISODate(body.trim());
  if (!iso) {
    return reply('Formato de fecha incorrecto. Por favor usá DD/MM/YYYY (ej: 25/04/2025).');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const chosen = new Date(iso + 'T00:00:00');
  if (chosen < today) {
    return reply('La fecha ingresada ya pasó. Por favor elegí una fecha futura.');
  }

  // Verificar que no sea domingo (0)
  if (chosen.getDay() === 0) {
    return reply('El consultorio no atiende los domingos. Elegí otro día.');
  }

  let slots;
  try {
    slots = await getAvailableSlots(iso);
  } catch (err) {
    console.error('Error obteniendo slots:', err);
    return reply('Hubo un error consultando el calendario. Intentá de nuevo en unos minutos.');
  }

  if (slots.length === 0) {
    return reply(
      `No hay turnos disponibles para el ${body.trim()}. ¿Querés intentar con otra fecha? (ingresá DD/MM/YYYY)`
    );
  }

  const lista = slots.map((s, i) => `${i + 1}. ${s}`).join('\n');
  setSession(from, { step: 'AGENDAR_HORA', fecha: iso, _slots: slots });
  return reply(`Horarios disponibles para el ${body.trim()}:\n\n${lista}\n\nElegí un número de la lista.`);
}

async function handleAgendarHora(from, body) {
  const session = getSession(from);
  const slots = session._slots || [];
  const idx = parseInt(body.trim(), 10) - 1;

  if (isNaN(idx) || idx < 0 || idx >= slots.length) {
    const lista = slots.map((s, i) => `${i + 1}. ${s}`).join('\n');
    return reply(`Opción inválida. Elegí un número de la lista:\n\n${lista}`);
  }

  const hora = slots[idx];
  const [y, m, d] = session.fecha.split('-');
  const fechaLegible = `${d}/${m}/${y}`;

  setSession(from, { step: 'AGENDAR_CONFIRMAR', hora });
  return reply(
    `Vas a agendar un turno para:\n\n👤 *${session.nombre}*\n📅 *${fechaLegible}*\n🕐 *${hora} hs*\n\n¿Confirmás? (sí / no)`
  );
}

async function handleAgendarConfirmar(from, text) {
  if (!['si', 'sí', 's', 'yes'].includes(text)) {
    resetSession(from);
    return reply(`Turno cancelado. Cuando quieras podés escribir *menú* para volver al inicio.`);
  }

  const session = getSession(from);
  let eventId;
  try {
    eventId = await createAppointment({
      nombre: session.nombre,
      fecha: session.fecha,
      hora: session.hora,
    });
  } catch (err) {
    console.error('Error creando turno:', err);
    return reply('Hubo un error al registrar el turno. Por favor intentá nuevamente.');
  }

  const [y, m, d] = session.fecha.split('-');
  resetSession(from);
  return reply(
    `✅ ¡Turno confirmado!\n\n📅 *${d}/${m}/${y}* a las *${session.hora} hs*\n\nTe esperamos. Si necesitás cancelar o reprogramar escribí *menú*.`
  );
}

// ─── CONSULTAR ────────────────────────────────────────────────────────────────

async function handleConsultarNombre(from, body) {
  const nombre = body.trim();
  if (nombre.length < 3) {
    return reply('Por favor ingresá tu nombre completo.');
  }

  let appt;
  try {
    appt = await findNextAppointment(nombre);
  } catch (err) {
    console.error('Error consultando turno:', err);
    return reply('Hubo un error al buscar tu turno. Intentá de nuevo.');
  }

  resetSession(from);
  if (!appt) {
    return reply(`No encontré turnos próximos para *${nombre}*.\n\nEscribí *menú* para volver al inicio.`);
  }

  return reply(
    `📋 Tu próximo turno:\n\n👤 *${nombre}*\n📅 ${appt.fecha}\n🕐 ${appt.hora} hs\n\nEscribí *menú* para volver al inicio.`
  );
}

// ─── CANCELAR ─────────────────────────────────────────────────────────────────

async function handleCancelarNombre(from, body) {
  const nombre = body.trim();
  if (nombre.length < 3) {
    return reply('Por favor ingresá tu nombre completo.');
  }

  let appt;
  try {
    appt = await findNextAppointment(nombre);
  } catch (err) {
    console.error('Error buscando turno para cancelar:', err);
    return reply('Hubo un error al buscar tu turno. Intentá de nuevo.');
  }

  if (!appt) {
    resetSession(from);
    return reply(`No encontré turnos próximos para *${nombre}*.\n\nEscribí *menú* para volver al inicio.`);
  }

  setSession(from, { step: 'CANCELAR_CONFIRMAR', nombre, _appt: appt });
  return reply(
    `Encontré este turno:\n\n📅 ${appt.fecha}\n🕐 ${appt.hora} hs\n\n¿Confirmás la cancelación? (sí / no)`
  );
}

async function handleCancelarConfirmar(from, text) {
  if (!['si', 'sí', 's', 'yes'].includes(text)) {
    resetSession(from);
    return reply('Cancelación descartada. Escribí *menú* para volver al inicio.');
  }

  const session = getSession(from);
  try {
    await cancelAppointment(session._appt.eventId);
  } catch (err) {
    console.error('Error cancelando turno:', err);
    return reply('Hubo un error al cancelar el turno. Por favor contactá al consultorio directamente.');
  }

  resetSession(from);
  return reply(
    `🗑️ Tu turno fue cancelado correctamente.\n\nEscribí *menú* cuando quieras agendar uno nuevo.`
  );
}

module.exports = { handleIncomingMessage };
