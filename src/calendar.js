const { google } = require('googleapis');

// Duración de cada sesión en minutos
const SESSION_DURATION = parseInt(process.env.SESSION_DURATION_MIN || '50', 10);

// Horario laboral (hora local del calendario)
const WORK_START = parseInt(process.env.WORK_START_HOUR || '9', 10);
const WORK_END = parseInt(process.env.WORK_END_HOUR || '19', 10);

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
}

function getCalendar() {
  return google.calendar({ version: 'v3', auth: getAuth() });
}

/**
 * Devuelve los slots libres de un día dado (formato YYYY-MM-DD).
 * Retorna array de strings "HH:MM".
 */
async function getAvailableSlots(dateStr) {
  const calendar = getCalendar();
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const timeZone = process.env.TIMEZONE || 'America/Argentina/Buenos_Aires';

  const dayStart = new Date(`${dateStr}T${String(WORK_START).padStart(2, '0')}:00:00`);
  const dayEnd = new Date(`${dateStr}T${String(WORK_END).padStart(2, '0')}:00:00`);

  const { data } = await calendar.freebusy.query({
    requestBody: {
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString(),
      timeZone,
      items: [{ id: calendarId }],
    },
  });

  const busy = (data.calendars[calendarId]?.busy || []).map((b) => ({
    start: new Date(b.start),
    end: new Date(b.end),
  }));

  const slots = [];
  let cursor = new Date(dayStart);

  while (cursor < dayEnd) {
    const slotEnd = new Date(cursor.getTime() + SESSION_DURATION * 60000);
    const isBusy = busy.some((b) => cursor < b.end && slotEnd > b.start);
    if (!isBusy) {
      slots.push(
        `${String(cursor.getHours()).padStart(2, '0')}:${String(cursor.getMinutes()).padStart(2, '0')}`
      );
    }
    cursor = slotEnd;
  }

  return slots;
}

/**
 * Crea un evento en el calendario y retorna el eventId.
 */
async function createAppointment({ nombre, fecha, hora }) {
  const calendar = getCalendar();
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const timeZone = process.env.TIMEZONE || 'America/Argentina/Buenos_Aires';

  const [year, month, day] = fecha.split('-').map(Number);
  const [hour, minute] = hora.split(':').map(Number);

  const start = new Date(year, month - 1, day, hour, minute);
  const end = new Date(start.getTime() + SESSION_DURATION * 60000);

  const { data } = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: `Sesión — ${nombre}`,
      description: `Turno agendado via WhatsApp para ${nombre}.`,
      start: { dateTime: start.toISOString(), timeZone },
      end: { dateTime: end.toISOString(), timeZone },
    },
  });

  return data.id;
}

/**
 * Cancela (elimina) un evento por su ID.
 */
async function cancelAppointment(eventId) {
  const calendar = getCalendar();
  await calendar.events.delete({
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    eventId,
  });
}

/**
 * Busca el próximo turno del paciente por nombre (búsqueda simple).
 * Retorna { eventId, fecha, hora } o null.
 */
async function findNextAppointment(nombre) {
  const calendar = getCalendar();
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  const { data } = await calendar.events.list({
    calendarId,
    timeMin: new Date().toISOString(),
    q: nombre,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 1,
  });

  const event = data.items?.[0];
  if (!event) return null;

  const dt = new Date(event.start.dateTime || event.start.date);
  return {
    eventId: event.id,
    fecha: dt.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    hora: dt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
  };
}

module.exports = { getAvailableSlots, createAppointment, cancelAppointment, findNextAppointment };
