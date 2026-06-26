// API Base URL
const API_URL = 'http://localhost:5000/api';

let stationsList = [];
let filteredStationsList = [];
let myDeskBookings = [];
let assignedExperiments = [];
let submittedReports = [];
let studentIssues = [];
let studentManuals = [];
let currentFilter = 'all';
let chatMessages = [];
let messageInterval = null;

function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return false;
    }
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role !== 'student' && user.role !== 'admin') {
        window.location.href = '/';
        return false;
    }
    const userNameSpan = document.getElementById('userName');
    if (userNameSpan) {
        userNameSpan.innerText = user.name || user.full_name || 'Student';
    }
    return true;
}

function logout() {
    console.log('Logout function called');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.clear();
    if (messageInterval) clearInterval(messageInterval);
    window.location.href = '/';
}

function triggerToast(msg, type = "info") {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; padding: 12px 24px;
        background: ${type === 'error' ? '#ef4444' : '#10b981'};
        color: white; border-radius: 8px; z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    toast.innerHTML = `<i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i> ${msg}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

async function loadAllData() {
    try {
        await Promise.all([
            loadStations(),
            loadMyBookings(),
            loadMyExperiments(),
            loadMySubmissions(),
            loadMyIssues(),
            loadManuals(),
            loadMessages()
        ]);
        renderStudentWorkspace();
    } catch (error) {
        console.error('Error loading data:', error);
        triggerToast('Error loading dashboard data', 'error');
    }
}

async function loadStations() {
    try {
        console.log('Loading stations...');
        const response = await fetch(`${API_URL}/student/stations`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        console.log('Stations API response:', data);
        
        if (data.success) {
            stationsList = data.stations || [];
            console.log('Stations loaded:', stationsList.length, 'items');
            
            if (stationsList.length === 0) {
                triggerToast('No stations found in database. Please contact administrator.', 'error');
            }
            
            applyStationFilter();
        } else {
            console.error('Failed to load stations:', data.message);
            stationsList = [];
            filteredStationsList = [];
            updateStationDropdowns();
        }
    } catch (error) {
        console.error('Error loading stations:', error);
        triggerToast('Error connecting to server. Please check if backend is running.', 'error');
        stationsList = [];
        filteredStationsList = [];
        updateStationDropdowns();
    }
}

function applyStationFilter() {
    console.log('Applying filter:', currentFilter);
    
    if (currentFilter === 'available') {
        filteredStationsList = stationsList.filter(st => st.status === 'available');
        console.log('Filtered available stations:', filteredStationsList.length);
    } else {
        filteredStationsList = [...stationsList];
        console.log('All stations:', filteredStationsList.length);
    }
    
    updateStationDropdowns();
    updateStationCount();
}

function updateStationDropdowns() {
    const deskSelect = document.getElementById('deskSelect');
    const issueSelect = document.getElementById('issueEquipmentSelect');
    const hintDiv = document.getElementById('stationHint');
    
    if (!deskSelect) {
        console.log('Desk select element not found');
        return;
    }
    
    if (!filteredStationsList || filteredStationsList.length === 0) {
        const emptyMsg = '<option value="">No stations available</option>';
        if (deskSelect) deskSelect.innerHTML = emptyMsg;
        if (issueSelect) issueSelect.innerHTML = emptyMsg;
        
        if (hintDiv) {
            if (stationsList.length === 0) {
                hintDiv.innerHTML = '<i class="fas fa-database"></i> No stations found in database. Please contact administrator.';
            } else if (currentFilter === 'available') {
                hintDiv.innerHTML = '<i class="fas fa-info-circle"></i> No available stations at the moment. Try changing filter to "All Stations" to see all stations.';
            } else {
                hintDiv.innerHTML = '<i class="fas fa-info-circle"></i> No stations found.';
            }
            hintDiv.className = 'equipment-hint maintenance';
        }
        return;
    }
    
    const optionsHtml = filteredStationsList.map(st => {
        const isAvailable = st.status === 'available';
        const isInUse = st.status === 'inuse';
        const isMaintenance = st.status === 'maintenance';
        
        let disabled = false;
        let styleClass = '';
        
        if (isMaintenance) {
            disabled = true;
            styleClass = 'equipment-option-maintenance';
        } else if (isInUse) {
            styleClass = 'equipment-option-inuse';
        } else if (isAvailable) {
            styleClass = 'equipment-option-available';
        }
        
        return `<option value="${st.id}" ${disabled ? 'disabled' : ''} data-status="${st.status}" class="${styleClass}">
            ${escapeHtml(st.name)} - ${st.status.toUpperCase()} ${isMaintenance ? '(Not Available)' : isInUse ? '(Currently In Use)' : '(Available)'}
        </option>`;
    }).join('');
    
    if (deskSelect) deskSelect.innerHTML = optionsHtml;
    if (issueSelect) issueSelect.innerHTML = optionsHtml;
    
    if (deskSelect) {
        deskSelect.onchange = function() {
            const selectedOption = this.options[this.selectedIndex];
            const status = selectedOption.getAttribute('data-status');
            const name = selectedOption.value ? selectedOption.text.split(' -')[0] : '';
            
            if (hintDiv && status) {
                if (status === 'maintenance') {
                    hintDiv.innerHTML = `<i class="fas fa-tools"></i> ${name} is under MAINTENANCE and cannot be booked.`;
                    hintDiv.className = 'equipment-hint maintenance';
                } else if (status === 'inuse') {
                    hintDiv.innerHTML = `<i class="fas fa-play"></i> ${name} is currently IN USE. You can still request a booking for future dates.`;
                    hintDiv.className = 'equipment-hint inuse';
                } else {
                    hintDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${name} is AVAILABLE for booking.`;
                    hintDiv.className = 'equipment-hint available';
                }
            } else if (hintDiv) {
                hintDiv.innerHTML = '';
            }
        };
    }
}

