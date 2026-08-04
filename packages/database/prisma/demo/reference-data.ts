/**
 * Static reference data for the demo seed — clinically and commercially
 * plausible content for an Indian multi-speciality hospital, matching the
 * demo organization the base seed creates (Mumbai, INR, 18% GST).
 *
 * Consumed exclusively by `prisma/seed-demo.ts`. Every organisation, person,
 * vendor and insurer here is invented; external domains use `.example`.
 */

// ─── People ────────────────────────────────────────────────────────────────

export const FIRST_NAMES_MALE = [
  'Aarav', 'Rohan', 'Aditya', 'Vivek', 'Karan', 'Nikhil', 'Suresh', 'Manish',
  'Rahul', 'Sanjay', 'Imran', 'Yash', 'Devendra', 'Prakash', 'Anil', 'Harsh',
  'Tarun', 'Gopal', 'Ashok', 'Ravi',
] as const

export const FIRST_NAMES_FEMALE = [
  'Ananya', 'Kavya', 'Sneha', 'Divya', 'Pooja', 'Nisha', 'Rekha', 'Sunita',
  'Ishita', 'Meera', 'Fatima', 'Shalini', 'Aarti', 'Neha', 'Lakshmi', 'Bhavna',
  'Ritu', 'Swati', 'Anjali', 'Preeti',
] as const

export const LAST_NAMES = [
  'Sharma', 'Patil', 'Deshmukh', 'Iyer', 'Nair', 'Reddy', 'Gupta', 'Verma',
  'Kulkarni', 'Joshi', 'Shetty', 'Menon', 'Chauhan', 'Bhatt', 'Sinha', 'Rao',
  'Pillai', 'Khan', 'Sethi', 'Mehta', 'Naik', 'Bose', 'Kamath', 'Thakur',
] as const

export const MUMBAI_LOCALITIES = [
  { area: 'Andheri West', pincode: '400058' },
  { area: 'Bandra East', pincode: '400051' },
  { area: 'Dadar West', pincode: '400028' },
  { area: 'Powai', pincode: '400076' },
  { area: 'Malad West', pincode: '400064' },
  { area: 'Chembur', pincode: '400071' },
  { area: 'Borivali East', pincode: '400066' },
  { area: 'Ghatkopar West', pincode: '400086' },
  { area: 'Thane West', pincode: '400601' },
  { area: 'Vashi, Navi Mumbai', pincode: '400703' },
] as const

/** Weighted toward the commoner Indian blood groups. */
export const BLOOD_GROUPS = [
  'O_POSITIVE', 'O_POSITIVE', 'B_POSITIVE', 'B_POSITIVE', 'A_POSITIVE',
  'A_POSITIVE', 'AB_POSITIVE', 'O_NEGATIVE', 'B_NEGATIVE', 'A_NEGATIVE',
] as const

// ─── Departments added on top of the base seed's GENMED/CARDIO/EMRG/LAB ────

export const EXTRA_DEPARTMENTS = [
  { code: 'ORTHO', name: 'Orthopaedics' },
  { code: 'PEDIA', name: 'Paediatrics' },
  { code: 'OBGYN', name: 'Obstetrics & Gynaecology' },
  { code: 'SURG', name: 'General Surgery' },
  { code: 'RADIO', name: 'Radiology' },
  { code: 'NEURO', name: 'Neurology' },
] as const

// ─── Doctors (in addition to the base seed's Dr. Priya Sharma, Cardiology) ──

export interface DoctorSpec {
  email: string
  firstName: string
  lastName: string
  departmentCode: string
  registrationNumber: string
  specialization: string
  subSpecialization?: string
  qualification: string
  experienceYears: number
  consultationFee: number
  languages: string[]
  bio: string
  joiningYearsAgo: number
}

export const DOCTOR_SPECS: DoctorSpec[] = [
  {
    email: 'rajesh.menon@medicore.demo',
    firstName: 'Rajesh',
    lastName: 'Menon',
    departmentCode: 'GENMED',
    registrationNumber: 'MCI-2008-004512',
    specialization: 'General Medicine',
    subSpecialization: 'Diabetology',
    qualification: 'MBBS, MD (General Medicine)',
    experienceYears: 17,
    consultationFee: 600,
    languages: ['English', 'Hindi', 'Malayalam'],
    bio: 'Consultant physician with a special interest in diabetes and metabolic disorders.',
    joiningYearsAgo: 6,
  },
  {
    email: 'anjali.deshpande@medicore.demo',
    firstName: 'Anjali',
    lastName: 'Deshpande',
    departmentCode: 'ORTHO',
    registrationNumber: 'MCI-2012-007781',
    specialization: 'Orthopaedics',
    subSpecialization: 'Joint Replacement',
    qualification: 'MBBS, MS (Orthopaedics)',
    experienceYears: 13,
    consultationFee: 900,
    languages: ['English', 'Hindi', 'Marathi'],
    bio: 'Orthopaedic surgeon specialising in primary and revision joint replacement.',
    joiningYearsAgo: 5,
  },
  {
    email: 'vikram.iyer@medicore.demo',
    firstName: 'Vikram',
    lastName: 'Iyer',
    departmentCode: 'SURG',
    registrationNumber: 'MCI-2006-002310',
    specialization: 'General Surgery',
    subSpecialization: 'Laparoscopic Surgery',
    qualification: 'MBBS, MS (General Surgery), FMAS',
    experienceYears: 19,
    consultationFee: 1000,
    languages: ['English', 'Hindi', 'Tamil'],
    bio: 'Senior consultant surgeon with a laparoscopic and gastrointestinal practice.',
    joiningYearsAgo: 8,
  },
  {
    email: 'sneha.kulkarni@medicore.demo',
    firstName: 'Sneha',
    lastName: 'Kulkarni',
    departmentCode: 'OBGYN',
    registrationNumber: 'MCI-2013-009045',
    specialization: 'Obstetrics & Gynaecology',
    subSpecialization: 'High-Risk Obstetrics',
    qualification: 'MBBS, MS (Obstetrics & Gynaecology)',
    experienceYears: 12,
    consultationFee: 800,
    languages: ['English', 'Hindi', 'Marathi'],
    bio: 'Obstetrician and gynaecologist managing high-risk pregnancies and infertility care.',
    joiningYearsAgo: 4,
  },
  {
    email: 'arjun.nair@medicore.demo',
    firstName: 'Arjun',
    lastName: 'Nair',
    departmentCode: 'PEDIA',
    registrationNumber: 'MCI-2015-011238',
    specialization: 'Paediatrics',
    subSpecialization: 'Neonatology',
    qualification: 'MBBS, MD (Paediatrics)',
    experienceYears: 10,
    consultationFee: 700,
    languages: ['English', 'Hindi', 'Malayalam'],
    bio: 'Paediatrician and neonatologist running the newborn follow-up clinic.',
    joiningYearsAgo: 3,
  },
  {
    email: 'farhan.qureshi@medicore.demo',
    firstName: 'Farhan',
    lastName: 'Qureshi',
    departmentCode: 'RADIO',
    registrationNumber: 'MCI-2011-006620',
    specialization: 'Radiodiagnosis',
    subSpecialization: 'Cross-sectional Imaging',
    qualification: 'MBBS, MD (Radiodiagnosis)',
    experienceYears: 14,
    consultationFee: 750,
    languages: ['English', 'Hindi', 'Urdu'],
    bio: 'Consultant radiologist reporting CT, MRI and ultrasound studies.',
    joiningYearsAgo: 6,
  },
  {
    email: 'meera.reddy@medicore.demo',
    firstName: 'Meera',
    lastName: 'Reddy',
    departmentCode: 'EMRG',
    registrationNumber: 'MCI-2014-010334',
    specialization: 'Emergency Medicine',
    qualification: 'MBBS, MD (Emergency Medicine)',
    experienceYears: 11,
    consultationFee: 650,
    languages: ['English', 'Hindi', 'Telugu'],
    bio: 'Emergency physician leading the casualty and trauma triage team.',
    joiningYearsAgo: 4,
  },
]

