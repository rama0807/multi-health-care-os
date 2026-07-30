import { z } from 'zod';
import { OrganizationType, SubscriptionTier } from './enums';
export interface Organization {
    id: string;
    name: string;
    slug: string;
    type: OrganizationType;
    email: string;
    phone: string;
    address: string | null;
    city: string | null;
    state: string | null;
    country: string;
    pincode: string | null;
    logo: string | null;
    website: string | null;
    licenseNumber: string | null;
    subscriptionTier: SubscriptionTier;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface OrganizationSettings {
    uhidPrefix: string;
    uhidResetYearly: boolean;
    timezone: string;
    currency: string;
    currencySymbol: string;
    dateFormat: string;
    timeFormat: '12h' | '24h';
    gstNumber?: string;
    gstRate: number;
    defaultAppointmentDuration: number;
    workingDays: number[];
    workingHoursStart: string;
    workingHoursEnd: string;
}
export declare const UpdateOrganizationSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodString>;
    pincode: z.ZodOptional<z.ZodString>;
    website: z.ZodOptional<z.ZodString>;
    licenseNumber: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    email?: string | undefined;
    phone?: string | undefined;
    address?: string | undefined;
    city?: string | undefined;
    state?: string | undefined;
    pincode?: string | undefined;
    website?: string | undefined;
    licenseNumber?: string | undefined;
}, {
    name?: string | undefined;
    email?: string | undefined;
    phone?: string | undefined;
    address?: string | undefined;
    city?: string | undefined;
    state?: string | undefined;
    pincode?: string | undefined;
    website?: string | undefined;
    licenseNumber?: string | undefined;
}>;
//# sourceMappingURL=organization.d.ts.map