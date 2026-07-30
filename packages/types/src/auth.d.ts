import { z } from 'zod';
import { SystemRole } from './enums';
export interface JwtPayload {
    sub: string;
    email: string;
    orgId: string;
    orgSlug: string;
    roles: SystemRole[];
    sessionId: string;
    iat: number;
    exp: number;
}
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}
export interface SessionInfo {
    sessionId: string;
    userId: string;
    userAgent: string;
    ipAddress: string;
    createdAt: Date;
    lastUsedAt: Date;
    isCurrent: boolean;
}
export declare const LoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    organizationSlug: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    password: string;
    email: string;
    organizationSlug?: string | undefined;
}, {
    password: string;
    email: string;
    organizationSlug?: string | undefined;
}>;
export type LoginDto = z.infer<typeof LoginSchema>;
export declare const RegisterOrganizationSchema: z.ZodObject<{
    organizationName: z.ZodString;
    organizationSlug: z.ZodString;
    adminFirstName: z.ZodString;
    adminLastName: z.ZodString;
    adminEmail: z.ZodString;
    adminPassword: z.ZodString;
    phone: z.ZodString;
}, "strip", z.ZodTypeAny, {
    organizationSlug: string;
    organizationName: string;
    adminFirstName: string;
    adminLastName: string;
    adminEmail: string;
    adminPassword: string;
    phone: string;
}, {
    organizationSlug: string;
    organizationName: string;
    adminFirstName: string;
    adminLastName: string;
    adminEmail: string;
    adminPassword: string;
    phone: string;
}>;
export type RegisterOrganizationDto = z.infer<typeof RegisterOrganizationSchema>;
export declare const ForgotPasswordSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export declare const ResetPasswordSchema: z.ZodObject<{
    token: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
    token: string;
}, {
    password: string;
    token: string;
}>;
//# sourceMappingURL=auth.d.ts.map