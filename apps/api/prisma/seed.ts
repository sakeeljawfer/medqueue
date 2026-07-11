/**
 * Demo seed: 1 admin, 30 approved doctors (plus 2 pending for the approval
 * queue), dispensaries across all 25 districts, weekly schedules, today's
 * sessions, 40 patients, and a pending bank-slip payment.
 *
 * Deterministic — no faker — so demo phone numbers and SLMC numbers are
 * stable across re-runs. Idempotent via upsert on unique keys.
 *
 * Run: pnpm --filter api seed
 */
import { PrismaClient, Specialty } from '@prisma/client';
import { DISTRICTS } from '@medqueue/shared';

const prisma = new PrismaClient();

const SPECIALTIES = Object.values(Specialty);

/** Sri Lankan demo names: [name, preferred locale]. */
const DOCTOR_NAMES: Array<[string, 'en' | 'si' | 'ta']> = [
  ['Dr. Nimal Perera', 'si'],
  ['Dr. Kumari Jayawardena', 'si'],
  ['Dr. S. Thavarajah', 'ta'],
  ['Dr. Anoma Fernando', 'en'],
  ['Dr. Ruwan Wickramasinghe', 'si'],
  ['Dr. Fathima Rizwan', 'en'],
  ['Dr. Chaminda Silva', 'si'],
  ['Dr. Meena Sivakumar', 'ta'],
  ['Dr. Prasad Gunasekara', 'si'],
  ['Dr. Nirmala Rajapaksa', 'si'],
  ['Dr. A. Kandasamy', 'ta'],
  ['Dr. Dilani Weerasinghe', 'en'],
  ['Dr. Mohamed Nazeer', 'en'],
  ['Dr. Sanduni Herath', 'si'],
  ['Dr. Rajan Krishnamoorthy', 'ta'],
  ['Dr. Ishara Bandara', 'si'],
  ['Dr. Shanthi Balasingham', 'ta'],
  ['Dr. Lasantha Karunaratne', 'si'],
  ['Dr. Zainab Marikkar', 'en'],
  ['Dr. Upul Dissanayake', 'si'],
  ['Dr. Tharindu Senanayake', 'en'],
  ['Dr. V. Yogeswaran', 'ta'],
  ['Dr. Chandrika Amarasekara', 'si'],
  ['Dr. Roshan de Alwis', 'en'],
  ['Dr. Pavithra Selvarajah', 'ta'],
  ['Dr. Gayan Rathnayake', 'si'],
  ['Dr. Harsha Liyanage', 'en'],
  ['Dr. Kavitha Ramanathan', 'ta'],
  ['Dr. Sunil Ekanayake', 'si'],
  ['Dr. Nadeesha Wijesuriya', 'si'],
];

const PATIENT_NAMES = [
  'Saman Kumara', 'Ayesha Nofal', 'Kasun Madushanka', 'Tharshini Raj', 'Nuwan Pradeep',
  'Iresha Sandamali', 'Mohamed Aslam', 'Dinesh Chandimal', 'Vithya Sri', 'Chamara Kapugedara',
  'Hansika Perera', 'Suresh Kumar', 'Malsha Fernando', 'Rifka Nusrath', 'Janith Liyanage',
  'Piumi Hansamali', 'Arjun Vasanth', 'Lakmal Silva', 'Shanika Devi', 'Ruwanthi Mendis',
  'Isuru Udana', 'Fathima Shifna', 'Kavindu Theekshana', 'Yalini Kumar', 'Dasun Shanaka',
  'Nethmi Gamage', 'Riyas Ahamed', 'Sachini Nisansala', 'Keerthi Raja', 'Pasindu Sooriyabandara',
  'Amaya Wijethunga', 'Sivarani Nadesan', 'Buddhika Pathirana', 'Zahra Iqbal', 'Ravindu Fernando',
  'Umesha Kaushalya', 'Pradeepan Siva', 'Chathura Randika', 'Nilufa Careem', 'Heshan Jayasekara',
];

