"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdatePatientSchema = exports.CreatePatientSchema = void 0;
const zod_1 = require("zod");
const enums_1 = require("./enums");
exports.CreatePatientSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(2).max(50),
    lastName: zod_1.z.string().min(2).max(50),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().regex(/^[6-9]\d{9}$/, 'Enter valid Indian mobile number'),
    dateOfBirth: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
    gender: zod_1.z.nativeEnum(enums_1.Gender),
    bloodGroup: zod_1.z.nativeEnum(enums_1.BloodGroup).optional(),
    address: zod_1.z.string().max(200).optional(),
    city: zod_1.z.string().max(50).optional(),
    state: zod_1.z.string().max(50).optional(),
    pincode: zod_1.z.string().regex(/^\d{6}$/).optional(),
    emergencyContactName: zod_1.z.string().max(50).optional(),
    emergencyContactPhone: zod_1.z
        .string()
        .regex(/^[6-9]\d{9}$/)
        .optional(),
});
exports.UpdatePatientSchema = exports.CreatePatientSchema.partial();
//# sourceMappingURL=patient.js.map