const assert = require('node:assert');
const http = require('node:http');
const app = require('../src/server');

let server;
let baseUrl;

// Test Execution Results Collector
const testResults = [];

function recordTestResult(id, moduleName, scenario, testData, technique, expected, actual, passed) {
  testResults.push({
    id,
    module: moduleName,
    scenario,
    testData,
    technique,
    expected,
    actual,
    status: passed ? 'Pass' : 'Fail'
  });
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${id} - ${scenario}`);
}

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { ...headers }
    };

    let postData = null;
    if (body) {
      if (typeof body === 'object') {
        postData = JSON.stringify(body);
        options.headers['Content-Type'] = 'application/json';
        options.headers['Content-Length'] = Buffer.byteLength(postData);
      } else {
        postData = body;
      }
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch(e) { parsed = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runAllTests() {
  console.log('===============================================================');
  console.log('  STARTING COMPREHENSIVE AUTOMATED TEST SUITE FOR NEGP        ');
  console.log('===============================================================\n');

  // Start test server
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`Test server active on ${baseUrl}\n`);
      resolve();
    });
  });

  try {
    // ---------------- MODULE 1: AUTHENTICATION & CITIZEN REGISTRATION ----------------
    {
      // TC-M1-01: Valid Citizen Registration
      const uniqueEmail = `test.citizen.${Date.now()}@negp.gov.in`;
      const res = await request('POST', '/api/auth/register', {
        name: 'Rohan Sharma',
        email: uniqueEmail,
        password: 'Password@123',
        phone: '9876543210',
        aadhaar_no: '9988-7766-5544'
      });
      const passed = res.status === 201 && res.body.success === true;
      recordTestResult(
        'TC-M1-01',
        'Citizen Registration',
        'Register citizen with valid credentials',
        `Email: ${uniqueEmail}, Phone: 9876543210`,
        'Equivalence Partitioning',
        'HTTP 201 Created; citizen account saved with unique ID',
        `Status ${res.status}; success=${res.body.success}`,
        passed
      );
    }

    {
      // TC-M1-02: Duplicate Email Registration (Negative)
      const res = await request('POST', '/api/auth/register', {
        name: 'Abhishek Duplicate',
        email: 'abhishek.citizen@negp.gov.in',
        password: 'Password@123',
        phone: '9876543210'
      });
      const passed = res.status === 409 && res.body.success === false;
      recordTestResult(
        'TC-M1-02',
        'Citizen Registration',
        'Attempt registration with existing email',
        'Email: abhishek.citizen@negp.gov.in',
        'Equivalence Partitioning',
        'HTTP 409 Conflict; registration rejected',
        `Status ${res.status}; message="${res.body.message}"`,
        passed
      );
    }

    {
      // TC-M1-03: Missing Mandatory Registration Fields (Negative)
      const res = await request('POST', '/api/auth/register', {
        name: 'Incomplete User',
        email: 'incomplete@test.com'
        // missing password & phone
      });
      const passed = res.status === 400 && res.body.success === false;
      recordTestResult(
        'TC-M1-03',
        'Citizen Registration',
        'Submit registration with missing mandatory fields',
        'Password and phone omitted',
        'Validation Testing',
        'HTTP 400 Bad Request; error message returned',
        `Status ${res.status}; message="${res.body.message}"`,
        passed
      );
    }

    {
      // TC-M1-04: Boundary Value Analysis on Phone Number (Invalid length < 10)
      const res = await request('POST', '/api/auth/register', {
        name: 'Phone Test User',
        email: `phone.test.${Date.now()}@test.com`,
        password: 'Password@123',
        phone: '987654321' // 9 digits (boundary failure)
      });
      const passed = res.status === 400 && res.body.message.includes('10-digit');
      recordTestResult(
        'TC-M1-04',
        'Citizen Registration',
        'BVA on mobile phone: 9 digits (Min - 1)',
        'Phone: 987654321',
        'Boundary Value Analysis',
        'HTTP 400; rejected due to invalid phone length',
        `Status ${res.status}; message="${res.body.message}"`,
        passed
      );
    }

    {
      // TC-M1-05: Valid Citizen Login
      const res = await request('POST', '/api/auth/login', {
        email: 'abhishek.citizen@negp.gov.in',
        password: 'Password@123'
      });
      const passed = res.status === 200 && res.body.user.role === 'Citizen';
      recordTestResult(
        'TC-M1-05',
        'Authentication',
        'Login with valid citizen credentials',
        'Email: abhishek.citizen@negp.gov.in, Pwd: Password@123',
        'Functional Testing',
        'HTTP 200 OK; authenticated as Citizen',
        `Status ${res.status}; role=${res.body.user?.role}`,
        passed
      );
    }

    {
      // TC-M1-06: Invalid Password Login (Negative)
      const res = await request('POST', '/api/auth/login', {
        email: 'abhishek.citizen@negp.gov.in',
        password: 'WrongPassword'
      });
      const passed = res.status === 401 && res.body.success === false;
      recordTestResult(
        'TC-M1-06',
        'Authentication',
        'Login with incorrect password',
        'Email: abhishek.citizen@negp.gov.in, Pwd: WrongPassword',
        'Validation Testing',
        'HTTP 401 Unauthorized; login denied',
        `Status ${res.status}; message="${res.body.message}"`,
        passed
      );
    }

    // ---------------- MODULE 1: APPLICATION SUBMISSION & TRACKING ----------------
    let createdAppId = null;

    {
      // TC-M1-07: Fetch Active Government Services
      const res = await request('GET', '/api/services');
      const passed = res.status === 200 && Array.isArray(res.body.services) && res.body.services.length >= 4;
      recordTestResult(
        'TC-M1-07',
        'Government Service Catalog',
        'Retrieve catalog of available government services',
        'None',
        'Functional Testing',
        'HTTP 200 OK; returns list of active services with departments and fees',
        `Status ${res.status}; count=${res.body.services?.length}`,
        passed
      );
    }

    {
      // TC-M1-08: Submit Valid Government Service Application
      const res = await request('POST', '/api/applications', {
        service_id: 1,
        citizen_id: 1,
        applicant_name: 'Abhishek Purohit',
        applicant_email: 'abhishek.citizen@negp.gov.in',
        applicant_phone: '9876543210',
        applicant_address: 'Flat 402, Green Avenue, Sector 9',
        identity_type: 'Aadhaar Card',
        identity_number: '1234-5678-9012',
        is_draft: 'false',
        form_data: JSON.stringify({ annualIncome: '500000', occupation: 'Engineer' })
      });
      createdAppId = res.body.application_id;
      const passed = res.status === 201 && createdAppId && createdAppId.startsWith('NEGP-APP-');
      recordTestResult(
        'TC-M1-08',
        'Application Submission',
        'Submit complete government service application',
        'Service: 1 (Income Certificate), Valid applicant info',
        'Functional Testing',
        'HTTP 201; unique ID generated in format NEGP-APP-YYYY-XXXXX; status=Submitted',
        `Status ${res.status}; generated_id=${createdAppId}`,
        passed
      );
    }

    {
      // TC-M1-09: Missing Mandatory Fields in Application (Negative)
      const res = await request('POST', '/api/applications', {
        service_id: 1,
        citizen_id: 1,
        applicant_name: 'Abhishek Purohit'
        // Missing email, phone, address, identity
      });
      const passed = res.status === 400 && res.body.success === false;
      recordTestResult(
        'TC-M1-09',
        'Application Submission',
        'Submit application with incomplete mandatory fields',
        'Omitted phone, address, and identity number',
        'Validation Testing',
        'HTTP 400 Bad Request; validation failure explanation',
        `Status ${res.status}; message="${res.body.message}"`,
        passed
      );
    }

    {
      // TC-M1-10: Track Application by Reference ID
      const res = await request('GET', `/api/applications/${createdAppId}`);
      const passed = res.status === 200 && res.body.application.application_id === createdAppId && res.body.history.length >= 1;
      recordTestResult(
        'TC-M1-10',
        'Application Tracking',
        'Track submitted application and view status history timeline',
        `Application ID: ${createdAppId}`,
        'Functional Testing',
        'HTTP 200; application record, documents, and lifecycle history returned',
        `Status ${res.status}; history_entries=${res.body.history?.length}`,
        passed
      );
    }

    {
      // TC-M1-11: Officer Verification Workflow
      const res = await request('PATCH', `/api/applications/${createdAppId}/status`, {
        status: 'Under Verification',
        remarks: 'Documents examined by verification desk; physically verified.',
        user_id: 3,
        user_name: 'Rajesh Sharma (Officer)',
        user_role: 'Government Officer'
      });
      const passed = res.status === 200 && res.body.status === 'Under Verification';
      recordTestResult(
        'TC-M1-11',
        'Application Verification',
        'Government Officer transitions application to Under Verification',
        'Role: Government Officer, Status: Under Verification',
        'Integration Testing',
        'HTTP 200; status updated and audit logged',
        `Status ${res.status}; new_status=${res.body.status}`,
        passed
      );
    }

    {
      // TC-M1-12: Officer Sends Application for Department Head Approval
      const res = await request('PATCH', `/api/applications/${createdAppId}/status`, {
        status: 'Pending Approval',
        remarks: 'Verification complete; submitted for Dept Head sign-off.',
        user_id: 3,
        user_name: 'Rajesh Sharma (Officer)',
        user_role: 'Government Officer'
      });
      const passed = res.status === 200 && res.body.status === 'Pending Approval';
      recordTestResult(
        'TC-M1-12',
        'Application Workflow',
        'Transition application to Pending Approval',
        'Status: Pending Approval',
        'Integration Testing',
        'HTTP 200; queued for Department Head review',
        `Status ${res.status}; new_status=${res.body.status}`,
        passed
      );
    }

    {
      // TC-M1-13: Unauthorized Officer Approval Prevention (Security Check)
      const res = await request('PATCH', `/api/applications/${createdAppId}/status`, {
        status: 'Approved',
        remarks: 'Attempting approval without Department Head role',
        user_id: 3,
        user_name: 'Rajesh Sharma (Officer)',
        user_role: 'Government Officer' // unauthorized for approval
      });
      const passed = res.status === 403 && res.body.success === false;
      recordTestResult(
        'TC-M1-13',
        'Role-Based Access Control',
        'Enforce Dept Head approval authority (Prevent officer from approving)',
        'User Role: Government Officer attempting status=Approved',
        'Security / Validation Testing',
        'HTTP 403 Forbidden; only Dept Head/Admin permitted',
        `Status ${res.status}; message="${res.body.message}"`,
        passed
      );
    }

    {
      // TC-M1-14: Department Head Final Approval
      const res = await request('PATCH', `/api/applications/${createdAppId}/status`, {
        status: 'Approved',
        remarks: 'Verified eligibility and authenticated certificate issuance.',
        user_id: 5,
        user_name: 'Dr. Sunita Verma (Dept Head)',
        user_role: 'Department Head'
      });
      const passed = res.status === 200 && res.body.status === 'Approved';
      recordTestResult(
        'TC-M1-14',
        'Application Approval',
        'Department Head approves application and grants service',
        'Role: Department Head, Status: Approved',
        'Functional Testing',
        'HTTP 200; application status transitioned to Approved',
        `Status ${res.status}; status=${res.body.status}`,
        passed
      );
    }

    // ---------------- MODULE 2: GRIEVANCE AND COMPLAINT REDRESSAL ----------------
    let createdGrvId = null;

    {
      // TC-M2-01: Submit Valid Public Grievance
      const res = await request('POST', '/api/grievances', {
        citizen_id: 1,
        citizen_name: 'Abhishek Purohit',
        department_id: 1,
        category: 'Delay in Service Delivery',
        title: 'Delayed Income Certificate Verification',
        description: 'Application was submitted over 10 days ago but remains pending with the field inspector.',
        supporting_evidence: `Application Ref: ${createdAppId}`
      });
      createdGrvId = res.body.grievance_id;
      const passed = res.status === 201 && createdGrvId && createdGrvId.startsWith('NEGP-GRV-');
      recordTestResult(
        'TC-M2-01',
        'Grievance Registration',
        'Lodge public grievance with valid category and details',
        'Dept: 1, Category: Delay in Service Delivery',
        'Functional Testing',
        'HTTP 201; unique ticket ID generated (NEGP-GRV-YYYY-XXXXX); status=Filed',
        `Status ${res.status}; generated_id=${createdGrvId}`,
        passed
      );
    }

    {
      // TC-M2-02: Missing Mandatory Grievance Fields (Negative)
      const res = await request('POST', '/api/grievances', {
        citizen_id: 1,
        department_id: 1
        // missing category, title, description
      });
      const passed = res.status === 400 && res.body.success === false;
      recordTestResult(
        'TC-M2-02',
        'Grievance Registration',
        'Submit grievance with missing required fields',
        'Omitted category, title, and description',
        'Validation Testing',
        'HTTP 400 Bad Request; validation message returned',
        `Status ${res.status}; message="${res.body.message}"`,
        passed
      );
    }

    {
      // TC-M2-03: Boundary Value Analysis on Title (Length < 5 chars)
      const res = await request('POST', '/api/grievances', {
        citizen_id: 1,
        department_id: 1,
        category: 'Delay in Service Delivery',
        title: 'Help', // 4 characters (Min - 1 boundary failure)
        description: 'Need help urgently with my application.'
      });
      const passed = res.status === 400 && res.body.message.includes('5 characters');
      recordTestResult(
        'TC-M2-03',
        'Grievance Registration',
        'BVA on grievance title: 4 characters (Min - 1)',
        'Title: "Help"',
        'Boundary Value Analysis',
        'HTTP 400; rejected because title length < 5',
        `Status ${res.status}; message="${res.body.message}"`,
        passed
      );
    }

    {
      // TC-M2-04: Track Grievance Status & Timeline
      const res = await request('GET', `/api/grievances/${createdGrvId}`);
      const passed = res.status === 200 && res.body.grievance.grievance_id === createdGrvId;
      recordTestResult(
        'TC-M2-04',
        'Grievance Tracking',
        'Track grievance by reference ID and verify details',
        `Grievance ID: ${createdGrvId}`,
        'Functional Testing',
        'HTTP 200; grievance information, assigned department, and history returned',
        `Status ${res.status}; status=${res.body.grievance?.status}`,
        passed
      );
    }

    {
      // TC-M2-05: Officer Updates Grievance to In Progress
      const res = await request('PATCH', `/api/grievances/${createdGrvId}/status`, {
        status: 'In Progress',
        remarks: 'Grievance assigned to Field Inspector for physical verification.',
        user_id: 3,
        user_name: 'Rajesh Sharma (Officer)',
        user_role: 'Government Officer'
      });
      const passed = res.status === 200 && res.body.status === 'In Progress';
      recordTestResult(
        'TC-M2-05',
        'Grievance Processing',
        'Officer acknowledges and transitions grievance to In Progress',
        'Status: In Progress',
        'Integration Testing',
        'HTTP 200; status updated and timeline entry added',
        `Status ${res.status}; status=${res.body.status}`,
        passed
      );
    }

    {
      // TC-M2-06: Resolve Grievance with Resolution Summary
      const res = await request('PATCH', `/api/grievances/${createdGrvId}/status`, {
        status: 'Resolved',
        remarks: 'Verification expedited; citizen certificate processed.',
        resolution_summary: 'Field inspection completed on priority. Delay was due to network downtime.',
        user_id: 3,
        user_name: 'Rajesh Sharma (Officer)',
        user_role: 'Government Officer'
      });
      const passed = res.status === 200 && res.body.status === 'Resolved';
      recordTestResult(
        'TC-M2-06',
        'Grievance Resolution',
        'Officer resolves grievance with comprehensive resolution remarks',
        'Status: Resolved, Resolution Summary provided',
        'Functional Testing',
        'HTTP 200; status=Resolved; remarks stored in database',
        `Status ${res.status}; status=${res.body.status}`,
        passed
      );
    }

    {
      // TC-M2-07: Citizen Feedback Submission
      const res = await request('POST', `/api/grievances/${createdGrvId}/feedback`, {
        rating: 5,
        comment: 'Resolution provided within 24 hours. Very satisfied.',
        citizen_id: 1
      });
      const passed = res.status === 200 && res.body.success === true;
      recordTestResult(
        'TC-M2-07',
        'Grievance Feedback',
        'Submit 5-star resolution feedback',
        'Rating: 5, Comment: Very satisfied',
        'Functional Testing',
        'HTTP 200; citizen feedback rating saved',
        `Status ${res.status}; success=${res.body.success}`,
        passed
      );
    }

    {
      // TC-M2-08: Invalid Feedback Rating Boundary Check (Rating = 6)
      const res = await request('POST', `/api/grievances/${createdGrvId}/feedback`, {
        rating: 6, // boundary failure (max 5)
        comment: 'Invalid rating',
        citizen_id: 1
      });
      const passed = res.status === 400 && res.body.message.includes('1 and 5');
      recordTestResult(
        'TC-M2-08',
        'Grievance Feedback',
        'BVA on feedback rating: 6 stars (Max + 1)',
        'Rating: 6',
        'Boundary Value Analysis',
        'HTTP 400; rejected because rating must be between 1 and 5',
        `Status ${res.status}; message="${res.body.message}"`,
        passed
      );
    }

    {
      // TC-M2-09: Nonexistent Grievance Query (Negative)
      const res = await request('GET', '/api/grievances/NEGP-GRV-NONEXISTENT-999');
      const passed = res.status === 404 && res.body.success === false;
      recordTestResult(
        'TC-M2-09',
        'Grievance Tracking',
        'Query invalid / nonexistent grievance ID',
        'ID: NEGP-GRV-NONEXISTENT-999',
        'Validation Testing',
        'HTTP 404 Not Found; error message returned',
        `Status ${res.status}; message="${res.body.message}"`,
        passed
      );
    }

    {
      // TC-SYS-01: Portal Analytics & Dashboard Aggregates
      const res = await request('GET', '/api/analytics/dashboard');
      const d = res.body.data;
      const passed = res.status === 200 && d.totalApplications > 0 && d.totalGrievances > 0;
      recordTestResult(
        'TC-SYS-01',
        'Portal Analytics',
        'Verify dashboard metrics and real-time status counts',
        'None',
        'Integration Testing',
        'HTTP 200; correct aggregate counts for applications and grievances',
        `Status ${res.status}; apps=${d?.totalApplications}, grv=${d?.totalGrievances}`,
        passed
      );
    }

  } finally {
    server.close();
  }

  console.log('\n===============================================================');
  const passCount = testResults.filter(r => r.status === 'Pass').length;
  const failCount = testResults.filter(r => r.status === 'Fail').length;
  console.log(`TEST SUMMARY: Total=${testResults.length} | Passed=${passCount} | Failed=${failCount}`);
  console.log('===============================================================\n');

  // Export results to JSON
  const fs = require('fs');
  const path = require('path');
  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(reportsDir, 'test_results.json'),
    JSON.stringify(testResults, null, 2)
  );
  console.log('Test results exported to reports/test_results.json');
}

runAllTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
