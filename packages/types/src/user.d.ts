import { z } from 'zod';
import { SystemRole } from './enums';
export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    fullName: string;
    phone: string | null;
    avatar: string | null;
    isActive: boolean;
    isEmailVerified: boolean;
    organizationId: string;
    roles: SystemRole[];
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
export declare const CreateUserSchema: z.ZodObject<{
    email: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    password: z.ZodString;
    roles: z.ZodArray<z.ZodNativeEnum<typeof SystemRole>, "many">;
}, "strip", z.ZodTypeAny, {
    password: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: SystemRole[];
    phone?: string | undefined;
}, {
    password: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: SystemRole[];
    phone?: string | undefined;
}>;
export type CreateUserDto = z.infer<typeof CreateUserSchema>;
export declare const UpdateUserSchema: z.ZodObject<{
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    roles: z.ZodOptional<z.ZodArray<z.ZodNativeEnum<typeof SystemRole>, "many">>;
}, "strip", z.ZodTypeAny, {
    phone?: string | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    roles?: SystemRole[] | undefined;
}, {
    phone?: string | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    roles?: SystemRole[] | undefined;
}>;
export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
//# sourceMappingURL=user.d.ts.map