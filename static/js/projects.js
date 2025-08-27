// Projects management JavaScript
let allProjects = [];
let filteredProjects = [];
let projectQuillEditor = null;

document.addEventListener('DOMContentLoaded', function() {
    loadProjects();
    setupEventListeners();
    initializeQuillEditor();
});

function initializeQuillEditor() {
    const container = document.getElementById('projectDescriptionEditor');
    if (!container) return;
    
    projectQuillEditor = new Quill('#projectDescriptionEditor', {
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
        placeholder: 'Describe the project and its goals...'
    });
    
    // Store reference on the container
    container.__quill = projectQuillEditor;
}

function setupEventListeners() {
    // Modal controls
    document.getElementById('addProjectBtn').addEventListener('click', () => openModal());
    document.querySelector('.close').addEventListener('click', closeModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);
    
    // Form submission
    document.getElementById('projectForm').addEventListener('submit', handleSubmit);
    
    // Filters
    document.getElementById('statusFilter').addEventListener('change', applyFilters);
    document.getElementById('sortBy').addEventListener('change', applyFilters);
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('projectModal');
        if (event.target === modal) {
            closeModal();
        }
    });
}

async function loadProjects() {
    try {
        const response = await fetch('/api/projects');
        if (response.ok) {
            allProjects = await response.json();
            await loadTaskCounts();
            applyFilters();
        }
    } catch (error) {
        console.error('Error loading projects:', error);
    }
}

async function loadTaskCounts() {
    try {
        const response = await fetch('/api/tasks');
        if (response.ok) {
            const tasks = await response.json();
            
            // Count tasks for each project
            allProjects.forEach(project => {
                const projectTasks = tasks.filter(task => task.project_id === project.id);
                project.task_count = projectTasks.length;
                project.open_tasks = projectTasks.filter(t => t.status === 'Open').length;
                project.completed_tasks = projectTasks.filter(t => t.status === 'Completed').length;
            });
        }
    } catch (error) {
        console.error('Error loading task counts:', error);
    }
}

function applyFilters() {
    const statusFilter = document.getElementById('statusFilter').value;
    const sortBy = document.getElementById('sortBy').value;
    
    // Filter projects
    filteredProjects = allProjects.filter(project => {
        if (statusFilter && project.status !== statusFilter) return false;
        return true;
    });
    
    // Sort projects
    filteredProjects.sort((a, b) => {
        switch(sortBy) {
            case 'created':
                return new Date(b.created_at) - new Date(a.created_at);
            case 'target':
                if (!a.target_date) return 1;
                if (!b.target_date) return -1;
                return new Date(a.target_date) - new Date(b.target_date);
            case 'title':
                return a.title.localeCompare(b.title);
            case 'tasks':
                return (b.task_count || 0) - (a.task_count || 0);
            default:
                return 0;
        }
    });
    
    renderProjects();
}

