// Project Workspace JavaScript
let currentProject = null;
let projectTasks = [];
let config = {};
let saveTimeout = null;
let projQuillEditor = null;

document.addEventListener('DOMContentLoaded', function() {
    const projectId = window.location.pathname.split('/').pop();
    loadConfig();
    loadProject(projectId);
    loadProjectTasks(projectId);
    setupEventListeners();
    initializeProjQuillEditor();
});

function initializeProjQuillEditor() {
    const container = document.getElementById('projDescriptionEditor');
    if (!container) return;
    
    projQuillEditor = new Quill('#projDescriptionEditor', {
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
        placeholder: 'Describe the project...'
    });
    
    // Store reference on the container
    container.__quill = projQuillEditor;
}

function setupEventListeners() {
    // Edit project button
    document.getElementById('editProjectBtn').addEventListener('click', openEditProjectModal);
    
    // Delete project button
    document.getElementById('deleteProjectBtn').addEventListener('click', deleteCurrentProject);
    
    // Add task button
    document.getElementById('addTaskBtn').addEventListener('click', openTaskModal);
    
    // View filter
    document.getElementById('viewFilter').addEventListener('change', filterTasks);
    
    // Edit project form
    document.getElementById('editProjectForm').addEventListener('submit', saveProjectChanges);
    
    // Task form
    document.getElementById('taskForm').addEventListener('submit', saveTask);
    
    // Notes handling
    const notesTextarea = document.getElementById('projectNotes');
    const saveNotesBtn = document.getElementById('saveNotesBtn');
    
    notesTextarea.addEventListener('input', function() {
        // Update character count
        document.getElementById('notesCharCount').textContent = `${this.value.length} characters`;
        
        // Clear existing timeout
        if (saveTimeout) clearTimeout(saveTimeout);
        
        // Show auto-save indicator
        const indicator = document.getElementById('autoSaveIndicator');
        indicator.style.display = 'inline-block';
        
        // Set new timeout for auto-save
        saveTimeout = setTimeout(() => {
            saveNotes(true);
        }, 3000);
    });
    
    saveNotesBtn.addEventListener('click', () => saveNotes(false));
}

async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        config = await response.json();
        populateDropdowns();
    } catch (error) {
        console.error('Error loading config:', error);
    }
}

function populateDropdowns() {
    // Populate category dropdown
    const categorySelect = document.getElementById('category');
    if (categorySelect && config.categories) {
        categorySelect.innerHTML = config.categories.map(cat => 
            `<option value="${cat}">${cat}</option>`
        ).join('');
    }
    
    // Populate priority dropdown
    const prioritySelect = document.getElementById('priority');
    if (prioritySelect && config.priorities) {
        prioritySelect.innerHTML = config.priorities.map(priority => 
            `<option value="${priority}">${priority}</option>`
        ).join('');
    }
    
    // Populate status dropdown
    const statusSelect = document.getElementById('status');
    if (statusSelect && config.statuses) {
        statusSelect.innerHTML = config.statuses.map(status => 
            `<option value="${status}">${status}</option>`
        ).join('');
    }
}

async function loadProject(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}`);
        if (response.ok) {
            currentProject = await response.json();
            displayProjectDetails();
        } else {
            console.error('Project not found');
        }
    } catch (error) {
        console.error('Error loading project:', error);
    }
}

function displayProjectDetails() {
    if (!currentProject) return;
    
    // Update breadcrumb and title
    document.getElementById('breadcrumbTitle').textContent = currentProject.title;
    document.getElementById('projectTitle').textContent = currentProject.title;
    
    // Update status badge
    const statusBadge = document.getElementById('projectStatus');
    statusBadge.textContent = currentProject.status;
    statusBadge.className = `project-status-badge status-${currentProject.status.toLowerCase().replace(' ', '-')}`;
    
    // Update description with rich text support
    const descElement = document.getElementById('projectDescription');
    const description = currentProject.description || 'No description available';
    if (description.includes('<') && description.includes('>')) {
        descElement.innerHTML = description;
    } else {
        descElement.textContent = description;
    }
    
    // Update dates
    document.getElementById('targetDate').textContent = currentProject.target_date || 'Not set';
    document.getElementById('createdDate').textContent = new Date(currentProject.created_at).toLocaleDateString();
    document.getElementById('updatedDate').textContent = new Date(currentProject.updated_at).toLocaleDateString();
    
    // Update notes
    const notesTextarea = document.getElementById('projectNotes');
    notesTextarea.value = currentProject.notes || '';
    document.getElementById('notesCharCount').textContent = `${notesTextarea.value.length} characters`;
}

async function loadProjectTasks(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}/tasks`);
        if (response.ok) {
            projectTasks = await response.json();
            updateTaskStats();
            filterTasks();
        }
    } catch (error) {
        console.error('Error loading tasks:', error);
    }
}

