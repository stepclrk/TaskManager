// Topic Workspace functionality
let currentTopic = null;
let topicTasks = [];
let currentTask = null;
let config = {};
let keyResultCounter = 0;

document.addEventListener('DOMContentLoaded', function() {
    const topicId = getTopicIdFromUrl();
    if (topicId) {
        loadTopic(topicId);
        loadConfig();
    }
    
    document.getElementById('addTaskBtn').addEventListener('click', showAddTaskModal);
    document.getElementById('editTopicBtn').addEventListener('click', showEditObjectiveModal);
    document.getElementById('viewFilter').addEventListener('change', filterTasks);
    document.getElementById('taskForm').addEventListener('submit', saveTask);
    document.getElementById('editObjectiveForm').addEventListener('submit', saveObjective);
    
    // Notes functionality
    const notesTextarea = document.getElementById('objectiveNotes');
    const saveNotesBtn = document.getElementById('saveNotesBtn');
    const autoSaveIndicator = document.getElementById('autoSaveIndicator');
    const charCountDiv = document.getElementById('notesCharCount');
    let notesTimeout;
    let originalNotes = '';
    
    // Update character count
    function updateCharCount() {
        const count = notesTextarea.value.length;
        charCountDiv.textContent = `${count} characters`;
    }
    
    notesTextarea.addEventListener('input', function() {
        updateCharCount();
        
        // Check if notes have changed
        if (notesTextarea.value !== originalNotes) {
            // Change button to indicate unsaved changes
            saveNotesBtn.textContent = 'Save Notes *';
            saveNotesBtn.classList.remove('btn-secondary');
            saveNotesBtn.classList.add('btn-primary');
            
            // Show auto-save indicator and start auto-save timer
            clearTimeout(notesTimeout);
            autoSaveIndicator.style.display = 'inline-block';
            
            notesTimeout = setTimeout(() => {
                saveNotes(true); // true = auto-save
            }, 3000); // Auto-save after 3 seconds
        }
    });
    
    saveNotesBtn.addEventListener('click', () => saveNotes(false)); // false = manual save
    
    // Confidence slider
    document.getElementById('objConfidence').addEventListener('input', function(e) {
        document.getElementById('objConfidenceLabel').textContent = e.target.value + '%';
    });
    
    // Close modal when clicking outside
    window.onclick = function(event) {
        const taskModal = document.getElementById('taskModal');
        const editObjModal = document.getElementById('editObjectiveModal');
        if (event.target == taskModal) {
            closeModal();
        } else if (event.target == editObjModal) {
            closeEditObjectiveModal();
        }
    }
});

function getTopicIdFromUrl() {
    const pathParts = window.location.pathname.split('/');
    return pathParts[pathParts.length - 1];
}

async function loadTopic(topicId) {
    try {
        const response = await fetch(`/api/topics/${topicId}`);
        if (!response.ok) {
            window.location.href = '/topics';
            return;
        }
        
        currentTopic = await response.json();
        displayTopicInfo();
        displayTasks();
        updateStats();
        
        // Also display OKR information if available
        displayOKRInfo();
    } catch (error) {
        console.error('Error loading topic:', error);
        window.location.href = '/topics';
    }
}

async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        config = await response.json();
        
        // Populate form dropdowns
        populateSelect('category', config.categories);
        populateSelect('priority', config.priorities);
        populateSelect('status', config.statuses);
    } catch (error) {
        console.error('Error loading config:', error);
    }
}

function populateSelect(id, options) {
    const select = document.getElementById(id);
    if (select && options) {
        select.innerHTML = options.map(opt => 
            `<option value="${opt}">${opt}</option>`
        ).join('');
    }
}

function displayTopicInfo() {
    document.getElementById('topicTitle').textContent = currentTopic.title;
    document.getElementById('breadcrumbTitle').textContent = currentTopic.title;
    document.getElementById('topicDescription').textContent = currentTopic.description || 'No description provided';
    
    // Set status badge
    const statusElement = document.getElementById('topicStatus');
    statusElement.textContent = currentTopic.status || 'Active';
    statusElement.className = `topic-status-badge status-${(currentTopic.status || 'Active').toLowerCase().replace(' ', '-')}`;
    
    // Set dates
    document.getElementById('targetDate').textContent = currentTopic.target_date || 'Not set';
    document.getElementById('createdDate').textContent = formatDate(currentTopic.created_at);
    document.getElementById('updatedDate').textContent = formatDate(currentTopic.updated_at);
    
    // Load notes
    const notesTextarea = document.getElementById('objectiveNotes');
    notesTextarea.value = currentTopic.notes || '';
    originalNotes = currentTopic.notes || '';
    updateCharCount();
    
    // Update page title
    document.title = `${currentTopic.title} - Objective Workspace`;
}