function renderProjects() {
    const grid = document.getElementById('projectsGrid');
    
    if (filteredProjects.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #999;">
                <h3>No projects found</h3>
                <p>Create your first project to organize your tasks</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = filteredProjects.map(project => {
        const statusClass = `status-${project.status.toLowerCase().replace(' ', '-')}`;
        const targetDate = project.target_date ? new Date(project.target_date).toLocaleDateString() : 'No target date';
        const taskCount = project.task_count || 0;
        const openTasks = project.open_tasks || 0;
        const completedTasks = project.completed_tasks || 0;
        
        return `
            <div class="project-card" onclick="navigateToWorkspace('${project.id}')">
                <div class="project-header">
                    <h3 class="project-title">${escapeHtml(project.title)}</h3>
                    <span class="project-status ${statusClass}">${project.status}</span>
                </div>
                
                <div class="project-description">
                    ${project.description || ''}
                </div>
                
                <div class="project-meta">
                    <div class="project-date">
                        📅 ${targetDate}
                    </div>
                    <div class="project-stats">
                        <div class="stat-item">
                            <span class="stat-icon">📋</span>
                            <span class="stat-count">${taskCount}</span>
                        </div>
                        <div class="stat-item" title="Open tasks">
                            <span class="stat-icon">📂</span>
                            <span class="stat-count">${openTasks}</span>
                        </div>
                        <div class="stat-item" title="Completed tasks">
                            <span class="stat-icon">✅</span>
                            <span class="stat-count">${completedTasks}</span>
                        </div>
                    </div>
                </div>
                
                <div style="position: absolute; top: 20px; right: 20px; display: flex; gap: 5px;">
                    <button class="btn btn-small" onclick="event.stopPropagation(); editProject('${project.id}')" 
                            style="padding: 5px 10px; font-size: 0.85em;">
                        Edit
                    </button>
                    <button class="btn btn-small btn-danger" onclick="event.stopPropagation(); deleteProject('${project.id}')" 
                            style="padding: 5px 10px; font-size: 0.85em; background: #e74c3c; color: white; border: none;">
                        Delete
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function navigateToWorkspace(projectId) {
    window.location.href = `/projects/${projectId}`;
}

function openModal(projectId = null) {
    const modal = document.getElementById('projectModal');
    const modalTitle = document.getElementById('modalTitle');
    const form = document.getElementById('projectForm');
    
    if (projectId) {
        const project = allProjects.find(t => t.id === projectId);
        if (project) {
            modalTitle.textContent = 'Edit Project';
            document.getElementById('projectId').value = project.id;
            document.getElementById('projectTitle').value = project.title;
            
            // Set description in Quill editor
            const description = project.description || '';
            document.getElementById('projectDescription').value = description;
            if (projectQuillEditor) {
                if (description.includes('<') && description.includes('>')) {
                    projectQuillEditor.root.innerHTML = description;
                } else {
                    projectQuillEditor.setText(description);
                }
            }
            
            document.getElementById('projectStatus').value = project.status;
            document.getElementById('projectTargetDate').value = project.target_date || '';
        }
    } else {
        modalTitle.textContent = 'New Project';
        form.reset();
        
        // Clear Quill editor
        if (projectQuillEditor) {
            projectQuillEditor.setText('');
        }
        
        document.getElementById('projectStatus').value = 'Planning';
    }
    
    modal.style.display = 'block';
}

function closeModal() {
    const modal = document.getElementById('projectModal');
    modal.style.display = 'none';
    document.getElementById('projectForm').reset();
}

function editProject(projectId) {
    openModal(projectId);
}

async function deleteProject(projectId) {
    const project = allProjects.find(t => t.id === projectId);
    if (!project) return;
    
    const confirmMessage = `Are you sure you want to delete the project "${project.title}"?\n\nThis will remove the project and unlink it from any associated tasks.`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/projects/${projectId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            showNotification('Project deleted successfully!', 'success');
            loadProjects(); // Reload the projects list
        } else {
            const error = await response.json();
            showNotification(error.error || 'Failed to delete project', 'error');
        }
    } catch (error) {
        console.error('Error deleting project:', error);
        showNotification('Failed to delete project', 'error');
    }
}

async function handleSubmit(event) {
    event.preventDefault();
    
    const projectId = document.getElementById('projectId').value;
    
    // Get rich text content from Quill
    let descriptionValue = '';
    if (projectQuillEditor) {
        descriptionValue = projectQuillEditor.root.innerHTML;
        // Update hidden textarea
        document.getElementById('projectDescription').value = descriptionValue;
    } else {
        descriptionValue = document.getElementById('projectDescription').value;
    }
    
    // Validate description is not empty (check for empty or only whitespace/empty HTML)
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = descriptionValue;
    const textContent = tempDiv.textContent || tempDiv.innerText || '';
    
    if (!textContent.trim()) {
        alert('Please provide a description for the project');
        return;
    }
    
    const projectData = {
        title: document.getElementById('projectTitle').value,
        description: descriptionValue,
        status: document.getElementById('projectStatus').value,
        target_date: document.getElementById('projectTargetDate').value || null
    };
    
    try {
        const url = projectId ? `/api/projects/${projectId}` : '/api/projects';
        const method = projectId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(projectData)
        });
        
        if (response.ok) {
            closeModal();
            loadProjects();
            
            // Show success message
            const message = projectId ? 'Project updated successfully!' : 'Project created successfully!';
            showNotification(message, 'success');
        } else {
            const error = await response.json();
            showNotification(error.error || 'Failed to save project', 'error');
        }
    } catch (error) {
        console.error('Error saving project:', error);
        showNotification('Failed to save project', 'error');
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