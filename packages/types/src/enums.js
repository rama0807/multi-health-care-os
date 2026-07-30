"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InsuranceClaimStatus = exports.DocumentType = exports.SystemRole = exports.NotificationChannel = exports.ShiftType = exports.BedStatus = exports.Priority = exports.LabTestStatus = exports.PaymentMode = exports.InvoiceStatus = exports.AppointmentStatus = exports.AppointmentType = exports.BloodGroup = exports.Gender = exports.SubscriptionTier = exports.OrganizationType = void 0;
var OrganizationType;
(function (OrganizationType) {
    OrganizationType["HOSPITAL"] = "HOSPITAL";
    OrganizationType["CLINIC"] = "CLINIC";
    OrganizationType["DIAGNOSTIC_CENTER"] = "DIAGNOSTIC_CENTER";
    OrganizationType["NURSING_HOME"] = "NURSING_HOME";
})(OrganizationType || (exports.OrganizationType = OrganizationType = {}));
var SubscriptionTier;
(function (SubscriptionTier) {
    SubscriptionTier["FREE"] = "FREE";
    SubscriptionTier["STARTER"] = "STARTER";
    SubscriptionTier["PROFESSIONAL"] = "PROFESSIONAL";
    SubscriptionTier["ENTERPRISE"] = "ENTERPRISE";
})(SubscriptionTier || (exports.SubscriptionTier = SubscriptionTier = {}));
var Gender;
(function (Gender) {
    Gender["MALE"] = "MALE";
    Gender["FEMALE"] = "FEMALE";
    Gender["OTHER"] = "OTHER";
})(Gender || (exports.Gender = Gender = {}));
var BloodGroup;
(function (BloodGroup) {
    BloodGroup["A_POSITIVE"] = "A_POSITIVE";
    BloodGroup["A_NEGATIVE"] = "A_NEGATIVE";
    BloodGroup["B_POSITIVE"] = "B_POSITIVE";
    BloodGroup["B_NEGATIVE"] = "B_NEGATIVE";
    BloodGroup["AB_POSITIVE"] = "AB_POSITIVE";
    BloodGroup["AB_NEGATIVE"] = "AB_NEGATIVE";
    BloodGroup["O_POSITIVE"] = "O_POSITIVE";
    BloodGroup["O_NEGATIVE"] = "O_NEGATIVE";
})(BloodGroup || (exports.BloodGroup = BloodGroup = {}));
var AppointmentType;
(function (AppointmentType) {
    AppointmentType["OPD"] = "OPD";
    AppointmentType["IPD"] = "IPD";
    AppointmentType["EMERGENCY"] = "EMERGENCY";
    AppointmentType["PROCEDURE"] = "PROCEDURE";
    AppointmentType["FOLLOW_UP"] = "FOLLOW_UP";
    AppointmentType["TELECONSULTATION"] = "TELECONSULTATION";
})(AppointmentType || (exports.AppointmentType = AppointmentType = {}));
var AppointmentStatus;
(function (AppointmentStatus) {
    AppointmentStatus["SCHEDULED"] = "SCHEDULED";
    AppointmentStatus["CONFIRMED"] = "CONFIRMED";
    AppointmentStatus["ARRIVED"] = "ARRIVED";
    AppointmentStatus["IN_CONSULTATION"] = "IN_CONSULTATION";
    AppointmentStatus["COMPLETED"] = "COMPLETED";
    AppointmentStatus["CANCELLED"] = "CANCELLED";
    AppointmentStatus["NO_SHOW"] = "NO_SHOW";
})(AppointmentStatus || (exports.AppointmentStatus = AppointmentStatus = {}));
var InvoiceStatus;
(function (InvoiceStatus) {
    InvoiceStatus["DRAFT"] = "DRAFT";
    InvoiceStatus["ISSUED"] = "ISSUED";
    InvoiceStatus["PARTIALLY_PAID"] = "PARTIALLY_PAID";
    InvoiceStatus["PAID"] = "PAID";
    InvoiceStatus["OVERDUE"] = "OVERDUE";
    InvoiceStatus["CANCELLED"] = "CANCELLED";
    InvoiceStatus["REFUNDED"] = "REFUNDED";
})(InvoiceStatus || (exports.InvoiceStatus = InvoiceStatus = {}));
var PaymentMode;
(function (PaymentMode) {
    PaymentMode["CASH"] = "CASH";
    PaymentMode["CARD"] = "CARD";
    PaymentMode["UPI"] = "UPI";
    PaymentMode["NEFT"] = "NEFT";
    PaymentMode["RTGS"] = "RTGS";
    PaymentMode["CHEQUE"] = "CHEQUE";
    PaymentMode["INSURANCE"] = "INSURANCE";
})(PaymentMode || (exports.PaymentMode = PaymentMode = {}));
var LabTestStatus;
(function (LabTestStatus) {
    LabTestStatus["ORDERED"] = "ORDERED";
    LabTestStatus["SAMPLE_COLLECTED"] = "SAMPLE_COLLECTED";
    LabTestStatus["IN_PROGRESS"] = "IN_PROGRESS";
    LabTestStatus["COMPLETED"] = "COMPLETED";
    LabTestStatus["REPORTED"] = "REPORTED";
    LabTestStatus["CANCELLED"] = "CANCELLED";
})(LabTestStatus || (exports.LabTestStatus = LabTestStatus = {}));
var Priority;
(function (Priority) {
    Priority["ROUTINE"] = "ROUTINE";
    Priority["URGENT"] = "URGENT";
    Priority["STAT"] = "STAT";
})(Priority || (exports.Priority = Priority = {}));
var BedStatus;
(function (BedStatus) {
    BedStatus["AVAILABLE"] = "AVAILABLE";
    BedStatus["OCCUPIED"] = "OCCUPIED";
    BedStatus["RESERVED"] = "RESERVED";
    BedStatus["UNDER_MAINTENANCE"] = "UNDER_MAINTENANCE";
})(BedStatus || (exports.BedStatus = BedStatus = {}));
var ShiftType;
(function (ShiftType) {
    ShiftType["MORNING"] = "MORNING";
    ShiftType["AFTERNOON"] = "AFTERNOON";
    ShiftType["NIGHT"] = "NIGHT";
    ShiftType["ROTATING"] = "ROTATING";
})(ShiftType || (exports.ShiftType = ShiftType = {}));
var NotificationChannel;
(function (NotificationChannel) {
    NotificationChannel["EMAIL"] = "EMAIL";
    NotificationChannel["SMS"] = "SMS";
    NotificationChannel["PUSH"] = "PUSH";
    NotificationChannel["IN_APP"] = "IN_APP";
    NotificationChannel["WHATSAPP"] = "WHATSAPP";
})(NotificationChannel || (exports.NotificationChannel = NotificationChannel = {}));
var SystemRole;
(function (SystemRole) {
    SystemRole["SUPER_ADMIN"] = "SUPER_ADMIN";
    SystemRole["ORG_ADMIN"] = "ORG_ADMIN";
    SystemRole["DOCTOR"] = "DOCTOR";
    SystemRole["NURSE"] = "NURSE";
    SystemRole["RECEPTIONIST"] = "RECEPTIONIST";
    SystemRole["LAB_TECHNICIAN"] = "LAB_TECHNICIAN";
    SystemRole["RADIOLOGY_TECHNICIAN"] = "RADIOLOGY_TECHNICIAN";
    SystemRole["PHARMACIST"] = "PHARMACIST";
    SystemRole["BILLING_STAFF"] = "BILLING_STAFF";
    SystemRole["INVENTORY_MANAGER"] = "INVENTORY_MANAGER";
})(SystemRole || (exports.SystemRole = SystemRole = {}));
var DocumentType;
(function (DocumentType) {
    DocumentType["AADHAAR"] = "AADHAAR";
    DocumentType["PAN"] = "PAN";
    DocumentType["PASSPORT"] = "PASSPORT";
    DocumentType["DRIVING_LICENSE"] = "DRIVING_LICENSE";
    DocumentType["INSURANCE_CARD"] = "INSURANCE_CARD";
    DocumentType["MEDICAL_REPORT"] = "MEDICAL_REPORT";
    DocumentType["PRESCRIPTION"] = "PRESCRIPTION";
    DocumentType["OTHER"] = "OTHER";
})(DocumentType || (exports.DocumentType = DocumentType = {}));
var InsuranceClaimStatus;
(function (InsuranceClaimStatus) {
    InsuranceClaimStatus["DRAFT"] = "DRAFT";
    InsuranceClaimStatus["SUBMITTED"] = "SUBMITTED";
    InsuranceClaimStatus["UNDER_REVIEW"] = "UNDER_REVIEW";
    InsuranceClaimStatus["APPROVED"] = "APPROVED";
    InsuranceClaimStatus["PARTIALLY_APPROVED"] = "PARTIALLY_APPROVED";
    InsuranceClaimStatus["REJECTED"] = "REJECTED";
    InsuranceClaimStatus["SETTLED"] = "SETTLED";
})(InsuranceClaimStatus || (exports.InsuranceClaimStatus = InsuranceClaimStatus = {}));
//# sourceMappingURL=enums.js.map