function displayTasks() {
    const filter = document.getElementById('viewFilter').value;
    topicTasks = currentTopic.tasks || [];
    
    let filteredTasks = topicTasks;
    
    if (filter !== 'all') {
        if (filter === 'open') {
            filteredTasks = topicTasks.filter(t => t.status === 'Open');
        } else if (filter === 'in-progress') {
            filteredTasks = topicTasks.filter(t => t.status === 'In Progress');
        } else if (filter === 'completed') {
            filteredTasks = topicTasks.filter(t => t.status === 'Completed');
        }
    }
    
    const container = document.getElementById('tasksContainer');
    
    if (filteredTasks.length === 0) {
        container.innerHTML = '<p class="empty-message">No tasks found</p>';
        document.getElementById('taskCount').textContent = '0 tasks';
        return;
    }
    
    document.getElementById('taskCount').textContent = `${filteredTasks.length} task${filteredTasks.length !== 1 ? 's' : ''}`;
    
    container.innerHTML = filteredTasks.map(task => {
        const isOverdue = task.follow_up_date && new Date(task.follow_up_date) < new Date() && task.status !== 'Completed';
        const isUrgent = task.priority === 'Urgent';
        const className = isUrgent ? 'urgent' : (isOverdue ? 'overdue' : '');
        
        return `
            <div class="task-list-item ${className}">
                <div class="task-info">
                    <div class="task-title">${escapeHtml(task.title)}</div>
                    <div class="task-meta">
                        Status: ${task.status} | 
                        Priority: <span class="${task.priority === 'Urgent' ? 'priority-urgent' : (task.priority === 'High' ? 'priority-high' : '')}">${task.priority}</span> | 
                        Due: ${task.follow_up_date || 'No date'}
                    </div>
                </div>
                <div class="task-actions">
                    <button class="edit-btn" onclick="editTask('${task.id}')">Edit</button>
                    <button class="delete-btn" onclick="removeTaskFromTopic('${task.id}')">Remove</button>
                </div>
            </div>
        `;
    }).join('');
}

function updateStats() {
    const tasks = currentTopic.tasks || [];
    const totalTasks = tasks.length;
    const openTasks = tasks.filter(t => t.status === 'Open').length;
    const inProgressTasks = tasks.filter(t => t.status === 'In Progress').length;
    const completedTasks = tasks.filter(t => t.status === 'Completed').length;
    
    document.getElementById('totalTasks').textContent = totalTasks;
    document.getElementById('openTasks').textContent = openTasks;
    document.getElementById('inProgressTasks').textContent = inProgressTasks;
    document.getElementById('completedTasks').textContent = completedTasks;
    
    // Update progress bar
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const progressBar = document.getElementById('progressBar');
    progressBar.style.width = `${progress}%`;
    progressBar.textContent = `${progress}%`;
}

function filterTasks() {
    displayTasks();
}

function showAddTaskModal() {
    currentTask = null;
    document.getElementById('modalTitle').textContent = 'Add Task to Objective';
    document.getElementById('taskForm').reset();
    
    // Pre-set the topic ID
    document.getElementById('taskTopic').value = currentTopic.id;
    
    // Set default status
    document.getElementById('status').value = config.statuses ? config.statuses[0] : 'Open';
    
    // Show the modal
    document.getElementById('taskModal').style.display = 'block';
}

async function editTask(taskId) {
    // Find the task in our local array
    currentTask = topicTasks.find(t => t.id === taskId);
    if (!currentTask) return;
    
    document.getElementById('modalTitle').textContent = 'Edit Task';
    document.getElementById('taskId').value = currentTask.id;
    document.getElementById('taskTopic').value = currentTopic.id;
    document.getElementById('title').value = currentTask.title || '';
    document.getElementById('customerName').value = currentTask.customer_name || '';
    document.getElementById('description').value = currentTask.description || '';
    document.getElementById('category').value = currentTask.category || config.categories[0];
    document.getElementById('priority').value = currentTask.priority || config.priorities[0];
    document.getElementById('followUpDate').value = currentTask.follow_up_date || '';
    document.getElementById('status').value = currentTask.status || config.statuses[0];
    document.getElementById('assignedTo').value = currentTask.assigned_to || '';
    document.getElementById('tags').value = currentTask.tags || '';
    
    document.getElementById('taskModal').style.display = 'block';
}

