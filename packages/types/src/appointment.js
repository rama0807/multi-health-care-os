"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateAppointmentStatusSchema = exports.CreateAppointmentSchema = void 0;
const zod_1 = require("zod");
const enums_1 = require("./enums");
exports.CreateAppointmentSchema = zod_1.z.object({
    patientId: zod_1.z.string().cuid(),
    doctorId: zod_1.z.string().cuid(),
    departmentId: zod_1.z.string().cuid().optional(),
    scheduledAt: zod_1.z.string().datetime(),
    durationMinutes: zod_1.z.number().int().min(5).max(240).default(15),
    type: zod_1.z.nativeEnum(enums_1.AppointmentType).default(enums_1.AppointmentType.OPD),
    chiefComplaint: zod_1.z.string().max(500).optional(),
    notes: zod_1.z.string().max(1000).optional(),
});
exports.UpdateAppointmentStatusSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(enums_1.AppointmentStatus),
    notes: zod_1.z.string().optional(),
});
//# sourceMappingURL=appointment.js.map