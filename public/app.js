// Current session state
let currentUser = {
  id: 1,
  name: 'Abhishek Purohit',
  email: 'abhishek.citizen@negp.gov.in',
  role: 'Citizen',
  department_code: null
};

let allServices = [];
let allDepartments = [];
let currentDeskView = 'apps';
let selectedFiles = [];

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  loadDepartments();
  loadServices();
  loadApplications();
  loadGrievances();
  loadDashboardAnalytics();
});

// Toast system
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Navigation Tab Switcher
function setupNavigation() {
  const navTabs = document.querySelectorAll('.nav-tab');
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });
}

function switchTab(tabId) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  const activeTabBtn = document.querySelector(`.nav-tab[data-tab="${tabId}"]`);
  if (activeTabBtn) activeTabBtn.classList.add('active');

  const content = document.getElementById(tabId);
  if (content) content.classList.add('active');

  if (tabId === 'tab-my-apps') loadApplications();
  if (tabId === 'tab-my-grievances') loadGrievances();
  if (tabId === 'tab-officer-desk') loadOfficerQueues();
  if (tabId === 'tab-dashboard') loadDashboardAnalytics();
}

// Role Switcher
function handleRoleChange(roleKey) {
  const badge = document.getElementById('currentUserBadge');
  const deskNav = document.getElementById('navOfficerDeskBtn');

  if (roleKey === 'citizen') {
    currentUser = {
      id: 1,
      name: 'Abhishek Purohit',
      email: 'abhishek.citizen@negp.gov.in',
      role: 'Citizen',
      department_code: null
    };
    badge.innerHTML = '<span class="user-role-tag">Citizen: Abhishek Purohit</span>';
    deskNav.style.display = 'none';
  } else if (roleKey === 'officer') {
    currentUser = {
      id: 3,
      name: 'Rajesh Sharma (Officer)',
      email: 'rajesh.officer@negp.gov.in',
      role: 'Government Officer',
      department_code: 'REV'
    };
    badge.innerHTML = '<span class="user-role-tag" style="color: #9a3412;">Officer: Rajesh Sharma (REV)</span>';
    deskNav.style.display = 'flex';
  } else if (roleKey === 'head') {
    currentUser = {
      id: 5,
      name: 'Dr. Sunita Verma (Dept Head)',
      email: 'sunita.head@negp.gov.in',
      role: 'Department Head',
      department_code: 'REV'
    };
    badge.innerHTML = '<span class="user-role-tag" style="color: #166534;">Dept Head: Dr. Sunita Verma</span>';
    deskNav.style.display = 'flex';
  } else if (roleKey === 'admin') {
    currentUser = {
      id: 6,
      name: 'Admin Portal Officer',
      email: 'admin@negp.gov.in',
      role: 'Admin',
      department_code: null
    };
    badge.innerHTML = '<span class="user-role-tag" style="color: #6b21a8;">System Administrator</span>';
    deskNav.style.display = 'flex';
  }

  showToast(`Switched active session to: ${currentUser.role}`, 'info');
  loadApplications();
  loadGrievances();
  if (deskNav.style.display !== 'none') {
    loadOfficerQueues();
  }
}

// ---------------- DEPARTMENTS & SERVICES ----------------
async function loadDepartments() {
  try {
    const res = await fetch('/api/departments');
    const data = await res.json();
    if (data.success) {
      allDepartments = data.departments;
      const grvDeptSelect = document.getElementById('grvDepartment');
      grvDeptSelect.innerHTML = '<option value="">-- Select Department --</option>' +
        allDepartments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
    }
  } catch (err) {
    console.error('Error loading departments:', err);
  }
}

async function loadServices() {
  try {
    const res = await fetch('/api/services');
    const data = await res.json();
    if (data.success) {
      allServices = data.services;
      renderServicesGrid(allServices);

      const applySelect = document.getElementById('applyServiceSelect');
      applySelect.innerHTML = '<option value="">-- Select a Government Service --</option>' +
        allServices.map(s => `<option value="${s.id}">${s.name} - ${s.department_name} (Fee: ₹${s.processing_fee})</option>`).join('');
    }
  } catch (err) {
    console.error('Error loading services:', err);
  }
}

