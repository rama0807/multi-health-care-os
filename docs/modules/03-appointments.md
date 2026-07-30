# Module: Appointments

## Purpose
Manages the full appointment lifecycle — from scheduling to completion — for all appointment types (OPD, IPD pre-admission, emergency, teleconsultation).

## Responsibilities
- Doctor availability slot generation based on weekly schedule
- Conflict detection (prevent double-booking)
- Appointment status state machine
- Walk-in queue management
- Appointment reminders (delegates to NotificationsModule)
- Calendar view data

## Status State Machine

```
SCHEDULED ──► CONFIRMED ──► ARRIVED ──► IN_CONSULTATION ──► COMPLETED
     │              │            │               │
     └──────────────┴────────────┴───────────────┴──► CANCELLED
                                                       NO_SHOW
```

## REST Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/appointments` | List appointments (date range, doctor, patient) | `appointments:read` |
| POST | `/appointments` | Book appointment | `appointments:write` |
| GET | `/appointments/:id` | Get appointment detail | `appointments:read` |
| PATCH | `/appointments/:id` | Update appointment | `appointments:write` |
| PATCH | `/appointments/:id/status` | Change status | `appointments:write` |
| DELETE | `/appointments/:id` | Cancel appointment | `appointments:write` |
| GET | `/appointments/slots` | Get available slots for doctor+date | `appointments:read` |
| GET | `/appointments/queue` | Today's OPD queue | `appointments:read` |
| PATCH | `/appointments/:id/check-in` | Mark patient arrived | `appointments:write` |
| GET | `/doctors/:doctorId/schedule` | Doctor weekly schedule | `appointments:read` |
| PUT | `/doctors/:doctorId/schedule` | Set doctor schedule | `appointments:admin` |
| POST | `/doctors/:doctorId/schedule/exceptions` | Add schedule exception | `appointments:admin` |

## Slot Generation Logic

```typescript
interface AvailabilitySlot {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6
  startTime: string  // "09:00"
  endTime: string    // "13:00"
  slotDurationMinutes: number  // 15
  maxPatients: number  // 20
}

// Slots generated dynamically, not stored in DB
// Exceptions (holidays, sick days) stored as ExceptionDates
```

## Dependencies
- `PatientsModule` — patient validation
- `DoctorsModule` — doctor availability config
- `NotificationsModule` — confirmation SMS/email
- `BillingModule` — auto-generate invoice on completion

## Events Published
- `appointment.scheduled`
- `appointment.confirmed`
- `appointment.cancelled`
- `appointment.completed`
- `appointment.no_show`

## Future Improvements
- Online patient self-booking portal
- WhatsApp booking via chatbot (AI Milestone 10)
- Video consultation link generation (Telemedicine)
- Recurring appointment series (e.g., physiotherapy sessions)