function updateTaskStats() {
    const totalTasks = projectTasks.length;
    const openTasks = projectTasks.filter(t => t.status === 'Open').length;
    const inProgressTasks = projectTasks.filter(t => t.status === 'In Progress').length;
    const completedTasks = projectTasks.filter(t => t.status === 'Completed').length;
    
    document.getElementById('totalTasks').textContent = totalTasks;
    document.getElementById('openTasks').textContent = openTasks;
    document.getElementById('inProgressTasks').textContent = inProgressTasks;
    document.getElementById('completedTasks').textContent = completedTasks;
    
    // Update progress bar
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const progressBar = document.getElementById('progressBar');
    progressBar.style.width = progress + '%';
    progressBar.textContent = progress + '%';
}

function filterTasks() {
    const filter = document.getElementById('viewFilter').value;
    let filteredTasks = projectTasks;
    
    if (filter !== 'all') {
        if (filter === 'open') {
            filteredTasks = projectTasks.filter(t => t.status === 'Open');
        } else if (filter === 'in-progress') {
            filteredTasks = projectTasks.filter(t => t.status === 'In Progress');
        } else if (filter === 'completed') {
            filteredTasks = projectTasks.filter(t => t.status === 'Completed');
        }
    }
    
    displayTasks(filteredTasks);
    document.getElementById('taskCount').textContent = `${filteredTasks.length} tasks`;
}

function displayTasks(tasks) {
    const container = document.getElementById('tasksContainer');
    
    if (tasks.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999;">No tasks found</p>';
        return;
    }
    
    container.innerHTML = tasks.map(task => {
        const priorityClass = `priority-${task.priority.toLowerCase()}`;
        const statusClass = `status-${task.status.toLowerCase().replace(' ', '-')}`;
        
        return `
            <div class="task-item" style="background: white; padding: 15px; margin-bottom: 10px; border-left: 4px solid #3498db; border-radius: 5px; cursor: pointer;" 
                 onclick="editTask('${task.id}')">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        <h4 style="margin: 0 0 10px 0; color: #2c3e50;">${escapeHtml(task.title)}</h4>
                        <div style="color: #666; font-size: 0.9em;">
                            ${task.customer_name ? `Customer: ${escapeHtml(task.customer_name)} | ` : ''}
                            ${task.assigned_to ? `Assigned to: ${escapeHtml(task.assigned_to)} | ` : ''}
                            ${task.follow_up_date ? `Due: ${formatFollowUpDate(task.follow_up_date)}` : 'No due date'}
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <span class="${priorityClass}" style="padding: 3px 8px; border-radius: 3px; font-size: 0.85em;">
                            ${task.priority}
                        </span>
                        <span class="${statusClass}" style="padding: 3px 8px; border-radius: 3px; font-size: 0.85em;">
                            ${task.status}
                        </span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function deleteCurrentProject() {
    if (!currentProject) return;
    
    const confirmMessage = `Are you sure you want to delete the topic "${currentProject.title}"?\n\nThis will remove the topic and unlink it from any associated tasks.\n\nYou will be redirected to the Topics page.`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/projects/${currentProject.id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            alert('Topic deleted successfully!');
            window.location.href = '/projects';
        } else {
            const error = await response.json();
            alert(error.error || 'Failed to delete topic');
        }
    } catch (error) {
        console.error('Error deleting topic:', error);
        alert('Failed to delete topic');
    }
}

function openEditProjectModal() {
    const modal = document.getElementById('editProjectModal');
    document.getElementById('projTitle').value = currentProject.title;
    
    // Set description in Quill editor
    const description = currentProject.description || '';
    document.getElementById('projDescription').value = description;
    if (projQuillEditor) {
        if (description.includes('<') && description.includes('>')) {
            projQuillEditor.root.innerHTML = description;
        } else {
            projQuillEditor.setText(description);
        }
    }
    
    document.getElementById('projStatus').value = currentProject.status;
    document.getElementById('projTargetDate').value = currentProject.target_date || '';
    modal.style.display = 'block';
}

function closeEditProjectModal() {
    document.getElementById('editProjectModal').style.display = 'none';
}

async function saveProjectChanges(e) {
    e.preventDefault();
    
    // Get rich text content from Quill
    let descriptionValue = '';
    if (projQuillEditor) {
        descriptionValue = projQuillEditor.root.innerHTML;
        // Update hidden textarea
        document.getElementById('projDescription').value = descriptionValue;
    } else {
        descriptionValue = document.getElementById('projDescription').value;
    }
    
    const updatedData = {
        title: document.getElementById('projTitle').value,
        description: descriptionValue,
        status: document.getElementById('projStatus').value,
        target_date: document.getElementById('projTargetDate').value || null
    };
    
    try {
        const response = await fetch(`/api/projects/${currentProject.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });
        
        if (response.ok) {
            currentProject = await response.json();
            displayProjectDetails();
            closeEditProjectModal();
            showNotification('Topic updated successfully!', 'success');
        }
    } catch (error) {
        console.error('Error updating project:', error);
        showNotification('Failed to update topic', 'error');
    }
}