function renderServicesGrid(services) {
  const container = document.getElementById('servicesGridContainer');
  if (services.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary); grid-column: 1/-1;">No matching services found.</p>';
    return;
  }

  container.innerHTML = services.map(s => `
    <div class="service-card">
      <div>
        <div class="service-card-header">
          <span class="service-dept">${s.department_code}</span>
          <span class="service-code">${s.code}</span>
        </div>
        <h4 class="service-title">${s.name}</h4>
        <p class="service-desc">${s.description || 'Essential public service provided by the departmental authority.'}</p>
        <div class="service-meta">
          <div>Fee: <strong>₹${s.processing_fee.toFixed(2)}</strong></div>
          <div>SLA: <strong>${s.turnaround_days} Days</strong></div>
        </div>
        <p style="font-size: 0.78rem; color: var(--text-secondary); margin-bottom: 12px;">
          <strong>Required Proofs:</strong> ${s.required_documents}
        </p>
      </div>
      <button class="btn btn-primary btn-sm" onclick="initiateServiceApplication(${s.id})">
        Apply Now ➔
      </button>
    </div>
  `).join('');
}

function filterServices(query) {
  const q = query.toLowerCase().trim();
  const filtered = allServices.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.department_name.toLowerCase().includes(q) ||
    s.category.toLowerCase().includes(q) ||
    s.code.toLowerCase().includes(q)
  );
  renderServicesGrid(filtered);
}

function initiateServiceApplication(serviceId) {
  switchTab('tab-apply');
  const select = document.getElementById('applyServiceSelect');
  select.value = serviceId;
  handleServiceSelectionChange(serviceId);
}

function handleServiceSelectionChange(serviceId) {
  const banner = document.getElementById('serviceInfoBanner');
  if (!serviceId) {
    banner.style.display = 'none';
    return;
  }
  const service = allServices.find(s => s.id == serviceId);
  if (service) {
    banner.style.display = 'block';
    banner.innerHTML = `
      <strong>Department:</strong> ${service.department_name} | 
      <strong>Processing Fee:</strong> ₹${service.processing_fee.toFixed(2)} | 
      <strong>Service SLA:</strong> ${service.turnaround_days} Business Days<br>
      <strong>Eligibility:</strong> ${service.eligibility || 'All eligible state residents.'}<br>
      <strong>Mandatory Documents:</strong> ${service.required_documents}
    `;
  }
}

// File Upload Handler
function handleFileSelected(event) {
  const files = Array.from(event.target.files);
  selectedFiles = files;
  const listContainer = document.getElementById('selectedFilesList');
  if (files.length > 0) {
    listContainer.innerHTML = files.map(f => `📄 ${f.name} (${(f.size / 1024).toFixed(1)} KB)`).join('<br>');
  } else {
    listContainer.innerHTML = '';
  }
}

// ---------------- MODULE 1: APPLICATION SUBMISSION ----------------
async function handleApplicationSubmit(event) {
  event.preventDefault();
  await submitApplicationPayload(false);
}

async function saveApplicationDraft() {
  await submitApplicationPayload(true);
}

