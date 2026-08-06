# Module: Patient Management

## Purpose
Central patient registry. Every patient in the hospital has a record here. This module is the foundation - all other clinical and billing modules reference patients.

## Responsibilities
- Patient registration with auto-generated UHID
- Patient search (name, phone, UHID, email)
- Patient profile management
- Document management (ID proofs, insurance cards)
- Duplicate patient detection and merge
- Patient history aggregation (timeline)

## Database Entities
- `Patient` - core record
- `PatientDocument` - uploaded files

## REST Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/patients` | List patients (paginated, filtered) | `patients:read` |
| POST | `/patients` | Register new patient | `patients:write` |
| GET | `/patients/:id` | Patient profile | `patients:read` |
| PATCH | `/patients/:id` | Update patient info | `patients:write` |
| DELETE | `/patients/:id` | Soft delete patient | `patients:delete` |
| GET | `/patients/search` | Search by name/phone/UHID | `patients:read` |
| POST | `/patients/:id/documents` | Upload document | `patients:write` |
| GET | `/patients/:id/documents` | List documents | `patients:read` |
| DELETE | `/patients/:id/documents/:docId` | Delete document | `patients:write` |
| GET | `/patients/:id/timeline` | Full patient timeline | `patients:read` |
| POST | `/patients/merge` | Merge duplicate patients | `patients:admin` |
| POST | `/patients/import` | Bulk import from CSV | `patients:admin` |

## UHID Generation

Format: `{orgPrefix}-{YYYY}-{000001}`

Rules:
- Prefix configured per organization (default: "MED")
- Year resets sequence annually (configurable)
- Zero-padded 6 digits
- Globally unique within the organization

```typescript
async generateUHID(organizationId: string): Promise<string> {
  const org = await this.orgService.findById(organizationId)
  const year = new Date().getFullYear()
  const count = await this.prisma.patient.count({
    where: { organizationId, createdAt: { gte: new Date(`${year}-01-01`) } }
  })
  const prefix = org.settings?.uhidPrefix ?? 'MED'
  return `${prefix}-${year}-${String(count + 1).padStart(6, '0')}`
}
```

## Search Implementation

Uses PostgreSQL full-text search with `tsvector`:

```sql
-- tsvector column updated on insert/update
to_tsvector('english', first_name || ' ' || last_name || ' ' || uhid || ' ' || phone)
```

Fallback to `ILIKE` for simple prefix matching.

## Dependencies
- `StorageService` - file upload/download via S3/MinIO
- `OrganizationsModule` - org settings (UHID prefix)

## Events Published
- `patient.registered`
- `patient.updated`
- `patient.deleted`
- `patient.document_uploaded`

## Future Improvements
- ABHA (Ayushman Bharat Health Account) ID integration
- Aadhaar-based eKYC for patient verification
- Patient portal login (separate app)
- WhatsApp contact sync for appointment reminders
