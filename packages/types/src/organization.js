"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateOrganizationSchema = void 0;
const zod_1 = require("zod");
exports.UpdateOrganizationSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(100).optional(),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    state: zod_1.z.string().optional(),
    pincode: zod_1.z.string().optional(),
    website: zod_1.z.string().url().optional(),
    licenseNumber: zod_1.z.string().optional(),
});
//# sourceMappingURL=organization.js.map