async function submitApplicationPayload(isDraft) {
  const serviceId = document.getElementById('applyServiceSelect').value;
  const name = document.getElementById('applicantName').value.trim();
  const email = document.getElementById('applicantEmail').value.trim();
  const phone = document.getElementById('applicantPhone').value.trim();
  const identityType = document.getElementById('identityType').value;
  const identityNumber = document.getElementById('identityNumber').value.trim();
  const annualIncome = document.getElementById('annualIncome').value;
  const address = document.getElementById('applicantAddress').value.trim();

  if (!serviceId) {
    showToast('Please select a target government service.', 'error');
    return;
  }
  if (!name || !email || !phone || !identityNumber || !address) {
    showToast('Please complete all mandatory applicant information fields.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('service_id', serviceId);
  formData.append('citizen_id', currentUser.id);
  formData.append('applicant_name', name);
  formData.append('applicant_email', email);
  formData.append('applicant_phone', phone);
  formData.append('applicant_address', address);
  formData.append('identity_type', identityType);
  formData.append('identity_number', identityNumber);
  formData.append('is_draft', isDraft ? 'true' : 'false');
  formData.append('form_data', JSON.stringify({ annualIncome, identityType }));

  if (selectedFiles.length > 0) {
    selectedFiles.forEach(file => formData.append('documents', file));
  }

  try {
    const res = await fetch('/api/applications', {
      method: 'POST',
      body: formData
    });
    const result = await res.json();

    if (result.success) {
      showToast(result.message, 'success');
      document.getElementById('applicationForm').reset();
      selectedFiles = [];
      document.getElementById('selectedFilesList').innerHTML = '';
      document.getElementById('serviceInfoBanner').style.display = 'none';
      switchTab('tab-my-apps');
    } else {
      showToast(result.message || 'Failed to submit application.', 'error');
    }
  } catch (err) {
    showToast('Submission error: ' + err.message, 'error');
  }
}

// ---------------- MODULE 1: APPLICATION TRACKING ----------------
let currentApplications = [];

async function loadApplications() {
  try {
    let url = '/api/applications';
    if (currentUser.role === 'Citizen') {
      url += `?citizen_id=${currentUser.id}`;
    }
    const res = await fetch(url);
    const data = await res.json();
    if (data.success) {
      currentApplications = data.applications;
      renderApplicationsTable(currentApplications);
    }
  } catch (err) {
    console.error('Error loading applications:', err);
  }
}

function getStatusClass(status) {
  const map = {
    'Draft': 'status-draft',
    'Submitted': 'status-submitted',
    'Under Verification': 'status-under-verification',
    'Pending Approval': 'status-pending-approval',
    'Approved': 'status-approved',
    'Rejected': 'status-rejected',
    'Filed': 'status-filed',
    'In Progress': 'status-in-progress',
    'Resolved': 'status-resolved',
    'Escalated': 'status-escalated',
    'Closed': 'status-closed'
  };
  return map[status] || 'status-draft';
}

function renderApplicationsTable(apps) {
  const tbody = document.getElementById('applicationsTableBody');
  if (apps.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 24px;">No applications found.</td></tr>';
    return;
  }

  tbody.innerHTML = apps.map(a => `
    <tr>
      <td><strong>${a.application_id}</strong></td>
      <td>${a.service_name}</td>
      <td>${a.applicant_name}</td>
      <td>${new Date(a.created_at).toLocaleDateString()}</td>
      <td><span class="status-pill ${getStatusClass(a.status)}">${a.status}</span></td>
      <td style="max-width: 260px; font-size: 0.82rem; color: var(--text-secondary);">${a.current_remarks || '-'}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="viewApplicationDetails('${a.application_id}')">
          View & Track
        </button>
      </td>
    </tr>
  `).join('');
}

function filterApplicationsTable(query) {
  const q = query.toLowerCase().trim();
  const filtered = currentApplications.filter(a =>
    a.application_id.toLowerCase().includes(q) ||
    a.applicant_name.toLowerCase().includes(q) ||
    a.service_name.toLowerCase().includes(q) ||
    a.status.toLowerCase().includes(q)
  );
  renderApplicationsTable(filtered);
}

async function viewApplicationDetails(appId) {
  try {
    const res = await fetch(`/api/applications/${appId}`);
    const data = await res.json();
    if (!data.success) {
      showToast(data.message, 'error');
      return;
    }

    const app = data.application;
    const history = data.history;
    const docs = data.documents;

    document.getElementById('modalAppTitle').innerText = `Application Details: ${app.application_id}`;

    let parsedFormData = {};
    try { parsedFormData = JSON.parse(app.form_data || '{}'); } catch(e){}

    const modalBody = document.getElementById('modalAppBody');
    modalBody.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 12px;">
        <div>
          <h3 style="color: var(--primary-dark); font-size: 1.15rem;">${app.service_name}</h3>
          <p style="color: var(--text-secondary); font-size: 0.85rem;">Department: ${app.department_name}</p>
        </div>
        <span class="status-pill ${getStatusClass(app.status)}">${app.status}</span>
      </div>

      <div class="form-grid" style="margin-bottom: 16px; font-size: 0.88rem;">
        <div><strong>Applicant Name:</strong> ${app.applicant_name}</div>
        <div><strong>Contact Phone:</strong> ${app.applicant_phone}</div>
        <div><strong>Email Address:</strong> ${app.applicant_email}</div>
        <div><strong>Identity Proof:</strong> ${app.identity_type} (${app.identity_number})</div>
        <div class="form-full"><strong>Permanent Address:</strong> ${app.applicant_address}</div>
        <div><strong>Processing Fee:</strong> ₹${app.processing_fee.toFixed(2)}</div>
        <div><strong>Service SLA:</strong> ${app.turnaround_days} Days</div>
      </div>

      <h5 style="margin-top: 18px; margin-bottom: 8px; color: var(--primary-dark);">Uploaded Supporting Documents</h5>
      <div style="background: #f8fafc; padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); font-size: 0.85rem;">
        ${docs.length === 0 ? '<p style="color: var(--text-secondary);">No documents uploaded.</p>' : 
          docs.map(d => `<div>📄 <strong>${d.document_type}:</strong> ${d.file_name} (${(d.file_size / 1024).toFixed(1)} KB)</div>`).join('')
        }
      </div>

      <h5 style="margin-top: 20px; margin-bottom: 8px; color: var(--primary-dark);">Processing Lifecycle & Status History</h5>
      <div class="timeline-box">
        ${history.map(h => `
          <div class="timeline-step">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <div class="timeline-title">${h.new_status} <span style="font-weight: normal; color: var(--text-secondary);">by ${h.changed_by_name || 'System'}</span></div>
              <div class="timeline-time">${new Date(h.timestamp).toLocaleString()}</div>
              <div class="timeline-remarks">${h.remarks || 'No remarks entered.'}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Footer actions depending on role
    const footer = document.getElementById('modalAppFooter');
    let actionButtons = `<button class="btn btn-secondary" onclick="closeModal('appDetailsModal')">Close</button>`;

    if (currentUser.role === 'Government Officer') {
      actionButtons = `
        <button class="btn btn-primary btn-sm" onclick="promptStatusUpdate('${app.application_id}', 'Under Verification')">Mark Under Verification</button>
        <button class="btn btn-primary btn-sm" onclick="promptStatusUpdate('${app.application_id}', 'Pending Approval')">Send for Approval ➔</button>
        <button class="btn btn-secondary" onclick="closeModal('appDetailsModal')">Close</button>
      `;
    } else if (currentUser.role === 'Department Head' || currentUser.role === 'Admin') {
      actionButtons = `
        <button class="btn btn-success btn-sm" onclick="promptStatusUpdate('${app.application_id}', 'Approved')">Approve Application ✅</button>
        <button class="btn btn-danger btn-sm" onclick="promptStatusUpdate('${app.application_id}', 'Rejected')">Reject Application ❌</button>
        <button class="btn btn-secondary" onclick="closeModal('appDetailsModal')">Close</button>
      `;
    }

    footer.innerHTML = actionButtons;
    openModal('appDetailsModal');
  } catch (err) {
    showToast('Failed to load application details: ' + err.message, 'error');
  }
}

async function promptStatusUpdate(appId, newStatus) {
  const remarks = prompt(`Enter official remarks for transitioning ${appId} to status "${newStatus}":`, `Verified and transitioned to ${newStatus}.`);
  if (remarks === null) return; // Cancelled

  try {
    const res = await fetch(`/api/applications/${appId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: newStatus,
        remarks: remarks || `Status set to ${newStatus}`,
        user_id: currentUser.id,
        user_name: currentUser.name,
        user_role: currentUser.role
      })
    });
    const result = await res.json();
    if (result.success) {
      showToast(result.message, 'success');
      closeModal('appDetailsModal');
      loadApplications();
      loadOfficerQueues();
      loadDashboardAnalytics();
    } else {
      showToast(result.message, 'error');
    }
  } catch (err) {
    showToast('Status update failed: ' + err.message, 'error');
  }
}

// ---------------- MODULE 2: GRIEVANCE MANAGEMENT ----------------
async function handleGrievanceSubmit(event) {
  event.preventDefault();

  const departmentId = document.getElementById('grvDepartment').value;
  const category = document.getElementById('grvCategory').value;
  const title = document.getElementById('grvTitle').value.trim();
  const description = document.getElementById('grvDescription').value.trim();
  const evidence = document.getElementById('grvEvidence').value.trim();

  if (!departmentId || !category || !title || !description) {
    showToast('Please fill out all mandatory grievance fields.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/grievances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        citizen_id: currentUser.id,
        citizen_name: currentUser.name,
        department_id: departmentId,
        category,
        title,
        description,
        supporting_evidence: evidence
      })
    });
    const result = await res.json();

    if (result.success) {
      showToast(result.message, 'success');
      document.getElementById('grievanceForm').reset();
      switchTab('tab-my-grievances');
    } else {
      showToast(result.message || 'Failed to submit grievance.', 'error');
    }
  } catch (err) {
    showToast('Grievance submission error: ' + err.message, 'error');
  }
}

