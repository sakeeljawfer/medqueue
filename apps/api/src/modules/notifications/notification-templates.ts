import type { Locale } from '@prisma/client';

type TemplateArgs = Record<string, string | number>;

/**
 * SMS/in-app copy per locale. SMS bodies are kept under 160 GSM chars where
 * possible; Sinhala/Tamil render as UCS-2 and may split — acceptable for
 * low-frequency transactional messages.
 */
const TEMPLATES: Record<string, Record<Locale, (args: TemplateArgs) => string>> = {
  'doctor.approved': {
    en: () => 'MedQueue: your doctor profile is approved. Patients can now find and book you.',
    si: () => 'MedQueue: ඔබේ වෛද්‍ය ගිණුම අනුමත විය. රෝගීන්ට දැන් ඔබව සොයා වෙන්කරවා ගත හැක.',
    ta: () =>
      'MedQueue: உங்கள் மருத்துவர் சுயவிவரம் அங்கீகரிக்கப்பட்டது. நோயாளிகள் இப்போது உங்களை முன்பதிவு செய்யலாம்.',
  },
  'doctor.rejected': {
    en: (a) => `MedQueue: your doctor profile was not approved. Reason: ${a.reason}`,
    si: (a) => `MedQueue: ඔබේ වෛද්‍ය ගිණුම අනුමත නොවීය. හේතුව: ${a.reason}`,
    ta: (a) => `MedQueue: உங்கள் மருத்துவர் சுயவிவரம் அங்கீகரிக்கப்படவில்லை. காரணம்: ${a.reason}`,
  },
  'payment.approved': {
    en: () => 'MedQueue: your payment was approved. Thank you.',
    si: () => 'MedQueue: ඔබේ ගෙවීම අනුමත විය. ස්තූතියි.',
    ta: () => 'MedQueue: உங்கள் கட்டணம் அங்கீகரிக்கப்பட்டது. நன்றி.',
  },
  'payment.rejected': {
    en: () => 'MedQueue: your payment could not be verified. Please contact support.',
    si: () => 'MedQueue: ඔබේ ගෙවීම සත්‍යාපනය කළ නොහැකි විය. සහාය අමතන්න.',
    ta: () => 'MedQueue: உங்கள் கட்டணத்தை சரிபார்க்க முடியவில்லை. ஆதரவைத் தொடர்பு கொள்ளவும்.',
  },
  'queue.almost_your_turn': {
    en: (a) => `MedQueue: almost your turn at ${a.dispensary} — now serving #${a.current}, you are #${a.token}. Please head in.`,
    si: (a) => `MedQueue: ${a.dispensary} හි ඔබේ වාරය ළඟයි — දැන් #${a.current}, ඔබ #${a.token}. පැමිණෙන්න.`,
    ta: (a) => `MedQueue: ${a.dispensary} இல் உங்கள் முறை நெருங்குகிறது — தற்போது #${a.current}, நீங்கள் #${a.token}. வாருங்கள்.`,
  },
};

export function renderTemplate(template: string, locale: Locale, args: TemplateArgs): string {
  const t = TEMPLATES[template];
  if (!t) throw new Error(`unknown_template:${template}`);
  return (t[locale] ?? t.en)(args);
}

export const KNOWN_TEMPLATES = Object.keys(TEMPLATES);
