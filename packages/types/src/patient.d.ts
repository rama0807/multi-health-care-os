import { z } from 'zod';
import { BloodGroup, DocumentType, Gender } from './enums';
export interface Patient {
    id: string;
    uhid: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string | null;
    phone: string;
    dateOfBirth: Date;
    age: number;
    gender: Gender;
    bloodGroup: BloodGroup | null;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    organizationId: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface PatientDocument {
    id: string;
    patientId: string;
    documentType: DocumentType;
    fileName: string;
    fileUrl: string;
    mimeType: string;
    fileSizeBytes: number;
    uploadedAt: Date;
}
export declare const CreatePatientSchema: z.ZodObject<{
    firstName: z.ZodString;
    lastName: z.ZodString;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodString;
    dateOfBirth: z.ZodString;
    gender: z.ZodNativeEnum<typeof Gender>;
    bloodGroup: z.ZodOptional<z.ZodNativeEnum<typeof BloodGroup>>;
    address: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodString>;
    pincode: z.ZodOptional<z.ZodString>;
    emergencyContactName: z.ZodOptional<z.ZodString>;
    emergencyContactPhone: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    phone: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: Gender;
    email?: string | undefined;
    address?: string | undefined;
    city?: string | undefined;
    state?: string | undefined;
    pincode?: string | undefined;
    bloodGroup?: BloodGroup | undefined;
    emergencyContactName?: string | undefined;
    emergencyContactPhone?: string | undefined;
}, {
    phone: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: Gender;
    email?: string | undefined;
    address?: string | undefined;
    city?: string | undefined;
    state?: string | undefined;
    pincode?: string | undefined;
    bloodGroup?: BloodGroup | undefined;
    emergencyContactName?: string | undefined;
    emergencyContactPhone?: string | undefined;
}>;
export type CreatePatientDto = z.infer<typeof CreatePatientSchema>;
export declare const UpdatePatientSchema: z.ZodObject<{
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    phone: z.ZodOptional<z.ZodString>;
    dateOfBirth: z.ZodOptional<z.ZodString>;
    gender: z.ZodOptional<z.ZodNativeEnum<typeof Gender>>;
    bloodGroup: z.ZodOptional<z.ZodOptional<z.ZodNativeEnum<typeof BloodGroup>>>;
    address: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    city: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    state: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    pincode: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    emergencyContactName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    emergencyContactPhone: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    email?: string | undefined;
    phone?: string | undefined;
    address?: string | undefined;
    city?: string | undefined;
    state?: string | undefined;
    pincode?: string | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    dateOfBirth?: string | undefined;
    gender?: Gender | undefined;
    bloodGroup?: BloodGroup | undefined;
    emergencyContactName?: string | undefined;
    emergencyContactPhone?: string | undefined;
}, {
    email?: string | undefined;
    phone?: string | undefined;
    address?: string | undefined;
    city?: string | undefined;
    state?: string | undefined;
    pincode?: string | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    dateOfBirth?: string | undefined;
    gender?: Gender | undefined;
    bloodGroup?: BloodGroup | undefined;
    emergencyContactName?: string | undefined;
    emergencyContactPhone?: string | undefined;
}>;
export type UpdatePatientDto = z.infer<typeof UpdatePatientSchema>;
export interface PatientSearchQuery {
    q?: string;
    uhid?: string;
    phone?: string;
    page?: number;
    limit?: number;
}
//# sourceMappingURL=patient.d.ts.map