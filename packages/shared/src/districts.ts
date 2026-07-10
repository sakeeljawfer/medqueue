/**
 * All 25 districts of Sri Lanka, keyed by a stable slug used in URLs and DB rows.
 * Names provided in English, Sinhala, and Tamil.
 */
export interface District {
  slug: string;
  province: string;
  en: string;
  si: string;
  ta: string;
}

export const DISTRICTS: readonly District[] = [
  { slug: 'colombo', province: 'Western', en: 'Colombo', si: 'කොළඹ', ta: 'கொழும்பு' },
  { slug: 'gampaha', province: 'Western', en: 'Gampaha', si: 'ගම්පහ', ta: 'கம்பஹா' },
  { slug: 'kalutara', province: 'Western', en: 'Kalutara', si: 'කළුතර', ta: 'களுத்துறை' },
  { slug: 'kandy', province: 'Central', en: 'Kandy', si: 'මහනුවර', ta: 'கண்டி' },
  { slug: 'matale', province: 'Central', en: 'Matale', si: 'මාතලේ', ta: 'மாத்தளை' },
  { slug: 'nuwara-eliya', province: 'Central', en: 'Nuwara Eliya', si: 'නුවරඑළිය', ta: 'நுவரெலியா' },
  { slug: 'galle', province: 'Southern', en: 'Galle', si: 'ගාල්ල', ta: 'காலி' },
  { slug: 'matara', province: 'Southern', en: 'Matara', si: 'මාතර', ta: 'மாத்தறை' },
  { slug: 'hambantota', province: 'Southern', en: 'Hambantota', si: 'හම්බන්තොට', ta: 'அம்பாந்தோட்டை' },
  { slug: 'jaffna', province: 'Northern', en: 'Jaffna', si: 'යාපනය', ta: 'யாழ்ப்பாணம்' },
  { slug: 'kilinochchi', province: 'Northern', en: 'Kilinochchi', si: 'කිලිනොච්චිය', ta: 'கிளிநொச்சி' },
  { slug: 'mannar', province: 'Northern', en: 'Mannar', si: 'මන්නාරම', ta: 'மன்னார்' },
  { slug: 'vavuniya', province: 'Northern', en: 'Vavuniya', si: 'වවුනියාව', ta: 'வவுனியா' },
  { slug: 'mullaitivu', province: 'Northern', en: 'Mullaitivu', si: 'මුලතිව්', ta: 'முல்லைத்தீவு' },
  { slug: 'batticaloa', province: 'Eastern', en: 'Batticaloa', si: 'මඩකලපුව', ta: 'மட்டக்களப்பு' },
  { slug: 'ampara', province: 'Eastern', en: 'Ampara', si: 'අම්පාර', ta: 'அம்பாறை' },
  { slug: 'trincomalee', province: 'Eastern', en: 'Trincomalee', si: 'ත්‍රිකුණාමලය', ta: 'திருகோணமலை' },
  { slug: 'kurunegala', province: 'North Western', en: 'Kurunegala', si: 'කුරුණෑගල', ta: 'குருணாகல்' },
  { slug: 'puttalam', province: 'North Western', en: 'Puttalam', si: 'පුත්තලම', ta: 'புத்தளம்' },
  { slug: 'anuradhapura', province: 'North Central', en: 'Anuradhapura', si: 'අනුරාධපුරය', ta: 'அனுராதபுரம்' },
  { slug: 'polonnaruwa', province: 'North Central', en: 'Polonnaruwa', si: 'පොළොන්නරුව', ta: 'பொலன்னறுவை' },
  { slug: 'badulla', province: 'Uva', en: 'Badulla', si: 'බදුල්ල', ta: 'பதுளை' },
  { slug: 'monaragala', province: 'Uva', en: 'Monaragala', si: 'මොනරාගල', ta: 'மொணராகலை' },
  { slug: 'ratnapura', province: 'Sabaragamuwa', en: 'Ratnapura', si: 'රත්නපුර', ta: 'இரத்தினபுரி' },
  { slug: 'kegalle', province: 'Sabaragamuwa', en: 'Kegalle', si: 'කෑගල්ල', ta: 'கேகாலை' },
] as const;

export const DISTRICT_SLUGS = DISTRICTS.map((d) => d.slug);