// ─── Presenting complaints → diagnosis, mapped per speciality ──────────────

export interface ComplaintSpec {
  complaint: string
  hpi: string
  diagnosis: string
  icd: string
  specialities: string[]
}

export const COMPLAINTS: ComplaintSpec[] = [
  {
    complaint: 'Fever with chills for 3 days',
    hpi: 'Intermittent high-grade fever for three days with rigors, generalised body ache and reduced appetite. No cough or urinary symptoms.',
    diagnosis: 'Acute viral febrile illness',
    icd: 'B34.9',
    specialities: ['General Medicine', 'Emergency Medicine', 'Paediatrics'],
  },
  {
    complaint: 'Chest discomfort on exertion',
    hpi: 'Retrosternal heaviness on climbing two flights of stairs for the last two weeks, relieved by rest. No syncope or orthopnoea.',
    diagnosis: 'Stable angina pectoris',
    icd: 'I20.9',
    specialities: ['Cardiology', 'General Medicine'],
  },
  {
    complaint: 'Uncontrolled blood sugar on review',
    hpi: 'Known type 2 diabetic for eight years on oral hypoglycaemics, reports fasting sugars in the 180-220 mg/dL range for a month.',
    diagnosis: 'Type 2 diabetes mellitus with poor glycaemic control',
    icd: 'E11.9',
    specialities: ['General Medicine', 'Cardiology'],
  },
  {
    complaint: 'Low back pain radiating to left leg',
    hpi: 'Mechanical low back pain for six weeks radiating below the knee, aggravated by prolonged sitting. No bladder or bowel involvement.',
    diagnosis: 'Lumbar disc prolapse with radiculopathy',
    icd: 'M51.1',
    specialities: ['Orthopaedics', 'Neurology'],
  },
  {
    complaint: 'Right knee pain and difficulty walking',
    hpi: 'Progressive right knee pain for two years, worse on stairs, with morning stiffness lasting under thirty minutes.',
    diagnosis: 'Primary osteoarthritis of right knee',
    icd: 'M17.1',
    specialities: ['Orthopaedics'],
  },
  {
    complaint: 'Pain in right lower abdomen',
    hpi: 'Periumbilical pain since last night that shifted to the right iliac fossa, with nausea and one episode of vomiting.',
    diagnosis: 'Acute appendicitis',
    icd: 'K35.80',
    specialities: ['General Surgery', 'Emergency Medicine'],
  },
  {
    complaint: 'Antenatal check-up at 32 weeks',
    hpi: 'Second gravida at 32 weeks by dates, no bleeding or leaking, good foetal movements. Blood pressure trending upward at last two visits.',
    diagnosis: 'Antenatal care of second pregnancy, gestational hypertension',
    icd: 'O13',
    specialities: ['Obstetrics & Gynaecology'],
  },
  {
    complaint: 'Cough and breathlessness for a week',
    hpi: 'Productive cough with yellow expectoration and exertional breathlessness for a week, low-grade fever. Non-smoker.',
    diagnosis: 'Community-acquired pneumonia',
    icd: 'J18.9',
    specialities: ['General Medicine', 'Emergency Medicine', 'Paediatrics'],
  },
  {
    complaint: 'Loose stools and vomiting since morning',
    hpi: 'Six episodes of watery stools and three of vomiting since morning after eating outside food. Passing reduced urine.',
    diagnosis: 'Acute gastroenteritis with mild dehydration',
    icd: 'A09',
    specialities: ['General Medicine', 'Paediatrics', 'Emergency Medicine'],
  },
  {
    complaint: 'Headache with visual aura',
    hpi: 'Recurrent unilateral throbbing headache preceded by shimmering visual aura, two to three episodes a month, with photophobia.',
    diagnosis: 'Migraine with aura',
    icd: 'G43.1',
    specialities: ['Neurology', 'General Medicine'],
  },
  {
    complaint: 'Child not feeding well, febrile',
    hpi: 'Eighteen-month-old with fever and reduced feeding for two days, pulling at the right ear, irritable at night.',
    diagnosis: 'Acute suppurative otitis media',
    icd: 'H66.0',
    specialities: ['Paediatrics'],
  },
  {
    complaint: 'Road traffic accident, injury to left forearm',
    hpi: 'Two-wheeler skid an hour ago, fall on outstretched hand, painful swollen left forearm, no head injury or loss of consciousness.',
    diagnosis: 'Closed fracture of left radius shaft',
    icd: 'S52.30',
    specialities: ['Emergency Medicine', 'Orthopaedics'],
  },
]

export const PROCEDURE_NAMES = [
  'Wound dressing',
  'Nebulisation',
  'Intravenous fluid administration',
  'Electrocardiogram',
  'Plaster of Paris slab application',
  'Foley catheterisation',
  'Suture removal',
  'Incision and drainage',
] as const

// ─── Laboratory catalog ────────────────────────────────────────────────────

export interface LabCatalogSpec {
  testCode: string
  testName: string
  category: string
  unit?: string
  low?: number
  high?: number
  text?: string
  criticalLow?: number
  criticalHigh?: number
  price: number
}

export const LAB_CATALOG: LabCatalogSpec[] = [
  { testCode: 'HB', testName: 'Haemoglobin', category: 'Haematology', unit: 'g/dL', low: 12, high: 16, criticalLow: 7, criticalHigh: 20, price: 150 },
  { testCode: 'TLC', testName: 'Total Leucocyte Count', category: 'Haematology', unit: 'cells/µL', low: 4000, high: 11000, criticalHigh: 30000, price: 180 },
  { testCode: 'PLT', testName: 'Platelet Count', category: 'Haematology', unit: '×10³/µL', low: 150, high: 410, criticalLow: 20, price: 200 },
  { testCode: 'ESR', testName: 'Erythrocyte Sedimentation Rate', category: 'Haematology', unit: 'mm/hr', low: 0, high: 20, price: 120 },
  { testCode: 'FBS', testName: 'Fasting Blood Sugar', category: 'Biochemistry', unit: 'mg/dL', low: 70, high: 100, criticalLow: 45, criticalHigh: 400, price: 100 },
  { testCode: 'PPBS', testName: 'Post Prandial Blood Sugar', category: 'Biochemistry', unit: 'mg/dL', low: 70, high: 140, criticalHigh: 450, price: 100 },
  { testCode: 'HBA1C', testName: 'Glycated Haemoglobin (HbA1c)', category: 'Biochemistry', unit: '%', low: 4, high: 5.7, price: 550 },
  { testCode: 'CREAT', testName: 'Serum Creatinine', category: 'Biochemistry', unit: 'mg/dL', low: 0.6, high: 1.3, criticalHigh: 5, price: 180 },
  { testCode: 'UREA', testName: 'Blood Urea', category: 'Biochemistry', unit: 'mg/dL', low: 15, high: 45, price: 160 },
  { testCode: 'NA', testName: 'Serum Sodium', category: 'Biochemistry', unit: 'mmol/L', low: 135, high: 145, criticalLow: 120, criticalHigh: 160, price: 200 },
  { testCode: 'K', testName: 'Serum Potassium', category: 'Biochemistry', unit: 'mmol/L', low: 3.5, high: 5.1, criticalLow: 2.5, criticalHigh: 6.5, price: 200 },
  { testCode: 'SGPT', testName: 'Alanine Aminotransferase (SGPT)', category: 'Biochemistry', unit: 'U/L', low: 7, high: 56, price: 220 },
  { testCode: 'SGOT', testName: 'Aspartate Aminotransferase (SGOT)', category: 'Biochemistry', unit: 'U/L', low: 10, high: 40, price: 220 },
  { testCode: 'TBIL', testName: 'Total Bilirubin', category: 'Biochemistry', unit: 'mg/dL', low: 0.2, high: 1.2, price: 190 },
  { testCode: 'TSH', testName: 'Thyroid Stimulating Hormone', category: 'Endocrinology', unit: 'µIU/mL', low: 0.4, high: 4.2, price: 400 },
  { testCode: 'CHOL', testName: 'Total Cholesterol', category: 'Biochemistry', unit: 'mg/dL', low: 120, high: 200, price: 450 },
  { testCode: 'TROPI', testName: 'Troponin I', category: 'Cardiac Markers', unit: 'ng/mL', low: 0, high: 0.04, criticalHigh: 0.5, price: 1200 },
  { testCode: 'CRP', testName: 'C-Reactive Protein', category: 'Immunology', unit: 'mg/L', low: 0, high: 5, price: 500 },
  { testCode: 'URINE', testName: 'Urine Routine Examination', category: 'Clinical Pathology', text: 'Normal', price: 150 },
  { testCode: 'DENGUE', testName: 'Dengue NS1 Antigen', category: 'Serology', text: 'Negative', price: 700 },
  { testCode: 'MP', testName: 'Malaria Parasite (Rapid)', category: 'Serology', text: 'Negative', price: 350 },
  { testCode: 'BLDGRP', testName: 'Blood Group & Rh Typing', category: 'Immunohaematology', text: 'A/B/AB/O with Rh', price: 200 },
]

