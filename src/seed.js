const db = require('./database');

function seedDatabase() {
  console.log('Seeding National E-Governance Portal Database...');

  // 1. Seed Departments
  const deptCount = db.prepare('SELECT COUNT(*) as count FROM departments').get().count;
  if (deptCount === 0) {
    const insertDept = db.prepare('INSERT INTO departments (code, name, description, head_name) VALUES (?, ?, ?, ?)');
    insertDept.run('REV', 'Revenue & Land Records', 'Handles land titles, income certificates, caste & domicile verifications.', 'Dr. Sunita Verma');
    insertDept.run('TRANS', 'Transport Department', 'Handles driving licenses, vehicle registrations, and transport permits.', 'Shri Vikram Malhotra');
    insertDept.run('FOOD', 'Food & Civil Supplies', 'Handles ration cards, fair price shop allocations, and public distribution.', 'Smt. Anjali Deshmukh');
    insertDept.run('HEALTH', 'Public Health & Family Welfare', 'Handles birth/death registration, health schemes, and hospital grievances.', 'Dr. Arvind Joshi');
    insertDept.run('EDU', 'Higher & Technical Education', 'Scholarships, university transcript verifications, and educational aid.', 'Prof. Meenakshi Sundaram');
  }

  // 2. Seed Users
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    const insertUser = db.prepare('INSERT INTO users (name, email, password, role, phone, aadhaar_no, department_code) VALUES (?, ?, ?, ?, ?, ?, ?)');
    
    // Citizen
    insertUser.run('Abhishek Purohit', 'abhishek.citizen@negp.gov.in', 'Password@123', 'Citizen', '9876543210', '1234-5678-9012', null);
    insertUser.run('Pooja Sharma', 'pooja.sharma@negp.gov.in', 'Password@123', 'Citizen', '9811223344', '2345-6789-0123', null);
    
    // Government Officers
    insertUser.run('Rajesh Sharma (Officer)', 'rajesh.officer@negp.gov.in', 'Officer@123', 'Government Officer', '9822334455', '3456-7890-1234', 'REV');
    insertUser.run('Kavita Nair (Officer)', 'kavita.officer@negp.gov.in', 'Officer@123', 'Government Officer', '9833445566', '4567-8901-2345', 'TRANS');
    
    // Department Heads
    insertUser.run('Dr. Sunita Verma (Dept Head)', 'sunita.head@negp.gov.in', 'Head@123', 'Department Head', '9844556677', '5678-9012-3456', 'REV');
    
    // Admin
    insertUser.run('Admin Portal Officer', 'admin@negp.gov.in', 'Admin@123', 'Admin', '9855667788', '6789-0123-4567', null);
  }

  // 3. Seed Services
  const serviceCount = db.prepare('SELECT COUNT(*) as count FROM services').get().count;
  if (serviceCount === 0) {
    const insertService = db.prepare(`
      INSERT INTO services (department_id, code, name, category, description, eligibility, required_documents, processing_fee, turnaround_days)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const revId = db.prepare("SELECT id FROM departments WHERE code = 'REV'").get().id;
    const transId = db.prepare("SELECT id FROM departments WHERE code = 'TRANS'").get().id;
    const foodId = db.prepare("SELECT id FROM departments WHERE code = 'FOOD'").get().id;
    const healthId = db.prepare("SELECT id FROM departments WHERE code = 'HEALTH'").get().id;

    insertService.run(revId, 'REV-INC-01', 'Income Certificate', 'Revenue Services', 'Issuance of annual household income verification certificate for welfare schemes.', 'Resident of state with verifiable annual income proof.', 'Aadhaar Card, Salary Slip / IT Return, Ration Card, Address Proof', 50.00, 7);
    insertService.run(revId, 'REV-DOM-02', 'Domicile / Residence Certificate', 'Revenue Services', 'Official state resident certificate for education and employment reservations.', 'Continuous domicile residence for minimum 10 years in the state.', 'School Leaving Certificate, Electricity Bill, Ration Card, Aadhaar Card', 60.00, 10);
    insertService.run(transId, 'TRANS-DL-01', 'Driving License Renewal', 'Transport Services', 'Renewal of non-transport or transport vehicle driving licenses.', 'Holder of expired or expiring driving license within grace period.', 'Existing Driving License, Form 1A Medical Certificate, Address Proof', 200.00, 5);
    insertService.run(foodId, 'FOOD-RC-01', 'New Ration Card Application', 'Civil Supplies', 'Issuance of family ration card for subsidized public food distribution.', 'Head of household with no prior active ration card registered.', 'Family Photo, Gas Connection Receipt, Aadhaar Cards of all members', 20.00, 15);
    insertService.run(healthId, 'HLT-BRT-01', 'Birth Certificate Issuance', 'Vital Statistics', 'Official registration and issuance of birth certificate.', 'Birth occurred within state municipal jurisdiction.', 'Hospital Discharge Summary, Parents ID Proof, Marriage Certificate', 0.00, 3);
  }

  // 4. Seed Applications
  const appCount = db.prepare('SELECT COUNT(*) as count FROM applications').get().count;
  if (appCount === 0) {
    const citizen = db.prepare("SELECT id FROM users WHERE email = 'abhishek.citizen@negp.gov.in'").get();
    const revService = db.prepare("SELECT id FROM services WHERE code = 'REV-INC-01'").get();
    const officer = db.prepare("SELECT id, name FROM users WHERE email = 'rajesh.officer@negp.gov.in'").get();

    const insertApp = db.prepare(`
      INSERT INTO applications (application_id, service_id, citizen_id, applicant_name, applicant_email, applicant_phone, applicant_address, identity_type, identity_number, form_data, status, current_remarks, verified_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const appId1 = 'NEGP-APP-2026-10001';
    insertApp.run(
      appId1,
      revService.id,
      citizen.id,
      'Abhishek Purohit',
      'abhishek.citizen@negp.gov.in',
      '9876543210',
      'Flat 402, Green Avenue, Sector 9',
      'Aadhaar Card',
      '1234-5678-9012',
      JSON.stringify({ annualIncome: '450000', occupation: 'Software Professional', familyMembers: '4' }),
      'Under Verification',
      'Document verification in progress by Tehsildar desk.',
      officer.id
    );

    // History for App 1
    const insertAppHist = db.prepare('INSERT INTO application_history (application_id, previous_status, new_status, changed_by_user_id, changed_by_name, remarks) VALUES (?, ?, ?, ?, ?, ?)');
    insertAppHist.run(appId1, null, 'Submitted', citizen.id, 'Abhishek Purohit', 'Application successfully submitted online with uploaded proofs.');
    insertAppHist.run(appId1, 'Submitted', 'Under Verification', officer.id, officer.name, 'Assigned to Verification Officer Rajesh Sharma.');

    // Seed App 2: Approved
    const appId2 = 'NEGP-APP-2026-10002';
    insertApp.run(
      appId2,
      revService.id,
      citizen.id,
      'Abhishek Purohit',
      'abhishek.citizen@negp.gov.in',
      '9876543210',
      'Flat 402, Green Avenue, Sector 9',
      'Aadhaar Card',
      '1234-5678-9012',
      JSON.stringify({ annualIncome: '320000', occupation: 'Consultant', familyMembers: '3' }),
      'Approved',
      'All proofs verified and approved by Competent Authority.',
      officer.id
    );
    insertAppHist.run(appId2, null, 'Submitted', citizen.id, 'Abhishek Purohit', 'Application submitted.');
    insertAppHist.run(appId2, 'Submitted', 'Under Verification', officer.id, officer.name, 'Verification done.');
    insertAppHist.run(appId2, 'Under Verification', 'Pending Approval', officer.id, officer.name, 'Recommended for sign-off.');
    insertAppHist.run(appId2, 'Pending Approval', 'Approved', 5, 'Dr. Sunita Verma (Dept Head)', 'Certificate digitally generated and granted.');
  }

  // 5. Seed Grievances
  const grvCount = db.prepare('SELECT COUNT(*) as count FROM grievances').get().count;
  if (grvCount === 0) {
    const citizen = db.prepare("SELECT id FROM users WHERE email = 'abhishek.citizen@negp.gov.in'").get();
    const revDept = db.prepare("SELECT id FROM departments WHERE code = 'REV'").get();
    const officer = db.prepare("SELECT id, name FROM users WHERE email = 'rajesh.officer@negp.gov.in'").get();

    const insertGrv = db.prepare(`
      INSERT INTO grievances (grievance_id, citizen_id, department_id, category, title, description, supporting_evidence, status, assigned_officer_id, officer_remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const grvId1 = 'NEGP-GRV-2026-20001';
    insertGrv.run(
      grvId1,
      citizen.id,
      revDept.id,
      'Delay in Service Delivery',
      'Delay in Tehsildar Office Verification for Land Records',
      'Submitted application 14 days ago for land title correction. Processing SLA was 7 days. Request urgent intervention.',
      'Ref No: REV-REC-8849',
      'In Progress',
      officer.id,
      'Field inspection report requested from Village Officer. Case under active resolution.'
    );

    const insertGrvHist = db.prepare('INSERT INTO grievance_history (grievance_id, previous_status, new_status, changed_by_user_id, changed_by_name, remarks) VALUES (?, ?, ?, ?, ?, ?)');
    insertGrvHist.run(grvId1, null, 'Filed', citizen.id, 'Abhishek Purohit', 'Grievance lodged on portal.');
    insertGrvHist.run(grvId1, 'Filed', 'In Progress', officer.id, officer.name, 'Officer assigned and enquiry initiated.');
  }

  console.log('Database seeding successfully finished!');
}

module.exports = seedDatabase;

if (require.main === module) {
  seedDatabase();
}