async function removeTaskFromTopic(taskId) {
    if (!confirm('Remove this task from the objective? The task will not be deleted.')) {
        return;
    }
    
    try {
        // Get the task
        const taskResponse = await fetch(`/api/tasks/${taskId}`);
        const task = await taskResponse.json();
        
        // Remove topic association
        delete task.topic_id;
        
        // Update the task
        const updateResponse = await fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(task)
        });
        
        if (updateResponse.ok) {
            // Reload topic to refresh tasks list
            await loadTopic(currentTopic.id);
        } else {
            alert('Error removing task from objective');
        }
    } catch (error) {
        console.error('Error removing task from topic:', error);
        alert('Error removing task from objective');
    }
}

function showEditObjectiveModal() {
    // Populate the edit form with current objective data
    document.getElementById('objTitle').value = currentTopic.title || '';
    document.getElementById('objDescription').value = currentTopic.description || '';
    document.getElementById('objType').value = currentTopic.objective_type || 'aspirational';
    document.getElementById('objPeriod').value = currentTopic.period || 'Q1';
    document.getElementById('objStatus').value = currentTopic.status || 'Active';
    document.getElementById('objTargetDate').value = currentTopic.target_date || '';
    document.getElementById('objConfidence').value = (currentTopic.confidence || 0.5) * 100;
    document.getElementById('objConfidenceLabel').textContent = Math.round((currentTopic.confidence || 0.5) * 100) + '%';
    document.getElementById('objOwner').value = currentTopic.owner || '';
    
    // Populate key results
    populateKeyResults(currentTopic.key_results || []);
    
    // Show the modal
    document.getElementById('editObjectiveModal').style.display = 'block';
}

function closeEditObjectiveModal() {
    document.getElementById('editObjectiveModal').style.display = 'none';
}