// ─── Radiology catalog ─────────────────────────────────────────────────────

export interface RadiologyCatalogSpec {
  code: string
  name: string
  category: string
  modality: string
  bodyPart: string
  contrastRequired: boolean
  price: number
  durationMinutes: number
}

export const RADIOLOGY_CATALOG: RadiologyCatalogSpec[] = [
  { code: 'XR-CHEST-PA', name: 'X-Ray Chest PA View', category: 'X-Ray', modality: 'CR', bodyPart: 'Chest', contrastRequired: false, price: 400, durationMinutes: 10 },
  { code: 'XR-KNEE-AP', name: 'X-Ray Knee AP & Lateral', category: 'X-Ray', modality: 'CR', bodyPart: 'Knee', contrastRequired: false, price: 500, durationMinutes: 10 },
  { code: 'XR-FOREARM', name: 'X-Ray Forearm AP & Lateral', category: 'X-Ray', modality: 'CR', bodyPart: 'Forearm', contrastRequired: false, price: 500, durationMinutes: 10 },
  { code: 'XR-LSSPINE', name: 'X-Ray Lumbosacral Spine', category: 'X-Ray', modality: 'CR', bodyPart: 'Lumbar Spine', contrastRequired: false, price: 650, durationMinutes: 15 },
  { code: 'US-ABD', name: 'Ultrasound Whole Abdomen', category: 'Ultrasound', modality: 'US', bodyPart: 'Abdomen', contrastRequired: false, price: 1200, durationMinutes: 25 },
  { code: 'US-OBS', name: 'Obstetric Ultrasound (Growth Scan)', category: 'Ultrasound', modality: 'US', bodyPart: 'Pelvis', contrastRequired: false, price: 1500, durationMinutes: 30 },
  { code: 'US-KUB', name: 'Ultrasound KUB', category: 'Ultrasound', modality: 'US', bodyPart: 'Abdomen', contrastRequired: false, price: 1000, durationMinutes: 20 },
  { code: 'CT-BRAIN', name: 'CT Brain Plain', category: 'CT', modality: 'CT', bodyPart: 'Head', contrastRequired: false, price: 3500, durationMinutes: 20 },
  { code: 'CT-ABD-C', name: 'CT Abdomen & Pelvis with Contrast', category: 'CT', modality: 'CT', bodyPart: 'Abdomen', contrastRequired: true, price: 7500, durationMinutes: 35 },
  { code: 'CT-CHEST', name: 'CT Chest (HRCT)', category: 'CT', modality: 'CT', bodyPart: 'Chest', contrastRequired: false, price: 5500, durationMinutes: 25 },
  { code: 'MR-BRAIN', name: 'MRI Brain Plain', category: 'MRI', modality: 'MR', bodyPart: 'Head', contrastRequired: false, price: 9000, durationMinutes: 45 },
  { code: 'MR-LSSPINE', name: 'MRI Lumbosacral Spine', category: 'MRI', modality: 'MR', bodyPart: 'Lumbar Spine', contrastRequired: false, price: 9500, durationMinutes: 45 },
  { code: 'MAMMO', name: 'Digital Mammography Bilateral', category: 'Mammography', modality: 'MG', bodyPart: 'Breast', contrastRequired: false, price: 2800, durationMinutes: 25 },
  { code: 'ECHO', name: '2D Echocardiography', category: 'Ultrasound', modality: 'US', bodyPart: 'Heart', contrastRequired: false, price: 2200, durationMinutes: 30 },
]

// ─── Pharmacy catalog (one row per batch, per ADR-0014) ────────────────────

export interface DrugSpec {
  genericName: string
  brandName: string
  strength: string
  dosageForm: string
  manufacturer: string
  price: number
  taxPercent: number
}