let currentGrievances = [];

async function loadGrievances() {
  try {
    let url = '/api/grievances';
    if (currentUser.role === 'Citizen') {
      url += `?citizen_id=${currentUser.id}`;
    }
    const res = await fetch(url);
    const data = await res.json();
    if (data.success) {
      currentGrievances = data.grievances;
      renderGrievanceTable(currentGrievances);
    }
  } catch (err) {
    console.error('Error loading grievances:', err);
  }
}

function renderGrievanceTable(grvs) {
  const tbody = document.getElementById('grievancesTableBody');
  if (grvs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-secondary); padding: 24px;">No grievances lodged.</td></tr>';
    return;
  }

  tbody.innerHTML = grvs.map(g => `
    <tr>
      <td><strong>${g.grievance_id}</strong></td>
      <td>${g.department_name}</td>
      <td>${g.category}</td>
      <td>${g.title}</td>
      <td>${new Date(g.created_at).toLocaleDateString()}</td>
      <td><span class="status-pill ${getStatusClass(g.status)}">${g.status}</span></td>
      <td style="max-width: 240px; font-size: 0.82rem; color: var(--text-secondary);">${g.officer_remarks || g.resolution_summary || '-'}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="viewGrievanceDetails('${g.grievance_id}')">
          View Details
        </button>
      </td>
    </tr>
  `).join('');
}

