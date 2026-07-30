"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateUserSchema = exports.CreateUserSchema = void 0;
const zod_1 = require("zod");
const enums_1 = require("./enums");
exports.CreateUserSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    firstName: zod_1.z.string().min(2).max(50),
    lastName: zod_1.z.string().min(2).max(50),
    phone: zod_1.z.string().optional(),
    password: zod_1.z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
    roles: zod_1.z.array(zod_1.z.nativeEnum(enums_1.SystemRole)).min(1),
});
exports.UpdateUserSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(2).max(50).optional(),
    lastName: zod_1.z.string().min(2).max(50).optional(),
    phone: zod_1.z.string().optional(),
    roles: zod_1.z.array(zod_1.z.nativeEnum(enums_1.SystemRole)).optional(),
});
//# sourceMappingURL=user.js.map