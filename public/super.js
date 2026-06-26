// API Base URL
const API_URL = 'http://localhost:5000/api';

let equipmentData = [];
let bookingsData = [];
let experimentsData = [];
let sopDocuments = [];
let chatMessages = [];
let messageInterval = null;
let usersList = [];

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
    if (user.role !== 'supervisor' && user.role !== 'admin') {
        window.location.href = '/';
        return false;
    }
    const userNameSpan = document.getElementById('userName');
    if (userNameSpan) {
        userNameSpan.innerText = user.name || user.full_name || 'Supervisor';
    }
    return true;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
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

async function loadStats() {
    try {
        const response = await fetch(`${API_URL}/supervisor/stats`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('statsGrid').innerHTML = `
                <div class="stat-card"><div><h3>Pending Requests</h3><div class="stat-number">${data.stats.pendingBookings}</div></div><div class="stat-icon"><i class="fas fa-clock"></i></div></div>
                <div class="stat-card"><div><h3>Active Experiments</h3><div class="stat-number">${data.stats.activeExperiments}</div></div><div class="stat-icon"><i class="fas fa-chart-line"></i></div></div>
                <div class="stat-card"><div><h3>Available Gears</h3><div class="stat-number">${data.stats.availableEquipment}</div></div><div class="stat-icon"><i class="fas fa-microscope"></i></div></div>
            `;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadBookings(filter = 'all') {
    try {
        const response = await fetch(`${API_URL}/supervisor/bookings?status=${filter}`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success) {
            bookingsData = data.bookings;
            renderBookingRequests(filter);
        }
    } catch (error) {
        console.error('Error loading bookings:', error);
    }
}

function renderBookingRequests(filter) {
    let filtered = bookingsData;
    if (filter !== 'all') {
        filtered = bookingsData.filter(b => b.status === filter);
    }
    
    const container = document.getElementById('allRequests');
    if (container) {
        container.innerHTML = filtered.length === 0 ? 
            '<p style="padding: 20px; text-align: center; color: #666;">No requests matching criteria.</p>' : 
            filtered.map(b => `
                <div class="booking-request" style="border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 15px; padding: 15px;">
                    <div class="request-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <strong>${escapeHtml(b.equipment_name)}</strong>
                        <span class="status-badge status-${b.status}">${b.status}</span>
                    </div>
                    <p><strong>User:</strong> ${escapeHtml(b.user_name)} | <strong>Time:</strong> ${new Date(b.start_time).toLocaleString()} to ${new Date(b.end_time).toLocaleString()}</p>
                    <p><strong>Purpose:</strong> ${escapeHtml(b.purpose || 'N/A')}</p>
                    ${b.status === 'pending' ? `
                        <div class="request-actions" style="margin-top: 10px; display: flex; gap: 10px;">
                            <button class="btn btn-approve" onclick="updateBookingStatus(${b.id}, 'approved')">Approve</button>
                            <button class="btn btn-reject" onclick="updateBookingStatus(${b.id}, 'rejected')">Reject</button>
                        </div>
                    ` : ''}
                </div>
            `).join('');
    }
    
    const pending = bookingsData.filter(b => b.status === 'pending');
    const previewContainer = document.getElementById('pendingRequestsPreview');
    if (previewContainer) {
        previewContainer.innerHTML = pending.length === 0 ? 
            '<p style="color:#666; padding: 10px;">No pending approvals.</p>' : 
            pending.slice(0, 3).map(b => `
                <div class="booking-request" style="border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 10px; padding: 12px;">
                    <div class="request-header" style="display: flex; justify-content: space-between;">
                        <strong>${escapeHtml(b.equipment_name)}</strong>
                        <span>${new Date(b.start_time).toLocaleDateString()}</span>
                    </div>
                    <p style="margin: 5px 0;">${escapeHtml(b.user_name)} - ${escapeHtml(b.purpose || 'No purpose')}</p>
                    <div class="request-actions" style="margin-top: 8px; display: flex; gap: 8px;">
                        <button class="btn btn-approve" onclick="updateBookingStatus(${b.id}, 'approved')">Approve</button>
                        <button class="btn btn-reject" onclick="updateBookingStatus(${b.id}, 'rejected')">Reject</button>
                    </div>
                </div>
            `).join('');
    }
    
    const today = new Date().toISOString().slice(0, 10);
    const todaysBookings = bookingsData.filter(b => b.status === 'approved' && b.start_time.startsWith(today));
    const scheduleContainer = document.getElementById('todaySchedule');
    if (scheduleContainer) {
        scheduleContainer.innerHTML = todaysBookings.length === 0 ? 
            '<p style="color:#666; padding: 10px;">No tasks scheduled today.</p>' : 
            todaysBookings.map(b => `
                <div class="experiment-card" style="border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 8px; padding: 10px;">
                    <strong>${escapeHtml(b.equipment_name)}</strong> (${new Date(b.start_time).toLocaleTimeString()} - ${new Date(b.end_time).toLocaleTimeString()})<br>
                    <small>User: ${escapeHtml(b.user_name)}</small>
                </div>
            `).join('');
    }
}

async function updateBookingStatus(id, status) {
    try {
        const response = await fetch(`${API_URL}/supervisor/bookings/${id}/status`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status })
        });
        const data = await response.json();
        
        if (data.success) {
            triggerToast(`Booking ${status} successfully!`, 'success');
            loadBookings(document.getElementById('requestFilter')?.value || 'all');
            loadStats();
            loadEquipment();
        } else {
            triggerToast(data.message, 'error');
        }
    } catch (error) {
        triggerToast('Error updating booking', 'error');
    }
}