export const DRUGS: DrugSpec[] = [
  { genericName: 'Paracetamol', brandName: 'Dolo 650', strength: '650 mg', dosageForm: 'Tablet', manufacturer: 'Micro Labs', price: 2.2, taxPercent: 12 },
  { genericName: 'Amoxicillin + Clavulanic Acid', brandName: 'Augmentin 625', strength: '625 mg', dosageForm: 'Tablet', manufacturer: 'GSK', price: 18.5, taxPercent: 12 },
  { genericName: 'Azithromycin', brandName: 'Azithral 500', strength: '500 mg', dosageForm: 'Tablet', manufacturer: 'Alembic', price: 26.0, taxPercent: 12 },
  { genericName: 'Pantoprazole', brandName: 'Pan 40', strength: '40 mg', dosageForm: 'Tablet', manufacturer: 'Alkem', price: 9.4, taxPercent: 12 },
  { genericName: 'Metformin', brandName: 'Glycomet 500', strength: '500 mg', dosageForm: 'Tablet', manufacturer: 'USV', price: 3.1, taxPercent: 12 },
  { genericName: 'Glimepiride', brandName: 'Amaryl 2', strength: '2 mg', dosageForm: 'Tablet', manufacturer: 'Sanofi', price: 8.7, taxPercent: 12 },
  { genericName: 'Atorvastatin', brandName: 'Atorva 20', strength: '20 mg', dosageForm: 'Tablet', manufacturer: 'Zydus', price: 11.2, taxPercent: 12 },
  { genericName: 'Aspirin', brandName: 'Ecosprin 75', strength: '75 mg', dosageForm: 'Tablet', manufacturer: 'USV', price: 1.4, taxPercent: 12 },
  { genericName: 'Clopidogrel', brandName: 'Clopilet 75', strength: '75 mg', dosageForm: 'Tablet', manufacturer: 'Sun Pharma', price: 12.6, taxPercent: 12 },
  { genericName: 'Amlodipine', brandName: 'Amlong 5', strength: '5 mg', dosageForm: 'Tablet', manufacturer: 'Micro Labs', price: 4.3, taxPercent: 12 },
  { genericName: 'Telmisartan', brandName: 'Telma 40', strength: '40 mg', dosageForm: 'Tablet', manufacturer: 'Glenmark', price: 10.8, taxPercent: 12 },
  { genericName: 'Metoprolol', brandName: 'Metolar XR 25', strength: '25 mg', dosageForm: 'Tablet', manufacturer: 'Cipla', price: 6.5, taxPercent: 12 },
  { genericName: 'Levothyroxine', brandName: 'Thyronorm 50', strength: '50 mcg', dosageForm: 'Tablet', manufacturer: 'Abbott', price: 2.8, taxPercent: 12 },
  { genericName: 'Cetirizine', brandName: 'Cetzine 10', strength: '10 mg', dosageForm: 'Tablet', manufacturer: 'GSK', price: 2.0, taxPercent: 12 },
  { genericName: 'Ondansetron', brandName: 'Emeset 4', strength: '4 mg', dosageForm: 'Tablet', manufacturer: 'Cipla', price: 5.6, taxPercent: 12 },
  { genericName: 'Diclofenac', brandName: 'Voveran 50', strength: '50 mg', dosageForm: 'Tablet', manufacturer: 'Novartis', price: 4.8, taxPercent: 12 },
  { genericName: 'Tramadol + Paracetamol', brandName: 'Ultracet', strength: '37.5 mg', dosageForm: 'Tablet', manufacturer: 'Janssen', price: 14.5, taxPercent: 12 },
  { genericName: 'Ceftriaxone', brandName: 'Monocef 1g', strength: '1 g', dosageForm: 'Injection', manufacturer: 'Aristo', price: 62.0, taxPercent: 12 },
  { genericName: 'Ondansetron', brandName: 'Emeset Injection', strength: '2 mg/mL', dosageForm: 'Injection', manufacturer: 'Cipla', price: 18.0, taxPercent: 12 },
  { genericName: 'Pantoprazole', brandName: 'Pantop IV 40', strength: '40 mg', dosageForm: 'Injection', manufacturer: 'Aristo', price: 48.0, taxPercent: 12 },
  { genericName: 'Enoxaparin', brandName: 'Clexane 40', strength: '40 mg', dosageForm: 'Injection', manufacturer: 'Sanofi', price: 385.0, taxPercent: 12 },
  { genericName: 'Insulin Human', brandName: 'Huminsulin 30/70', strength: '100 IU/mL', dosageForm: 'Injection', manufacturer: 'Eli Lilly', price: 165.0, taxPercent: 12 },
  { genericName: 'Salbutamol', brandName: 'Asthalin Respules', strength: '2.5 mg', dosageForm: 'Respule', manufacturer: 'Cipla', price: 12.0, taxPercent: 12 },
  { genericName: 'Budesonide', brandName: 'Budecort Respules', strength: '0.5 mg', dosageForm: 'Respule', manufacturer: 'Cipla', price: 32.0, taxPercent: 12 },
  { genericName: 'Paracetamol', brandName: 'Calpol Suspension', strength: '250 mg/5 mL', dosageForm: 'Syrup', manufacturer: 'GSK', price: 48.0, taxPercent: 12 },
  { genericName: 'Amoxicillin', brandName: 'Mox Dry Syrup', strength: '125 mg/5 mL', dosageForm: 'Syrup', manufacturer: 'Sun Pharma', price: 56.0, taxPercent: 12 },
  { genericName: 'Oral Rehydration Salts', brandName: 'Electral', strength: '21.8 g', dosageForm: 'Sachet', manufacturer: 'FDC', price: 22.0, taxPercent: 5 },
  { genericName: 'Iron + Folic Acid', brandName: 'Autrin', strength: '100 mg', dosageForm: 'Capsule', manufacturer: 'Pfizer', price: 6.2, taxPercent: 12 },
  { genericName: 'Calcium + Vitamin D3', brandName: 'Shelcal 500', strength: '500 mg', dosageForm: 'Tablet', manufacturer: 'Torrent', price: 7.4, taxPercent: 12 },
  { genericName: 'Sodium Chloride', brandName: 'NS 0.9% 500 mL', strength: '0.9%', dosageForm: 'IV Fluid', manufacturer: 'Baxter', price: 52.0, taxPercent: 12 },
]

/** Diagnosis → what a clinician would realistically prescribe for it. */
export const PRESCRIBING_PATTERNS: Record<
  string,
  Array<{ brand: string; dosage: string; frequency: string; duration: string; route: string; instructions: string }>
> = {
  'Acute viral febrile illness': [
    { brand: 'Dolo 650', dosage: '1 tablet', frequency: 'TDS (thrice daily)', duration: '5 days', route: 'ORAL', instructions: 'Take after food. Stop if fever settles for 48 hours.' },
    { brand: 'Cetzine 10', dosage: '1 tablet', frequency: 'OD (once daily)', duration: '5 days', route: 'ORAL', instructions: 'Take at bedtime — may cause drowsiness.' },
  ],
  'Stable angina pectoris': [
    { brand: 'Ecosprin 75', dosage: '1 tablet', frequency: 'OD (once daily)', duration: '30 days', route: 'ORAL', instructions: 'Take after dinner.' },
    { brand: 'Atorva 20', dosage: '1 tablet', frequency: 'OD (once daily)', duration: '30 days', route: 'ORAL', instructions: 'Take at bedtime.' },
    { brand: 'Metolar XR 25', dosage: '1 tablet', frequency: 'OD (once daily)', duration: '30 days', route: 'ORAL', instructions: 'Do not stop abruptly.' },
  ],
  'Type 2 diabetes mellitus with poor glycaemic control': [
    { brand: 'Glycomet 500', dosage: '1 tablet', frequency: 'BD (twice daily)', duration: '30 days', route: 'ORAL', instructions: 'Take with breakfast and dinner.' },
    { brand: 'Amaryl 2', dosage: '1 tablet', frequency: 'OD (once daily)', duration: '30 days', route: 'ORAL', instructions: 'Take 30 minutes before breakfast.' },
  ],
  'Lumbar disc prolapse with radiculopathy': [
    { brand: 'Voveran 50', dosage: '1 tablet', frequency: 'BD (twice daily)', duration: '7 days', route: 'ORAL', instructions: 'Take after food.' },
    { brand: 'Pan 40', dosage: '1 tablet', frequency: 'OD (once daily)', duration: '7 days', route: 'ORAL', instructions: 'Take on an empty stomach in the morning.' },
  ],
  'Primary osteoarthritis of right knee': [
    { brand: 'Ultracet', dosage: '1 tablet', frequency: 'BD (twice daily)', duration: '10 days', route: 'ORAL', instructions: 'Take after food.' },
    { brand: 'Shelcal 500', dosage: '1 tablet', frequency: 'OD (once daily)', duration: '30 days', route: 'ORAL', instructions: 'Take after lunch.' },
  ],
  'Acute appendicitis': [
    { brand: 'Monocef 1g', dosage: '1 g', frequency: 'BD (twice daily)', duration: '3 days', route: 'IV', instructions: 'Administer over 30 minutes after test dose.' },
    { brand: 'Emeset Injection', dosage: '4 mg', frequency: 'SOS (as needed)', duration: '3 days', route: 'IV', instructions: 'For vomiting, maximum three doses a day.' },
  ],
  'Antenatal care of second pregnancy, gestational hypertension': [
    { brand: 'Autrin', dosage: '1 capsule', frequency: 'OD (once daily)', duration: '30 days', route: 'ORAL', instructions: 'Take after lunch with vitamin C rich food.' },
    { brand: 'Shelcal 500', dosage: '1 tablet', frequency: 'OD (once daily)', duration: '30 days', route: 'ORAL', instructions: 'Take after dinner.' },
  ],
  'Community-acquired pneumonia': [
    { brand: 'Augmentin 625', dosage: '1 tablet', frequency: 'BD (twice daily)', duration: '7 days', route: 'ORAL', instructions: 'Complete the full course.' },
    { brand: 'Azithral 500', dosage: '1 tablet', frequency: 'OD (once daily)', duration: '3 days', route: 'ORAL', instructions: 'Take one hour before food.' },
    { brand: 'Asthalin Respules', dosage: '2.5 mg', frequency: 'TDS (thrice daily)', duration: '5 days', route: 'INHALATION', instructions: 'Via nebuliser.' },
  ],
  'Acute gastroenteritis with mild dehydration': [
    { brand: 'Electral', dosage: '1 sachet', frequency: 'SOS (as needed)', duration: '3 days', route: 'ORAL', instructions: 'Dissolve in 1 litre of clean water, sip through the day.' },
    { brand: 'Emeset 4', dosage: '1 tablet', frequency: 'SOS (as needed)', duration: '3 days', route: 'ORAL', instructions: 'For vomiting only.' },
  ],
  'Migraine with aura': [
    { brand: 'Dolo 650', dosage: '1 tablet', frequency: 'SOS (as needed)', duration: '15 days', route: 'ORAL', instructions: 'At the onset of headache, maximum three a day.' },
    { brand: 'Emeset 4', dosage: '1 tablet', frequency: 'SOS (as needed)', duration: '15 days', route: 'ORAL', instructions: 'For associated nausea.' },
  ],
  'Acute suppurative otitis media': [
    { brand: 'Mox Dry Syrup', dosage: '5 mL', frequency: 'TDS (thrice daily)', duration: '7 days', route: 'ORAL', instructions: 'Shake well before use. Refrigerate after reconstitution.' },
    { brand: 'Calpol Suspension', dosage: '5 mL', frequency: 'SOS (as needed)', duration: '5 days', route: 'ORAL', instructions: 'For fever above 100°F.' },
  ],
  'Closed fracture of left radius shaft': [
    { brand: 'Ultracet', dosage: '1 tablet', frequency: 'BD (twice daily)', duration: '5 days', route: 'ORAL', instructions: 'Take after food.' },
    { brand: 'Pan 40', dosage: '1 tablet', frequency: 'OD (once daily)', duration: '5 days', route: 'ORAL', instructions: 'Before breakfast.' },
  ],
}

