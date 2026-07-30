"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResetPasswordSchema = exports.ForgotPasswordSchema = exports.RegisterOrganizationSchema = exports.LoginSchema = void 0;
const zod_1 = require("zod");
exports.LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
    organizationSlug: zod_1.z.string().optional(),
});
exports.RegisterOrganizationSchema = zod_1.z.object({
    organizationName: zod_1.z.string().min(2).max(100),
    organizationSlug: zod_1.z
        .string()
        .min(2)
        .max(50)
        .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
    adminFirstName: zod_1.z.string().min(2).max(50),
    adminLastName: zod_1.z.string().min(2).max(50),
    adminEmail: zod_1.z.string().email(),
    adminPassword: zod_1.z
        .string()
        .min(8)
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number'),
    phone: zod_1.z.string().regex(/^[6-9]\d{9}$/, 'Enter valid Indian mobile number'),
});
exports.ForgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
});
exports.ResetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string(),
    password: zod_1.z
        .string()
        .min(8)
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
});
//# sourceMappingURL=auth.js.map