/** Approximate town centres per district for plausible pins. */
const TOWNS: Record<string, { town: string; lat: number; lng: number }> = {
  colombo: { town: 'Nugegoda', lat: 6.8649, lng: 79.8997 },
  gampaha: { town: 'Negombo', lat: 7.2083, lng: 79.8358 },
  kalutara: { town: 'Panadura', lat: 6.7133, lng: 79.9026 },
  kandy: { town: 'Peradeniya', lat: 7.2599, lng: 80.5977 },
  matale: { town: 'Dambulla', lat: 7.874, lng: 80.6511 },
  'nuwara-eliya': { town: 'Hatton', lat: 6.8916, lng: 80.5959 },
  galle: { town: 'Karapitiya', lat: 6.0652, lng: 80.2213 },
  matara: { town: 'Weligama', lat: 5.9754, lng: 80.4293 },
  hambantota: { town: 'Tangalle', lat: 6.0243, lng: 80.7941 },
  jaffna: { town: 'Nallur', lat: 9.6684, lng: 80.0295 },
  kilinochchi: { town: 'Kilinochchi', lat: 9.3961, lng: 80.3982 },
  mannar: { town: 'Mannar', lat: 8.9772, lng: 79.9042 },
  vavuniya: { town: 'Vavuniya', lat: 8.7514, lng: 80.4971 },
  mullaitivu: { town: 'Mullaitivu', lat: 9.2671, lng: 80.8142 },
  batticaloa: { town: 'Kattankudy', lat: 7.6767, lng: 81.7319 },
  ampara: { town: 'Kalmunai', lat: 7.4098, lng: 81.8358 },
  trincomalee: { town: 'Kinniya', lat: 8.4986, lng: 81.1839 },
  kurunegala: { town: 'Kuliyapitiya', lat: 7.4688, lng: 80.0401 },
  puttalam: { town: 'Chilaw', lat: 7.5758, lng: 79.7953 },
  anuradhapura: { town: 'Anuradhapura', lat: 8.3114, lng: 80.4037 },
  polonnaruwa: { town: 'Kaduruwela', lat: 7.9403, lng: 81.0188 },
  badulla: { town: 'Bandarawela', lat: 6.8291, lng: 80.9896 },
  monaragala: { town: 'Wellawaya', lat: 6.7369, lng: 81.1031 },
  ratnapura: { town: 'Embilipitiya', lat: 6.3432, lng: 80.8578 },
  kegalle: { town: 'Mawanella', lat: 7.2531, lng: 80.4466 },
};

const BIOS: Record<string, string> = {
  GENERAL_PRACTICE: 'Family physician focused on preventive care and chronic disease management.',
  PEDIATRICS: 'Caring for infants and children, with special interest in nutrition and asthma.',
  GYNECOLOGY: "Women's health, antenatal care and family planning consultations.",
  CARDIOLOGY: 'Consultant cardiologist — hypertension, cholesterol and heart failure clinics.',
  DERMATOLOGY: 'Skin, hair and nail conditions; eczema and psoriasis clinics.',
  ENT: 'Ear, nose and throat specialist; sinus and hearing assessments.',
  OPHTHALMOLOGY: 'Eye examinations, cataract assessment and diabetic eye screening.',
  ORTHOPEDICS: 'Joint pain, sports injuries and fracture follow-up care.',
  PSYCHIATRY: 'Confidential consultations for stress, anxiety and depression.',
  NEUROLOGY: 'Headache, epilepsy and stroke follow-up clinics.',
  UROLOGY: 'Kidney stones, prostate care and urinary tract conditions.',
  ONCOLOGY: 'Cancer screening, staging reviews and treatment follow-up.',
  ENDOCRINOLOGY: 'Diabetes, thyroid and hormonal disorder management.',
  GASTROENTEROLOGY: 'Gastritis, liver disease and digestive health consultations.',
  RESPIRATORY: 'Asthma, COPD and chronic cough clinics.',
};

function phone(prefix: string, index: number): string {
  return `+947${prefix}${String(index).padStart(6, '0')}`;
}

