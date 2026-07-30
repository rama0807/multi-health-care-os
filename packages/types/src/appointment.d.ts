import { z } from 'zod';
import { AppointmentStatus, AppointmentType } from './enums';
export interface Appointment {
    id: string;
    appointmentNumber: string;
    patientId: string;
    doctorId: string;
    departmentId: string | null;
    organizationId: string;
    scheduledAt: Date;
    durationMinutes: number;
    type: AppointmentType;
    status: AppointmentStatus;
    chiefComplaint: string | null;
    notes: string | null;
    roomNumber: string | null;
    createdAt: Date;
    updatedAt: Date;
}
export interface TimeSlot {
    startTime: string;
    endTime: string;
    isAvailable: boolean;
    appointmentId?: string;
}
export declare const CreateAppointmentSchema: z.ZodObject<{
    patientId: z.ZodString;
    doctorId: z.ZodString;
    departmentId: z.ZodOptional<z.ZodString>;
    scheduledAt: z.ZodString;
    durationMinutes: z.ZodDefault<z.ZodNumber>;
    type: z.ZodDefault<z.ZodNativeEnum<typeof AppointmentType>>;
    chiefComplaint: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: AppointmentType;
    patientId: string;
    doctorId: string;
    scheduledAt: string;
    durationMinutes: number;
    departmentId?: string | undefined;
    chiefComplaint?: string | undefined;
    notes?: string | undefined;
}, {
    patientId: string;
    doctorId: string;
    scheduledAt: string;
    type?: AppointmentType | undefined;
    departmentId?: string | undefined;
    durationMinutes?: number | undefined;
    chiefComplaint?: string | undefined;
    notes?: string | undefined;
}>;
export type CreateAppointmentDto = z.infer<typeof CreateAppointmentSchema>;
export declare const UpdateAppointmentStatusSchema: z.ZodObject<{
    status: z.ZodNativeEnum<typeof AppointmentStatus>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: AppointmentStatus;
    notes?: string | undefined;
}, {
    status: AppointmentStatus;
    notes?: string | undefined;
}>;
export interface AppointmentQuery {
    date?: string;
    doctorId?: string;
    patientId?: string;
    status?: AppointmentStatus;
    type?: AppointmentType;
    page?: number;
    limit?: number;
}
//# sourceMappingURL=appointment.d.ts.map