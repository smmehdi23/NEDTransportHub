export const NED_DEPARTMENTS = [
  // Faculty of Civil & Petroleum Engineering (CPL)
  'Civil Engineering',
  'Urban & Infrastructure Engineering',
  'Petroleum Engineering',
  'Earthquake Engineering',
  'Environmental Engineering',
  // Faculty of Electrical & Computer Engineering (ECE)
  'Electrical Engineering',
  'Electronic Engineering',
  'Telecommunications Engineering',
  'Computer & Information Systems Engineering (CIS)',
  'Biomedical Engineering',
  'Computer Science & Information Technology (CSIT)',
  'Software Engineering',
  // Faculty of Mechanical & Manufacturing Engineering (MME)
  'Mechanical Engineering',
  'Industrial & Manufacturing Engineering',
  'Textile Engineering',
  'Automotive & Marine Engineering',
  // Faculty of Chemical & Process Engineering (CPE)
  'Chemical Engineering',
  'Polymer & Petrochemical Engineering',
  'Materials Engineering',
  'Metallurgical Engineering',
  'Food Engineering',
  // Faculty of Architecture & Sciences (ASC)
  'Architecture & Planning',
  'Economics & Management Sciences',
  'Physics',
  'Chemistry',
  'Mathematics',
  'English Linguistics & Allied Studies',
  'Essential Studies',
  // Institutes / Constituent Campuses
  'Panjwani-Hisaar Water Institute (PHWI)',
  'Thar Institute of Engineering, Sciences & Technology (TIEST)',
  // Faculty / Non-Departmental Staff (always last)
  'Faculty / Admin Staff',
] as const;

export const FACULTY_OPTION = 'Faculty / Admin Staff';

export const CAR_PRESETS = [
  'Suzuki Cultus',
  'Suzuki Alto',
  'Honda City',
  'Honda Civic',
  'Toyota Corolla',
  'Suzuki Wagon R',
  'Toyota Yaris',
  'Kia Picanto',
];

export const BIKE_PRESETS = [
  'Honda CD-70',
  'Honda CG-125',
  'Yamaha YBR-125',
  'Suzuki GS-150',
  'Unique UD-70',
];

export function validatePakistaniPhone(raw: string): {
  valid: boolean;
  normalized?: string;
  error?: string;
} {
  const cleaned = raw.replace(/[\s-]/g, '').trim();
  if (/^03\d{9}$/.test(cleaned)) {
    return { valid: true, normalized: `+92${cleaned.slice(1)}` };
  }
  if (/^\+923\d{9}$/.test(cleaned)) {
    return { valid: true, normalized: cleaned };
  }
  return {
    valid: false,
    error: 'Enter a valid Pakistani mobile number (e.g. +923001234567 or 03001234567).',
  };
}

export function validatePakistaniPlate(raw: string): {
  valid: boolean;
  normalized?: string;
  error?: string;
} {
  const plate = raw.replace(/\s+/g, '').toUpperCase();
  if (/^[A-Z]{2,4}-?\d{1,4}$/.test(plate)) {
    return { valid: true, normalized: plate };
  }
  return {
    valid: false,
    error: 'Enter a valid Pakistani plate number (e.g. BKA-482 or ABC-1234).',
  };
}

export function validateVehicleModel(raw: string): {
  valid: boolean;
  normalized?: string;
  error?: string;
} {
  const model = raw.replace(/\s+/g, ' ').trim();
  const words = model.split(/[\s-]+/).filter((w) => w.length >= 2);
  if (model.length >= 3 && model.length <= 50 && words.length >= 2 && /^[A-Za-z0-9\s\-./]+$/.test(model)) {
    return { valid: true, normalized: model };
  }
  return {
    valid: false,
    error: 'Enter a valid make and model (e.g. Suzuki Cultus or Honda CD-70).',
  };
}
