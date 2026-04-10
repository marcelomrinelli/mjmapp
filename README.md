# Bot Cecilia — WhatsApp + Google Calendar

Bot de WhatsApp para consultorio psicológico. Permite a los pacientes agendar, consultar y cancelar turnos directamente desde WhatsApp, sincronizando todo con Google Calendar.

## Funcionalidades

- Agendar turno: el paciente elige fecha y hora de los slots disponibles
- Consultar próximo turno
- Cancelar turno
- Respeta horario de atención configurable
- Detecta conflictos con eventos existentes en el calendario

## Requisitos

- Node.js 18+
- Cuenta de [Twilio](https://www.twilio.com/) con WhatsApp habilitado (Sandbox o número aprobado)
- Proyecto en [Google Cloud](https://console.cloud.google.com/) con la API de Calendar activada y una cuenta de servicio

## Instalación

```bash
npm install
cp .env.example .env
# Editá .env con tus credenciales
npm start
```

## Configuración

### 1. Twilio — WhatsApp

1. Creá una cuenta en [twilio.com](https://www.twilio.com/)
2. Activá el **Sandbox de WhatsApp** en *Messaging → Try it out → Send a WhatsApp message*
3. Copiá `Account SID` y `Auth Token` al `.env`
4. En el Sandbox configurá el webhook de entrada apuntando a:
   ```
   https://<tu-dominio>/webhook
   ```

### 2. Google Calendar — Cuenta de Servicio

1. En [Google Cloud Console](https://console.cloud.google.com/):
   - Creá un proyecto nuevo
   - Habilitá la **Google Calendar API**
   - Creá una **Cuenta de Servicio** y descargá el JSON de credenciales
2. En Google Calendar, compartí tu calendario con el email de la cuenta de servicio (permisos de edición)
3. Copiá el ID del calendario y el contenido del JSON al `.env`

### 3. Exponer el servidor localmente (desarrollo)

Usá [ngrok](https://ngrok.com/) para recibir webhooks en local:

```bash
ngrok http 3000
# Copiá la URL https://xxxx.ngrok.io al webhook de Twilio
```

## Variables de entorno

| Variable | Descripcion |
|---|---|
| `PORT` | Puerto del servidor (default: 3000) |
| `TWILIO_ACCOUNT_SID` | SID de cuenta Twilio |
| `TWILIO_AUTH_TOKEN` | Token de autenticacion Twilio |
| `GOOGLE_CALENDAR_ID` | ID del calendario de Google |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | JSON de credenciales de la cuenta de servicio |
| `TIMEZONE` | Zona horaria (ej: `America/Argentina/Buenos_Aires`) |
| `WORK_START_HOUR` | Hora de inicio de atencion (24h, default: 9) |
| `WORK_END_HOUR` | Hora de fin de atencion (24h, default: 19) |
| `SESSION_DURATION_MIN` | Duracion de sesion en minutos (default: 50) |

## Estructura del proyecto

```
src/
  index.js      — Servidor Express, recibe webhooks de Twilio
  bot.js        — Maquina de estados de la conversacion
  calendar.js   — Integracion con Google Calendar API
  sessions.js   — Gestion de sesiones en memoria por usuario
.env.example    — Plantilla de variables de entorno
```

## Flujo de conversacion

```
Usuario escribe → Menu principal
  1 → Agendar:   Nombre → Fecha → Seleccion de horario → Confirmacion
  2 → Consultar: Nombre → Muestra proximo turno
  3 → Cancelar:  Nombre → Muestra turno → Confirmacion → Elimina del calendario
```

En cualquier momento el usuario puede escribir **menu** para volver al inicio.
