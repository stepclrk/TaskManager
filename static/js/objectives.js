// Objectives management JavaScript
let allObjectives = [];
let filteredObjectives = [];
let objectiveQuillEditor = null;

document.addEventListener('DOMContentLoaded', function() {
    loadObjectives();
    setupEventListeners();
    initializeQuillEditor();
});

function initializeQuillEditor() {
    const container = document.getElementById('objectiveDescriptionEditor');
    if (!container) return;
    
    objectiveQuillEditor = new Quill('#objectiveDescriptionEditor', {
        theme: 'snow',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline', 'strike'],
                ['blockquote', 'code-block'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                [{ 'header': [1, 2, 3, false] }],
                ['link'],
                ['clean']
            ]
        },
        placeholder: 'Explain the importance and impact of this objective...'
    });
    
    // Store reference on the container
    container.__quill = objectiveQuillEditor;
}

function setupEventListeners() {
    // Modal controls
    const addBtn = document.getElementById('addObjectiveBtn');
    if (addBtn) {
        addBtn.addEventListener('click', () => openModal());
    }
    
    const closeBtn = document.querySelector('.close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    
    // Form submission
    const form = document.getElementById('objectiveForm');
    if (form) {
        form.addEventListener('submit', handleSubmit);
    }
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('objectiveModal');
        if (event.target === modal) {
            closeModal();
        }
    });
}

async function loadObjectives() {
    try {
        const response = await fetch('/api/topics');
        if (response.ok) {
            allObjectives = await response.json();
            await loadTaskCounts();
            applyFilters();
        }
    } catch (error) {
        console.error('Error loading objectives:', error);
    }
}

async function loadTaskCounts() {
    try {
        const response = await fetch('/api/tasks');
        if (response.ok) {
            const tasks = await response.json();
            
            // Count tasks for each objective
            allObjectives.forEach(objective => {
                const objectiveTasks = tasks.filter(task => task.project_id === objective.id);
                objective.task_count = objectiveTasks.length;
                objective.open_tasks = objectiveTasks.filter(t => t.status === 'Open').length;
                objective.completed_tasks = objectiveTasks.filter(t => t.status === 'Completed').length;
            });
        }
    } catch (error) {
        console.error('Error loading task counts:', error);
    }
}

