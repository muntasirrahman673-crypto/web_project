// API Base URL
const API_URL = 'http://localhost:5000/api';

let equipmentList = [];
let filteredEquipmentList = [];
let myBookings = [];
let myExperiments = [];
let uploadedResults = [];
let reportedDamage = [];
let sopDocuments = [];
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
    if (user.role !== 'researcher' && user.role !== 'admin') {
        window.location.href = '/';
        return false;
    }
    const userNameSpan = document.getElementById('userName');
    if (userNameSpan) {
        userNameSpan.innerText = user.name || user.full_name || 'Researcher';
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

// Load all data
async function loadAllData() {
    try {
        await Promise.all([
            loadEquipment(),
            loadMyBookings(),
            loadMyExperiments(),
            loadMyResults(),
            loadMyDamageReports(),
            loadSOP(),
            loadMessages()
        ]);
        renderAllModules();
    } catch (error) {
        console.error('Error loading data:', error);
        triggerToast('Error loading dashboard data', 'error');
    }
}

async function loadEquipment() {
    try {
        console.log('Loading equipment...');
        const response = await fetch(`${API_URL}/researcher/equipment-for-booking`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        console.log('Equipment API response:', data);
        
        if (data.success) {
            equipmentList = data.equipment || [];
            console.log('Equipment loaded:', equipmentList.length, 'items');
            
            if (equipmentList.length === 0) {
                triggerToast('No equipment found in database. Please add equipment first.', 'error');
            }
            
            applyEquipmentFilter();
        } else {
            console.error('Failed to load equipment:', data.message);
            triggerToast('Failed to load equipment: ' + (data.message || 'Unknown error'), 'error');
            equipmentList = [];
            filteredEquipmentList = [];
            updateEquipmentDropdown();
        }
    } catch (error) {
        console.error('Error loading equipment:', error);
        triggerToast('Error connecting to server. Please check if backend is running.', 'error');
        equipmentList = [];
        filteredEquipmentList = [];
        updateEquipmentDropdown();
    }
}

// Apply filter to equipment list
function applyEquipmentFilter() {
    console.log('Applying filter:', currentFilter);
    
    if (currentFilter === 'available') {
        filteredEquipmentList = equipmentList.filter(eq => eq.status === 'available');
        console.log('Filtered available equipment:', filteredEquipmentList.length);
    } else {
        filteredEquipmentList = [...equipmentList];
        console.log('All equipment:', filteredEquipmentList.length);
    }
    
    updateEquipmentDropdown();
    updateEquipmentCount();
}

// Update equipment dropdown with filtered list
function updateEquipmentDropdown() {
    const equipmentSelect = document.getElementById('bookingEquipment');
    const hintDiv = document.getElementById('equipmentHint');
    
    if (!equipmentSelect) {
        console.log('Equipment select element not found');
        return;
    }
    
    if (!filteredEquipmentList || filteredEquipmentList.length === 0) {
        equipmentSelect.innerHTML = '<option value="">No equipment available</option>';
        if (hintDiv) {
            if (equipmentList.length === 0) {
                hintDiv.innerHTML = '<i class="fas fa-database"></i> No equipment found in database. Please contact administrator to add equipment.';
            } else if (currentFilter === 'available') {
                hintDiv.innerHTML = '<i class="fas fa-info-circle"></i> No available equipment at the moment. Try changing filter to "All Equipment" to see all equipment.';
            } else {
                hintDiv.innerHTML = '<i class="fas fa-info-circle"></i> No equipment found.';
            }
            hintDiv.className = 'equipment-hint maintenance';
        }
        return;
    }
    
    equipmentSelect.innerHTML = filteredEquipmentList.map(eq => {
        const isAvailable = eq.status === 'available';
        const isInUse = eq.status === 'inuse';
        const isMaintenance = eq.status === 'maintenance';
        
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
        
        return `<option value="${eq.id}" ${disabled ? 'disabled' : ''} data-status="${eq.status}" class="${styleClass}">
            ${escapeHtml(eq.name)} - ${eq.status.toUpperCase()} ${isMaintenance ? '(Not Available)' : isInUse ? '(Currently In Use)' : '(Available)'}
        </option>`;
    }).join('');
    
    equipmentSelect.onchange = function() {
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

// Update equipment count display
function updateEquipmentCount() {
    const countSpan = document.getElementById('equipmentCount');
    if (countSpan) {
        const availableCount = equipmentList.filter(eq => eq.status === 'available').length;
        const totalCount = equipmentList.length;
        
        if (currentFilter === 'available') {
            countSpan.innerHTML = `(${filteredEquipmentList.length} available out of ${totalCount} total)`;
        } else {
            countSpan.innerHTML = `(${totalCount} total, ${availableCount} available)`;
        }
    }
}

// Set up filter buttons
function setupFilterButtons() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            currentFilter = btn.getAttribute('data-filter');
            applyEquipmentFilter();
        });
    });
}