// ─── Billing service catalog ───────────────────────────────────────────────

export const SERVICE_CATALOG = [
  { code: 'CONS-GEN', name: 'General Consultation', category: 'Consultation', price: 600, taxPercent: 0 },
  { code: 'CONS-SPEC', name: 'Specialist Consultation', category: 'Consultation', price: 900, taxPercent: 0 },
  { code: 'CONS-FOLLOW', name: 'Follow-up Consultation', category: 'Consultation', price: 300, taxPercent: 0 },
  { code: 'CONS-EMRG', name: 'Emergency Consultation', category: 'Consultation', price: 1200, taxPercent: 0 },
  { code: 'REG-NEW', name: 'New Patient Registration', category: 'Administrative', price: 200, taxPercent: 18 },
  { code: 'DRESS-SM', name: 'Dressing (Small)', category: 'Procedure', price: 350, taxPercent: 18 },
  { code: 'NEB', name: 'Nebulisation', category: 'Procedure', price: 250, taxPercent: 18 },
  { code: 'IV-INF', name: 'IV Infusion / Fluid Administration', category: 'Procedure', price: 450, taxPercent: 18 },
  { code: 'ECG', name: 'Electrocardiogram (12 lead)', category: 'Diagnostics', price: 350, taxPercent: 18 },
  { code: 'POP-SLAB', name: 'Plaster of Paris Slab', category: 'Procedure', price: 900, taxPercent: 18 },
  { code: 'CATH-FOLEY', name: 'Foley Catheterisation', category: 'Procedure', price: 700, taxPercent: 18 },
  { code: 'INJ-ADMIN', name: 'Injection Administration', category: 'Procedure', price: 150, taxPercent: 18 },
  { code: 'ROOM-GEN', name: 'General Ward Bed Charges (per day)', category: 'Room Charges', price: 1500, taxPercent: 0 },
  { code: 'ROOM-SEMI', name: 'Semi-Private Room Charges (per day)', category: 'Room Charges', price: 3000, taxPercent: 0 },
  { code: 'ROOM-PVT', name: 'Private Room Charges (per day)', category: 'Room Charges', price: 6000, taxPercent: 0 },
  { code: 'ROOM-ICU', name: 'ICU Bed Charges (per day)', category: 'Room Charges', price: 12000, taxPercent: 0 },
  { code: 'NURS-CARE', name: 'Nursing Care Charges (per day)', category: 'Nursing', price: 800, taxPercent: 0 },
  { code: 'OT-MINOR', name: 'Minor OT Charges', category: 'Operation Theatre', price: 6500, taxPercent: 18 },
  { code: 'OT-MAJOR', name: 'Major OT Charges', category: 'Operation Theatre', price: 22000, taxPercent: 18 },
  { code: 'AMBUL', name: 'Ambulance Charges', category: 'Administrative', price: 1500, taxPercent: 18 },
]

// ─── Insurance ─────────────────────────────────────────────────────────────

export const INSURANCE_PROVIDERS = [
  {
    code: 'STAR', name: 'Starline Health & Allied Insurance', type: 'INSURANCE_COMPANY',
    contactPerson: 'Ramesh Krishnan', email: 'claims@starline-health.example', phone: '18004252255',
    address: 'Ispahani Centre, Nungambakkam, Chennai 600034',
    plans: [
      { code: 'STAR-FHO', name: 'Family Health Optima', coveragePercent: 90, coPayPercent: 10, deductible: 0, annualLimit: 500000, perVisitLimit: 100000, networkType: 'CASHLESS' },
      { code: 'STAR-MEDI', name: 'Medi Classic', coveragePercent: 80, coPayPercent: 20, deductible: 5000, annualLimit: 300000, perVisitLimit: 75000, networkType: 'BOTH' },
    ],
  },
  {
    code: 'HRZN', name: 'Horizon General Insurance', type: 'INSURANCE_COMPANY',
    contactPerson: 'Sneha Bhatia', email: 'cashless@horizon-gi.example', phone: '18002700700',
    address: 'Leela Business Park, Andheri East, Mumbai 400059',
    plans: [
      { code: 'HRZN-OPT', name: 'Optima Restore', coveragePercent: 100, coPayPercent: 0, deductible: 0, annualLimit: 1000000, perVisitLimit: 250000, networkType: 'CASHLESS' },
    ],
  },
  {
    code: 'MEDIA', name: 'MediAssist Health TPA', type: 'TPA',
    contactPerson: 'Prakash Salunkhe', email: 'preauth@mediassist-tpa.example', phone: '18002336767',
    address: 'S. No. 46/1, Karve Nagar, Pune 411052',
    plans: [
      { code: 'MEDIA-GRP', name: 'Group Mediclaim (Corporate)', coveragePercent: 100, coPayPercent: 0, deductible: 0, annualLimit: 400000, perVisitLimit: 150000, networkType: 'CASHLESS' },
      { code: 'MEDIA-STD', name: 'Standard Reimbursement', coveragePercent: 75, coPayPercent: 25, deductible: 10000, annualLimit: 200000, perVisitLimit: 50000, networkType: 'REIMBURSEMENT' },
    ],
  },
  {
    code: 'INFOTECH', name: 'Infotech Solutions Pvt Ltd (Corporate)', type: 'CORPORATE',
    contactPerson: 'Divya Ranganathan', email: 'benefits@infotech-solutions.example', phone: '02249001234',
    address: 'Mindspace, Malad West, Mumbai 400064',
    plans: [
      { code: 'INFOTECH-EMP', name: 'Employee Health Benefit', coveragePercent: 100, coPayPercent: 0, deductible: 0, annualLimit: 600000, perVisitLimit: 200000, networkType: 'CASHLESS' },
    ],
  },
]