async function loadEquipment() {
    try {
        const response = await fetch(`${API_URL}/supervisor/equipment`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success) {
            equipmentData = data.equipment;
            const gridContainer = document.getElementById('equipmentGrid');
            if (gridContainer) {
                gridContainer.innerHTML = equipmentData.map(e => `
                    <div class="equipment-card" style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px;">
                        <div class="equipment-header" style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                            <strong>${escapeHtml(e.name)}</strong>
                            <span class="status-badge status-${e.status}">${e.status}</span>
                        </div>
                        <p style="font-size:0.85rem; color:#666; margin-bottom:10px;">
                            <i class="fas fa-map-marker-alt"></i> ${escapeHtml(e.location || 'Lab')}
                            ${e.category ? `<br><i class="fas fa-tag"></i> ${escapeHtml(e.category)}` : ''}
                        </p>
                        <select onchange="updateEquipmentStatus(${e.id}, this.value)" style="width:100%; padding:6px; border-radius:4px; border:1px solid #ddd;">
                            <option value="available" ${e.status === 'available' ? 'selected' : ''}>✓ Available</option>
                            <option value="inuse" ${e.status === 'inuse' ? 'selected' : ''}>⚡ In Use</option>
                            <option value="maintenance" ${e.status === 'maintenance' ? 'selected' : ''}>🔧 Maintenance</option>
                        </select>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading equipment:', error);
    }
}

async function updateEquipmentStatus(id, status) {
    try {
        const response = await fetch(`${API_URL}/supervisor/equipment/${id}/status`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status })
        });
        const data = await response.json();
        
        if (data.success) {
            triggerToast(`Equipment status updated to ${status}`, 'success');
            loadEquipment();
            loadStats();
        } else {
            triggerToast(data.message, 'error');
        }
    } catch (error) {
        triggerToast('Error updating status', 'error');
    }
}

async function loadExperiments() {
    try {
        const response = await fetch(`${API_URL}/supervisor/experiments`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success) {
            experimentsData = data.experiments;
            const active = experimentsData.filter(e => e.status === 'active');
            const completed = experimentsData.filter(e => e.status === 'completed');
            
            const activeContainer = document.getElementById('activeExperiments');
            if (activeContainer) {
                activeContainer.innerHTML = active.length === 0 ? 
                    '<p style="padding: 20px; text-align: center; color: #666;">No currently active tracking sessions.</p>' : 
                    active.map(e => `
                        <div class="experiment-card" style="border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 12px; padding: 15px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <strong>${escapeHtml(e.title || e.equipment_name || 'Experiment')}</strong>
                                <span>${escapeHtml(e.researcher_name)}</span>
                            </div>
                            <div class="experiment-progress" style="margin: 10px 0;">
                                <div style="height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden;">
                                    <div class="progress-bar" style="width: ${e.progress || 0}%; height: 100%; background: #10b981;"></div>
                                </div>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-size:0.85rem;">Progress: ${e.progress || 0}%</span>
                                <button class="btn btn-edit" onclick="openVerifyModal(${e.id})">Verify Progress</button>
                            </div>
                            ${e.notes ? `<p style="margin-top: 10px; font-size:0.85rem; color:#666;"><i class="fas fa-sticky-note"></i> ${escapeHtml(e.notes)}</p>` : ''}
                        </div>
                    `).join('');
            }
            
            const completedContainer = document.getElementById('completedExperiments');
            if (completedContainer) {
                completedContainer.innerHTML = completed.length === 0 ? 
                    '<p style="padding: 20px; text-align: center; color: #666;">No completed experiments.</p>' : 
                    completed.map(e => `
                        <div class="experiment-card" style="border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 8px; padding: 12px;">
                            <strong>${escapeHtml(e.title || e.equipment_name || 'Experiment')}</strong> - ${escapeHtml(e.researcher_name)}<br>
                            <small>Completed: ${e.completed_at ? new Date(e.completed_at).toLocaleDateString() : 'N/A'}</small>
                        </div>
                    `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading experiments:', error);
    }
}

function openVerifyModal(expId) {
    document.getElementById('verifyExpId').value = expId;
    openModal('verifyModal');
}

async function confirmVerification() {
    const id = parseInt(document.getElementById('verifyExpId').value);
    const notes = document.getElementById('verifyNotes').value;
    
    try {
        const response = await fetch(`${API_URL}/supervisor/experiments/${id}/progress`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ progress: 100, notes: notes })
        });
        const data = await response.json();
        
        if (data.success) {
            closeModal('verifyModal');
            document.getElementById('verifyNotes').value = '';
            triggerToast("Experiment verified successfully!", 'success');
            loadExperiments();
            loadStats();
        } else {
            triggerToast(data.message, 'error');
        }
    } catch (error) {
        triggerToast('Error verifying experiment', 'error');
    }
}

async function loadEquipmentForSOP() {
    try {
        const response = await fetch(`${API_URL}/supervisor/equipment`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success && data.equipment) {
            const select = document.getElementById('sopEquipmentId');
            if (select) {
                select.innerHTML = '<option value="">All Equipment (General SOP)</option>' + 
                    data.equipment.map(eq => `<option value="${eq.id}">${escapeHtml(eq.name)} (${eq.status})</option>`).join('');
            }
        }
    } catch (error) {
        console.error('Error loading equipment for SOP:', error);
    }
}

async function loadSOP() {
    try {
        const response = await fetch(`${API_URL}/supervisor/sop`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success && data.sopDocs) {
            sopDocuments = data.sopDocs;
            const container = document.getElementById('sopDocuments');
            if (container) {
                container.innerHTML = sopDocuments.map(d => `
                    <div class="equipment-card" style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px;">
                        <strong><i class="fas fa-file-alt"></i> ${escapeHtml(d.title)}</strong>
                        <p style="font-size:0.85rem; margin: 8px 0; color: #666;">
                            ${d.equipment_name ? `Equipment: ${escapeHtml(d.equipment_name)}<br>` : ''}
                            Type: ${escapeHtml(d.document_type || 'SOP')}
                        </p>
                        ${d.description ? `<p style="font-size:0.8rem; color:#666;">${escapeHtml(d.description)}</p>` : ''}
                        <button class="btn btn-edit" style="width:100%; margin-top:8px;" onclick="downloadSOP(${d.id})">
                            <i class="fas fa-download"></i> Download
                        </button>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading SOP:', error);
    }
}

async function downloadSOP(id) {
    try {
        triggerToast('Downloading document...', 'info');
        const response = await fetch(`${API_URL}/supervisor/sop/${id}/download`, {
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
        triggerToast('Error downloading SOP', 'error');
    }
}

async function uploadSOP() {
    const title = document.getElementById('sopTitle').value;
    const equipment_id = document.getElementById('sopEquipmentId').value;
    const document_type = document.getElementById('sopType').value;
    const description = document.getElementById('sopDescription').value;
    const fileInput = document.getElementById('sopFile');
    
    if (!title) {
        triggerToast("Please enter a document title", 'error');
        return;
    }
    
    if (!fileInput.files[0]) {
        triggerToast("Please select a file to upload", 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('title', title);
    formData.append('equipment_id', equipment_id || '');
    formData.append('document_type', document_type);
    formData.append('description', description);
    formData.append('sopFile', fileInput.files[0]);
    
    try {
        const response = await fetch(`${API_URL}/supervisor/sop`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: formData
        });
        const data = await response.json();
        
        if (data.success) {
            triggerToast("SOP uploaded successfully!", 'success');
            closeModal('sopModal');
            document.getElementById('sopTitle').value = '';
            document.getElementById('sopDescription').value = '';
            document.getElementById('sopEquipmentId').value = '';
            document.getElementById('sopFile').value = '';
            await loadSOP();
        } else {
            triggerToast(data.message || 'Error uploading SOP', 'error');
        }
    } catch (error) {
        console.error('Error uploading SOP:', error);
        triggerToast('Error uploading SOP document', 'error');
    }
}

async function loadEquipmentForDamage() {
    try {
        const response = await fetch(`${API_URL}/supervisor/equipment`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success && data.equipment) {
            const select = document.getElementById('damageEquipment');
            const hint = document.getElementById('equipmentStatusHint');
            
            if (select) {
                select.innerHTML = '<option value="">-- Select Equipment --</option>' + 
                    data.equipment.map(eq => 
                        `<option value="${eq.id}" data-status="${eq.status}" data-name="${escapeHtml(eq.name)}">
                            ${escapeHtml(eq.name)} - [${eq.status.toUpperCase()}]
                        </option>`
                    ).join('');
                
                select.onchange = function() {
                    const selectedOption = this.options[this.selectedIndex];
                    const status = selectedOption.getAttribute('data-status');
                    const name = selectedOption.getAttribute('data-name');
                    
                    if (hint && status && name) {
                        hint.className = `equipment-status-hint ${status}`;
                        if (status === 'maintenance') {
                            hint.innerHTML = `<i class="fas fa-tools"></i> Warning: ${name} is currently under MAINTENANCE. Please verify the issue.`;
                        } else if (status === 'inuse') {
                            hint.innerHTML = `<i class="fas fa-play"></i> Note: ${name} is currently IN USE. Check if the issue is related to current usage.`;
                        } else {
                            hint.innerHTML = `<i class="fas fa-check-circle"></i> ${name} is currently AVAILABLE. Report the issue clearly.`;
                        }
                    } else if (hint && !status) {
                        hint.innerHTML = '';
                        hint.className = 'equipment-status-hint';
                    }
                };
            }
        }
    } catch (error) {
        console.error('Error loading equipment for damage:', error);
    }
}

async function loadDamageReports() {
    try {
        const response = await fetch(`${API_URL}/supervisor/damage-reports`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success && data.reports) {
            const container = document.getElementById('damageReportsTable');
            if (container) {
                container.innerHTML = `
                    <table style="width:100%">
                        <thead>
                            <tr>
                                <th>Equipment</th>
                                <th>Severity</th>
                                <th>Reported By</th>
                                <th>Status</th>
                                <th>Date</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.reports.map(r => `
                                <tr>
                                    <td><strong>${escapeHtml(r.equipment_name)}</strong><br><small style="color:#666;">Equipment Status: ${r.equipment_status || 'N/A'}</small></td>
                                    <td><span class="status-badge status-maintenance">${r.severity}</span></td>
                                    <td>${escapeHtml(r.reported_by_name)}</td>
                                    <td><span class="status-badge ${r.status === 'pending' ? 'status-pending' : 'status-approved'}">${r.status}</span></td>
                                    <td>${new Date(r.reported_at).toLocaleDateString()}</td>
                                    <td>
                                        ${r.status === 'pending' ? 
                                            `<button class="btn btn-approve" onclick="resolveDamageReport(${r.id})">Mark Resolved</button>` : 
                                            '<span class="status-badge status-approved">Resolved</span>'
                                        }
                                     </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            }
        }
    } catch (error) {
        console.error('Error loading damage reports:', error);
    }
}

async function resolveDamageReport(id) {
    if (!confirm('Mark this damage report as resolved? This will update the equipment status back to available.')) return;
    
    try {
        const response = await fetch(`${API_URL}/supervisor/damage-reports/${id}/status`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status: 'resolved' })
        });
        const data = await response.json();
        
        if (data.success) {
            triggerToast('Damage report marked as resolved!', 'success');
            await loadDamageReports();
            await loadEquipment();
            await loadStats();
        } else {
            triggerToast(data.message, 'error');
        }
    } catch (error) {
        triggerToast('Error updating report', 'error');
    }
}

async function submitDamageReport() {
    const equipmentId = document.getElementById('damageEquipment').value;
    const severity = document.getElementById('damageSeverity').value;
    const description = document.getElementById('damageDescription').value;
    const reporter = document.getElementById('damageReporter').value;
    
    if (!equipmentId || !description || !reporter) {
        triggerToast("Please fill in all fields and select equipment", 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/supervisor/damage-reports`, {
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
            triggerToast("Damage report submitted successfully!", 'success');
            closeModal('damageModal');
            document.getElementById('damageEquipment').value = '';
            document.getElementById('damageDescription').value = '';
            document.getElementById('damageReporter').value = '';
            const hint = document.getElementById('equipmentStatusHint');
            if (hint) {
                hint.innerHTML = '';
                hint.className = 'equipment-status-hint';
            }
            await loadDamageReports();
            await loadEquipment();
            await loadStats();
        } else {
            triggerToast(data.message, 'error');
        }
    } catch (error) {
        console.error('Error submitting damage report:', error);
        triggerToast('Error submitting damage report', 'error');
    }
}

// Load users for chat recipient selection
async function loadUsersForChat() {
    try {
        const response = await fetch(`${API_URL}/supervisor/users`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success && data.users) {
            usersList = data.users;
            const select = document.getElementById('chatReceiverSelect');
            if (select) {
                select.innerHTML = `
                    <option value="">👥 All Users (Broadcast)</option>
                    ${usersList.map(user => `
                        <option value="${user.id}">📝 ${escapeHtml(user.full_name)} (${escapeHtml(user.role)})</option>
                    `).join('')}
                `;
            }
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Enhanced Chat functionality
async function loadMessages() {
    try {
        const response = await fetch(`${API_URL}/supervisor/messages`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success && data.messages) {
            chatMessages = data.messages;
            renderChatDisplay();
            await updateUnreadBadge();
        }
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

async function sendMessage() {
    const inp = document.getElementById('chatInput');
    const message = inp ? inp.value.trim() : '';
    const receiverSelect = document.getElementById('chatReceiverSelect');
    const receiverId = receiverSelect ? receiverSelect.value : '';
    
    if (!message) {
        triggerToast('Please enter a message', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/supervisor/messages`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ 
                receiver_id: receiverId || null,
                message: message 
            })
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
        triggerToast('Error sending message', 'error');
    }
}

async function markMessagesAsRead() {
    try {
        await fetch(`${API_URL}/supervisor/messages/mark-read`, {
            method: 'PUT',
            headers: getAuthHeaders()
        });
    } catch (error) {
        console.error('Error marking messages as read:', error);
    }
}

async function updateUnreadBadge() {
    try {
        const response = await fetch(`${API_URL}/supervisor/messages/unread-count`, {
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

function renderChatDisplay() {
    const container = document.getElementById('chatMessages');
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const currentUserId = currentUser.id;
    
    if (container) {
        if (!chatMessages || chatMessages.length === 0) {
            container.innerHTML = '<div class="msg-rcv" style="text-align:center; opacity:0.7;">No messages yet. Select a recipient and start a conversation!</div>';
            return;
        }
        
        container.innerHTML = chatMessages.map(m => {
            const isOwnMessage = m.sender_id === currentUserId;
            const receiverInfo = m.receiver_name ? `<br><small style="font-size:0.6rem;">To: ${escapeHtml(m.receiver_name)}</small>` : '';
            
            return `
                <div class="msg-bubble ${isOwnMessage ? 'msg-sent' : 'msg-rcv'}">
                    <small style="display:block; font-size:0.7rem; opacity:0.8;">
                        <strong>${escapeHtml(m.sender_name)}</strong> (${escapeHtml(m.sender_role || 'User')})
                        ${!isOwnMessage && m.receiver_name !== currentUser.full_name ? receiverInfo : ''}
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

function filterRequests() {
    loadBookings(document.getElementById('requestFilter').value);
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

function openModal(id) { 
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'flex';
}

function closeModal(id) { 
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
}

async function autoUpdateEquipmentStatus() {
    try {
        const response = await fetch(`${API_URL}/supervisor/auto-update-equipment-status`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (data.success) {
            console.log('Equipment status auto-updated');
            loadEquipment();
            loadBookings(document.getElementById('requestFilter')?.value || 'all');
        }
    } catch (error) {
        console.error('Auto-update error:', error);
    }
}

function initViewRouter() {
    document.querySelectorAll(".nav-item").forEach(item => {
        item.addEventListener("click", () => {
            document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
            item.classList.add("active");

            const sectionTarget = item.getAttribute("data-section");
            document.querySelectorAll(".content-section").forEach(sec => sec.classList.remove("active-section"));
            
            const activeSection = document.getElementById(`${sectionTarget}Section`);
            if(activeSection) activeSection.classList.add("active-section");
            
            const titles = { 
                dashboard: 'Supervisor Dashboard', 
                requests: 'Booking Requests', 
                equipment: 'Equipment Status', 
                experiments: 'Track Experiments', 
                sop: 'SOP & Safety Documents', 
                damage: 'Damage Reports' 
            };
            const pageTitle = document.getElementById('pageTitle');
            if (pageTitle) pageTitle.innerText = titles[sectionTarget] || 'Dashboard';
            
            if (window.innerWidth <= 992) closeMobileSidebar();
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
    if (overlay) overlay.addEventListener("click", closeMobileSidebar);
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            if (confirm("Log out?")) logout();
        });
    }
}

function closeMobileSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    if (sidebar) sidebar.classList.remove("open");
    if (overlay) overlay.classList.remove("open");
}

document.addEventListener("click", function(e) {
    if (e.target.classList && e.target.classList.contains('btn-act')) {
        const dest = e.target.getAttribute("data-target");
        const sideItem = document.querySelector(`.nav-item[data-section="${dest}"]`);
        if (sideItem) sideItem.click();
    }
});

// Make functions global
window.updateBookingStatus = updateBookingStatus;
window.updateEquipmentStatus = updateEquipmentStatus;
window.openVerifyModal = openVerifyModal;
window.confirmVerification = confirmVerification;
window.downloadSOP = downloadSOP;
window.uploadSOP = uploadSOP;
window.resolveDamageReport = resolveDamageReport;
window.submitDamageReport = submitDamageReport;
window.sendMessage = sendMessage;
window.toggleChat = toggleChat;
window.filterRequests = filterRequests;
window.openModal = openModal;
window.closeModal = closeModal;

document.addEventListener("DOMContentLoaded", () => {
    if (!checkAuth()) return;
    
    initViewRouter();
    initMobileNavigation();
    
    loadStats();
    loadBookings('all');
    loadEquipment();
    loadExperiments();
    loadSOP();
    loadDamageReports();
    loadEquipmentForDamage();
    loadEquipmentForSOP();
    loadUsersForChat();
    loadMessages();
    
    setInterval(autoUpdateEquipmentStatus, 60000);
    
    setInterval(() => {
        if (document.getElementById('chatWindow')?.style.display === 'flex') {
            loadMessages();
        }
        updateUnreadBadge();
    }, 5000);
    
    renderChatDisplay();
});