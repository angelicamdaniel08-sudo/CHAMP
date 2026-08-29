/**
 * Automated Test Suite for CHAMP REST API Endpoints
 * Run with: node test-api.js
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function runTests() {
  console.log(`\n🧪 Running CHAMP REST API Test Suite on ${BASE_URL}...\n`);
  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} - ${details}`);
      failed++;
    }
  }

  try {
    // 1. Health check
    const health = await request('/api/health');
    assert(health.status === 200 && health.data?.status === 'HEALTHY', 'GET /api/health - Server is healthy');

    // 2. Fetch doctors
    const doctors = await request('/api/doctors');
    assert(doctors.status === 200 && Array.isArray(doctors.data?.data) && doctors.data.data.length > 0,
      'GET /api/doctors - Fetch available doctors & queue lengths',
      JSON.stringify(doctors.data)
    );
    const testDoctor = doctors.data.data[0];

    // 3. Fetch users / students
    const users = await request('/api/users?role=STUDENT');
    assert(users.status === 200 && users.data?.data?.length > 0,
      'GET /api/users - Fetch registered student users'
    );
    const testStudent = users.data.data[0];

    // 4. Book an appointment (POST /api/appointments)
    const booking = await request('/api/appointments', {
      method: 'POST',
      body: JSON.stringify({
        studentId: testStudent.id,
        doctorId: testDoctor.id,
        reason: 'Severe headache and dehydration'
      })
    });
    assert(
      booking.status === 201 && booking.data?.data?.queueNumber > 0,
      'POST /api/appointments - Book appointment and assign queueNumber',
      JSON.stringify(booking.data)
    );
    const newAppointment = booking.data.data;
    console.log(`     ℹ️ Assigned Queue Number: #${newAppointment.queueNumber} with Dr. ${newAppointment.doctor?.name}`);

    // 5. Real-time Queue Status check (GET /api/appointments/queue/:id)
    const queueCheck = await request(`/api/appointments/queue/${newAppointment.id}`);
    assert(
      queueCheck.status === 200 && queueCheck.data?.data?.queueTelemetry !== undefined,
      'GET /api/appointments/queue/:id - Real-time queue status & telemetry check',
      JSON.stringify(queueCheck.data)
    );
    console.log(`     ℹ️ Patients ahead in queue: ${queueCheck.data.data.queueTelemetry.patientsAhead}`);

    // 6. Advance appointment status (PATCH /api/appointments/:id/status)
    const updateAppt = await request(`/api/appointments/${newAppointment.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'IN_PROGRESS' })
    });
    assert(
      updateAppt.status === 200 && updateAppt.data?.data?.status === 'IN_PROGRESS',
      'PATCH /api/appointments/:id/status - Update appointment to IN_PROGRESS'
    );

    // 7. Submit Prescription (POST /api/prescriptions)
    const rx = await request('/api/prescriptions', {
      method: 'POST',
      body: JSON.stringify({
        studentId: testStudent.id,
        imageBase64OrUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae',
        hostelDeliveryAddress: 'Hostel Block A - Room 204',
        notes: 'Ibuprofen 400mg + ORS packets'
      })
    });
    assert(
      rx.status === 201 && rx.data?.data?.status === 'PENDING',
      'POST /api/prescriptions - Submit prescription for pharmacist verification & hostel dispatch',
      JSON.stringify(rx.data)
    );
    const newRx = rx.data.data;

    // 8. Fetch Prescriptions (GET /api/prescriptions)
    const rxList = await request('/api/prescriptions');
    assert(
      rxList.status === 200 && rxList.data?.data?.length > 0,
      'GET /api/prescriptions - Fetch prescription records'
    );

    // 9. Pharmacist verify prescription (PATCH /api/prescriptions/:id/status)
    const rxVerify = await request(`/api/prescriptions/${newRx.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'VERIFIED',
        pharmacistNotes: 'Verified by Pharmacist Jenkins. Dispatched for hostel delivery.'
      })
    });
    assert(
      rxVerify.status === 200 && rxVerify.data?.data?.status === 'VERIFIED',
      'PATCH /api/prescriptions/:id/status - Pharmacist verification'
    );

    // 10. Fetch campus health alerts (GET /api/alerts)
    const alerts = await request('/api/alerts');
    assert(
      alerts.status === 200 && alerts.data?.data?.length > 0,
      'GET /api/alerts - Fetch active campus health alerts',
      JSON.stringify(alerts.data)
    );
    console.log(`     ℹ️ Found ${alerts.data.count} active health alerts`);

    // 11. Broadcast new health alert (POST /api/alerts)
    const newAlert = await request('/api/alerts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Emergency Dust Storm & Respiratory Precaution',
        message: 'High air particulate matter observed. Students with asthma are advised to remain indoors.',
        alertType: 'GENERAL',
        severity: 'MEDIUM'
      })
    });
    assert(
      newAlert.status === 201 && newAlert.data?.data?.id !== undefined,
      'POST /api/alerts - Broadcast new health advisory'
    );

    // 12. Trigger Instant Priority Emergency Dispatch (POST /api/emergency)
    const emergency = await request('/api/emergency', {
      method: 'POST',
      body: JSON.stringify({
        studentId: testStudent.id,
        location: 'Hostel Block A - 2nd Floor Common Room',
        details: 'Student experiencing acute severe allergic reaction and wheezing'
      })
    });
    assert(
      emergency.status === 201 && emergency.data?.priority === 'CRITICAL_DISPATCH',
      'POST /api/emergency - Trigger instant priority emergency dispatch',
      JSON.stringify(emergency.data)
    );
    const emergencyRecord = emergency.data.data;

    // 13. Fetch emergency dispatches (GET /api/emergency)
    const emergList = await request('/api/emergency');
    assert(
      emergList.status === 200 && emergList.data?.data?.length > 0,
      'GET /api/emergency - Real-time emergency feed for response teams'
    );

    // 14. Update emergency status (PATCH /api/emergency/:id/status)
    const emergUpdate = await request(`/api/emergency/${emergencyRecord.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'RESPONDING' })
    });
    assert(
      emergUpdate.status === 200 && emergUpdate.data?.data?.status === 'RESPONDING',
      'PATCH /api/emergency/:id/status - Update dispatch status to RESPONDING'
    );

  } catch (error) {
    console.error('\n❌ Unexpected error while executing tests:', error);
    failed++;
  }

  console.log(`\n========================================`);
  console.log(` 🏁 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