// ─── IPD ward / room / bed layout ──────────────────────────────────────────

export const WARD_LAYOUT = [
  { code: 'GWA', name: 'General Ward A', type: 'GENERAL', bedType: 'GENERAL', departmentCode: 'GENMED', floor: '1', block: 'A', rooms: 6, bedsPerRoom: 4, chargesPerDay: 1500 },
  { code: 'SPWB', name: 'Semi-Private Ward B', type: 'SEMI_PRIVATE', bedType: 'SEMI_PRIVATE', departmentCode: 'GENMED', floor: '2', block: 'B', rooms: 5, bedsPerRoom: 2, chargesPerDay: 3000 },
  { code: 'PWC', name: 'Private Ward C', type: 'PRIVATE', bedType: 'PRIVATE', departmentCode: 'SURG', floor: '3', block: 'C', rooms: 6, bedsPerRoom: 1, chargesPerDay: 6000 },
  { code: 'ICU1', name: 'Intensive Care Unit', type: 'ICU', bedType: 'ICU', departmentCode: 'EMRG', floor: '2', block: 'A', rooms: 2, bedsPerRoom: 5, chargesPerDay: 12000 },
  { code: 'MATW', name: 'Maternity Ward', type: 'SEMI_PRIVATE', bedType: 'SEMI_PRIVATE', departmentCode: 'OBGYN', floor: '4', block: 'B', rooms: 4, bedsPerRoom: 2, chargesPerDay: 4000 },
  { code: 'PEDW', name: 'Paediatric Ward', type: 'GENERAL', bedType: 'GENERAL', departmentCode: 'PEDIA', floor: '4', block: 'A', rooms: 3, bedsPerRoom: 3, chargesPerDay: 2000 },
]

// ─── General inventory master ──────────────────────────────────────────────

export const INVENTORY_CATEGORIES = [
  { code: 'MEDCON', name: 'Medical Consumables', children: [{ code: 'MEDCON-DRESS', name: 'Dressing Material' }, { code: 'MEDCON-INJ', name: 'Injectables & IV Sets' }] },
  { code: 'SURGI', name: 'Surgical Items', children: [{ code: 'SURGI-SUT', name: 'Sutures' }, { code: 'SURGI-GLV', name: 'Gloves & Drapes' }] },
  { code: 'BIOMED', name: 'Biomedical Equipment', children: [{ code: 'BIOMED-MON', name: 'Monitoring Devices' }, { code: 'BIOMED-RESP', name: 'Respiratory Equipment' }] },
  { code: 'HOUSE', name: 'Housekeeping & Sanitation', children: [{ code: 'HOUSE-DISI', name: 'Disinfectants' }] },
  { code: 'STAT', name: 'Stationery & Administration', children: [] },
]

export const INVENTORY_ITEM_GROUPS = [
  { code: 'FAST', name: 'Fast Moving' },
  { code: 'SLOW', name: 'Slow Moving' },
  { code: 'HIGHVAL', name: 'High Value' },
  { code: 'CRIT', name: 'Critical / Emergency' },
]

export const INVENTORY_UNITS = [
  { symbol: 'PCS', name: 'Pieces' },
  { symbol: 'BOX', name: 'Box' },
  { symbol: 'PKT', name: 'Packet' },
  { symbol: 'ROLL', name: 'Roll' },
  { symbol: 'LTR', name: 'Litre' },
  { symbol: 'NOS', name: 'Numbers' },
  { symbol: 'PAIR', name: 'Pair' },
]

export const INVENTORY_MANUFACTURERS = [
  { name: 'Trimed Materials India Ltd', contactPerson: 'Sameer Kulkarni', phone: '02267048000', email: 'sales@trimed.example', address: 'Concorde Block, UB City, Bengaluru 560001' },
  { name: 'Ramson Medical Devices', contactPerson: 'Naveen Gupta', phone: '01204567800', email: 'orders@ramson-med.example', address: 'Site IV, Sahibabad Industrial Area, Ghaziabad 201010' },
  { name: 'Meridian Surgical Products', contactPerson: 'Priti Nambiar', phone: '02239878000', email: 'medical@meridian-surgical.example', address: 'Arena Space, Jogeshwari East, Mumbai 400060' },
  { name: 'Lumen Healthcare Systems', contactPerson: 'Rohit Anand', phone: '01244606000', email: 'care@lumen-health.example', address: 'DLF Cyber City, Gurugram 122002' },
  { name: 'Indus Syringes & Medical Devices', contactPerson: 'Alok Mehra', phone: '01292345600', email: 'sales@indus-syringes.example', address: 'Sector 25, Faridabad 121004' },
]

export const INVENTORY_BRANDS = [
  { name: 'Poromed', manufacturer: 'Trimed Materials India Ltd' },
  { name: 'Clearfilm', manufacturer: 'Trimed Materials India Ltd' },
  { name: 'Ramovac', manufacturer: 'Ramson Medical Devices' },
  { name: 'Meridex', manufacturer: 'Meridian Surgical Products' },
  { name: 'VitalView', manufacturer: 'Lumen Healthcare Systems' },
  { name: 'Indus Dispo', manufacturer: 'Indus Syringes & Medical Devices' },
]

export interface InventoryItemSpec {
  code: string
  name: string
  categoryCode: string
  groupCode: string
  unitSymbol: string
  manufacturer?: string
  brand?: string
  itemType: 'CONSUMABLE' | 'ASSET'
  hsnCode: string
  gstPercent: number
  unitCost: number
  trackBatch: boolean
  trackSerial: boolean
  trackExpiry: boolean
  reorderLevel: number
  minStock: number
  maxStock: number
}

