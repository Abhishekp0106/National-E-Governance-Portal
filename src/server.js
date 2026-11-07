const express = require('express');
const cors = require('cors');
const path = require('node:path');
const fs = require('node:fs');
const multer = require('multer');
const db = require('./database');
const seedDatabase = require('./seed');

const app = express();
const PORT = process.env.PORT || 3000;

// Auto-seed if needed
seedDatabase();

// Setup uploads folder
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_'));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Only PDF, JPG, PNG, and DOC files are permitted.'));
    }
  }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(uploadDir));

// Helper: Audit logging
function logAudit(userId, userName, action, entityType, entityId, details) {
  try {
    const stmt = db.prepare('INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)');
    stmt.run(userId || null, userName || 'System', action, entityType, entityId || null, details || null);
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}

// ---------------- AUTHENTICATION APIs ----------------
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, phone, aadhaar_no, role } = req.body;

  if (!name || !email || !password || !phone) {
    return res.status(400).json({ success: false, message: 'Mandatory fields missing: Name, Email, Password, and Phone are required.' });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, message: 'Invalid email address format.' });
  }

  // Phone validation (10 digits)
  if (!/^\d{10}$/.test(phone.replace(/[^0-9]/g, ''))) {
    return res.status(400).json({ success: false, message: 'Invalid phone number. Must be a 10-digit number.' });
  }

  const userRole = role === 'Government Officer' || role === 'Department Head' || role === 'Admin' ? role : 'Citizen';

  try {
    const checkEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (checkEmail) {
      return res.status(409).json({ success: false, message: 'Email address is already registered.' });
    }

    const insertUser = db.prepare('INSERT INTO users (name, email, password, role, phone, aadhaar_no) VALUES (?, ?, ?, ?, ?, ?)');
    const result = insertUser.run(name.trim(), email.toLowerCase().trim(), password, userRole, phone, aadhaar_no || null);
    
    logAudit(result.lastInsertRowid, name, 'USER_REGISTERED', 'users', result.lastInsertRowid.toString(), `Role: ${userRole}`);

    res.status(201).json({
      success: true,
      message: 'Citizen registered successfully.',
      user: { id: result.lastInsertRowid, name, email: email.toLowerCase().trim(), role: userRole }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!user || user.password !== password) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    logAudit(user.id, user.name, 'USER_LOGIN', 'users', user.id.toString(), `Logged in as ${user.role}`);

    res.json({
      success: true,
      message: `Welcome, ${user.name}!`,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department_code: user.department_code,
        phone: user.phone,
        aadhaar_no: user.aadhaar_no
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------- DEPARTMENTS & SERVICES APIs ----------------
app.get('/api/departments', (req, res) => {
  try {
    const departments = db.prepare('SELECT * FROM departments ORDER BY name ASC').all();
    res.json({ success: true, departments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/services', (req, res) => {
  try {
    const services = db.prepare(`
      SELECT s.*, d.name as department_name, d.code as department_code
      FROM services s
      JOIN departments d ON s.department_id = d.id
      ORDER BY s.category, s.name ASC
    `).all();
    res.json({ success: true, services });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/services/:id', (req, res) => {
  try {
    const service = db.prepare(`
      SELECT s.*, d.name as department_name, d.code as department_code, d.head_name
      FROM services s
      JOIN departments d ON s.department_id = d.id
      WHERE s.id = ?
    `).get(req.params.id);

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found.' });
    }
    res.json({ success: true, service });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------- MODULE 1: APPLICATION MANAGEMENT APIs ----------------
app.post('/api/applications', upload.array('documents', 5), (req, res) => {
  try {
    const {
      service_id,
      citizen_id,
      applicant_name,
      applicant_email,
      applicant_phone,
      applicant_address,
      identity_type,
      identity_number,
      form_data,
      is_draft
    } = req.body;

    // Validate mandatory fields
    if (!service_id || !applicant_name || !applicant_email || !applicant_phone || !applicant_address || !identity_type || !identity_number) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed: All mandatory applicant information fields must be completed.'
      });
    }

    // Generate Unique Application ID
    const year = new Date().getFullYear();
    const randomSeq = Math.floor(10000 + Math.random() * 90000);
    const applicationId = `NEGP-APP-${year}-${randomSeq}`;
    const initialStatus = is_draft === 'true' ? 'Draft' : 'Submitted';

    const insertStmt = db.prepare(`
      INSERT INTO applications (
        application_id, service_id, citizen_id, applicant_name, applicant_email,
        applicant_phone, applicant_address, identity_type, identity_number,
        form_data, status, current_remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(
      applicationId,
      parseInt(service_id),
      parseInt(citizen_id) || 1,
      applicant_name.trim(),
      applicant_email.trim(),
      applicant_phone.trim(),
      applicant_address.trim(),
      identity_type.trim(),
      identity_number.trim(),
      typeof form_data === 'string' ? form_data : JSON.stringify(form_data || {}),
      initialStatus,
      initialStatus === 'Draft' ? 'Saved as draft by applicant.' : 'Application submitted online for verification.'
    );

    // Save uploaded documents
    if (req.files && req.files.length > 0) {
      const docStmt = db.prepare(`
        INSERT INTO application_documents (application_id, document_type, file_name, file_path, file_size, mime_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      req.files.forEach(file => {
        docStmt.run(
          applicationId,
          req.body.document_type || 'Identity / Supporting Proof',
          file.originalname,
          file.path,
          file.size,
          file.mimetype
        );
      });
    }

    // Record initial history
    const historyStmt = db.prepare(`
      INSERT INTO application_history (application_id, previous_status, new_status, changed_by_user_id, changed_by_name, remarks)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    historyStmt.run(
      applicationId,
      null,
      initialStatus,
      parseInt(citizen_id) || 1,
      applicant_name,
      initialStatus === 'Draft' ? 'Application saved as draft.' : 'Application submitted successfully.'
    );

    logAudit(parseInt(citizen_id) || 1, applicant_name, 'SUBMIT_APPLICATION', 'applications', applicationId, `Service ID: ${service_id}`);

    res.status(201).json({
      success: true,
      message: initialStatus === 'Draft' ? 'Application saved as draft.' : 'Application submitted successfully! Please note your reference ID for tracking.',
      application_id: applicationId,
      status: initialStatus
    });
  } catch (err) {
    console.error('Submit application error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/applications', (req, res) => {
  try {
    const { citizen_id, status, department_code, search } = req.query;
    let query = `
      SELECT a.*, s.name as service_name, s.code as service_code, s.category as service_category,
             d.name as department_name, d.code as department_code
      FROM applications a
      JOIN services s ON a.service_id = s.id
      JOIN departments d ON s.department_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (citizen_id) {
      query += ' AND a.citizen_id = ?';
      params.push(parseInt(citizen_id));
    }
    if (status) {
      query += ' AND a.status = ?';
      params.push(status);
    }
    if (department_code) {
      query += ' AND d.code = ?';
      params.push(department_code);
    }
    if (search) {
      query += ' AND (a.application_id LIKE ? OR a.applicant_name LIKE ? OR s.name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY a.created_at DESC';
    const applications = db.prepare(query).all(...params);
    res.json({ success: true, count: applications.length, applications });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/applications/:id', (req, res) => {
  try {
    const appRecord = db.prepare(`
      SELECT a.*, s.name as service_name, s.code as service_code, s.category as service_category,
             s.eligibility, s.required_documents, s.processing_fee, s.turnaround_days,
             d.name as department_name, d.code as department_code, d.head_name
      FROM applications a
      JOIN services s ON a.service_id = s.id
      JOIN departments d ON s.department_id = d.id
      WHERE a.id = ? OR a.application_id = ?
    `).get(req.params.id, req.params.id);

    if (!appRecord) {
      return res.status(404).json({ success: false, message: 'Application reference not found.' });
    }

    const documents = db.prepare('SELECT * FROM application_documents WHERE application_id = ?').all(appRecord.application_id);
    const history = db.prepare('SELECT * FROM application_history WHERE application_id = ? ORDER BY timestamp ASC').all(appRecord.application_id);

    res.json({
      success: true,
      application: appRecord,
      documents,
      history
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.patch('/api/applications/:id/status', (req, res) => {
  try {
    const { status, remarks, user_id, user_name, user_role } = req.body;
    const appId = req.params.id;

    const validStatuses = ['Draft', 'Submitted', 'Under Verification', 'Pending Approval', 'Approved', 'Rejected', 'Closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Permitted values: ${validStatuses.join(', ')}` });
    }

    const currentApp = db.prepare('SELECT * FROM applications WHERE id = ? OR application_id = ?').get(appId, appId);
    if (!currentApp) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    // Role-based status transition checks
    if ((status === 'Approved' || status === 'Rejected') && user_role !== 'Department Head' && user_role !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Only Department Head or System Admin can mark an application as Approved or Rejected.'
      });
    }

    let verifiedBy = currentApp.verified_by;
    let approvedBy = currentApp.approved_by;

    if (status === 'Under Verification' || status === 'Pending Approval') {
      verifiedBy = user_id || verifiedBy;
    }
    if (status === 'Approved' || status === 'Rejected') {
      approvedBy = user_id || approvedBy;
    }

    const updateStmt = db.prepare(`
      UPDATE applications
      SET status = ?, current_remarks = ?, verified_by = ?, approved_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    updateStmt.run(status, remarks || `Status changed to ${status}`, verifiedBy, approvedBy, currentApp.id);

    // Add to history
    const historyStmt = db.prepare(`
      INSERT INTO application_history (application_id, previous_status, new_status, changed_by_user_id, changed_by_name, remarks)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    historyStmt.run(
      currentApp.application_id,
      currentApp.status,
      status,
      user_id || null,
      user_name || user_role || 'Authorized Officer',
      remarks || `Application transitioned to ${status}.`
    );

    logAudit(user_id, user_name, 'UPDATE_APPLICATION_STATUS', 'applications', currentApp.application_id, `From ${currentApp.status} to ${status}`);

    res.json({
      success: true,
      message: `Application status updated to ${status} successfully.`,
      application_id: currentApp.application_id,
      status
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------- MODULE 2: GRIEVANCE MANAGEMENT APIs ----------------
app.post('/api/grievances', (req, res) => {
  try {
    const { citizen_id, department_id, category, title, description, supporting_evidence, citizen_name } = req.body;

    if (!department_id || !category || !title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed: Department, category, title, and detailed description are required.'
      });
    }

    if (title.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed: Grievance title must be at least 5 characters long.'
      });
    }

    const year = new Date().getFullYear();
    const randomSeq = Math.floor(20000 + Math.random() * 80000);
    const grievanceId = `NEGP-GRV-${year}-${randomSeq}`;

    const insertStmt = db.prepare(`
      INSERT INTO grievances (grievance_id, citizen_id, department_id, category, title, description, supporting_evidence, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Filed')
    `);

    insertStmt.run(
      grievanceId,
      parseInt(citizen_id) || 1,
      parseInt(department_id),
      category.trim(),
      title.trim(),
      description.trim(),
      supporting_evidence ? supporting_evidence.trim() : null
    );

    // Initial history
    const historyStmt = db.prepare(`
      INSERT INTO grievance_history (grievance_id, previous_status, new_status, changed_by_user_id, changed_by_name, remarks)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    historyStmt.run(
      grievanceId,
      null,
      'Filed',
      parseInt(citizen_id) || 1,
      citizen_name || 'Citizen',
      'Grievance registered and queued for departmental investigation.'
    );

    logAudit(parseInt(citizen_id) || 1, citizen_name, 'SUBMIT_GRIEVANCE', 'grievances', grievanceId, `Dept ID: ${department_id}`);

    res.status(201).json({
      success: true,
      message: 'Grievance lodged successfully! Your Grievance Reference ID has been generated.',
      grievance_id: grievanceId,
      status: 'Filed'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/grievances', (req, res) => {
  try {
    const { citizen_id, status, department_id, search } = req.query;
    let query = `
      SELECT g.*, d.name as department_name, d.code as department_code, u.name as citizen_name, u.email as citizen_email
      FROM grievances g
      JOIN departments d ON g.department_id = d.id
      JOIN users u ON g.citizen_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (citizen_id) {
      query += ' AND g.citizen_id = ?';
      params.push(parseInt(citizen_id));
    }
    if (status) {
      query += ' AND g.status = ?';
      params.push(status);
    }
    if (department_id) {
      query += ' AND g.department_id = ?';
      params.push(parseInt(department_id));
    }
    if (search) {
      query += ' AND (g.grievance_id LIKE ? OR g.title LIKE ? OR g.category LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY g.created_at DESC';
    const grievances = db.prepare(query).all(...params);
    res.json({ success: true, count: grievances.length, grievances });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/grievances/:id', (req, res) => {
  try {
    const grv = db.prepare(`
      SELECT g.*, d.name as department_name, d.code as department_code, d.head_name,
             u.name as citizen_name, u.email as citizen_email, u.phone as citizen_phone
      FROM grievances g
      JOIN departments d ON g.department_id = d.id
      JOIN users u ON g.citizen_id = u.id
      WHERE g.id = ? OR g.grievance_id = ?
    `).get(req.params.id, req.params.id);

    if (!grv) {
      return res.status(404).json({ success: false, message: 'Grievance reference not found.' });
    }

    const history = db.prepare('SELECT * FROM grievance_history WHERE grievance_id = ? ORDER BY timestamp ASC').all(grv.grievance_id);

    res.json({
      success: true,
      grievance: grv,
      history
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.patch('/api/grievances/:id/status', (req, res) => {
  try {
    const { status, remarks, resolution_summary, escalated_reason, user_id, user_name, user_role } = req.body;
    const grvId = req.params.id;

    const validStatuses = ['Filed', 'In Progress', 'Resolved', 'Escalated', 'Closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Permitted: ${validStatuses.join(', ')}` });
    }

    const currentGrv = db.prepare('SELECT * FROM grievances WHERE id = ? OR grievance_id = ?').get(grvId, grvId);
    if (!currentGrv) {
      return res.status(404).json({ success: false, message: 'Grievance not found.' });
    }

    const updateStmt = db.prepare(`
      UPDATE grievances
      SET status = ?, officer_remarks = ?, resolution_summary = COALESCE(?, resolution_summary),
          escalated_reason = COALESCE(?, escalated_reason), assigned_officer_id = COALESCE(?, assigned_officer_id),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    updateStmt.run(
      status,
      remarks || `Grievance marked as ${status}`,
      resolution_summary || null,
      escalated_reason || null,
      user_id || null,
      currentGrv.id
    );

    // History record
    const histStmt = db.prepare(`
      INSERT INTO grievance_history (grievance_id, previous_status, new_status, changed_by_user_id, changed_by_name, remarks)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    histStmt.run(
      currentGrv.grievance_id,
      currentGrv.status,
      status,
      user_id || null,
      user_name || user_role || 'Officer',
      remarks || (status === 'Resolved' ? resolution_summary : `Status updated to ${status}`)
    );

    logAudit(user_id, user_name, 'UPDATE_GRIEVANCE_STATUS', 'grievances', currentGrv.grievance_id, `Transitioned to ${status}`);

    res.json({
      success: true,
      message: `Grievance status updated to ${status} successfully.`,
      grievance_id: currentGrv.grievance_id,
      status
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Feedback endpoint
app.post('/api/grievances/:id/feedback', (req, res) => {
  try {
    const { rating, comment, citizen_id } = req.body;
    const grvId = req.params.id;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5 stars.' });
    }

    const currentGrv = db.prepare('SELECT * FROM grievances WHERE id = ? OR grievance_id = ?').get(grvId, grvId);
    if (!currentGrv) {
      return res.status(404).json({ success: false, message: 'Grievance not found.' });
    }

    db.prepare('UPDATE grievances SET feedback_rating = ?, feedback_comment = ? WHERE id = ?').run(rating, comment || '', currentGrv.id);

    res.json({ success: true, message: 'Thank you for your valuable feedback!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------- DASHBOARD & ANALYTICS APIs ----------------
app.get('/api/analytics/dashboard', (req, res) => {
  try {
    const totalApps = db.prepare('SELECT COUNT(*) as count FROM applications').get().count;
    const appStatusRows = db.prepare('SELECT status, COUNT(*) as count FROM applications GROUP BY status').all();
    
    const totalGrievances = db.prepare('SELECT COUNT(*) as count FROM grievances').get().count;
    const grvStatusRows = db.prepare('SELECT status, COUNT(*) as count FROM grievances GROUP BY status').all();
    
    const totalServices = db.prepare('SELECT COUNT(*) as count FROM services').get().count;
    const totalDepartments = db.prepare('SELECT COUNT(*) as count FROM departments').get().count;
    const totalCitizens = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'Citizen'").get().count;

    const appsByStatus = {};
    appStatusRows.forEach(r => { appsByStatus[r.status] = r.count; });

    const grvByStatus = {};
    grvStatusRows.forEach(r => { grvByStatus[r.status] = r.count; });

    res.json({
      success: true,
      data: {
        totalApplications: totalApps,
        applicationsByStatus: appsByStatus,
        totalGrievances: totalGrievances,
        grievancesByStatus: grvByStatus,
        totalServices,
        totalDepartments,
        totalCitizens
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Catch-all 404 for unknown APIs
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'API endpoint not found.' });
  }
  next();
});

// Serve frontend SPA fallback
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start Server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`National E-Governance Portal server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;