function updateStationCount() {
    const countSpan = document.getElementById('stationCount');
    if (countSpan) {
        const availableCount = stationsList.filter(st => st.status === 'available').length;
        const totalCount = stationsList.length;
        
        if (currentFilter === 'available') {
            countSpan.innerHTML = `(${filteredStationsList.length} available out of ${totalCount} total)`;
        } else {
            countSpan.innerHTML = `(${totalCount} total, ${availableCount} available)`;
        }
    }
}

function setupFilterButtons() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            currentFilter = btn.getAttribute('data-filter');
            applyStationFilter();
        });
    });
}

async function loadMyBookings() {
    try {
        const response = await fetch(`${API_URL}/student/my-bookings`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (data.success) {
            myDeskBookings = data.bookings || [];
        } else {
            myDeskBookings = [];
        }
    } catch (error) {
        console.error('Error loading bookings:', error);
        myDeskBookings = [];
    }
}

async function loadMyExperiments() {
    try {
        const response = await fetch(`${API_URL}/student/my-experiments`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (data.success) {
            assignedExperiments = data.experiments || [];
        } else {
            assignedExperiments = [];
        }
    } catch (error) {
        console.error('Error loading experiments:', error);
        assignedExperiments = [];
    }
}

async function loadMySubmissions() {
    try {
        const response = await fetch(`${API_URL}/student/my-submissions`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (data.success) {
            submittedReports = data.results || [];
        } else {
            submittedReports = [];
        }
    } catch (error) {
        console.error('Error loading submissions:', error);
        submittedReports = [];
    }
}

async function loadMyIssues() {
    try {
        const response = await fetch(`${API_URL}/student/my-issues`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (data.success && data.issues) {
            studentIssues = data.issues;
        } else {
            studentIssues = [];
        }
    } catch (error) {
        console.error('Error loading issues:', error);
        studentIssues = [];
    }
}

// Load SOP documents
async function loadManuals() {
    try {
        const response = await fetch(`${API_URL}/student/manuals`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        console.log('Manuals API response:', data);
        
        if (data.success && data.manuals) {
            studentManuals = data.manuals;
            console.log('Manuals loaded:', studentManuals.length);
        } else {
            studentManuals = [];
        }
        renderStudentManualsCatalog();
    } catch (error) {
        console.error('Error loading manuals:', error);
        studentManuals = [];
        renderStudentManualsCatalog();
    }
}

// Download manual file
async function downloadManual(id) {
    try {
        triggerToast('Downloading manual...', 'info');
        const response = await fetch(`${API_URL}/student/manuals/${id}/download`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'lab_manual.pdf';
            if (contentDisposition) {
                const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (match && match[1]) {
                    filename = match[1].replace(/['"]/g, '');
                }
            }
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            triggerToast('Download started!', 'success');
        } else {
            const error = await response.json();
            triggerToast(error.message || 'Error downloading file', 'error');
        }
    } catch (error) {
        console.error('Download error:', error);
        triggerToast('Error downloading manual', 'error');
    }
}

// Filter SOP documents
function filterSOPDocuments() {
    const searchTerm = document.getElementById('sopSearchInput')?.value.toLowerCase() || '';
    renderStudentManualsCatalog(searchTerm);
}

// Render functions
function renderStudentWorkspace() {
    renderStudentStats();
    renderStudentSchedules();
    renderStudentStationStates();
    renderStudentDeskTable();
    renderStudentExperiments();
    renderSubmittedReportsTable();
    renderStudentIssuesTable();
    renderStudentManualsCatalog();
}

function renderStudentStats() {
    const pendingCount = myDeskBookings.filter(b => b.status === "pending").length;
    const activeCount = assignedExperiments.filter(e => e.status === "active").length;
    const submittedCount = submittedReports.length;
    
    const statsGrid = document.getElementById('statsGrid');
    if (statsGrid) {
        statsGrid.innerHTML = `
            <div class="stat-card"><div><h3>Pending Desk Requests</h3><div class="stat-number">${pendingCount}</div></div><div class="stat-icon"><i class="fas fa-hourglass-half"></i></div></div>
            <div class="stat-card"><div><h3>Active Experiments</h3><div class="stat-number">${activeCount}</div></div><div class="stat-icon"><i class="fas fa-flask"></i></div></div>
            <div class="stat-card"><div><h3>Submitted Reports</h3><div class="stat-number">${submittedCount}</div></div><div class="stat-icon"><i class="fas fa-cloud-upload-alt"></i></div></div>
        `;
    }
}

function renderStudentSchedules() {
    const approved = myDeskBookings.filter(b => b.status === "approved");
    const container = document.getElementById('studentRecentBookings');
    if (container) {
        container.innerHTML = approved.length === 0 ? 
            '<p style="color:#666; font-size:0.9rem; padding:10px;">No approved desk bookings found.</p>' : 
            approved.slice(0, 3).map(b => `
                <div class="experiment-card">
                    <strong>${escapeHtml(b.station_name)}</strong>
                    <br><small><i class="fas fa-clock"></i> ${new Date(b.start_time).toLocaleString()} to ${new Date(b.end_time).toLocaleTimeString()}</small>
                    <br><small class="status-badge status-${b.status}">${b.status}</small>
                </div>
            `).join('');
    }
}

function renderStudentStationStates() {
    const container = document.getElementById('studentQuickEquipment');
    if (container) {
        const availableCount = stationsList.filter(s => s.status === 'available').length;
        const inuseCount = stationsList.filter(s => s.status === 'inuse').length;
        const maintenanceCount = stationsList.filter(s => s.status === 'maintenance').length;
        
        if (stationsList.length === 0) {
            container.innerHTML = '<p style="color:#666; padding:10px;">No stations found in database. Please contact administrator.</p>';
            return;
        }
        
        container.innerHTML = `
            <div style="margin-bottom: 10px; padding: 8px; background: #f3f4f6; border-radius: 8px;">
                <small>📊 Summary: ${availableCount} Available | ${inuseCount} In Use | ${maintenanceCount} Maintenance</small>
            </div>
            ${stationsList.slice(0, 5).map(s => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding: 8px 0; border-bottom:1px solid #eee;">
                    <span style="font-size:0.9rem;">${escapeHtml(s.name)}</span>
                    <span class="status-badge status-${s.status}">${s.status}</span>
                </div>
            `).join('')}
        `;
    }
}

function renderStudentDeskTable() {
    const container = document.getElementById('myDesksListTable');
    if (container) {
        if (myDeskBookings.length === 0) {
            container.innerHTML = '<p style="padding:20px; text-align:center; color:#666;">No desk bookings found.</p>';
            return;
        }
        container.innerHTML = `
            <table style="width:100%">
                <thead>
                    <tr>
                        <th>Station</th>
                        <th>Date & Time</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${myDeskBookings.slice(0, 5).map(b => `
                        <tr>
                            <td><strong>${escapeHtml(b.station_name)}</strong></td>
                            <td><small>${new Date(b.start_time).toLocaleString()}</small></td>
                            <td><span class="status-badge status-${b.status}">${b.status}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
}

function renderStudentExperiments() {
    const approvedBookings = myDeskBookings.filter(b => b.status === "approved");
    const expSelect = document.getElementById('studentExpSelect');
    if (expSelect) {
        if (approvedBookings.length === 0) {
            expSelect.innerHTML = '<option value="">No approved desk bookings available</option>';
        } else {
            expSelect.innerHTML = approvedBookings.map(b => `<option value="${b.id}">${escapeHtml(b.station_name)} (${new Date(b.start_time).toLocaleDateString()})</option>`).join('');
        }
    }
    
    const assignSelect = document.getElementById('assignContextSelect');
    if (assignSelect) {
        if (assignedExperiments.length === 0) {
            assignSelect.innerHTML = '<option value="">No experiments available</option>';
        } else {
            assignSelect.innerHTML = assignedExperiments.map(e => `<option value="${e.id}">${escapeHtml(e.title || 'Experiment')} (${e.progress}%)</option>`).join('');
        }
    }
    
    const activeExps = assignedExperiments.filter(e => e.status === "active");
    const container = document.getElementById('studentExpCards');
    if (container) {
        container.innerHTML = activeExps.length === 0 ? 
            '<p style="color:#666; font-size:0.9rem; padding:10px;">No active experiments tracked currently.</p>' : 
            activeExps.map(e => `
                <div class="experiment-card">
                    <strong>${escapeHtml(e.title || 'Experiment')}</strong><br>
                    <small>Station: ${escapeHtml(e.equipment_name || 'N/A')}</small>
                    <div style="background:#e5e7eb; height:6px; border-radius:3px; margin:8px 0;">
                        <div style="background:#3b82f6; width:${e.progress}%; height:100%; border-radius:3px;"></div>
                    </div>
                    <small>Progress: ${e.progress}%</small>
                </div>
            `).join('');
    }
}

function renderSubmittedReportsTable() {
    const container = document.getElementById('turnedInTable');
    if (container) {
        if (submittedReports.length === 0) {
            container.innerHTML = '<p style="padding:20px; text-align:center; color:#666;">No submitted reports found.</p>';
            return;
        }
        container.innerHTML = `
            <table style="width:100%">
                <thead>
                    <tr>
                        <th>Assignment</th>
                        <th>File</th>
                        <th>Upload Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${submittedReports.slice(0, 5).map(r => `
                        <tr>
                            <td><strong>${escapeHtml(r.experiment_title)}</strong><br><small style="color:#666;">${escapeHtml(r.conclusion || '')}</small></td>
                            <td><i class="fas fa-file-alt"></i> ${escapeHtml(r.file_name || 'File')}</td>
                            <td>${new Date(r.uploaded_at).toLocaleDateString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
}

// Render Student Manuals Catalog with search filter
function renderStudentManualsCatalog(searchTerm = '') {
    const container = document.getElementById('studentSopList');
    if (container) {
        if (!studentManuals || studentManuals.length === 0) {
            container.innerHTML = '<p style="padding:20px; text-align:center; color:#666;">No lab manuals available.</p>';
            return;
        }
        
        let filteredManuals = studentManuals;
        if (searchTerm) {
            filteredManuals = studentManuals.filter(m => 
                (m.title && m.title.toLowerCase().includes(searchTerm)) ||
                (m.equipment_name && m.equipment_name.toLowerCase().includes(searchTerm)) ||
                (m.description && m.description.toLowerCase().includes(searchTerm)) ||
                (m.document_type && m.document_type.toLowerCase().includes(searchTerm))
            );
        }
        
        if (filteredManuals.length === 0) {
            container.innerHTML = '<p style="padding:20px; text-align:center; color:#666;">No manuals match your search.</p>';
            return;
        }
        
        container.innerHTML = filteredManuals.map(m => `
            <div class="sop-card">
                <div class="document-type">${escapeHtml(m.document_type || 'Lab Manual')}</div>
                <h4><i class="fas fa-file-alt"></i> ${escapeHtml(m.title)}</h4>
                ${m.equipment_name ? `<div class="equipment-name"><i class="fas fa-microscope"></i> Equipment: ${escapeHtml(m.equipment_name)}</div>` : ''}
                ${m.description ? `<div class="description">${escapeHtml(m.description)}</div>` : ''}
                <button class="btn btn-edit" style="width:100%; margin-top:8px;" onclick="downloadManual(${m.id})">
                    <i class="fas fa-download"></i> Download Manual
                </button>
            </div>
        `).join('');
    }
}

function renderStudentIssuesTable() {
    const container = document.getElementById('studentReportedIssuesTable');
    if (container) {
        if (studentIssues.length === 0) {
            container.innerHTML = '<p style="padding:20px; text-align:center; color:#666;">No issues reported.</p>';
            return;
        }
        container.innerHTML = `
            <table style="width:100%">
                <thead>
                    <tr>
                        <th>Equipment</th>
                        <th>Severity</th>
                        <th>Report Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${studentIssues.slice(0, 5).map(i => `
                        <tr>
                            <td><strong>${escapeHtml(i.equipment_name)}</strong><br><small>${escapeHtml(i.description)}</small></td>
                            <td><span class="status-badge status-maintenance">${i.severity}</span></td>
                            <td>${new Date(i.reported_at).toLocaleDateString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
}

// FIXED: Chat functionality with proper API integration
async function loadMessages() {
    try {
        const response = await fetch(`${API_URL}/student/messages`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success && data.messages) {
            chatMessages = data.messages;
            renderStudentChatWidget();
        }
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

async function sendStudentMessage() {
    const inp = document.getElementById('chatInput');
    const message = inp ? inp.value.trim() : '';
    
    if (!message) {
        triggerToast('Please enter a message', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/student/messages`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ message: message })
        });
        const data = await response.json();
        
        if (data.success) {
            inp.value = '';
            await loadMessages();
            triggerToast('Message sent successfully!', 'success');
        } else {
            triggerToast(data.message || 'Error sending message', 'error');
        }
    } catch (error) {
        console.error('Error sending message:', error);
        triggerToast('Error sending message. Please check your connection.', 'error');
    }
}

function renderStudentChatWidget() {
    const container = document.getElementById('chatMessages');
    const currentUserId = JSON.parse(localStorage.getItem('user') || '{}').id;
    
    if (container) {
        if (!chatMessages || chatMessages.length === 0) {
            container.innerHTML = '<div class="msg-rcv" style="text-align:center; opacity:0.7;">No messages yet. Start a conversation with your instructor!</div>';
            return;
        }
        
        container.innerHTML = chatMessages.map(m => {
            const isOwnMessage = m.sender_id === currentUserId;
            const senderInfo = m.sender_name || (isOwnMessage ? 'You' : 'Instructor');
            
            return `
                <div class="msg-bubble ${isOwnMessage ? 'msg-sent' : 'msg-rcv'}">
                    <small style="display:block; font-size:0.7rem; opacity:0.8;">
                        <strong>${escapeHtml(senderInfo)}</strong> (${escapeHtml(m.sender_role || (isOwnMessage ? 'Student' : 'Instructor'))})
                    </small>
                    <div style="margin: 4px 0;">${escapeHtml(m.message)}</div>
                    <small style="display:block; font-size:0.6rem; opacity:0.6; text-align:right;">
                        ${new Date(m.created_at).toLocaleTimeString()}
                    </small>
                </div>
            `;
        }).join('');
        container.scrollTop = container.scrollHeight;
    }
}

function toggleStudentChat() {
    const win = document.getElementById('chatWindow');
    if (win) {
        const isVisible = win.style.display === 'flex';
        win.style.display = isVisible ? 'none' : 'flex';
        if (!isVisible) {
            loadMessages();
        }
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Navigation
function initStudentRouter() {
    const navItems = document.querySelectorAll(".nav-item");
    navItems.forEach(item => {
        item.addEventListener("click", () => {
            navItems.forEach(i => i.classList.remove("active"));
            item.classList.add("active");

            const targetSection = item.getAttribute("data-section");
            const sections = document.querySelectorAll(".content-section");
            sections.forEach(sec => sec.classList.remove("active-section"));
            
            const activeSec = document.getElementById(`${targetSection}Section`);
            if (activeSec) activeSec.classList.add("active-section");

            const titles = { 
                dashboard: 'Student Overview', 
                'class-booking': 'Book Lab Desk Station', 
                'student-experiments': 'My Experiments Tracker', 
                'submit-assignment': 'Submit Lab Report',
                'student-sop': 'SOP & Lab Protocols',
                'student-issue': 'Report Equipment Issue'
            };
            const pageTitle = document.getElementById('pageTitle');
            if (pageTitle) pageTitle.innerText = titles[targetSection] || 'Student Console';

            if (window.innerWidth <= 992) closeStudentSidebar();
        });
    });

    const actionButtons = document.querySelectorAll(".btn-act");
    actionButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const dest = btn.getAttribute("data-target");
            const sideItem = document.querySelector(`.nav-item[data-section="${dest}"]`);
            if (sideItem) sideItem.click();
        });
    });
}

function initStudentMobileMenu() {
    const toggle = document.getElementById("menuToggle");
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    const logoutBtn = document.getElementById("logoutBtn");

    if (toggle) {
        toggle.addEventListener("click", () => {
            if (sidebar) sidebar.classList.add("open");
            if (overlay) overlay.classList.add("open");
        });
    }
    
    if (overlay) {
        overlay.addEventListener("click", closeStudentSidebar);
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            console.log("Logout button clicked");
            if (confirm("Are you sure you want to log out?")) {
                logout();
            }
        });
    }
}

function closeStudentSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    if (sidebar) sidebar.classList.remove("open");
    if (overlay) overlay.classList.remove("open");
}

function initDateDefaults() {
    let now = new Date();
    let tomorrow = new Date(now.getTime() + 24 * 3600000);
    const startInput = document.getElementById('deskStart');
    const endInput = document.getElementById('deskEnd');
    if (startInput) startInput.value = now.toISOString().slice(0, 16);
    if (endInput) endInput.value = tomorrow.toISOString().slice(0, 16);
}

// Form event listeners
function bindFormEvents() {
    const deskBookingForm = document.getElementById('deskBookingForm');
    if (deskBookingForm) {
        deskBookingForm.removeEventListener('submit', handleDeskBooking);
        deskBookingForm.addEventListener('submit', handleDeskBooking);
    }
    
    const studentExpForm = document.getElementById('studentExpForm');
    if (studentExpForm) {
        studentExpForm.removeEventListener('submit', handleStudentExp);
        studentExpForm.addEventListener('submit', handleStudentExp);
    }
    
    const assignmentForm = document.getElementById('assignmentForm');
    if (assignmentForm) {
        assignmentForm.removeEventListener('submit', handleAssignmentUpload);
        assignmentForm.addEventListener('submit', handleAssignmentUpload);
    }
    
    const studentIssueForm = document.getElementById('studentIssueForm');
    if (studentIssueForm) {
        studentIssueForm.removeEventListener('submit', handleStudentIssue);
        studentIssueForm.addEventListener('submit', handleStudentIssue);
    }
}

// Form submissions
async function handleDeskBooking(e) {
    e.preventDefault();
    console.log('Submitting desk booking...');
    
    const stationId = document.getElementById('deskSelect').value;
    const start = document.getElementById('deskStart').value;
    const end = document.getElementById('deskEnd').value;
    const purpose = document.getElementById('deskPurpose').value;
    
    if (!stationId || !start || !end) {
        triggerToast("Please fill all fields", 'error');
        return;
    }
    
    if (new Date(start) >= new Date(end)) {
        triggerToast("End time must be after start time", 'error');
        return;
    }
    
    const selectedStation = filteredStationsList.find(st => st.id == stationId);
    if (selectedStation && selectedStation.status === 'maintenance') {
        triggerToast("This station is under maintenance and cannot be booked.", 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/student/bookings`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                equipment_id: parseInt(stationId),
                start_time: start,
                end_time: end,
                purpose: purpose || 'Lab work'
            })
        });
        const data = await response.json();
        
        if (data.success) {
            triggerToast("Desk reservation submitted successfully!", 'success');
            document.getElementById('deskBookingForm').reset();
            initDateDefaults();
            await loadMyBookings();
            renderStudentWorkspace();
        } else {
            triggerToast(data.message || 'Failed to submit booking', 'error');
        }
    } catch (error) {
        console.error('Error submitting booking:', error);
        triggerToast('Error submitting booking. Please try again.', 'error');
    }
}

async function handleStudentExp(e) {
    e.preventDefault();
    console.log('Submitting experiment...');
    
    const bookingId = document.getElementById('studentExpSelect').value;
    const notes = document.getElementById('studentExpNotes').value;
    const progress = parseInt(document.getElementById('studentExpProgress').value);
    
    if (!bookingId) {
        triggerToast("Please select a desk booking", 'error');
        return;
    }
    
    const booking = myDeskBookings.find(b => b.id == bookingId);
    const title = booking ? `Experiment at ${booking.station_name}` : 'Student Assignment';
    
    try {
        const response = await fetch(`${API_URL}/student/experiments`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                booking_id: parseInt(bookingId),
                title: title,
                equipment_used: booking?.station_name || 'Lab Station',
                progress: progress,
                notes: notes
            })
        });
        const data = await response.json();
        
        if (data.success) {
            triggerToast(`Assignment progress updated to ${progress}%`, 'success');
            document.getElementById('studentExpForm').reset();
            await loadMyExperiments();
            renderStudentWorkspace();
        } else {
            triggerToast(data.message || 'Failed to save experiment', 'error');
        }
    } catch (error) {
        console.error('Error saving experiment:', error);
        triggerToast('Error saving experiment. Please try again.', 'error');
    }
}

async function handleAssignmentUpload(e) {
    e.preventDefault();
    console.log('Uploading assignment...');
    
    const experimentId = document.getElementById('assignContextSelect').value;
    const title = document.getElementById('assignTitle').value;
    const comments = document.getElementById('assignComments').value;
    const fileInput = document.getElementById('assignFile');
    
    if (!experimentId) {
        triggerToast("Please select an experiment", 'error');
        return;
    }
    
    if (!title) {
        triggerToast("Please enter a report title", 'error');
        return;
    }
    
    if (!fileInput.files[0]) {
        triggerToast("Please select a file to upload", 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('experiment_id', experimentId);
    formData.append('title', title);
    formData.append('conclusion', comments);
    formData.append('assignFile', fileInput.files[0]);
    
    try {
        const response = await fetch(`${API_URL}/student/upload-assignment`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: formData
        });
        const data = await response.json();
        
        if (data.success) {
            triggerToast("Assignment submitted successfully!", 'success');
            document.getElementById('assignmentForm').reset();
            await loadMySubmissions();
            renderStudentWorkspace();
        } else {
            triggerToast(data.message || 'Failed to submit assignment', 'error');
        }
    } catch (error) {
        console.error('Error submitting assignment:', error);
        triggerToast('Error submitting assignment. Please try again.', 'error');
    }
}

async function handleStudentIssue(e) {
    e.preventDefault();
    console.log('Submitting issue report...');
    
    const equipmentId = document.getElementById('issueEquipmentSelect').value;
    const severity = document.getElementById('issueSeverity').value;
    const description = document.getElementById('issueDescription').value;
    
    if (!equipmentId) {
        triggerToast("Please select equipment", 'error');
        return;
    }
    
    if (!description) {
        triggerToast("Please provide a description of the issue", 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/student/issues`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                equipment_id: parseInt(equipmentId),
                severity: severity.toLowerCase(),
                description: description
            })
        });
        const data = await response.json();
        
        if (data.success) {
            triggerToast("Issue reported successfully!", 'success');
            document.getElementById('studentIssueForm').reset();
            await loadMyIssues();
            renderStudentWorkspace();
        } else {
            triggerToast(data.message || 'Failed to submit issue report', 'error');
        }
    } catch (error) {
        console.error('Error submitting report:', error);
        triggerToast('Error submitting issue report. Please try again.', 'error');
    }
}

// Make functions available globally
window.downloadManual = downloadManual;
window.filterSOPDocuments = filterSOPDocuments;
window.sendStudentMessage = sendStudentMessage;
window.toggleStudentChat = toggleStudentChat;

// Initialize
document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM loaded, initializing student dashboard...");
    
    if (!checkAuth()) return;
    
    initStudentRouter();
    initStudentMobileMenu();
    initDateDefaults();
    setupFilterButtons();
    bindFormEvents();
    loadAllData();
    
    // Refresh messages every 5 seconds when chat is open
    setInterval(() => {
        if (document.getElementById('chatWindow')?.style.display === 'flex') {
            loadMessages();
        }
    }, 5000);
    
    renderStudentChatWidget();
});