export const INVENTORY_ITEMS: InventoryItemSpec[] = [
  { code: 'CON-SYR-05', name: 'Disposable Syringe 5 mL', categoryCode: 'MEDCON-INJ', groupCode: 'FAST', unitSymbol: 'PCS', manufacturer: 'Indus Syringes & Medical Devices', brand: 'Indus Dispo', itemType: 'CONSUMABLE', hsnCode: '90183100', gstPercent: 12, unitCost: 4.5, trackBatch: true, trackSerial: false, trackExpiry: true, reorderLevel: 2000, minStock: 1000, maxStock: 20000 },
  { code: 'CON-SYR-10', name: 'Disposable Syringe 10 mL', categoryCode: 'MEDCON-INJ', groupCode: 'FAST', unitSymbol: 'PCS', manufacturer: 'Indus Syringes & Medical Devices', brand: 'Indus Dispo', itemType: 'CONSUMABLE', hsnCode: '90183100', gstPercent: 12, unitCost: 6.2, trackBatch: true, trackSerial: false, trackExpiry: true, reorderLevel: 1500, minStock: 800, maxStock: 15000 },
  { code: 'CON-IVSET', name: 'IV Infusion Set', categoryCode: 'MEDCON-INJ', groupCode: 'FAST', unitSymbol: 'PCS', manufacturer: 'Ramson Medical Devices', itemType: 'CONSUMABLE', hsnCode: '90183900', gstPercent: 12, unitCost: 22.0, trackBatch: true, trackSerial: false, trackExpiry: true, reorderLevel: 800, minStock: 400, maxStock: 8000 },
  { code: 'CON-CANN-20', name: 'IV Cannula 20G', categoryCode: 'MEDCON-INJ', groupCode: 'FAST', unitSymbol: 'PCS', manufacturer: 'Ramson Medical Devices', itemType: 'CONSUMABLE', hsnCode: '90183900', gstPercent: 12, unitCost: 18.5, trackBatch: true, trackSerial: false, trackExpiry: true, reorderLevel: 1000, minStock: 500, maxStock: 10000 },
  { code: 'CON-GAUZE', name: 'Sterile Gauze Swab 10x10 cm', categoryCode: 'MEDCON-DRESS', groupCode: 'FAST', unitSymbol: 'PKT', itemType: 'CONSUMABLE', hsnCode: '30059010', gstPercent: 12, unitCost: 32.0, trackBatch: true, trackSerial: false, trackExpiry: true, reorderLevel: 600, minStock: 300, maxStock: 6000 },
  { code: 'CON-BAND-CR', name: 'Crepe Bandage 10 cm', categoryCode: 'MEDCON-DRESS', groupCode: 'FAST', unitSymbol: 'ROLL', itemType: 'CONSUMABLE', hsnCode: '30059040', gstPercent: 12, unitCost: 48.0, trackBatch: false, trackSerial: false, trackExpiry: false, reorderLevel: 400, minStock: 200, maxStock: 4000 },
  { code: 'CON-TAPE', name: 'Surgical Paper Tape 1 inch', categoryCode: 'MEDCON-DRESS', groupCode: 'FAST', unitSymbol: 'ROLL', manufacturer: 'Trimed Materials India Ltd', brand: 'Poromed', itemType: 'CONSUMABLE', hsnCode: '30051090', gstPercent: 12, unitCost: 36.0, trackBatch: true, trackSerial: false, trackExpiry: true, reorderLevel: 500, minStock: 250, maxStock: 5000 },
  { code: 'CON-DRESS-TR', name: 'Transparent Film Dressing 6x7 cm', categoryCode: 'MEDCON-DRESS', groupCode: 'SLOW', unitSymbol: 'PCS', manufacturer: 'Trimed Materials India Ltd', brand: 'Clearfilm', itemType: 'CONSUMABLE', hsnCode: '30051090', gstPercent: 12, unitCost: 62.0, trackBatch: true, trackSerial: false, trackExpiry: true, reorderLevel: 300, minStock: 150, maxStock: 3000 },
  { code: 'SUR-GLV-70', name: 'Sterile Surgical Gloves Size 7.0', categoryCode: 'SURGI-GLV', groupCode: 'FAST', unitSymbol: 'PAIR', itemType: 'CONSUMABLE', hsnCode: '40151100', gstPercent: 12, unitCost: 24.0, trackBatch: true, trackSerial: false, trackExpiry: true, reorderLevel: 1200, minStock: 600, maxStock: 12000 },
  { code: 'SUR-GLV-75', name: 'Sterile Surgical Gloves Size 7.5', categoryCode: 'SURGI-GLV', groupCode: 'FAST', unitSymbol: 'PAIR', itemType: 'CONSUMABLE', hsnCode: '40151100', gstPercent: 12, unitCost: 24.0, trackBatch: true, trackSerial: false, trackExpiry: true, reorderLevel: 1200, minStock: 600, maxStock: 12000 },
  { code: 'SUR-EXAM-GLV', name: 'Examination Gloves (Nitrile, Medium)', categoryCode: 'SURGI-GLV', groupCode: 'FAST', unitSymbol: 'BOX', itemType: 'CONSUMABLE', hsnCode: '40151900', gstPercent: 12, unitCost: 420.0, trackBatch: true, trackSerial: false, trackExpiry: true, reorderLevel: 200, minStock: 100, maxStock: 2000 },
  { code: 'SUR-SUT-30', name: 'Polyglactin Suture 3-0 with Needle', categoryCode: 'SURGI-SUT', groupCode: 'HIGHVAL', unitSymbol: 'PCS', manufacturer: 'Meridian Surgical Products', brand: 'Meridex', itemType: 'CONSUMABLE', hsnCode: '30061010', gstPercent: 12, unitCost: 178.0, trackBatch: true, trackSerial: false, trackExpiry: true, reorderLevel: 250, minStock: 120, maxStock: 2500 },
  { code: 'SUR-SUT-20', name: 'Silk Suture 2-0 with Needle', categoryCode: 'SURGI-SUT', groupCode: 'SLOW', unitSymbol: 'PCS', manufacturer: 'Meridian Surgical Products', brand: 'Meridex', itemType: 'CONSUMABLE', hsnCode: '30061010', gstPercent: 12, unitCost: 96.0, trackBatch: true, trackSerial: false, trackExpiry: true, reorderLevel: 200, minStock: 100, maxStock: 2000 },
  { code: 'SUR-DRAPE', name: 'Sterile Surgical Drape Sheet', categoryCode: 'SURGI-GLV', groupCode: 'SLOW', unitSymbol: 'PCS', itemType: 'CONSUMABLE', hsnCode: '63071090', gstPercent: 12, unitCost: 145.0, trackBatch: true, trackSerial: false, trackExpiry: true, reorderLevel: 150, minStock: 75, maxStock: 1500 },
  { code: 'CON-MASK-N95', name: 'N95 Respirator Mask', categoryCode: 'MEDCON-DRESS', groupCode: 'CRIT', unitSymbol: 'PCS', manufacturer: 'Trimed Materials India Ltd', itemType: 'CONSUMABLE', hsnCode: '63079090', gstPercent: 5, unitCost: 58.0, trackBatch: true, trackSerial: false, trackExpiry: true, reorderLevel: 800, minStock: 400, maxStock: 8000 },
  { code: 'CON-OXY-MASK', name: 'Oxygen Mask with Reservoir Bag (Adult)', categoryCode: 'MEDCON-INJ', groupCode: 'CRIT', unitSymbol: 'PCS', manufacturer: 'Ramson Medical Devices', itemType: 'CONSUMABLE', hsnCode: '90192000', gstPercent: 12, unitCost: 88.0, trackBatch: false, trackSerial: false, trackExpiry: false, reorderLevel: 200, minStock: 100, maxStock: 2000 },
  { code: 'CON-URO-BAG', name: 'Urine Collection Bag 2000 mL', categoryCode: 'MEDCON-INJ', groupCode: 'FAST', unitSymbol: 'PCS', manufacturer: 'Ramson Medical Devices', itemType: 'CONSUMABLE', hsnCode: '90183900', gstPercent: 12, unitCost: 42.0, trackBatch: true, trackSerial: false, trackExpiry: true, reorderLevel: 300, minStock: 150, maxStock: 3000 },
  { code: 'HK-DISINF', name: 'Surface Disinfectant Concentrate 5 L', categoryCode: 'HOUSE-DISI', groupCode: 'FAST', unitSymbol: 'LTR', itemType: 'CONSUMABLE', hsnCode: '38089400', gstPercent: 18, unitCost: 640.0, trackBatch: true, trackSerial: false, trackExpiry: true, reorderLevel: 60, minStock: 30, maxStock: 600 },
  { code: 'HK-HANDRUB', name: 'Alcohol Hand Rub 500 mL', categoryCode: 'HOUSE-DISI', groupCode: 'FAST', unitSymbol: 'PCS', itemType: 'CONSUMABLE', hsnCode: '38089400', gstPercent: 18, unitCost: 185.0, trackBatch: true, trackSerial: false, trackExpiry: true, reorderLevel: 250, minStock: 120, maxStock: 2500 },
  { code: 'HK-BIOBAG', name: 'Biomedical Waste Bag (Red, 30 L)', categoryCode: 'HOUSE-DISI', groupCode: 'FAST', unitSymbol: 'PKT', itemType: 'CONSUMABLE', hsnCode: '39232990', gstPercent: 18, unitCost: 210.0, trackBatch: false, trackSerial: false, trackExpiry: false, reorderLevel: 100, minStock: 50, maxStock: 1000 },
  { code: 'STAT-CASE', name: 'Patient Case Paper File', categoryCode: 'STAT', groupCode: 'FAST', unitSymbol: 'PCS', itemType: 'CONSUMABLE', hsnCode: '48201090', gstPercent: 18, unitCost: 14.0, trackBatch: false, trackSerial: false, trackExpiry: false, reorderLevel: 1000, minStock: 500, maxStock: 10000 },
  { code: 'STAT-PRINT', name: 'A4 Printing Paper (500 sheets)', categoryCode: 'STAT', groupCode: 'SLOW', unitSymbol: 'PKT', itemType: 'CONSUMABLE', hsnCode: '48025690', gstPercent: 18, unitCost: 285.0, trackBatch: false, trackSerial: false, trackExpiry: false, reorderLevel: 80, minStock: 40, maxStock: 800 },
  { code: 'AST-MON-VS', name: 'Multipara Vital Signs Monitor', categoryCode: 'BIOMED-MON', groupCode: 'HIGHVAL', unitSymbol: 'NOS', manufacturer: 'Lumen Healthcare Systems', brand: 'VitalView', itemType: 'ASSET', hsnCode: '90189019', gstPercent: 12, unitCost: 185000, trackBatch: false, trackSerial: true, trackExpiry: false, reorderLevel: 2, minStock: 1, maxStock: 40 },
  { code: 'AST-SYRPUMP', name: 'Syringe Infusion Pump', categoryCode: 'BIOMED-MON', groupCode: 'HIGHVAL', unitSymbol: 'NOS', manufacturer: 'Ramson Medical Devices', itemType: 'ASSET', hsnCode: '90189019', gstPercent: 12, unitCost: 42000, trackBatch: false, trackSerial: true, trackExpiry: false, reorderLevel: 4, minStock: 2, maxStock: 60 },
  { code: 'AST-VENT', name: 'ICU Ventilator', categoryCode: 'BIOMED-RESP', groupCode: 'HIGHVAL', unitSymbol: 'NOS', manufacturer: 'Lumen Healthcare Systems', itemType: 'ASSET', hsnCode: '90192000', gstPercent: 12, unitCost: 950000, trackBatch: false, trackSerial: true, trackExpiry: false, reorderLevel: 1, minStock: 1, maxStock: 15 },
  { code: 'AST-NEBUL', name: 'Compressor Nebuliser', categoryCode: 'BIOMED-RESP', groupCode: 'SLOW', unitSymbol: 'NOS', manufacturer: 'Lumen Healthcare Systems', itemType: 'ASSET', hsnCode: '90192000', gstPercent: 12, unitCost: 3800, trackBatch: false, trackSerial: true, trackExpiry: false, reorderLevel: 5, minStock: 3, maxStock: 50 },
  { code: 'AST-ECG', name: '12-Lead ECG Machine', categoryCode: 'BIOMED-MON', groupCode: 'HIGHVAL', unitSymbol: 'NOS', manufacturer: 'Lumen Healthcare Systems', itemType: 'ASSET', hsnCode: '90181100', gstPercent: 12, unitCost: 128000, trackBatch: false, trackSerial: true, trackExpiry: false, reorderLevel: 1, minStock: 1, maxStock: 12 },
  { code: 'AST-WHEEL', name: 'Patient Wheelchair (Foldable)', categoryCode: 'BIOMED-MON', groupCode: 'SLOW', unitSymbol: 'NOS', itemType: 'ASSET', hsnCode: '87131090', gstPercent: 5, unitCost: 8500, trackBatch: false, trackSerial: true, trackExpiry: false, reorderLevel: 3, minStock: 2, maxStock: 40 },
]