function openTaskModal(taskId = null) {
    const modal = document.getElementById('taskModal');
    const form = document.getElementById('taskForm');
    
    if (taskId) {
        const task = projectTasks.find(t => t.id === taskId);
        if (task) {
            document.getElementById('modalTitle').textContent = 'Edit Task';
            document.getElementById('taskId').value = task.id;
            document.getElementById('title').value = task.title;
            document.getElementById('customerName').value = task.customer_name || '';
            document.getElementById('description').value = task.description || '';
            document.getElementById('category').value = task.category || config.categories[0];
            document.getElementById('priority').value = task.priority || config.priorities[0];
            // Handle datetime-local input format
            if (task.follow_up_date) {
                // Convert to datetime-local format (YYYY-MM-DDTHH:MM)
                let dateValue = task.follow_up_date;
                // If it's just a date (YYYY-MM-DD), keep it as is for backward compatibility
                if (dateValue.length === 10) {
                    // Don't set a default time for existing date-only values
                    document.getElementById('followUpDate').value = '';
                    // Show the date in a user-friendly way
                    document.getElementById('followUpDate').placeholder = dateValue + ' (no time set)';
                } else {
                    // If it already has time, ensure it's in the correct format
                    if (dateValue.includes(' ')) {
                        // Convert from display format back to input format if needed
                        dateValue = dateValue.replace(' ', 'T').substring(0, 16);
                    }
                    document.getElementById('followUpDate').value = dateValue.substring(0, 16);
                }
            } else {
                document.getElementById('followUpDate').value = '';
            }
            document.getElementById('status').value = task.status || config.statuses[0];
            document.getElementById('assignedTo').value = task.assigned_to || '';
            document.getElementById('tags').value = task.tags || '';
        }
    } else {
        document.getElementById('modalTitle').textContent = 'Add Task';
        form.reset();
        document.getElementById('taskProject').value = currentProject.id;
        
        // Set defaults
        if (config.categories) document.getElementById('category').value = config.categories[0];
        if (config.priorities) document.getElementById('priority').value = config.priorities[1];
        if (config.statuses) document.getElementById('status').value = config.statuses[0];
    }
    
    modal.style.display = 'block';
}

function editTask(taskId) {
    openTaskModal(taskId);
}

function closeModal() {
    document.getElementById('taskModal').style.display = 'none';
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
        project_id: currentProject.id
    };
    
    try {
        const taskId = document.getElementById('taskId').value;
        const url = taskId ? `/api/tasks/${taskId}` : '/api/tasks';
        const method = taskId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData)
        });
        
        if (response.ok) {
            closeModal();
            loadProjectTasks(currentProject.id);
            showNotification(taskId ? 'Task updated successfully!' : 'Task created successfully!', 'success');
        }
    } catch (error) {
        console.error('Error saving task:', error);
        showNotification('Failed to save task', 'error');
    }
}

async function saveNotes(isAutoSave = false) {
    const notes = document.getElementById('projectNotes').value;
    
    try {
        const response = await fetch(`/api/projects/${currentProject.id}/notes`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: notes })
        });
        
        if (response.ok) {
            currentProject.notes = notes;
            const statusDiv = document.getElementById('notesSaveStatus');
            const indicator = document.getElementById('autoSaveIndicator');
            
            indicator.style.display = 'none';
            
            if (!isAutoSave) {
                statusDiv.textContent = 'Notes saved successfully!';
                setTimeout(() => {
                    statusDiv.textContent = '';
                }, 3000);
            } else {
                statusDiv.textContent = 'Auto-saved';
                setTimeout(() => {
                    statusDiv.textContent = '';
                }, 2000);
            }
        }
    } catch (error) {
        console.error('Error saving notes:', error);
        document.getElementById('notesSaveStatus').textContent = 'Failed to save notes';
    }
}

function showNotification(message, type = 'info') {
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

function formatFollowUpDate(dateStr) {
    if (!dateStr) return 'No date';
    
    // Check if it includes time
    if (dateStr.includes('T') || (dateStr.includes(' ') && dateStr.length > 10)) {
        const date = new Date(dateStr);
        // Format with both date and time
        const dateOptions = { year: 'numeric', month: 'short', day: 'numeric' };
        const timeOptions = { hour: '2-digit', minute: '2-digit' };
        return date.toLocaleDateString(undefined, dateOptions) + ' ' + date.toLocaleTimeString(undefined, timeOptions);
    } else {
        // Just date
        const date = new Date(dateStr + 'T00:00:00');
        const dateOptions = { year: 'numeric', month: 'short', day: 'numeric' };
        return date.toLocaleDateString(undefined, dateOptions);
    }
}