async function main(): Promise<void> {
  console.log('Seeding MedQueue demo data…');

  // ----- admin -----
  const admin = await prisma.user.upsert({
    where: { phone: '+94770000001' },
    update: {},
    create: {
      phone: '+94770000001',
      role: 'ADMIN',
      name: 'MedQueue Admin',
      preferredLanguage: 'en',
      pdpaConsentAt: new Date(),
    },
  });

  // ----- patients -----
  const locales = ['si', 'ta', 'en'] as const;
  for (let i = 0; i < PATIENT_NAMES.length; i++) {
    await prisma.user.upsert({
      where: { phone: phone('1', i + 1) },
      update: {},
      create: {
        phone: phone('1', i + 1),
        role: 'PATIENT',
        name: PATIENT_NAMES[i],
        preferredLanguage: locales[i % 3],
        pdpaConsentAt: new Date(),
      },
    });
  }

  // ----- doctors: 30 approved spread over the 25 districts -----
  for (let i = 0; i < DOCTOR_NAMES.length; i++) {
    const [name, locale] = DOCTOR_NAMES[i]!;
    const district = DISTRICTS[i % DISTRICTS.length]!;
    const specialty = SPECIALTIES[i % SPECIALTIES.length]!;
    const spot = TOWNS[district.slug]!;

    const user = await prisma.user.upsert({
      where: { phone: phone('7', i + 1) },
      update: {},
      create: {
        phone: phone('7', i + 1),
        role: 'DOCTOR',
        name,
        preferredLanguage: locale,
        pdpaConsentAt: new Date(),
      },
    });

    const profile = await prisma.doctorProfile.upsert({
      where: { slmcRegNo: `SLMC-${String(40000 + i)}` },
      update: {},
      create: {
        userId: user.id,
        slmcRegNo: `SLMC-${String(40000 + i)}`,
        specialty,
        bio: BIOS[specialty] ?? null,
        consultationFeeLKR: 1000 + (i % 5) * 250,
        approvalStatus: 'APPROVED',
        approvedByAdminId: admin.id,
        approvedAt: new Date(),
      },
    });

    let dispensary = await prisma.dispensary.findFirst({
      where: { doctorId: profile.id },
    });
    if (!dispensary) {
      // Nudge pins ~±500 m so same-district dispensaries don't overlap.
      const jitter = (n: number) => Number((n + ((i % 7) - 3) * 0.005).toFixed(4));
      dispensary = await prisma.dispensary.create({
        data: {
          doctorId: profile.id,
          name: `${spot.town} Medical Centre`,
          addressLine: `${20 + i}, Main Street`,
          town: spot.town,
          district: district.slug,
          lat: jitter(spot.lat),
          lng: jitter(spot.lng),
          contactPhone: phone('6', i + 1),
        },
      });
    }

    // Two evening sessions and one weekend morning per week — the typical
    // channeling pattern for a dispensary doctor.
    const schedulesWanted = [
      { dayOfWeek: (i % 5) + 1, startTime: '17:00', endTime: '20:00' },
      { dayOfWeek: ((i + 2) % 5) + 1, startTime: '18:00', endTime: '21:00' },
      { dayOfWeek: i % 2 === 0 ? 6 : 0, startTime: '08:30', endTime: '12:00' },
    ];
    const existing = await prisma.sessionSchedule.count({
      where: { dispensaryId: dispensary.id },
    });
    if (existing === 0) {
      for (const s of schedulesWanted) {
        await prisma.sessionSchedule.create({
          data: {
            dispensaryId: dispensary.id,
            ...s,
            maxPatients: 60,
            avgConsultMinutes: 8 + (i % 4),
          },
        });
      }
    }
  }

  // ----- 2 pending doctors for the admin approval queue -----
  const pendingSeed: Array<[string, Specialty]> = [
    ['Dr. Janaka Abeywickrama', 'GENERAL_PRACTICE'],
    ['Dr. T. Sutharsan', 'PEDIATRICS'],
  ];
  for (let i = 0; i < pendingSeed.length; i++) {
    const [name, specialty] = pendingSeed[i]!;
    const user = await prisma.user.upsert({
      where: { phone: phone('8', i + 1) },
      update: {},
      create: {
        phone: phone('8', i + 1),
        role: 'DOCTOR',
        name,
        preferredLanguage: i === 0 ? 'si' : 'ta',
        pdpaConsentAt: new Date(),
      },
    });
    await prisma.doctorProfile.upsert({
      where: { slmcRegNo: `SLMC-${String(50000 + i)}` },
      update: {},
      create: {
        userId: user.id,
        slmcRegNo: `SLMC-${String(50000 + i)}`,
        specialty,
        bio: 'Recently relocated; setting up a new evening dispensary practice.',
        consultationFeeLKR: 1200,
        approvalStatus: 'PENDING',
      },
    });
  }

  // ----- today's sessions (Asia/Colombo) in SCHEDULED state -----
  const COLOMBO_OFFSET_MS = 5.5 * 3_600_000;
  const DAY_MS = 86_400_000;
  const colomboNow = new Date(Date.now() + COLOMBO_OFFSET_MS);
  const dayOfWeek = colomboNow.getUTCDay();
  const todayDate = new Date(Math.floor(colomboNow.getTime() / DAY_MS) * DAY_MS);

  const todaysSchedules = await prisma.sessionSchedule.findMany({
    where: { dayOfWeek, active: true },
  });
  for (const schedule of todaysSchedules) {
    await prisma.session.upsert({
      where: { scheduleId_date: { scheduleId: schedule.id, date: todayDate } },
      update: {},
      create: { scheduleId: schedule.id, date: todayDate, status: 'SCHEDULED' },
    });
  }

  // ----- one pending bank-slip payment for the review queue -----
  const firstDoctor = await prisma.doctorProfile.findUnique({
    where: { slmcRegNo: 'SLMC-40000' },
  });
  if (firstDoctor) {
    const pendingPayment = await prisma.payment.findFirst({
      where: { doctorId: firstDoctor.id, status: 'PENDING', method: 'BANK_SLIP' },
    });
    if (!pendingPayment) {
      await prisma.payment.create({
        data: {
          doctorId: firstDoctor.id,
          type: 'SUBSCRIPTION',
          amountLKR: 2500,
          method: 'BANK_SLIP',
          status: 'PENDING',
        },
      });
    }
  }

  const counts = await Promise.all([
    prisma.user.count(),
    prisma.doctorProfile.count(),
    prisma.dispensary.count(),
    prisma.sessionSchedule.count(),
    prisma.session.count(),
  ]);
  console.log(
    `Done. users=${counts[0]} doctors=${counts[1]} dispensaries=${counts[2]} schedules=${counts[3]} sessions=${counts[4]}`,
  );
  console.log('Admin sign-in: +94 77 000 0001 (OTP appears in API console in dev).');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