async function saveObjective(e) {
    e.preventDefault();
    
    // Get key results from the form
    const keyResults = getKeyResults();
    
    // Calculate OKR score
    let okrScore = 0;
    if (keyResults.length > 0) {
        const totalProgress = keyResults.reduce((sum, kr) => sum + (kr.progress || 0), 0);
        okrScore = totalProgress / keyResults.length;
    }
    
    const updatedData = {
        title: document.getElementById('objTitle').value,
        description: document.getElementById('objDescription').value,
        objective_type: document.getElementById('objType').value,
        period: document.getElementById('objPeriod').value,
        status: document.getElementById('objStatus').value,
        target_date: document.getElementById('objTargetDate').value,
        confidence: parseFloat(document.getElementById('objConfidence').value) / 100,
        owner: document.getElementById('objOwner').value,
        key_results: keyResults,  // Use the updated key results
        okr_score: okrScore,  // Include the calculated score
        notes: currentTopic.notes || ''  // Preserve notes
    };
    
    try {
        const response = await fetch(`/api/topics/${currentTopic.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedData)
        });
        
        if (response.ok) {
            closeEditObjectiveModal();
            // Reload the topic to refresh the display
            await loadTopic(currentTopic.id);
            showNotification('Objective updated successfully');
        } else {
            alert('Error updating objective');
        }
    } catch (error) {
        console.error('Error updating objective:', error);
        alert('Error updating objective');
    }
}

async function saveNotes(isAutoSave = false) {
    const notes = document.getElementById('objectiveNotes').value;
    const saveNotesBtn = document.getElementById('saveNotesBtn');
    const saveStatus = document.getElementById('notesSaveStatus');
    const autoSaveIndicator = document.getElementById('autoSaveIndicator');
    
    // Hide auto-save indicator
    autoSaveIndicator.style.display = 'none';
    
    // Update the current topic object
    currentTopic.notes = notes;
    
    try {
        const response = await fetch(`/api/topics/${currentTopic.id}/notes`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ notes: notes })
        });
        
        if (response.ok) {
            // Update original notes to track changes
            originalNotes = notes;
            
            // Show success feedback
            saveNotesBtn.textContent = 'Save Notes';
            saveNotesBtn.classList.remove('btn-primary');
            saveNotesBtn.classList.add('btn-secondary');
            
            const timestamp = new Date().toLocaleTimeString();
            if (isAutoSave) {
                saveStatus.innerHTML = `<span style="color: #27ae60;">✓ Auto-saved at ${timestamp}</span>`;
            } else {
                saveStatus.innerHTML = `<span style="color: #27ae60;">✓ Notes saved at ${timestamp}</span>`;
            }
            saveStatus.style.display = 'block';
            
            // Keep the success message visible longer
            setTimeout(() => {
                if (saveStatus.textContent.includes(timestamp)) {
                    saveStatus.style.opacity = '0.6';
                }
            }, 5000);
        } else {
            saveStatus.innerHTML = '<span style="color: #e74c3c;">✗ Error saving notes - please try again</span>';
            saveStatus.style.display = 'block';
        }
    } catch (error) {
        console.error('Error saving notes:', error);
        saveStatus.innerHTML = '<span style="color: #e74c3c;">✗ Error saving notes - please try again</span>';
        saveStatus.style.display = 'block';
    }
}

// Helper function to update character count
function updateCharCount() {
    const notesTextarea = document.getElementById('objectiveNotes');
    const charCountDiv = document.getElementById('notesCharCount');
    if (notesTextarea && charCountDiv) {
        const count = notesTextarea.value.length;
        charCountDiv.textContent = `${count} characters`;
    }
}

function editTopic() {
    // This function is no longer used, replaced by showEditObjectiveModal
    showEditObjectiveModal();
}

// Key Results Management Functions
window.addKeyResult = function() {
    keyResultCounter++;
    const container = document.getElementById('keyResultsList');
    const krDiv = document.createElement('div');
    krDiv.className = 'key-result-item';
    krDiv.id = `kr-${keyResultCounter}`;
    
    krDiv.innerHTML = `
        <button type="button" class="remove-kr-btn" onclick="removeKeyResult('kr-${keyResultCounter}')">×</button>
        <input type="text" placeholder="Key Result: e.g., 'Increase user engagement by 25%'" class="kr-title" required>
        <div class="kr-metrics">
            <div>
                <label>Start Value</label>
                <input type="number" placeholder="0" class="kr-start" value="0">
            </div>
            <div>
                <label>Target Value</label>
                <input type="number" placeholder="100" class="kr-target" value="100" required>
            </div>
            <div>
                <label>Current Value</label>
                <input type="number" placeholder="0" class="kr-current" value="0">
            </div>
        </div>
    `;
    
    container.appendChild(krDiv);
}

window.removeKeyResult = function(krId) {
    const element = document.getElementById(krId);
    if (element) {
        element.remove();
    }
}

function getKeyResults() {
    const keyResults = [];
    const krItems = document.querySelectorAll('.key-result-item');
    
    krItems.forEach(item => {
        const title = item.querySelector('.kr-title').value;
        const startValue = parseFloat(item.querySelector('.kr-start').value) || 0;
        const targetValue = parseFloat(item.querySelector('.kr-target').value) || 100;
        const currentValue = parseFloat(item.querySelector('.kr-current').value) || 0;
        
        if (title) {
            const progress = targetValue > startValue ? 
                (currentValue - startValue) / (targetValue - startValue) : 0;
            
            // Check if this KR already has an ID (from existing KRs)
            const existingId = item.dataset.krId;
            
            const kr = {
                title: title,
                start_value: startValue,
                target_value: targetValue,
                current_value: currentValue,
                progress: Math.min(Math.max(progress, 0), 1), // Clamp between 0 and 1
                status: progress >= 1 ? 'Completed' : progress > 0 ? 'In Progress' : 'Not Started'
            };
            
            // Preserve the ID if it exists
            if (existingId) {
                kr.id = existingId;
            }
            
            keyResults.push(kr);
        }
    });
    
    return keyResults;
}

function populateKeyResults(keyResults) {
    const container = document.getElementById('keyResultsList');
    container.innerHTML = '';
    keyResultCounter = 0;
    
    if (keyResults && keyResults.length > 0) {
        keyResults.forEach(kr => {
            keyResultCounter++;
            const krDiv = document.createElement('div');
            krDiv.className = 'key-result-item';
            krDiv.id = `kr-${keyResultCounter}`;
            krDiv.dataset.krId = kr.id || ''; // Store the KR ID
            
            krDiv.innerHTML = `
                <button type="button" class="remove-kr-btn" onclick="removeKeyResult('kr-${keyResultCounter}')">×</button>
                <input type="text" placeholder="Key Result" class="kr-title" value="${escapeHtml(kr.title)}" required>
                <div class="kr-metrics">
                    <div>
                        <label>Start Value</label>
                        <input type="number" placeholder="0" class="kr-start" value="${kr.start_value || 0}">
                    </div>
                    <div>
                        <label>Target Value</label>
                        <input type="number" placeholder="100" class="kr-target" value="${kr.target_value || 100}" required>
                    </div>
                    <div>
                        <label>Current Value</label>
                        <input type="number" placeholder="0" class="kr-current" value="${kr.current_value || 0}">
                    </div>
                </div>
            `;
            
            container.appendChild(krDiv);
        });
    }
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function closeModal() {
    document.getElementById('taskModal').style.display = 'none';
    currentTask = null;
}

async function saveTask(e) {
    e.preventDefault();
    
    const taskData = {
        title: document.getElementById('title').value,
        customer_name: document.getElementById('customerName').value,
        description: document.getElementById('description').value,
        category: document.getElementById('category').value,
        priority: document.getElementById('priority').value,
        follow_up_date: document.getElementById('followUpDate').value,
        status: document.getElementById('status').value,
        assigned_to: document.getElementById('assignedTo').value,
        tags: document.getElementById('tags').value,
        topic_id: currentTopic.id  // Always assign to current topic
    };
    
    try {
        const taskId = document.getElementById('taskId').value;
        const url = taskId ? `/api/tasks/${taskId}` : '/api/tasks';
        const method = taskId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(taskData)
        });
        
        if (response.ok) {
            closeModal();
            // Reload the topic to refresh the task list
            await loadTopic(currentTopic.id);
            
            // Show success message
            showNotification(taskId ? 'Task updated successfully' : 'Task added successfully');
        } else {
            alert('Error saving task');
        }
    } catch (error) {
        console.error('Error saving task:', error);
        alert('Error saving task');
    }
}

function showNotification(message) {
    // Create a simple notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #27ae60;
        color: white;
        padding: 15px 20px;
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
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

function displayOKRInfo() {
    // Remove any existing OKR section first
    const existingOKR = document.getElementById('okrSection');
    if (existingOKR) {
        existingOKR.remove();
    }
    
    // Add OKR information if available
    if (currentTopic.key_results && currentTopic.key_results.length > 0) {
        const headerDiv = document.querySelector('.workspace-header');
        
        // Calculate OKR score
        let totalProgress = 0;
        currentTopic.key_results.forEach(kr => {
            totalProgress += kr.progress || 0;
        });
        const okrScore = currentTopic.key_results.length > 0 ? 
            totalProgress / currentTopic.key_results.length : 0;
        
        // Create OKR section
        const okrSection = document.createElement('div');
        okrSection.id = 'okrSection'; // Add ID for easy reference
        okrSection.style.marginTop = '20px';
        okrSection.style.padding = '15px';
        okrSection.style.background = '#f8f9fa';
        okrSection.style.borderRadius = '8px';
        
        let okrHtml = `
            <h3 style="margin-bottom: 15px; color: #2c3e50;">Key Results</h3>
            <div style="margin-bottom: 10px;">
                <strong>Overall Progress:</strong> ${Math.round(okrScore * 100)}%
                ${currentTopic.confidence ? ` | <strong>Confidence:</strong> ${Math.round(currentTopic.confidence * 100)}%` : ''}
                ${currentTopic.period ? ` | <strong>Period:</strong> ${currentTopic.period}` : ''}
                ${currentTopic.objective_type ? ` | <strong>Type:</strong> ${currentTopic.objective_type}` : ''}
            </div>
        `;
        
        // Add each key result
        okrHtml += '<div style="margin-top: 15px;">';
        currentTopic.key_results.forEach(kr => {
            const progress = (kr.progress || 0) * 100;
            const progressClass = progress < 30 ? 'danger' : progress < 70 ? 'warning' : 'success';
            
            okrHtml += `
                <div style="margin-bottom: 15px;">
                    <div style="font-weight: 600; margin-bottom: 5px;">${escapeHtml(kr.title)}</div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="flex: 1; background: #e0e0e0; height: 10px; border-radius: 5px; overflow: hidden;">
                            <div style="background: ${progressClass === 'danger' ? '#e74c3c' : progressClass === 'warning' ? '#f39c12' : '#27ae60'}; 
                                        height: 100%; width: ${progress}%; transition: width 0.3s;"></div>
                        </div>
                        <div style="font-size: 0.9em; color: #666;">
                            ${kr.current_value || 0} / ${kr.target_value || 100}
                        </div>
                    </div>
                </div>
            `;
        });
        okrHtml += '</div>';
        
        okrSection.innerHTML = okrHtml;
        headerDiv.appendChild(okrSection);
    }
}