function applyFilters() {
    // Since we don't have filters in the objectives page, just display all objectives
    filteredObjectives = allObjectives;
    
    // Sort by creation date by default
    filteredObjectives.sort((a, b) => {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
    
    renderObjectives();
}

function renderObjectives() {
    const grid = document.getElementById('objectivesContainer');
    
    if (!grid) {
        console.error('Objectives container not found');
        return;
    }
    
    if (filteredObjectives.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #999;">
                <h3>No objectives found</h3>
                <p>Create your first objective to organize your tasks</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = filteredObjectives.map(objective => {
        const statusClass = `status-${objective.status.toLowerCase().replace(' ', '-')}`;
        const targetDate = objective.target_date ? new Date(objective.target_date).toLocaleDateString() : 'No target date';
        const taskCount = objective.task_count || 0;
        const okrScore = Math.round((objective.okr_score || 0) * 100);
        const confidence = Math.round((objective.confidence || 0) * 100);
        const keyResultsCount = objective.key_results ? objective.key_results.length : 0;
        
        // Determine score color
        let scoreClass = 'score-low';
        if (okrScore >= 70) scoreClass = 'score-high';
        else if (okrScore >= 40) scoreClass = 'score-medium';
        
        // Type badge
        const typeClass = objective.objective_type === 'committed' ? 'type-committed' : 'type-aspirational';
        const typeLabel = objective.objective_type === 'committed' ? 'Committed' : 'Aspirational';
        
        return `
            <div class="objective-card" onclick="navigateToWorkspace('${objective.id}')">
                <div class="objective-header">
                    <h3 class="objective-title">${escapeHtml(objective.title)}</h3>
                    <span class="objective-status ${statusClass}">${objective.status}</span>
                </div>
                
                <div style="margin: 5px 0;">
                    <span class="objective-type-badge ${typeClass}">${typeLabel}</span>
                    <span style="margin-left: 10px; color: #666; font-size: 0.9em;">${objective.period || 'Q1'}</span>
                </div>
                
                <div class="objective-description">
                    ${escapeHtml(objective.description || 'No description')}
                </div>
                
                <div style="margin: 10px 0;">
                    <span class="okr-score ${scoreClass}">OKR Score: ${okrScore}%</span>
                    <span class="confidence-indicator" style="margin-left: 10px;">
                        🎯 Confidence: ${confidence}%
                    </span>
                </div>
                
                <div class="objective-meta">
                    <div class="objective-date">
                        📅 ${targetDate}
                    </div>
                    <div class="objective-stats">
                        <div class="stat-item">
                            <span class="stat-icon">🎯</span>
                            <span class="stat-count">${keyResultsCount} KRs</span>
                        </div>
                        <div class="stat-item" title="Tasks">
                            <span class="stat-icon">📋</span>
                            <span class="stat-count">${taskCount} Tasks</span>
                        </div>
                    </div>
                </div>
                
                <div style="position: absolute; top: 20px; right: 20px; display: flex; gap: 5px;">
                    <button class="btn btn-small" onclick="event.stopPropagation(); editObjective('${objective.id}')" 
                            style="padding: 5px 10px; font-size: 0.85em;">
                        Edit
                    </button>
                    <button class="btn btn-small btn-danger" onclick="event.stopPropagation(); deleteObjective('${objective.id}')" 
                            style="padding: 5px 10px; font-size: 0.85em; background: #e74c3c; color: white; border: none;">
                        Delete
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function navigateToWorkspace(objectiveId) {
    window.location.href = `/objectives/${objectiveId}`;
}

function openModal(objectiveId = null) {
    const modal = document.getElementById('objectiveModal');
    const modalTitle = document.getElementById('modalTitle');
    const form = document.getElementById('objectiveForm');
    
    // Clear key results
    document.getElementById('keyResultsList').innerHTML = '';
    
    if (objectiveId) {
        const objective = allObjectives.find(o => o.id === objectiveId);
        if (objective) {
            modalTitle.textContent = 'Edit Objective';
            document.getElementById('objectiveId').value = objective.id;
            document.getElementById('objectiveTitle').value = objective.title;
            
            // Set description in Quill editor
            const description = objective.description || '';
            document.getElementById('objectiveDescription').value = description;
            if (objectiveQuillEditor) {
                if (description.includes('<') && description.includes('>')) {
                    objectiveQuillEditor.root.innerHTML = description;
                } else {
                    objectiveQuillEditor.setText(description);
                }
            }
            
            document.getElementById('objectiveType').value = objective.objective_type || 'aspirational';
            document.getElementById('objectivePeriod').value = objective.period || 'Q1';
            document.getElementById('objectiveStatus').value = objective.status || 'Active';
            document.getElementById('objectiveTargetDate').value = objective.target_date || '';
            document.getElementById('objectiveConfidence').value = (objective.confidence || 0.5) * 100;
            document.getElementById('confidenceLabel').textContent = Math.round((objective.confidence || 0.5) * 100) + '%';
            document.getElementById('objectiveOwner').value = objective.owner || '';
            
            // Load key results
            if (objective.key_results && objective.key_results.length > 0) {
                objective.key_results.forEach(kr => {
                    const krList = document.getElementById('keyResultsList');
                    const krId = 'kr-' + Date.now() + Math.random();
                    
                    const krItem = document.createElement('div');
                    krItem.className = 'key-result-item';
                    krItem.id = krId;
                    krItem.dataset.krId = kr.id;
                    krItem.innerHTML = `
                        <button type="button" class="remove-kr-btn" onclick="removeKeyResult('${krId}')">Remove</button>
                        <input type="text" placeholder="Key Result title" class="kr-title" value="${escapeHtml(kr.title)}" required>
                        <div class="kr-metrics">
                            <div>
                                <label>Start Value</label>
                                <input type="number" placeholder="0" class="kr-start" value="${kr.start_value || 0}">
                            </div>
                            <div>
                                <label>Current Value</label>
                                <input type="number" placeholder="0" class="kr-current" value="${kr.current_value || 0}">
                            </div>
                            <div>
                                <label>Target Value</label>
                                <input type="number" placeholder="100" class="kr-target" value="${kr.target_value || 0}" required>
                            </div>
                        </div>
                    `;
                    
                    krList.appendChild(krItem);
                });
            }
        }
    } else {
        modalTitle.textContent = 'New Objective';
        form.reset();
        
        // Clear Quill editor
        if (objectiveQuillEditor) {
            objectiveQuillEditor.setText('');
        }
        
        document.getElementById('objectiveStatus').value = 'Active';
        document.getElementById('objectiveType').value = 'aspirational';
        document.getElementById('objectiveConfidence').value = 50;
        document.getElementById('confidenceLabel').textContent = '50%';
    }
    
    modal.style.display = 'block';
}

function closeModal() {
    const modal = document.getElementById('objectiveModal');
    modal.style.display = 'none';
    document.getElementById('objectiveForm').reset();
}

function editObjective(objectiveId) {
    openModal(objectiveId);
}

async function deleteObjective(objectiveId) {
    const objective = allObjectives.find(o => o.id === objectiveId);
    if (!objective) return;
    
    const confirmMessage = `Are you sure you want to delete the objective "${objective.title}"?\n\nThis will remove the objective and unlink it from any associated tasks.`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/topics/${objectiveId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            showNotification('Objective deleted successfully!', 'success');
            loadObjectives(); // Reload the objectives list
        } else {
            const error = await response.json();
            showNotification(error.error || 'Failed to delete objective', 'error');
        }
    } catch (error) {
        console.error('Error deleting objective:', error);
        showNotification('Failed to delete objective', 'error');
    }
}

async function handleSubmit(event) {
    event.preventDefault();
    
    const objectiveId = document.getElementById('objectiveId').value;
    
    // Collect key results
    const keyResults = [];
    const krItems = document.querySelectorAll('.key-result-item');
    krItems.forEach(item => {
        const title = item.querySelector('.kr-title').value;
        const startValue = parseFloat(item.querySelector('.kr-start').value) || 0;
        const currentValue = parseFloat(item.querySelector('.kr-current').value) || 0;
        const targetValue = parseFloat(item.querySelector('.kr-target').value) || 0;
        
        if (title && targetValue > 0) {
            const progress = targetValue > 0 ? (currentValue - startValue) / (targetValue - startValue) : 0;
            keyResults.push({
                id: item.dataset.krId || null,
                title: title,
                start_value: startValue,
                current_value: currentValue,
                target_value: targetValue,
                progress: Math.max(0, Math.min(1, progress)),
                status: progress >= 1 ? 'Completed' : progress > 0 ? 'In Progress' : 'Not Started'
            });
        }
    });
    
    // Calculate OKR score
    const okrScore = keyResults.length > 0 
        ? keyResults.reduce((sum, kr) => sum + kr.progress, 0) / keyResults.length 
        : 0;
    
    // Get rich text content from Quill
    let descriptionValue = '';
    if (objectiveQuillEditor) {
        descriptionValue = objectiveQuillEditor.root.innerHTML;
        // Update hidden textarea
        document.getElementById('objectiveDescription').value = descriptionValue;
    } else {
        descriptionValue = document.getElementById('objectiveDescription').value;
    }
    
    const objectiveData = {
        title: document.getElementById('objectiveTitle').value,
        description: descriptionValue,
        objective_type: document.getElementById('objectiveType').value,
        period: document.getElementById('objectivePeriod').value,
        status: document.getElementById('objectiveStatus').value,
        target_date: document.getElementById('objectiveTargetDate').value || null,
        confidence: parseFloat(document.getElementById('objectiveConfidence').value) / 100,
        owner: document.getElementById('objectiveOwner').value,
        key_results: keyResults,
        okr_score: okrScore
    };
    
    try {
        const url = objectiveId ? `/api/topics/${objectiveId}` : '/api/topics';
        const method = objectiveId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(objectiveData)
        });
        
        if (response.ok) {
            closeModal();
            loadObjectives();
            
            // Show success message
            const message = objectiveId ? 'Objective updated successfully!' : 'Objective created successfully!';
            showNotification(message, 'success');
        } else {
            const error = await response.json();
            showNotification(error.error || 'Failed to save objective', 'error');
        }
    } catch (error) {
        console.error('Error saving objective:', error);
        showNotification('Failed to save objective', 'error');
    }
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
        color: white;
        border-radius: 4px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}