export const INVENTORY_STORES = [
  { code: 'CENTRAL', name: 'Central Store', type: 'CENTRAL', location: 'Basement, Block A' },
  { code: 'ICUST', name: 'ICU Sub-Store', type: 'ICU', location: '2nd Floor, Block A' },
  { code: 'OTST', name: 'Operation Theatre Store', type: 'OT', location: '3rd Floor, Block C' },
  { code: 'EMRGST', name: 'Emergency Store', type: 'EMERGENCY', location: 'Ground Floor, Block A' },
  { code: 'LABST', name: 'Laboratory Store', type: 'LABORATORY', location: '1st Floor, Block B' },
  { code: 'BIOMEDST', name: 'Biomedical Engineering Store', type: 'BIOMEDICAL', location: 'Basement, Block B' },
  { code: 'HKST', name: 'Housekeeping Store', type: 'HOUSEKEEPING', location: 'Basement, Block C' },
]

export const VENDORS = [
  { code: 'VEN-MEDEQ', name: 'MedEquip Solutions Pvt Ltd', contactPerson: 'Sunil Agarwal', phone: '02228765400', email: 'sales@medequip-solutions.example', address: '14, MIDC Industrial Estate, Andheri East', city: 'Mumbai', state: 'Maharashtra', pincode: '400093', gstin: '27AABCM1234F1Z5', pan: 'AABCM1234F', bankName: 'Meridian Bank', bankAccountNumber: '50200012345678', bankIfsc: 'MRDN0000123', paymentTermsDays: 30 },
  { code: 'VEN-SURGI', name: 'Surgicare Distributors', contactPerson: 'Nitin Shah', phone: '02226543210', email: 'orders@surgicare-dist.example', address: '7, Kalbadevi Road, Marine Lines', city: 'Mumbai', state: 'Maharashtra', pincode: '400002', gstin: '27AACCS5678G1Z2', pan: 'AACCS5678G', bankName: 'Meridian Bank', bankAccountNumber: '002105001234', bankIfsc: 'MRDN0000021', paymentTermsDays: 45 },
  { code: 'VEN-PHARMA', name: 'Nova Pharma Agencies', contactPerson: 'Kavita Rane', phone: '02224681357', email: 'supply@novapharma-agencies.example', address: '22, Princess Street, Marine Lines', city: 'Mumbai', state: 'Maharashtra', pincode: '400002', gstin: '27AADCN9012H1Z8', pan: 'AADCN9012H', bankName: 'Trident Bank', bankAccountNumber: '918020012345678', bankIfsc: 'TRDN0000456', paymentTermsDays: 30 },
  { code: 'VEN-BIOMED', name: 'BioMed Technologies India', contactPerson: 'Rakesh Chandra', phone: '02261234567', email: 'india@biomedtech-in.example', address: 'Unit 402, Godrej IT Park, Vikhroli West', city: 'Mumbai', state: 'Maharashtra', pincode: '400079', gstin: '27AAECB3456J1Z1', pan: 'AAECB3456J', bankName: 'Trident Bank', bankAccountNumber: '30012345678', bankIfsc: 'TRDN0001234', paymentTermsDays: 60 },
  { code: 'VEN-CLEAN', name: 'CleanCare Hygiene Supplies', contactPerson: 'Deepa Sawant', phone: '02225558899', email: 'info@cleancare-hygiene.example', address: 'Plot 9, Turbhe MIDC, Navi Mumbai', city: 'Navi Mumbai', state: 'Maharashtra', pincode: '400705', gstin: '27AAFCC7890K1Z4', pan: 'AAFCC7890K', bankName: 'Meridian Bank', bankAccountNumber: '4512301234', bankIfsc: 'MRDN0000651', paymentTermsDays: 21 },
]
