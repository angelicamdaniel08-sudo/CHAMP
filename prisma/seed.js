const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed for CHAMP...');

  // Clean existing data
  await prisma.emergencyDispatch.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.healthAlert.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.user.deleteMany();

  // 1. Seed Users (Students, Pharmacists, Counselors)
  console.log('👤 Seeding Users...');
  const student1 = await prisma.user.create({
    data: {
      name: 'Alex Rivera',
      email: 'alex.rivera@campus.edu',
      role: 'STUDENT',
      hostelBlock: 'Hostel Block A - Room 204',
      phone: '+1 (555) 234-5678'
    }
  });

  const student2 = await prisma.user.create({
    data: {
      name: 'Priya Sharma',
      email: 'priya.sharma@campus.edu',
      role: 'STUDENT',
      hostelBlock: 'Hostel Block C - Room 112',
      phone: '+1 (555) 345-6789'
    }
  });

  const student3 = await prisma.user.create({
    data: {
      name: 'Marcus Chen',
      email: 'marcus.chen@campus.edu',
      role: 'STUDENT',
      hostelBlock: 'Hostel Block B - Room 405',
      phone: '+1 (555) 456-7890'
    }
  });

  const pharmacist = await prisma.user.create({
    data: {
      name: 'Sarah Jenkins, PharmD',
      email: 'sarah.jenkins@campus-health.edu',
      role: 'PHARMACIST',
      hostelBlock: 'Campus Health Center Pharmacy',
      phone: '+1 (555) 800-PHARM'
    }
  });

  const counselor = await prisma.user.create({
    data: {
      name: 'Dr. Evelyn Reed',
      email: 'evelyn.reed@campus-health.edu',
      role: 'COUNSELOR',
      hostelBlock: 'Wellness Center - Suite 3B',
      phone: '+1 (555) 800-COUNSEL'
    }
  });

  // 2. Seed Doctors
  console.log('🩺 Seeding Doctors...');
  const doc1 = await prisma.doctor.create({
    data: {
      name: 'Dr. Gregory Vance, MD',
      specialty: 'General Medicine & Urgent Care',
      availabilityStatus: 'AVAILABLE',
      roomNumber: 'Clinic Room 101',
      email: 'gregory.vance@campus-health.edu',
      phone: '+1 (555) 101-0001',
      currentQueueLength: 0
    }
  });

  const doc2 = await prisma.doctor.create({
    data: {
      name: 'Dr. Ananya Patel, MD',
      specialty: 'Mental Health & Student Psychiatry',
      availabilityStatus: 'AVAILABLE',
      roomNumber: 'Wellness Suite 202',
      email: 'ananya.patel@campus-health.edu',
      phone: '+1 (555) 202-0002',
      currentQueueLength: 0
    }
  });

  const doc3 = await prisma.doctor.create({
    data: {
      name: 'Dr. Liam Gallagher, DO',
      specialty: 'Sports Medicine & Orthopedics',
      availabilityStatus: 'AVAILABLE',
      roomNumber: 'Sports Complex Clinic 03',
      email: 'liam.gallagher@campus-health.edu',
      phone: '+1 (555) 303-0003',
      currentQueueLength: 0
    }
  });

  const doc4 = await prisma.doctor.create({
    data: {
      name: 'Dr. Sofia Reyes, MD',
      specialty: 'Dermatology & Allergy',
      availabilityStatus: 'BUSY',
      roomNumber: 'Clinic Room 105',
      email: 'sofia.reyes@campus-health.edu',
      phone: '+1 (555) 105-0004',
      currentQueueLength: 0
    }
  });

  // 3. Seed Campus Health Alerts
  console.log('📢 Seeding Campus Health Alerts...');
  await prisma.healthAlert.createMany({
    data: [
      {
        title: 'Seasonal Viral Gastroenteritis Advisory',
        message: 'Campus health has observed an uptick in viral stomach bugs across South Quad hostels. Wash hands frequently and utilize hydration stations at all dining halls.',
        alertType: 'EPIDEMIC',
        severity: 'HIGH',
        isActive: true
      },
      {
        title: 'Extreme Heatwave Warning (Heat Index 104°F)',
        message: 'High temperatures predicted between 12:00 PM and 5:00 PM. Avoid outdoor athletic activities. Free electrolyte sachets available at all hostel front desks.',
        alertType: 'HEATWAVE',
        severity: 'MEDIUM',
        isActive: true
      },
      {
        title: 'Annual Influenza & Meningococcal Vaccination Drive',
        message: 'Free walk-in vaccinations available at the Main Campus Health Center from Monday to Friday, 9:00 AM - 4:00 PM. No appointment needed.',
        alertType: 'VACCINATION',
        severity: 'LOW',
        isActive: true
      }
    ]
  });

  // 4. Seed a demo initial appointment
  console.log('📅 Seeding Sample Appointment...');
  const appt1 = await prisma.appointment.create({
    data: {
      studentId: student1.id,
      doctorId: doc1.id,
      queueNumber: 1,
      reason: 'Persistent sore throat and low-grade fever',
      status: 'QUEUED'
    }
  });

  // Update doc1 queue length
  await prisma.doctor.update({
    where: { id: doc1.id },
    data: { currentQueueLength: 1 }
  });

  // 5. Seed a demo prescription
  console.log('💊 Seeding Sample Prescription...');
  await prisma.prescription.create({
    data: {
      studentId: student2.id,
      imageBase64OrUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=60',
      hostelDeliveryAddress: 'Hostel Block C - Room 112',
      notes: 'Prescribed: Amoxicillin 500mg (10 tabs) and Paracetamol 650mg. Deliver before 7 PM.',
      status: 'PENDING'
    }
  });

  console.log('✅ CHAMP database seeding completed successfully!');
  console.log(`Demo Student 1 ID: ${student1.id} (${student1.name})`);
  console.log(`Demo Student 2 ID: ${student2.id} (${student2.name})`);
  console.log(`Demo Doctor 1 ID:  ${doc1.id} (${doc1.name})`);
  console.log(`Demo Appointment ID: ${appt1.id}`);
}

main()
  .catch((e) => {
    console.error('❌ Error during database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
