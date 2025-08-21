// Topics management JavaScript
let allTopics = [];
let filteredTopics = [];

document.addEventListener('DOMContentLoaded', function() {
    loadTopics();
    setupEventListeners();
});

function setupEventListeners() {
    // Modal controls
    document.getElementById('addTopicBtn').addEventListener('click', () => openModal());
    document.querySelector('.close').addEventListener('click', closeModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);
    
    // Form submission
    document.getElementById('topicForm').addEventListener('submit', handleSubmit);
    
    // Filters
    document.getElementById('statusFilter').addEventListener('change', applyFilters);
    document.getElementById('sortBy').addEventListener('change', applyFilters);
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('topicModal');
        if (event.target === modal) {
            closeModal();
        }
    });
}

async function loadTopics() {
    try {
        const response = await fetch('/api/projects');
        if (response.ok) {
            allTopics = await response.json();
            await loadTaskCounts();
            applyFilters();
        }
    } catch (error) {
        console.error('Error loading topics:', error);
    }
}

async function loadTaskCounts() {
    try {
        const response = await fetch('/api/tasks');
        if (response.ok) {
            const tasks = await response.json();
            
            // Count tasks for each topic
            allTopics.forEach(topic => {
                const topicTasks = tasks.filter(task => task.project_id === topic.id);
                topic.task_count = topicTasks.length;
                topic.open_tasks = topicTasks.filter(t => t.status === 'Open').length;
                topic.completed_tasks = topicTasks.filter(t => t.status === 'Completed').length;
            });
        }
    } catch (error) {
        console.error('Error loading task counts:', error);
    }
}

function applyFilters() {
    const statusFilter = document.getElementById('statusFilter').value;
    const sortBy = document.getElementById('sortBy').value;
    
    // Filter topics
    filteredTopics = allTopics.filter(topic => {
        if (statusFilter && topic.status !== statusFilter) return false;
        return true;
    });
    
    // Sort topics
    filteredTopics.sort((a, b) => {
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
    
    renderTopics();
}

function renderTopics() {
    const grid = document.getElementById('topicsGrid');
    
    if (filteredTopics.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #999;">
                <h3>No topics found</h3>
                <p>Create your first topic to organize your tasks</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = filteredTopics.map(topic => {
        const statusClass = `status-${topic.status.toLowerCase().replace(' ', '-')}`;
        const targetDate = topic.target_date ? new Date(topic.target_date).toLocaleDateString() : 'No target date';
        const taskCount = topic.task_count || 0;
        const openTasks = topic.open_tasks || 0;
        const completedTasks = topic.completed_tasks || 0;
        
        return `
            <div class="topic-card" onclick="navigateToWorkspace('${topic.id}')">
                <div class="topic-header">
                    <h3 class="topic-title">${escapeHtml(topic.title)}</h3>
                    <span class="topic-status ${statusClass}">${topic.status}</span>
                </div>
                
                <div class="topic-description">
                    ${escapeHtml(topic.description)}
                </div>
                
                <div class="topic-meta">
                    <div class="topic-date">
                        📅 ${targetDate}
                    </div>
                    <div class="topic-stats">
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
                    <button class="btn btn-small" onclick="event.stopPropagation(); editTopic('${topic.id}')" 
                            style="padding: 5px 10px; font-size: 0.85em;">
                        Edit
                    </button>
                    <button class="btn btn-small btn-danger" onclick="event.stopPropagation(); deleteTopic('${topic.id}')" 
                            style="padding: 5px 10px; font-size: 0.85em; background: #e74c3c; color: white; border: none;">
                        Delete
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function navigateToWorkspace(topicId) {
    window.location.href = `/projects/${topicId}`;
}

function openModal(topicId = null) {
    const modal = document.getElementById('topicModal');
    const modalTitle = document.getElementById('modalTitle');
    const form = document.getElementById('topicForm');
    
    if (topicId) {
        const topic = allTopics.find(t => t.id === topicId);
        if (topic) {
            modalTitle.textContent = 'Edit Topic';
            document.getElementById('topicId').value = topic.id;
            document.getElementById('topicTitle').value = topic.title;
            document.getElementById('topicDescription').value = topic.description;
            document.getElementById('topicStatus').value = topic.status;
            document.getElementById('topicTargetDate').value = topic.target_date || '';
        }
    } else {
        modalTitle.textContent = 'New Topic';
        form.reset();
        document.getElementById('topicStatus').value = 'Planning';
    }
    
    modal.style.display = 'block';
}

function closeModal() {
    const modal = document.getElementById('topicModal');
    modal.style.display = 'none';
    document.getElementById('topicForm').reset();
}

function editTopic(topicId) {
    openModal(topicId);
}

async function deleteTopic(topicId) {
    const topic = allTopics.find(t => t.id === topicId);
    if (!topic) return;
    
    const confirmMessage = `Are you sure you want to delete the topic "${topic.title}"?\n\nThis will remove the topic and unlink it from any associated tasks.`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/projects/${topicId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            showNotification('Topic deleted successfully!', 'success');
            loadTopics(); // Reload the topics list
        } else {
            const error = await response.json();
            showNotification(error.error || 'Failed to delete topic', 'error');
        }
    } catch (error) {
        console.error('Error deleting topic:', error);
        showNotification('Failed to delete topic', 'error');
    }
}

async function handleSubmit(event) {
    event.preventDefault();
    
    const topicId = document.getElementById('topicId').value;
    const topicData = {
        title: document.getElementById('topicTitle').value,
        description: document.getElementById('topicDescription').value,
        status: document.getElementById('topicStatus').value,
        target_date: document.getElementById('topicTargetDate').value || null
    };
    
    try {
        const url = topicId ? `/api/projects/${topicId}` : '/api/projects';
        const method = topicId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(topicData)
        });
        
        if (response.ok) {
            closeModal();
            loadTopics();
            
            // Show success message
            const message = topicId ? 'Topic updated successfully!' : 'Topic created successfully!';
            showNotification(message, 'success');
        } else {
            const error = await response.json();
            showNotification(error.error || 'Failed to save topic', 'error');
        }
    } catch (error) {
        console.error('Error saving topic:', error);
        showNotification('Failed to save topic', 'error');
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