function filterGrievanceTable(query) {
  const q = query.toLowerCase().trim();
  const filtered = currentGrievances.filter(g =>
    g.grievance_id.toLowerCase().includes(q) ||
    g.title.toLowerCase().includes(q) ||
    g.category.toLowerCase().includes(q) ||
    g.department_name.toLowerCase().includes(q) ||
    g.status.toLowerCase().includes(q)
  );
  renderGrievanceTable(filtered);
}

async function viewGrievanceDetails(grvId) {
  try {
    const res = await fetch(`/api/grievances/${grvId}`);
    const data = await res.json();
    if (!data.success) {
      showToast(data.message, 'error');
      return;
    }

    const g = data.grievance;
    const history = data.history;

    document.getElementById('modalGrvTitle').innerText = `Grievance: ${g.grievance_id}`;

    const modalBody = document.getElementById('modalGrvBody');
    modalBody.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 12px;">
        <div>
          <h3 style="color: var(--primary-dark); font-size: 1.15rem;">${g.title}</h3>
          <p style="color: var(--text-secondary); font-size: 0.85rem;">Department: ${g.department_name} | Category: ${g.category}</p>
        </div>
        <span class="status-pill ${getStatusClass(g.status)}">${g.status}</span>
      </div>

      <div style="background: #f8fafc; padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--border); margin-bottom: 16px; font-size: 0.88rem;">
        <strong>Description:</strong>
        <p style="margin-top: 4px; color: var(--text-primary);">${g.description}</p>
        ${g.supporting_evidence ? `<div style="margin-top: 8px;"><strong>Evidence/Ref:</strong> ${g.supporting_evidence}</div>` : ''}
      </div>

      ${g.resolution_summary ? `
        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 12px; border-radius: var(--radius-sm); margin-bottom: 16px;">
          <strong style="color: #065f46;">Resolution Summary:</strong>
          <p style="color: #065f46; font-size: 0.88rem; margin-top: 4px;">${g.resolution_summary}</p>
        </div>
      ` : ''}

      ${g.status === 'Resolved' && currentUser.role === 'Citizen' && !g.feedback_rating ? `
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 14px; border-radius: var(--radius-sm); margin-bottom: 16px;">
          <strong style="color: var(--primary);">Resolution Feedback:</strong>
          <div style="margin-top: 8px; display: flex; gap: 8px; align-items: center;">
            <label>Rate Resolution:</label>
            <select id="grvRatingSelect" class="form-control" style="width: auto;">
              <option value="5">⭐⭐⭐⭐⭐ 5 - Highly Satisfied</option>
              <option value="4">⭐⭐⭐⭐ 4 - Satisfied</option>
              <option value="3">⭐⭐⭐ 3 - Neutral</option>
              <option value="2">⭐⭐ 2 - Unsatisfied</option>
              <option value="1">⭐ 1 - Very Poor</option>
            </select>
            <button class="btn btn-primary btn-sm" onclick="submitGrievanceFeedback('${g.grievance_id}')">Submit Feedback</button>
          </div>
        </div>
      ` : ''}

      <h5 style="margin-top: 18px; margin-bottom: 8px; color: var(--primary-dark);">Resolution Timeline</h5>
      <div class="timeline-box">
        ${history.map(h => `
          <div class="timeline-step">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <div class="timeline-title">${h.new_status} <span style="font-weight: normal; color: var(--text-secondary);">by ${h.changed_by_name || 'Officer'}</span></div>
              <div class="timeline-time">${new Date(h.timestamp).toLocaleString()}</div>
              <div class="timeline-remarks">${h.remarks || '-'}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Footer actions
    const footer = document.getElementById('modalGrvFooter');
    let actionButtons = `<button class="btn btn-secondary" onclick="closeModal('grvDetailsModal')">Close</button>`;

    if (currentUser.role === 'Government Officer' || currentUser.role === 'Department Head' || currentUser.role === 'Admin') {
      actionButtons = `
        <button class="btn btn-primary btn-sm" onclick="promptGrievanceStatusUpdate('${g.grievance_id}', 'In Progress')">Mark In Progress</button>
        <button class="btn btn-success btn-sm" onclick="promptGrievanceResolution('${g.grievance_id}')">Resolve Grievance ✅</button>
        <button class="btn btn-danger btn-sm" onclick="promptGrievanceEscalation('${g.grievance_id}')">Escalate ⚠️</button>
        <button class="btn btn-secondary" onclick="closeModal('grvDetailsModal')">Close</button>
      `;
    }

    footer.innerHTML = actionButtons;
    openModal('grvDetailsModal');
  } catch (err) {
    showToast('Failed to load grievance details: ' + err.message, 'error');
  }
}

async function promptGrievanceStatusUpdate(grvId, newStatus) {
  const remarks = prompt(`Enter remarks for updating ${grvId} to "${newStatus}":`, `Assigned and investigation started.`);
  if (remarks === null) return;

  try {
    const res = await fetch(`/api/grievances/${grvId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: newStatus,
        remarks,
        user_id: currentUser.id,
        user_name: currentUser.name,
        user_role: currentUser.role
      })
    });
    const result = await res.json();
    if (result.success) {
      showToast(result.message, 'success');
      closeModal('grvDetailsModal');
      loadGrievances();
      loadOfficerQueues();
      loadDashboardAnalytics();
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function promptGrievanceResolution(grvId) {
  const resolution = prompt(`Enter resolution summary for ${grvId}:`, `Inquiry completed. Necessary corrective action and service delivery completed.`);
  if (resolution === null) return;

  try {
    const res = await fetch(`/api/grievances/${grvId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'Resolved',
        remarks: 'Grievance resolved and communicated to citizen.',
        resolution_summary: resolution,
        user_id: currentUser.id,
        user_name: currentUser.name,
        user_role: currentUser.role
      })
    });
    const result = await res.json();
    if (result.success) {
      showToast(result.message, 'success');
      closeModal('grvDetailsModal');
      loadGrievances();
      loadOfficerQueues();
      loadDashboardAnalytics();
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function promptGrievanceEscalation(grvId) {
  const reason = prompt(`Enter escalation reason for ${grvId}:`, `Delayed beyond SLA; escalating to Department Head for disciplinary review.`);
  if (reason === null) return;

  try {
    const res = await fetch(`/api/grievances/${grvId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'Escalated',
        remarks: 'Case escalated to Higher Authority.',
        escalated_reason: reason,
        user_id: currentUser.id,
        user_name: currentUser.name,
        user_role: currentUser.role
      })
    });
    const result = await res.json();
    if (result.success) {
      showToast(result.message, 'success');
      closeModal('grvDetailsModal');
      loadGrievances();
      loadOfficerQueues();
      loadDashboardAnalytics();
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function submitGrievanceFeedback(grvId) {
  const rating = document.getElementById('grvRatingSelect').value;
  try {
    const res = await fetch(`/api/grievances/${grvId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: parseInt(rating), comment: 'Satisfied with timely portal resolution.', citizen_id: currentUser.id })
    });
    const result = await res.json();
    if (result.success) {
      showToast(result.message, 'success');
      viewGrievanceDetails(grvId);
    }
  } catch (err) {
    showToast('Feedback error: ' + err.message, 'error');
  }
}

// ---------------- OFFICER QUEUES & PROCESSING ----------------
function switchDeskView(view) {
  currentDeskView = view;
  const btnApps = document.getElementById('btnQueueApps');
  const btnGrv = document.getElementById('btnQueueGrv');
  const appsQueue = document.getElementById('deskAppsQueue');
  const grvQueue = document.getElementById('deskGrvQueue');

  if (view === 'apps') {
    btnApps.classList.replace('btn-secondary', 'btn-primary');
    btnGrv.classList.replace('btn-primary', 'btn-secondary');
    appsQueue.style.display = 'block';
    grvQueue.style.display = 'none';
  } else {
    btnGrv.classList.replace('btn-secondary', 'btn-primary');
    btnApps.classList.replace('btn-primary', 'btn-secondary');
    appsQueue.style.display = 'none';
    grvQueue.style.display = 'block';
  }
}

async function loadOfficerQueues() {
  // Load Applications for Officer Desk
  try {
    const resApps = await fetch('/api/applications');
    const dataApps = await resApps.json();
    if (dataApps.success) {
      const tbody = document.getElementById('officerAppsTableBody');
      tbody.innerHTML = dataApps.applications.map(a => `
        <tr>
          <td><strong>${a.application_id}</strong></td>
          <td>${a.applicant_name}</td>
          <td>${a.service_name}</td>
          <td>${a.identity_type} (${a.identity_number})</td>
          <td><span class="status-pill ${getStatusClass(a.status)}">${a.status}</span></td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="viewApplicationDetails('${a.application_id}')">
              Process ➔
            </button>
          </td>
        </tr>
      `).join('');
    }

    const resGrv = await fetch('/api/grievances');
    const dataGrv = await resGrv.json();
    if (dataGrv.success) {
      const tbody = document.getElementById('officerGrvTableBody');
      tbody.innerHTML = dataGrv.grievances.map(g => `
        <tr>
          <td><strong>${g.grievance_id}</strong></td>
          <td>${g.citizen_name}</td>
          <td>${g.department_name}</td>
          <td>${g.category}</td>
          <td>${g.title}</td>
          <td><span class="status-pill ${getStatusClass(g.status)}">${g.status}</span></td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="viewGrievanceDetails('${g.grievance_id}')">
              Process ➔
            </button>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Error loading officer queues:', err);
  }
}

// ---------------- DASHBOARD ANALYTICS ----------------
async function loadDashboardAnalytics() {
  try {
    const res = await fetch('/api/analytics/dashboard');
    const json = await res.json();
    if (json.success) {
      const d = json.data;
      document.getElementById('statTotalApps').innerText = d.totalApplications;
      document.getElementById('statApprovedApps').innerText = d.applicationsByStatus['Approved'] || 0;
      document.getElementById('statUnderVerification').innerText = d.applicationsByStatus['Under Verification'] || 0;
      document.getElementById('statTotalGrv').innerText = d.totalGrievances;
      document.getElementById('statResolvedGrv').innerText = d.grievancesByStatus['Resolved'] || 0;
    }
  } catch (err) {
    console.error('Error loading analytics:', err);
  }
}

// Modal helpers
function openModal(modalId) {
  document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}
