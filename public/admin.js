// API Base URL
const API_URL = 'http://localhost:5000/api';

// Common equipment suggestions for autocomplete
const equipmentSuggestions = [
    'Microscope', 'Compound Microscope', 'Electron Microscope', 'Fluorescence Microscope',
    'Centrifuge', 'Refrigerated Centrifuge', 'Microcentrifuge', 'Ultracentrifuge',
    'Spectrophotometer', 'UV-Vis Spectrophotometer', 'FTIR Spectrometer', 'Mass Spectrometer',
    'PCR Machine', 'Real-Time PCR', 'Thermal Cycler',
    'Incubator', 'CO2 Incubator', 'BOD Incubator', 'Shaking Incubator',
    'Autoclave', 'Biosafety Cabinet', 'Laminar Flow Hood', 'Fume Hood',
    'pH Meter', 'Balance', 'Analytical Balance', 'Hot Plate', 'Magnetic Stirrer',
    'Water Bath', 'Vortex Mixer', 'Shaker', 'Homogenizer',
    'Gel Electrophoresis', 'DNA Sequencer', 'Flow Cytometer', 'HPLC System'
];

// Helper function to get auth headers
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

// Check authentication
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return false;
    }
    return true;
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

// Show notification
function showNotification(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = "toast-alert";
    toast.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; padding: 12px 24px;
        border-radius: 8px; color: white; z-index: 1000;
        background-color: ${type === "error" ? "#ef4444" : type === "success" ? "#10b981" : "#3b82f6"};
        animation: fadeIn 0.3s ease;
    `;
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Load dashboard stats
async function loadDashboardStats() {
    try {
        const response = await fetch(`${API_URL}/admin/stats`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('totalUsers').innerText = data.stats.totalUsers;
            document.getElementById('pendingApprovals').innerText = data.stats.pendingApprovals;
            document.getElementById('totalEquipment').innerText = data.stats.totalEquipment;
            document.getElementById('activeBookings').innerText = data.stats.activeBookings;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load users
async function loadUsers() {
    try {
        const response = await fetch(`${API_URL}/admin/users`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success && data.users) {
            const tbody = document.getElementById('usersTableBody');
            tbody.innerHTML = data.users.map(user => `
                <tr>
                    <td>${escapeHtml(user.full_name)}</td>
                    <td>${escapeHtml(user.email)}</td>
                    <td>${escapeHtml(user.role)}</td>
                    <td>${user.is_approved ? '<span style="color:#10b981;">Approved</span>' : '<span style="color:#f59e0b;">Pending</span>'}</td>
                    <td>
                        ${!user.is_approved && user.role !== 'admin' ? 
                            `<button class="btn btn-approve" onclick="approveUser(${user.id})">Approve</button>
                             <button class="btn btn-reject" onclick="rejectUser(${user.id})">Reject</button>` : 
                            user.role !== 'admin' ?
                            `<button class="btn btn-reject" onclick="rejectUser(${user.id})">Delete</button>` : 
                            'Admin'
                        }
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Approve user
async function approveUser(userId) {
    if (!confirm('Approve this user?')) return;
    
    try {
        const response = await fetch(`${API_URL}/admin/users/${userId}/approve`, {
            method: 'PUT',
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success) {
            showNotification('User approved successfully!', 'success');
            loadUsers();
            loadDashboardStats();
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        showNotification('Error approving user', 'error');
    }
}

// Reject/Delete user
async function rejectUser(userId) {
    if (!confirm('Delete this user?')) return;
    
    try {
        const response = await fetch(`${API_URL}/admin/users/${userId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success) {
            showNotification('User deleted successfully!', 'success');
            loadUsers();
            loadDashboardStats();
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        showNotification('Error deleting user', 'error');
    }
}

// Load supervisors
async function loadSupervisors() {
    try {
        const response = await fetch(`${API_URL}/admin/supervisors`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success && data.supervisors) {
            const tbody = document.getElementById('supervisorsTableBody');
            tbody.innerHTML = data.supervisors.map(sup => `
                <tr>
                    <td>${escapeHtml(sup.full_name)}</td>
                    <td>${escapeHtml(sup.email)}</td>
                    <td>${escapeHtml(sup.department || 'N/A')}</td>
                    <td>Main Lab</td>
                    <td>
                        <button class="btn btn-edit" onclick="editSupervisor(${sup.id})">Edit</button>
                        <button class="btn btn-reject" onclick="deleteSupervisor(${sup.id})">Remove</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading supervisors:', error);
    }
}

// Add supervisor
async function addSupervisor() {
    const name = document.getElementById('supervisorName').value;
    const email = document.getElementById('supervisorEmail').value;
    const password = document.getElementById('supervisorPassword').value;
    const department = document.getElementById('supervisorDepartment').value;
    
    if (!name || !email || !password) {
        showNotification('Please fill all required fields', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/admin/supervisors`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                full_name: name,
                email: email,
                password: password,
                department: department || 'General'
            })
        });
        const data = await response.json();
        
        if (data.success) {
            showNotification('Supervisor added successfully!', 'success');
            closeSupervisorModal();
            loadSupervisors();
            loadDashboardStats();
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        showNotification('Error adding supervisor', 'error');
    }
}

// Delete supervisor
async function deleteSupervisor(userId) {
    if (!confirm('Remove this supervisor?')) return;
    await rejectUser(userId);
}

// Edit supervisor (placeholder)
function editSupervisor(userId) {
    showNotification('Edit functionality coming soon', 'info');
}

// Load equipment
async function loadEquipment() {
    try {
        const response = await fetch(`${API_URL}/admin/equipment`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success && data.equipment) {
            const tbody = document.getElementById('equipmentTableBody');
            tbody.innerHTML = data.equipment.map(eq => `
                <tr>
                    <td>${escapeHtml(eq.name)}</td>
                    <td>${escapeHtml(eq.category || 'N/A')}</td>
                    <td><span class="status-badge status-${eq.status}">${eq.status}</span></td>
                    <td>${escapeHtml(eq.location || 'N/A')}</td>
                    <td>
                        <button class="btn btn-edit" onclick="editEquipment(${eq.id})">Edit</button>
                        <button class="btn btn-reject" onclick="deleteEquipment(${eq.id})">Delete</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading equipment:', error);
    }
}

// Equipment suggestions
function setupEquipmentSuggestions() {
    const nameInput = document.getElementById('equipmentName');
    const suggestionsDiv = document.getElementById('nameSuggestions');
    
    if (!nameInput) return;
    
    nameInput.addEventListener('input', function() {
        const value = this.value.toLowerCase();
        if (value.length < 2) {
            suggestionsDiv.style.display = 'none';
            return;
        }
        
        const matches = equipmentSuggestions.filter(s => 
            s.toLowerCase().includes(value)
        );
        
        if (matches.length > 0) {
            suggestionsDiv.innerHTML = matches.map(m => 
                `<div class="suggestion-item" onclick="selectEquipmentSuggestion('${escapeHtml(m)}')">${escapeHtml(m)}</div>`
            ).join('');
            suggestionsDiv.style.display = 'block';
        } else {
            suggestionsDiv.style.display = 'none';
        }
    });
    
    document.addEventListener('click', function(e) {
        if (!suggestionsDiv.contains(e.target) && e.target !== nameInput) {
            suggestionsDiv.style.display = 'none';
        }
    });
}

function selectEquipmentSuggestion(name) {
    document.getElementById('equipmentName').value = name;
    document.getElementById('nameSuggestions').style.display = 'none';
    
    // Auto-select category based on equipment name
    const categoryMap = {
        'microscope': 'Microscopy',
        'centrifuge': 'Centrifugation',
        'spectrophotometer': 'Spectroscopy',
        'spectrometer': 'Spectroscopy',
        'pcr': 'PCR & Amplification',
        'thermal cycler': 'PCR & Amplification',
        'incubator': 'Incubation',
        'autoclave': 'Safety Equipment',
        'biosafety': 'Safety Equipment',
        'ph meter': 'General Lab',
        'balance': 'General Lab',
        'electrophoresis': 'Electrophoresis',
        'chromatography': 'Chromatography'
    };
    
    const lowerName = name.toLowerCase();
    for (const [key, category] of Object.entries(categoryMap)) {
        if (lowerName.includes(key)) {
            document.getElementById('equipmentCategory').value = category;
            break;
        }
    }
}

// Add equipment with form
function openEquipmentModal(equipment = null) {
    const modal = document.getElementById('equipmentModal');
    const title = document.getElementById('equipmentModalTitle');
    const form = document.getElementById('equipmentForm');
    
    if (equipment) {
        title.innerText = 'Edit Equipment';
        document.getElementById('equipmentId').value = equipment.id;
        document.getElementById('equipmentName').value = equipment.name;
        document.getElementById('equipmentCategory').value = equipment.category || '';
        document.getElementById('equipmentLocation').value = equipment.location || '';
        document.getElementById('equipmentStatus').value = equipment.status || 'available';
        document.getElementById('equipmentDescription').value = equipment.description || '';
    } else {
        title.innerText = 'Add New Equipment';
        form.reset();
        document.getElementById('equipmentId').value = '';
    }
    
    modal.style.display = 'flex';
}

function closeEquipmentModal() {
    document.getElementById('equipmentModal').style.display = 'none';
    document.getElementById('nameSuggestions').style.display = 'none';
}

// Save equipment
async function saveEquipment() {
    const id = document.getElementById('equipmentId').value;
    const name = document.getElementById('equipmentName').value;
    const category = document.getElementById('equipmentCategory').value;
    const location = document.getElementById('equipmentLocation').value;
    const status = document.getElementById('equipmentStatus').value;
    const description = document.getElementById('equipmentDescription').value;
    
    if (!name) {
        showNotification('Equipment name is required', 'error');
        return;
    }
    
    try {
        let response;
        if (id) {
            response = await fetch(`${API_URL}/admin/equipment/${id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ name, category, location, status, description })
            });
        } else {
            response = await fetch(`${API_URL}/admin/equipment`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ name, category, location, status, description })
            });
        }
        const data = await response.json();
        
        if (data.success) {
            showNotification(id ? 'Equipment updated!' : 'Equipment added!', 'success');
            closeEquipmentModal();
            loadEquipment();
            loadDashboardStats();
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        showNotification('Error saving equipment', 'error');
    }
}

// Edit equipment
async function editEquipment(id) {
    try {
        const response = await fetch(`${API_URL}/admin/equipment`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success && data.equipment) {
            const equipment = data.equipment.find(eq => eq.id === id);
            if (equipment) {
                openEquipmentModal(equipment);
            }
        }
    } catch (error) {
        showNotification('Error loading equipment', 'error');
    }
}

// Delete equipment
async function deleteEquipment(id) {
    if (!confirm('Delete this equipment? This action cannot be undone.')) return;
    
    try {
        const response = await fetch(`${API_URL}/admin/equipment/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success) {
            showNotification('Equipment deleted!', 'success');
            loadEquipment();
            loadDashboardStats();
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        showNotification('Error deleting equipment', 'error');
    }
}

// Load damage reports
async function loadDamageReports() {
    try {
        const response = await fetch(`${API_URL}/admin/damage-reports`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success && data.reports) {
            const tbody = document.getElementById('reportsTableBody');
            tbody.innerHTML = data.reports.map(report => `
                <tr>
                    <td>#${report.id}</td>
                    <td>${escapeHtml(report.equipment_name)}</td>
                    <td><span class="status-badge status-${report.severity === 'high' ? 'maintenance' : report.severity === 'medium' ? 'inuse' : 'available'}">${report.severity}</span></td>
                    <td>${escapeHtml(report.reported_by_name)}</td>
                    <td><span class="status-badge ${report.status === 'pending' ? 'status-pending' : 'status-approved'}">${report.status}</span></td>
                    <td>${new Date(report.reported_at).toLocaleDateString()}</td>
                    <td>
                        <button class="btn btn-download" onclick="downloadDamageReport(${report.id})">Download PDF</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading reports:', error);
        const tbody = document.getElementById('reportsTableBody');
        tbody.innerHTML = '<tr><td colspan="7" class="loading">Error loading reports...</td></tr>';
    }
}

// Download damage report as PDF
async function downloadDamageReport(id) {
    try {
        showNotification('Generating report...', 'info');
        
        // Fetch the damage report details
        const response = await fetch(`${API_URL}/admin/damage-reports`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success && data.reports) {
            const report = data.reports.find(r => r.id === id);
            if (report) {
                // Create HTML content for PDF
                const reportHtml = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <title>Damage Report #${report.id}</title>
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                                padding: 40px;
                                line-height: 1.6;
                            }
                            .header {
                                text-align: center;
                                margin-bottom: 30px;
                                padding-bottom: 20px;
                                border-bottom: 2px solid #333;
                            }
                            .header h1 {
                                color: #1e40af;
                                margin: 0;
                            }
                            .report-details {
                                margin: 20px 0;
                            }
                            .detail-row {
                                margin: 10px 0;
                                padding: 8px;
                                border-bottom: 1px solid #eee;
                            }
                            .label {
                                font-weight: bold;
                                display: inline-block;
                                width: 150px;
                            }
                            .severity-high {
                                color: #ef4444;
                                font-weight: bold;
                            }
                            .severity-medium {
                                color: #f59e0b;
                                font-weight: bold;
                            }
                            .severity-low {
                                color: #10b981;
                                font-weight: bold;
                            }
                            .footer {
                                margin-top: 50px;
                                text-align: center;
                                font-size: 12px;
                                color: #666;
                                border-top: 1px solid #eee;
                                padding-top: 20px;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <h1>Equipment Damage Report</h1>
                            <p>Lab Management System</p>
                        </div>
                        <div class="report-details">
                            <div class="detail-row">
                                <span class="label">Report ID:</span>
                                <span>DR${report.id}</span>
                            </div>
                            <div class="detail-row">
                                <span class="label">Equipment Name:</span>
                                <span>${escapeHtml(report.equipment_name)}</span>
                            </div>
                            <div class="detail-row">
                                <span class="label">Equipment Status:</span>
                                <span>${report.equipment_status || 'N/A'}</span>
                            </div>
                            <div class="detail-row">
                                <span class="label">Severity Level:</span>
                                <span class="severity-${report.severity}">${report.severity.toUpperCase()}</span>
                            </div>
                            <div class="detail-row">
                                <span class="label">Reported By:</span>
                                <span>${escapeHtml(report.reported_by_name)}</span>
                            </div>
                            <div class="detail-row">
                                <span class="label">Report Date:</span>
                                <span>${new Date(report.reported_at).toLocaleString()}</span>
                            </div>
                            <div class="detail-row">
                                <span class="label">Status:</span>
                                <span>${report.status}</span>
                            </div>
                            <div class="detail-row">
                                <span class="label">Description:</span>
                                <div style="margin-top: 5px;">${escapeHtml(report.description)}</div>
                            </div>
                        </div>
                        <div class="footer">
                            <p>This is an auto-generated report from Lab Management System</p>
                            <p>Generated on: ${new Date().toLocaleString()}</p>
                        </div>
                    </body>
                    </html>
                `;
                
                // Create blob and download
                const blob = new Blob([reportHtml], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `damage_report_${report.id}_${new Date().toISOString().split('T')[0]}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                showNotification('Report downloaded successfully!', 'success');
            } else {
                showNotification('Report not found', 'error');
            }
        }
    } catch (error) {
        console.error('Error downloading report:', error);
        showNotification('Error downloading report', 'error');
    }
}

// Supervisor modal functions
function openSupervisorModal() {
    document.getElementById('supervisorModal').style.display = 'flex';
}

function closeSupervisorModal() {
    document.getElementById('supervisorModal').style.display = 'none';
    document.getElementById('supervisorForm').reset();
}

// Escape HTML to prevent XSS
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Navigation and initialization
document.addEventListener("DOMContentLoaded", () => {
    if (!checkAuth()) return;
    
    // Initialize all modules
    loadDashboardStats();
    loadUsers();
    loadSupervisors();
    loadEquipment();
    loadDamageReports();
    setupEquipmentSuggestions();
    
    // Form submissions
    document.getElementById('equipmentForm').addEventListener('submit', (e) => {
        e.preventDefault();
        saveEquipment();
    });
    
    document.getElementById('supervisorForm').addEventListener('submit', (e) => {
        e.preventDefault();
        addSupervisor();
    });
    
    // Navigation
    const navLinks = document.querySelectorAll(".nav-link");
    const sections = document.querySelectorAll(".content-section");
    const sidebar = document.getElementById("sidebar");
    const sidebarOverlay = document.getElementById("sidebarOverlay");

    const toggleSidebar = (state) => {
        sidebar.classList.toggle("open", state);
        if (sidebarOverlay) sidebarOverlay.classList.toggle("open", state);
    };

    navLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove("active"));
            sections.forEach(s => s.classList.remove("active-section"));

            link.classList.add("active");
            const targetId = link.getAttribute("href").substring(1);
            document.getElementById(targetId).classList.add("active-section");

            if (window.innerWidth <= 992) toggleSidebar(false);
        });
    });

    const menuToggle = document.getElementById("menuToggle");
    if (menuToggle) {
        menuToggle.addEventListener("click", () => toggleSidebar(true));
    }
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener("click", () => toggleSidebar(false));
    }

    // Logout
    document.getElementById("logoutBtn").addEventListener("click", () => {
        if (confirm("Are you sure you want to log out?")) {
            logout();
        }
    });
    
    // Add equipment button
    const addEquipmentBtn = document.getElementById('addEquipmentBtn');
    if (addEquipmentBtn) {
        addEquipmentBtn.addEventListener('click', () => openEquipmentModal());
    }
    
    // Add supervisor button
    const addSupervisorBtn = document.getElementById('addSupervisorBtn');
    if (addSupervisorBtn) {
        addSupervisorBtn.addEventListener('click', openSupervisorModal);
    }
});

// Make functions global for onclick handlers
window.approveUser = approveUser;
window.rejectUser = rejectUser;
window.editSupervisor = editSupervisor;
window.deleteSupervisor = deleteSupervisor;
window.editEquipment = editEquipment;
window.deleteEquipment = deleteEquipment;
window.downloadDamageReport = downloadDamageReport;
window.closeEquipmentModal = closeEquipmentModal;
window.closeSupervisorModal = closeSupervisorModal;
window.selectEquipmentSuggestion = selectEquipmentSuggestion;