async function loadMyBookings() {
    try {
        const response = await fetch(`${API_URL}/researcher/my-bookings`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (data.success) {
            myBookings = data.bookings || [];
        } else {
            myBookings = [];
        }
    } catch (error) {
        console.error('Error loading bookings:', error);
        myBookings = [];
    }
}

async function loadMyExperiments() {
    try {
        const response = await fetch(`${API_URL}/researcher/my-experiments`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (data.success) {
            myExperiments = data.experiments || [];
        } else {
            myExperiments = [];
        }
    } catch (error) {
        console.error('Error loading experiments:', error);
        myExperiments = [];
    }
}

async function loadMyResults() {
    try {
        const response = await fetch(`${API_URL}/researcher/my-results`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (data.success) {
            uploadedResults = data.results || [];
        } else {
            uploadedResults = [];
        }
    } catch (error) {
        console.error('Error loading results:', error);
        uploadedResults = [];
    }
}

async function loadMyDamageReports() {
    try {
        const response = await fetch(`${API_URL}/researcher/damage-reports`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (data.success && data.reports) {
            reportedDamage = data.reports;
        } else {
            reportedDamage = [];
        }
    } catch (error) {
        console.error('Error loading damage reports:', error);
        reportedDamage = [];
    }
}

async function loadSOP() {
    try {
        const response = await fetch(`${API_URL}/researcher/sop`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        console.log('SOP API response:', data);
        
        if (data.success && data.sopDocs) {
            sopDocuments = data.sopDocs;
            console.log('SOP documents loaded:', sopDocuments.length);
        } else {
            sopDocuments = [];
        }
        renderSOPCatalog();
    } catch (error) {
        console.error('Error loading SOP:', error);
        sopDocuments = [];
        renderSOPCatalog();
    }
}

async function downloadSOP(id) {
    try {
        triggerToast('Downloading document...', 'info');
        const response = await fetch(`${API_URL}/researcher/sop/${id}/download`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'sop_document.pdf';
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
        triggerToast('Error downloading SOP document', 'error');
    }
}

// Render functions
function renderAllModules() {
    renderStats();
    renderUpcomingSchedules();
    renderEquipmentStates();
    renderBookingHistory();
    renderExperimentManager();
    renderUploadedResultsTable();
    renderSOPCatalog();
    renderDamageReportsTable();
}

function renderStats() {
    const pendingCount = myBookings.filter(b => b.status === "pending").length;
    const activeCount = myExperiments.filter(e => e.status === "active").length;
    const resultsCount = uploadedResults.length;
    
    const statsGrid = document.getElementById('statsGrid');
    if (statsGrid) {
        statsGrid.innerHTML = `
            <div class="stat-card"><div><h3>Pending Schedules</h3><div class="stat-number">${pendingCount}</div></div><div class="stat-icon"><i class="fas fa-hourglass-half"></i></div></div>
            <div class="stat-card"><div><h3>Active Tracking Run</h3><div class="stat-number">${activeCount}</div></div><div class="stat-icon"><i class="fas fa-vial"></i></div></div>
            <div class="stat-card"><div><h3>Uploaded Datasets</h3><div class="stat-number">${resultsCount}</div></div><div class="stat-icon"><i class="fas fa-cloud-upload-alt"></i></div></div>
        `;
    }
}

function renderUpcomingSchedules() {
    const approved = myBookings.filter(b => b.status === "approved");
    const container = document.getElementById('recentBookings');
    if (container) {
        container.innerHTML = approved.length === 0 ? 
            '<p style="color:#666; font-size:0.9rem; padding:10px;">No approved bookings found.</p>' : 
            approved.slice(0, 3).map(b => `
                <div class="experiment-card">
                    <strong>${escapeHtml(b.equipment_name)}</strong>
                    <br><small><i class="fas fa-clock"></i> ${new Date(b.start_time).toLocaleString()} to ${new Date(b.end_time).toLocaleTimeString()}</small>
                    <br><small class="status-badge status-${b.status}">${b.status}</small>
                </div>
            `).join('');
    }
}

function renderEquipmentStates() {
    const container = document.getElementById('quickEquipment');
    if (container) {
        const availableCount = equipmentList.filter(e => e.status === 'available').length;
        const inuseCount = equipmentList.filter(e => e.status === 'inuse').length;
        const maintenanceCount = equipmentList.filter(e => e.status === 'maintenance').length;
        
        if (equipmentList.length === 0) {
            container.innerHTML = '<p style="color:#666; padding:10px;">No equipment found in database. Please contact administrator.</p>';
            return;
        }
        
        container.innerHTML = `
            <div style="margin-bottom: 10px; padding: 8px; background: #f3f4f6; border-radius: 8px;">
                <small>📊 Summary: ${availableCount} Available | ${inuseCount} In Use | ${maintenanceCount} Maintenance</small>
            </div>
            ${equipmentList.slice(0, 5).map(e => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding: 8px 0; border-bottom:1px solid #eee;">
                    <span style="font-size:0.9rem;">${escapeHtml(e.name)}</span>
                    <span class="status-badge status-${e.status}">${e.status}</span>
                </div>
            `).join('')}
        `;
    }
    
    const damageSelect = document.getElementById('damageEquipmentSelect');
    if (damageSelect) {
        if (equipmentList.length === 0) {
            damageSelect.innerHTML = '<option value="">No equipment available</option>';
        } else {
            damageSelect.innerHTML = equipmentList.map(eq => `<option value="${eq.id}">${escapeHtml(eq.name)} (${eq.status})</option>`).join('');
        }
    }
}

function renderBookingHistory() {
    const container = document.getElementById('myBookingsList');
    if (container) {
        if (myBookings.length === 0) {
            container.innerHTML = '<p style="padding:20px; text-align:center; color:#666;">No bookings found.</p>';
            return;
        }
        container.innerHTML = `
            <table style="width:100%">
                <thead>
                    <tr>
                        <th>Equipment</th>
                        <th>Date</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${myBookings.slice(0, 5).map(b => `
                        <tr>
                            <td><strong>${escapeHtml(b.equipment_name)}</strong></td>
                            <td><small>${new Date(b.start_time).toLocaleDateString()}</small></td>
                            <td><span class="status-badge status-${b.status}">${b.status}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
}

function renderExperimentManager() {
    const approvedBookings = myBookings.filter(b => b.status === "approved");
    const expSelect = document.getElementById('expBookingSelect');
    if (expSelect) {
        if (approvedBookings.length === 0) {
            expSelect.innerHTML = '<option value="">No approved bookings available</option>';
        } else {
            expSelect.innerHTML = approvedBookings.map(b => `<option value="${b.id}">${escapeHtml(b.equipment_name)} (${new Date(b.start_time).toLocaleDateString()})</option>`).join('');
        }
    }
    
    const uploadSelect = document.getElementById('uploadExpSelect');
    if (uploadSelect) {
        if (myExperiments.length === 0) {
            uploadSelect.innerHTML = '<option value="">No experiments available</option>';
        } else {
            uploadSelect.innerHTML = myExperiments.map(e => `<option value="${e.id}">${escapeHtml(e.title || 'Experiment')} (${e.progress}%)</option>`).join('');
        }
    }
    
    const activeExps = myExperiments.filter(e => e.status === "active");
    const container = document.getElementById('pastResults');
    if (container) {
        container.innerHTML = activeExps.length === 0 ? 
            '<p style="color:#666; font-size:0.9rem; padding:10px;">No active logs tracked currently.</p>' : 
            activeExps.map(e => `
                <div class="experiment-card">
                    <strong>${escapeHtml(e.title || 'Experiment')}</strong><br>
                    <small>Equipment: ${escapeHtml(e.equipment_name || 'N/A')}</small>
                    <div style="background:#e5e7eb; height:6px; border-radius:3px; margin:8px 0;">
                        <div style="background:#3b82f6; width:${e.progress}%; height:100%; border-radius:3px;"></div>
                    </div>
                    <small>Progress: ${e.progress}%</small>
                </div>
            `).join('');
    }
}

function renderUploadedResultsTable() {
    const container = document.getElementById('uploadedResultsTable');
    if (container) {
        if (uploadedResults.length === 0) {
            container.innerHTML = '<p style="padding:20px; text-align:center; color:#666;">No uploaded results found.</p>';
            return;
        }
        container.innerHTML = `
            <table style="width:100%">
                <thead>
                    <tr>
                        <th>Experiment</th>
                        <th>File</th>
                        <th>Upload Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${uploadedResults.slice(0, 5).map(r => `
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

function renderSOPCatalog() {
    const container = document.getElementById('sopList');
    if (container) {
        if (!sopDocuments || sopDocuments.length === 0) {
            container.innerHTML = '<p style="padding:20px; text-align:center; color:#666;">No SOP documents available.</p>';
            return;
        }
        container.innerHTML = sopDocuments.map(s => `
            <div class="equipment-card">
                <strong><i class="fas fa-file-alt"></i> ${escapeHtml(s.title)}</strong>
                ${s.equipment_name ? `<p style="font-size:0.8rem; color:#3b82f6; margin:6px 0;"><i class="fas fa-microscope"></i> Equipment: ${escapeHtml(s.equipment_name)}</p>` : ''}
                <p style="font-size:0.75rem; color:#888; margin:4px 0;">Type: ${escapeHtml(s.document_type || 'SOP')}</p>
                ${s.description ? `<p style="font-size:0.75rem; color:#666; margin:6px 0;">${escapeHtml(s.description)}</p>` : ''}
                <button class="btn btn-edit" style="width:100%; margin-top:8px;" onclick="downloadSOP(${s.id})">
                    <i class="fas fa-download"></i> Download Document
                </button>
            </div>
        `).join('');
    }
}

function renderDamageReportsTable() {
    const container = document.getElementById('reportedDamageTable');
    if (container) {
        if (reportedDamage.length === 0) {
            container.innerHTML = '<p style="padding:20px; text-align:center; color:#666;">No damage reports filed.</p>';
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
                    ${reportedDamage.slice(0, 5).map(d => `
                        <tr>
                            <td><strong>${escapeHtml(d.equipment_name)}</strong><br><small>${escapeHtml(d.description)}</small></td>
                            <td><span class="status-badge status-maintenance">${d.severity}</span></td>
                            <td>${new Date(d.reported_at).toLocaleDateString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
}

// ========== CHAT FUNCTIONALITY - FULL TWO-WAY ==========

async function loadMessages() {
    try {
        const response = await fetch(`${API_URL}/researcher/messages`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success && data.messages) {
            chatMessages = data.messages;
            renderChatWidget();
            updateUnreadBadge();
        }
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

async function sendMessage() {
    const inp = document.getElementById('chatInput');
    const message = inp ? inp.value.trim() : '';
    
    if (!message) {
        triggerToast('Please enter a message', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/researcher/messages`, {
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

async function markMessagesAsRead() {
    try {
        await fetch(`${API_URL}/researcher/messages/mark-read`, {
            method: 'PUT',
            headers: getAuthHeaders()
        });
    } catch (error) {
        console.error('Error marking messages as read:', error);
    }
}

async function updateUnreadBadge() {
    try {
        const response = await fetch(`${API_URL}/researcher/messages/unread-count`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success && data.count > 0) {
            const chatToggle = document.querySelector('.chat-toggle');
            if (chatToggle) {
                let badge = chatToggle.querySelector('.unread-badge');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'unread-badge';
                    badge.style.cssText = 'position:absolute; top:-5px; right:-5px; background:#ef4444; color:white; border-radius:50%; width:20px; height:20px; font-size:12px; display:flex; align-items:center; justify-content:center;';
                    chatToggle.style.position = 'relative';
                    chatToggle.appendChild(badge);
                }
                badge.textContent = data.count > 99 ? '99+' : data.count;
                badge.style.display = 'flex';
            }
        } else {
            const badge = document.querySelector('.chat-toggle .unread-badge');
            if (badge) badge.style.display = 'none';
        }
    } catch (error) {
        console.error('Error getting unread count:', error);
    }
}

function renderChatWidget() {
    const container = document.getElementById('chatMessages');
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const currentUserId = currentUser.id;
    
    if (container) {
        if (!chatMessages || chatMessages.length === 0) {
            container.innerHTML = '<div class="msg-rcv" style="text-align:center; opacity:0.7;">No messages yet. Start a conversation with your supervisor!</div>';
            return;
        }
        
        container.innerHTML = chatMessages.map(m => {
            const isOwnMessage = m.sender_id === currentUserId;
            const senderName = isOwnMessage ? 'You' : m.sender_name;
            const senderRole = isOwnMessage ? currentUser.role || 'Researcher' : m.sender_role;
            
            return `
                <div class="msg-bubble ${isOwnMessage ? 'msg-sent' : 'msg-rcv'}">
                    <small style="display:block; font-size:0.7rem; opacity:0.8;">
                        <strong>${escapeHtml(senderName)}</strong> (${escapeHtml(senderRole)})
                    </small>
                    <div style="margin: 4px 0;">${escapeHtml(m.message)}</div>
                    <small style="display:block; font-size:0.6rem; opacity:0.6; text-align:right;">
                        ${new Date(m.created_at).toLocaleString()}
                        ${!m.is_read && !isOwnMessage ? ' • Unread' : ''}
                    </small>
                </div>
            `;
        }).join('');
        container.scrollTop = container.scrollHeight;
        
        // Mark messages as read when chat is open
        if (container.offsetParent !== null) {
            markMessagesAsRead();
            const badge = document.querySelector('.chat-toggle .unread-badge');
            if (badge) badge.style.display = 'none';
        }
    }
}

function toggleChat() {
    const win = document.getElementById('chatWindow');
    if (win) {
        const isVisible = win.style.display === 'flex';
        win.style.display = isVisible ? 'none' : 'flex';
        if (!isVisible) {
            loadMessages();
        } else {
            markMessagesAsRead();
            const badge = document.querySelector('.chat-toggle .unread-badge');
            if (badge) badge.style.display = 'none';
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
function initViewRouter() {
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
                dashboard: 'Researcher Overview', 
                booking: 'Book Lab Equipment', 
                experiments: 'My Experiments Tracker', 
                'upload-results': 'Upload My Results Archive',
                sop: 'SOP & Safety Protocols',
                'damage-report': 'Equipment Damage Statements'
            };
            const pageTitle = document.getElementById('pageTitle');
            if (pageTitle) pageTitle.innerText = titles[targetSection] || 'Workspace';

            if (window.innerWidth <= 992) closeMobileSidebar();
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

function initMobileNavigation() {
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
        overlay.addEventListener("click", closeMobileSidebar);
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

function closeMobileSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    if (sidebar) sidebar.classList.remove("open");
    if (overlay) overlay.classList.remove("open");
}

function initDateDefaults() {
    let now = new Date();
    let tomorrow = new Date(now.getTime() + 24 * 3600000);
    const startInput = document.getElementById('bookingStart');
    const endInput = document.getElementById('bookingEnd');
    if (startInput) startInput.value = now.toISOString().slice(0, 16);
    if (endInput) endInput.value = tomorrow.toISOString().slice(0, 16);
}

// Form event listeners
function bindFormEvents() {
    const bookingForm = document.getElementById('bookingForm');
    if (bookingForm) {
        bookingForm.removeEventListener('submit', submitBooking);
        bookingForm.addEventListener('submit', submitBooking);
    }
    
    const experimentForm = document.getElementById('experimentForm');
    if (experimentForm) {
        experimentForm.removeEventListener('submit', submitExperiment);
        experimentForm.addEventListener('submit', submitExperiment);
    }
    
    const resultUploadForm = document.getElementById('resultUploadForm');
    if (resultUploadForm) {
        resultUploadForm.removeEventListener('submit', handleResultUpload);
        resultUploadForm.addEventListener('submit', handleResultUpload);
    }
    
    const damageReportForm = document.getElementById('damageReportForm');
    if (damageReportForm) {
        damageReportForm.removeEventListener('submit', handleDamageReport);
        damageReportForm.addEventListener('submit', handleDamageReport);
    }
}

// Form submission handlers
async function submitBooking(e) {
    e.preventDefault();
    console.log('Submitting booking...');
    
    const equipmentId = document.getElementById('bookingEquipment').value;
    const start = document.getElementById('bookingStart').value;
    const end = document.getElementById('bookingEnd').value;
    const plan = document.getElementById('bookingPlan').value;
    
    if (!equipmentId || !start || !end) {
        triggerToast("Please fill all fields", 'error');
        return;
    }
    
    if (new Date(start) >= new Date(end)) {
        triggerToast("End time must be after start time", 'error');
        return;
    }
    
    const selectedEq = filteredEquipmentList.find(eq => eq.id == equipmentId);
    if (selectedEq && selectedEq.status === 'maintenance') {
        triggerToast("This equipment is under maintenance and cannot be booked.", 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/researcher/bookings`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                equipment_id: parseInt(equipmentId),
                start_time: start,
                end_time: end,
                purpose: plan || 'Research purpose'
            })
        });
        const data = await response.json();
        
        if (data.success) {
            triggerToast("Booking request submitted successfully!", 'success');
            document.getElementById('bookingForm').reset();
            initDateDefaults();
            await loadMyBookings();
            renderAllModules();
        } else {
            triggerToast(data.message || 'Failed to submit booking', 'error');
        }
    } catch (error) {
        console.error('Error submitting booking:', error);
        triggerToast('Error submitting booking. Please try again.', 'error');
    }
}

async function submitExperiment(e) {
    e.preventDefault();
    console.log('Submitting experiment...');
    
    const bookingId = document.getElementById('expBookingSelect').value;
    const notes = document.getElementById('expNotes').value;
    const progress = parseInt(document.getElementById('expProgress').value);
    
    if (!bookingId) {
        triggerToast("Please select a booking", 'error');
        return;
    }
    
    const booking = myBookings.find(b => b.id == bookingId);
    const title = booking ? `Experiment with ${booking.equipment_name}` : 'Research Experiment';
    
    try {
        const response = await fetch(`${API_URL}/researcher/experiments`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                booking_id: parseInt(bookingId),
                title: title,
                equipment_used: booking?.equipment_name || 'Unknown',
                progress: progress,
                notes: notes
            })
        });
        const data = await response.json();
        
        if (data.success) {
            triggerToast(`Experiment progress updated to ${progress}%`, 'success');
            document.getElementById('experimentForm').reset();
            await loadMyExperiments();
            renderAllModules();
        } else {
            triggerToast(data.message || 'Failed to save experiment', 'error');
        }
    } catch (error) {
        console.error('Error saving experiment:', error);
        triggerToast('Error saving experiment. Please try again.', 'error');
    }
}

async function handleResultUpload(e) {
    e.preventDefault();
    console.log('Uploading result...');
    
    const experimentId = document.getElementById('uploadExpSelect').value;
    const title = document.getElementById('resultTitle').value;
    const conclusion = document.getElementById('resultConclusion').value;
    const fileInput = document.getElementById('resultFile');
    
    if (!experimentId) {
        triggerToast("Please select an experiment", 'error');
        return;
    }
    
    if (!title) {
        triggerToast("Please enter a dataset title", 'error');
        return;
    }
    
    if (!fileInput.files[0]) {
        triggerToast("Please select a file to upload", 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('experiment_id', experimentId);
    formData.append('title', title);
    formData.append('conclusion', conclusion);
    formData.append('resultFile', fileInput.files[0]);
    
    try {
        const response = await fetch(`${API_URL}/researcher/upload-result`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: formData
        });
        const data = await response.json();
        
        if (data.success) {
            triggerToast("Results uploaded successfully!", 'success');
            document.getElementById('resultUploadForm').reset();
            await loadMyResults();
            renderAllModules();
        } else {
            triggerToast(data.message || 'Failed to upload results', 'error');
        }
    } catch (error) {
        console.error('Error uploading results:', error);
        triggerToast('Error uploading results. Please try again.', 'error');
    }
}

async function handleDamageReport(e) {
    e.preventDefault();
    console.log('Submitting damage report...');
    
    const equipmentId = document.getElementById('damageEquipmentSelect').value;
    const severity = document.getElementById('damageSeverity').value;
    const description = document.getElementById('damageDescription').value;
    
    if (!equipmentId) {
        triggerToast("Please select equipment", 'error');
        return;
    }
    
    if (!description) {
        triggerToast("Please provide a description of the issue", 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/researcher/damage-reports`, {
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
            triggerToast("Damage report filed successfully!", 'success');
            document.getElementById('damageReportForm').reset();
            await loadMyDamageReports();
            renderAllModules();
        } else {
            triggerToast(data.message || 'Failed to submit damage report', 'error');
        }
    } catch (error) {
        console.error('Error submitting report:', error);
        triggerToast('Error submitting damage report. Please try again.', 'error');
    }
}

// Make functions global
window.downloadSOP = downloadSOP;
window.sendMessage = sendMessage;
window.toggleChat = toggleChat;

// Initialize
document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM loaded, initializing researcher dashboard...");
    
    if (!checkAuth()) return;
    
    initViewRouter();
    initMobileNavigation();
    initDateDefaults();
    setupFilterButtons();
    bindFormEvents();
    loadAllData();
    
    // Refresh messages every 5 seconds when chat is open
    setInterval(() => {
        if (document.getElementById('chatWindow')?.style.display === 'flex') {
            loadMessages();
        }
        updateUnreadBadge();
    }, 5000);
    
    renderChatWidget();
});