let allTasks = [];
let currentTask = null;
let config = {};
let topics = [];
window.hasApiKey = false;

async function checkApiKey() {
    try {
        const response = await fetch('/api/settings');
        const settings = await response.json();
        
        // Check if API key exists
        if (settings.api_key && settings.api_key !== '') {
            window.hasApiKey = true;
        } else {
            window.hasApiKey = false;
        }
        
        // Show/hide AI features
        const generateFollowUpBtn = document.getElementById('generateFollowUpBtn');
        const enhanceTextBtn = document.getElementById('enhanceTextBtn');
        
        if (generateFollowUpBtn) {
            generateFollowUpBtn.style.display = window.hasApiKey ? 'inline-block' : 'none';
        }
        if (enhanceTextBtn) {
            enhanceTextBtn.style.display = window.hasApiKey ? 'inline-block' : 'none';
        }
    } catch (error) {
        console.error('Error checking API key:', error);
        window.hasApiKey = false;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    checkApiKey();
    loadConfig();
    loadTopics();
    loadTasks().then(() => {
        // Check if we need to open a specific task
        const taskIdToOpen = sessionStorage.getItem('openTaskId');
        if (taskIdToOpen) {
            sessionStorage.removeItem('openTaskId');
            setTimeout(() => {
                editTask(taskIdToOpen);
            }, 100);
        }
        
        // Check if we need to create a new task for a topic
        const newTaskTopicId = sessionStorage.getItem('newTaskTopicId');
        if (newTaskTopicId) {
            const topicTitle = sessionStorage.getItem('newTaskTopicTitle');
            sessionStorage.removeItem('newTaskTopicId');
            sessionStorage.removeItem('newTaskTopicTitle');
            showAddTaskModal();
            // Pre-select the topic
            setTimeout(() => {
                const topicSelect = document.getElementById('taskTopic');
                if (topicSelect) {
                    topicSelect.value = newTaskTopicId;
                }
            }, 100);
        }
    });
    
    document.getElementById('addTaskBtn').addEventListener('click', showAddTaskModal);
    document.getElementById('exportBtn').addEventListener('click', exportTasks);
    document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
    document.getElementById('importFile').addEventListener('change', importTasks);
    
    document.getElementById('searchInput').addEventListener('input', filterTasks);
    document.getElementById('viewType').addEventListener('change', renderTasks);
    document.getElementById('groupBy').addEventListener('change', renderTasks);
    
    document.getElementById('taskForm').addEventListener('submit', saveTask);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);
    
    // Only add listener if API key exists
    const generateFollowUpBtn = document.getElementById('generateFollowUpBtn');
    if (generateFollowUpBtn) {
        generateFollowUpBtn.addEventListener('click', showFollowUpModal);
    }
    
    // Add listener for summary button
    const generateSummaryBtn = document.getElementById('generateSummaryBtn');
    if (generateSummaryBtn) {
        generateSummaryBtn.addEventListener('click', showSummaryModal);
    }
    
    document.querySelectorAll('.close').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });
    
    document.getElementById('closeFollowUpBtn').addEventListener('click', () => {
        document.getElementById('followUpModal').style.display = 'none';
    });
    
    document.getElementById('copyMessageBtn').addEventListener('click', copyMessage);
    
    // Handle regenerate button
    document.getElementById('regenerateBtn').addEventListener('click', () => {
        const activeTone = document.querySelector('.tone-btn.active');
        if (activeTone) {
            generateFollowUp(activeTone.dataset.tone);
        } else {
            alert('Please select a tone first');
        }
    });
    
    // Handle message type selection
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Clear any existing message when type changes
            const activeTone = document.querySelector('.tone-btn.active');
            if (activeTone) {
                generateFollowUp(activeTone.dataset.tone);
            }
        });
    });
    
    // Handle tone selection
    document.querySelectorAll('.tone-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tone-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            generateFollowUp(this.dataset.tone);
        });
    });
});

async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        config = await response.json();
        
        populateSelect('category', config.categories);
        populateSelect('priority', config.priorities);
        populateSelect('status', config.statuses);
    } catch (error) {
        console.error('Error loading config:', error);
    }
}

async function loadTopics() {
    try {
        const response = await fetch('/api/topics');
        topics = await response.json();
        populateTopicDropdown();
    } catch (error) {
        console.error('Error loading topics:', error);
    }
}

function populateTopicDropdown() {
    const topicSelect = document.getElementById('taskTopic');
    if (!topicSelect) return;
    
    topicSelect.innerHTML = '<option value="">No Objective</option>';
    topics.forEach(topic => {
        if (topic.status !== 'Completed') {
            topicSelect.innerHTML += `<option value="${topic.id}">${escapeHtml(topic.title)}</option>`;
        }
    });
}

function populateSelect(id, options) {
    const select = document.getElementById(id);
    select.innerHTML = options.map(opt => 
        `<option value="${opt}">${opt}</option>`
    ).join('');
}

async function loadTasks() {
    try {
        const response = await fetch('/api/tasks');
        allTasks = await response.json();
        renderTasks();
        return true;
    } catch (error) {
        console.error('Error loading tasks:', error);
        return false;
    }
}

function filterTasks() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const showCompletedCancelled = document.getElementById('showCompletedCancelled').checked;
    
    let filtered = allTasks;
    
    // Filter out completed and cancelled tasks unless checkbox is checked
    if (!showCompletedCancelled) {
        filtered = filtered.filter(task => 
            task.status !== 'Completed' && task.status !== 'Cancelled'
        );
    }
    
    // Apply search filter if there's a search term
    if (searchTerm) {
        filtered = filtered.filter(task => {
            return (
                task.title.toLowerCase().includes(searchTerm) ||
                (task.description || '').toLowerCase().includes(searchTerm) ||
                (task.customer_name || '').toLowerCase().includes(searchTerm) ||
                (task.assigned_to || '').toLowerCase().includes(searchTerm) ||
                (task.tags || '').toLowerCase().includes(searchTerm)
            );
        });
    }
    
    renderTasksFiltered(filtered);
}

function renderTasksFiltered(tasks) {
    const viewType = document.getElementById('viewType').value;
    const container = document.getElementById('tasksContainer');
    
    if (viewType === 'list') {
        renderListView(tasks, container);
    } else {
        const groupBy = document.getElementById('groupBy').value;
        renderKanbanView(tasks, container, groupBy);
    }
}

function renderTasks() {
    // Use filterTasks to apply all filters including completed/cancelled
    filterTasks();
}

function renderListView(tasks, container) {
    container.className = 'tasks-container list-view';
    
    if (tasks.length === 0) {
        container.innerHTML = '<p class="empty-message">No tasks found</p>';
        return;
    }
    
    container.innerHTML = tasks.map(task => {
        const isOverdue = task.follow_up_date && new Date(task.follow_up_date) < new Date();
        const isUrgent = task.priority === 'Urgent';
        const className = isUrgent ? 'urgent' : (isOverdue ? 'overdue' : '');
        
        // Find the topic name if task has a topic_id
        let topicName = '';
        if (task.topic_id && topics) {
            const topic = topics.find(t => t.id === task.topic_id);
            topicName = topic ? topic.title : '';
        }
        
        return `
            <div class="task-list-item ${className}">
                <div class="task-info">
                    <div class="task-title">${escapeHtml(task.title)}</div>
                    <div class="task-meta">
                        Customer: ${escapeHtml(task.customer_name || 'N/A')} | 
                        Status: ${task.status} | 
                        Priority: <span class="${task.priority === 'Urgent' ? 'priority-urgent' : (task.priority === 'High' ? 'priority-high' : '')}">${task.priority}</span> | 
                        Due: ${task.follow_up_date || 'No date'}
                        ${topicName ? ` | <span style="color: #3498db;">📊 ${escapeHtml(topicName)}</span>` : ''}
                    </div>
                </div>
                <div class="task-actions">
                    <button class="edit-btn" onclick="editTask('${task.id}')">Edit</button>
                    <button class="followup-btn" onclick="generateTaskFollowUp('${task.id}')">Follow-up</button>
                    <button class="delete-btn" onclick="deleteTask('${task.id}')">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderKanbanView(tasks, container, groupBy) {
    container.className = 'tasks-container';
    
    const groups = {};
    const groupOptions = config[groupBy === 'status' ? 'statuses' : 
                              groupBy === 'category' ? 'categories' :
                              groupBy === 'priority' ? 'priorities' : []];
    
    if (groupBy === 'customer') {
        tasks.forEach(task => {
            const key = task.customer_name || 'Unassigned';
            if (!groups[key]) groups[key] = [];
            groups[key].push(task);
        });
    } else {
        groupOptions.forEach(option => {
            groups[option] = tasks.filter(task => task[groupBy] === option);
        });
    }
    
    const kanbanHTML = `
        <div class="kanban-board" data-group-by="${groupBy}">
            ${Object.entries(groups).map(([group, groupTasks]) => `
                <div class="kanban-column" data-group="${escapeHtml(group)}">
                    <div class="kanban-header">
                        <span>${escapeHtml(group)}</span>
                        <span class="task-count">(${groupTasks.length})</span>
                    </div>
                    <div class="kanban-cards" data-group-value="${escapeHtml(group)}">
                        ${groupTasks.length === 0 ? 
                            '<div class="empty-column-message">Drop tasks here</div>' : 
                            groupTasks.map(task => {
                            const isOverdue = task.follow_up_date && new Date(task.follow_up_date) < new Date();
                            const isUrgent = task.priority === 'Urgent';
                            const className = isUrgent ? 'urgent' : (isOverdue ? 'overdue' : '');
                            
                            // Find the topic name if task has a topic_id
                            let topicName = '';
                            if (task.topic_id && topics) {
                                const topic = topics.find(t => t.id === task.topic_id);
                                topicName = topic ? topic.title : '';
                            }
                            
                            return `
                                <div class="kanban-card ${className}" 
                                     draggable="true" 
                                     data-task-id="${task.id}"
                                     data-task='${JSON.stringify(task).replace(/'/g, '&#39;')}'>
                                    <div class="drag-handle">⋮⋮</div>
                                    <div class="kanban-card-content" onclick="editTask('${task.id}')">
                                        <div class="kanban-card-title">${escapeHtml(task.title)}</div>
                                        <div class="kanban-card-customer">${escapeHtml(task.customer_name || 'No customer')}</div>
                                        ${topicName ? `<div class="kanban-card-topic" style="color: #3498db; font-size: 0.85em; margin-top: 5px;">📊 ${escapeHtml(topicName)}</div>` : ''}
                                        ${task.tags ? `
                                            <div class="kanban-card-tags">
                                                ${task.tags.split(',').map(tag => 
                                                    `<span class="tag">${escapeHtml(tag.trim())}</span>`
                                                ).join('')}
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    container.innerHTML = kanbanHTML;
    
    // Initialize drag and drop
    initializeDragAndDrop(groupBy);
}

function showAddTaskModal() {
    currentTask = null;
    document.getElementById('modalTitle').textContent = 'Add Task';
    document.getElementById('taskForm').reset();
    document.getElementById('taskTopic').value = ''; // Clear topic selection
    document.getElementById('taskModal').style.display = 'block';
    
    // Update AI button visibility
    const generateFollowUpBtn = document.getElementById('generateFollowUpBtn');
    const enhanceTextBtn = document.getElementById('enhanceTextBtn');
    const generateSummaryBtn = document.getElementById('generateSummaryBtn');
    
    if (generateFollowUpBtn) {
        generateFollowUpBtn.style.display = window.hasApiKey ? 'inline-block' : 'none';
    }
    if (enhanceTextBtn) {
        enhanceTextBtn.style.display = window.hasApiKey ? 'inline-block' : 'none';
    }
    if (generateSummaryBtn) {
        generateSummaryBtn.style.display = 'none'; // Hide for new tasks
    }
}

function editTask(taskId) {
    currentTask = allTasks.find(t => t.id === taskId);
    if (!currentTask) return;
    
    // Update AI button visibility
    const generateFollowUpBtn = document.getElementById('generateFollowUpBtn');
    const enhanceTextBtn = document.getElementById('enhanceTextBtn');
    const generateSummaryBtn = document.getElementById('generateSummaryBtn');
    
    if (generateFollowUpBtn) {
        generateFollowUpBtn.style.display = window.hasApiKey ? 'inline-block' : 'none';
    }
    if (enhanceTextBtn) {
        enhanceTextBtn.style.display = window.hasApiKey ? 'inline-block' : 'none';
    }
    if (generateSummaryBtn) {
        generateSummaryBtn.style.display = window.hasApiKey ? 'inline-block' : 'none'; // Show for existing tasks
    }
    
    document.getElementById('modalTitle').textContent = 'Edit Task';
    document.getElementById('taskId').value = currentTask.id;
    document.getElementById('title').value = currentTask.title;
    document.getElementById('customerName').value = currentTask.customer_name || '';
    document.getElementById('description').value = currentTask.description || '';
    document.getElementById('category').value = currentTask.category || config.categories[0];
    document.getElementById('priority').value = currentTask.priority || config.priorities[0];
    document.getElementById('followUpDate').value = currentTask.follow_up_date || '';
    document.getElementById('status').value = currentTask.status || config.statuses[0];
    document.getElementById('assignedTo').value = currentTask.assigned_to || '';
    document.getElementById('tags').value = currentTask.tags || '';
    document.getElementById('taskTopic').value = currentTask.topic_id || '';
    
    document.getElementById('taskModal').style.display = 'block';
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
        topic_id: document.getElementById('taskTopic').value || null
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
            loadTasks();
        }
    } catch (error) {
        console.error('Error saving task:', error);
    }
}

async function deleteTask(taskId) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadTasks();
        }
    } catch (error) {
        console.error('Error deleting task:', error);
    }
}

function closeModal() {
    document.getElementById('taskModal').style.display = 'none';
}

function showFollowUpModal() {
    if (!currentTask && !document.getElementById('title').value) {
        alert('Please enter task details first');
        return;
    }
    
    document.getElementById('followUpModal').style.display = 'block';
}

function generateTaskFollowUp(taskId) {
    currentTask = allTasks.find(t => t.id === taskId);
    if (!currentTask) return;
    
    document.getElementById('followUpModal').style.display = 'block';
}

async function generateFollowUp(tone) {
    const messageDiv = document.getElementById('generatedMessage');
    const messageType = document.querySelector('.type-btn.active').dataset.type;
    
    messageDiv.innerHTML = '<div style="text-align: center; color: #3498db;">🔄 Generating message...</div>';
    
    const taskData = currentTask || {
        title: document.getElementById('title').value,
        customer_name: document.getElementById('customerName').value,
        description: document.getElementById('description').value,
        priority: document.getElementById('priority').value
    };
    
    try {
        const response = await fetch('/api/ai/follow-up', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                task: taskData,
                tone: tone,
                message_type: messageType
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Format the message nicely
            let formattedMessage = data.message;
            
            // Add appropriate formatting based on message type
            if (messageType === 'email') {
                messageDiv.innerHTML = `
                    <div class="message-preview email-preview">
                        <div class="message-header">📧 Email Preview</div>
                        <div class="message-body">${escapeHtml(formattedMessage)}</div>
                    </div>
                `;
            } else {
                messageDiv.innerHTML = `
                    <div class="message-preview chat-preview">
                        <div class="message-header">💬 Chat Message Preview</div>
                        <div class="message-body">${escapeHtml(formattedMessage)}</div>
                    </div>
                `;
            }
        } else {
            messageDiv.innerHTML = `<div style="color: red;">❌ Error: ${escapeHtml(data.error)}</div>`;
        }
    } catch (error) {
        messageDiv.innerHTML = `<div style="color: red;">❌ Error generating message: ${escapeHtml(error.message)}</div>`;
    }
}

function copyMessage() {
    const messageBody = document.querySelector('.message-body');
    if (messageBody) {
        const message = messageBody.textContent;
        navigator.clipboard.writeText(message).then(() => {
            // Show success feedback
            const btn = document.getElementById('copyMessageBtn');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<span style="margin-right: 5px;">✅</span> Copied!';
            btn.style.background = '#27ae60';
            
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.style.background = '';
            }, 2000);
        });
    } else {
        alert('Please generate a message first');
    }
}

async function exportTasks() {
    try {
        const response = await fetch('/api/export');
        const tasks = await response.json();
        
        const dataStr = JSON.stringify(tasks, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `tasks_export_${new Date().toISOString().split('T')[0]}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    } catch (error) {
        console.error('Error exporting tasks:', error);
    }
}

async function importTasks(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(event) {
        try {
            const tasks = JSON.parse(event.target.result);
            
            const response = await fetch('/api/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(tasks)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                alert(`Successfully imported ${result.imported} tasks`);
                loadTasks();
            } else {
                alert(`Error importing: ${result.error}`);
            }
        } catch (error) {
            alert('Error reading file: ' + error.message);
        }
    };
    
    reader.readAsText(file);
    e.target.value = '';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

// Drag and Drop functionality
let draggedElement = null;
let draggedTask = null;

function initializeDragAndDrop(groupBy) {
    const cards = document.querySelectorAll('.kanban-card');
    const columns = document.querySelectorAll('.kanban-cards');
    
    // Add drag event listeners to cards
    cards.forEach(card => {
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
    });
    
    // Add drop event listeners to columns
    columns.forEach(column => {
        column.addEventListener('dragover', handleDragOver);
        column.addEventListener('drop', handleDrop);
        column.addEventListener('dragenter', handleDragEnter);
        column.addEventListener('dragleave', handleDragLeave);
    });
}

function handleDragStart(e) {
    draggedElement = this;
    draggedTask = JSON.parse(this.dataset.task);
    
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
    
    // Add visual feedback
    setTimeout(() => {
        this.style.opacity = '0.4';
    }, 0);
}

function handleDragEnd(e) {
    this.style.opacity = '';
    this.classList.remove('dragging');
    
    // Remove all drag-over classes
    document.querySelectorAll('.kanban-cards').forEach(column => {
        column.classList.remove('drag-over');
    });
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    
    // Visual feedback for valid drop zone
    const afterElement = getDragAfterElement(this, e.clientY);
    if (afterElement == null) {
        this.appendChild(draggedElement);
    } else {
        this.insertBefore(draggedElement, afterElement);
    }
    
    return false;
}

function handleDragEnter(e) {
    this.classList.add('drag-over');
}

function handleDragLeave(e) {
    if (e.target === this) {
        this.classList.remove('drag-over');
    }
}

async function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    this.classList.remove('drag-over');
    
    const groupBy = document.querySelector('.kanban-board').dataset.groupBy;
    const newGroupValue = this.dataset.groupValue;
    
    // Only update if the group has changed
    if (draggedTask && newGroupValue) {
        const oldValue = draggedTask[groupBy];
        
        if (oldValue !== newGroupValue) {
            // Update the task
            draggedTask[groupBy] = newGroupValue;
            
            // Show updating indicator
            showUpdateIndicator(draggedElement);
            
            try {
                // Send update to server
                const response = await fetch(`/api/tasks/${draggedTask.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(draggedTask)
                });
                
                if (response.ok) {
                    // Update local data
                    const taskIndex = allTasks.findIndex(t => t.id === draggedTask.id);
                    if (taskIndex !== -1) {
                        allTasks[taskIndex] = draggedTask;
                    }
                    
                    // Update the card's data attribute
                    draggedElement.dataset.task = JSON.stringify(draggedTask);
                    
                    // Show success feedback
                    showSuccessIndicator(draggedElement);
                    
                    // Update column counts
                    updateColumnCounts();
                } else {
                    // Revert on error
                    showErrorIndicator(draggedElement);
                    loadTasks(); // Reload to revert changes
                }
            } catch (error) {
                console.error('Error updating task:', error);
                showErrorIndicator(draggedElement);
                loadTasks(); // Reload to revert changes
            }
        }
    }
    
    draggedElement = null;
    draggedTask = null;
    
    return false;
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.kanban-card:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function updateColumnCounts() {
    const columns = document.querySelectorAll('.kanban-column');
    columns.forEach(column => {
        const cards = column.querySelectorAll('.kanban-card').length;
        const countElement = column.querySelector('.task-count');
        if (countElement) {
            countElement.textContent = `(${cards})`;
        }
    });
}

function showUpdateIndicator(element) {
    element.classList.add('updating');
}

function showSuccessIndicator(element) {
    element.classList.remove('updating');
    element.classList.add('update-success');
    setTimeout(() => {
        element.classList.remove('update-success');
    }, 1000);
}

function showErrorIndicator(element) {
    element.classList.remove('updating');
    element.classList.add('update-error');
    setTimeout(() => {
        element.classList.remove('update-error');
    }, 1000);
}

// Task Summary Functions
function showSummaryModal() {
    if (!currentTask && !document.getElementById('title').value) {
        alert('Please enter task details first or save the task');
        return;
    }
    
    // Show/hide summary button based on API key
    const generateSummaryBtn = document.getElementById('generateSummaryBtn');
    if (generateSummaryBtn) {
        generateSummaryBtn.style.display = window.hasApiKey ? 'inline-block' : 'none';
    }
    
    if (!window.hasApiKey) {
        alert('Please configure your API key in Settings to use AI features');
        return;
    }
    
    document.getElementById('summaryModal').style.display = 'block';
    
    // Add event listeners for summary type buttons
    document.querySelectorAll('.summary-type-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.summary-type-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            generateTaskSummary(this.dataset.type);
        });
    });
    
    // Add event listeners for modal buttons
    document.getElementById('regenerateSummaryBtn').addEventListener('click', () => {
        const activeType = document.querySelector('.summary-type-btn.active').dataset.type;
        generateTaskSummary(activeType);
    });
    
    document.getElementById('copySummaryBtn').addEventListener('click', copySummary);
    
    document.getElementById('closeSummaryBtn').addEventListener('click', () => {
        document.getElementById('summaryModal').style.display = 'none';
    });
    
    // Generate initial summary
    generateTaskSummary('executive');
}

async function generateTaskSummary(summaryType) {
    const summaryDiv = document.getElementById('summaryContent');
    
    // Show loading
    summaryDiv.innerHTML = '<div class="summary-loading"><span class="loading-spinner">⟳</span> Generating ' + 
                          (summaryType === 'executive' ? 'executive summary' : 'detailed analysis') + '...</div>';
    
    // Get task ID
    const taskId = currentTask?.id || document.getElementById('taskId').value;
    
    if (!taskId) {
        summaryDiv.innerHTML = '<div style="color: red;">❌ Please save the task first to generate a summary</div>';
        return;
    }
    
    try {
        const response = await fetch(`/api/ai/task-summary/${taskId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: summaryType
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Format the summary nicely
            const formattedSummary = formatTaskSummary(data.summary, summaryType);
            summaryDiv.innerHTML = `
                <div class="summary-result ${summaryType}">
                    <div class="summary-header">
                        ${summaryType === 'executive' ? '📊 Executive Summary' : '📋 Detailed Analysis'}
                    </div>
                    <div class="summary-body">
                        ${formattedSummary}
                    </div>
                    <div class="summary-footer">
                        Generated at ${new Date().toLocaleTimeString()}
                    </div>
                </div>
            `;
        } else {
            summaryDiv.innerHTML = `<div style="color: red;">❌ Error: ${escapeHtml(data.error)}</div>`;
        }
    } catch (error) {
        summaryDiv.innerHTML = `<div style="color: red;">❌ Error generating summary: ${escapeHtml(error.message)}</div>`;
    }
}

function formatTaskSummary(text, summaryType) {
    if (!text) return '<p>No summary available</p>';
    
    // Escape HTML first
    let formatted = escapeHtml(text);
    
    // Convert line breaks to paragraphs
    let paragraphs = formatted.split(/\n\n+/);
    
    let html = '';
    paragraphs.forEach(paragraph => {
        if (paragraph.trim()) {
            // Check if it's a numbered or bulleted list
            if (/^\d+\.|^[-*•]/.test(paragraph.trim())) {
                // Process as list
                const lines = paragraph.split('\n');
                html += '<ul class="summary-list">';
                lines.forEach(line => {
                    const cleanLine = line.replace(/^\d+\.\s*|^[-*•]\s*/, '').trim();
                    if (cleanLine) {
                        html += `<li>${cleanLine}</li>`;
                    }
                });
                html += '</ul>';
            } else {
                // Regular paragraph
                html += `<p class="summary-paragraph">${paragraph}</p>`;
            }
        }
    });
    
    // Highlight important keywords
    html = html.replace(/\b(OVERDUE|URGENT|CRITICAL|BLOCKED)\b/gi, '<span class="highlight-urgent">$1</span>');
    html = html.replace(/\b(completed|done|finished|resolved)\b/gi, '<span class="highlight-completed">$1</span>');
    html = html.replace(/\b(pending|in progress|ongoing)\b/gi, '<span class="highlight-pending">$1</span>');
    
    return html;
}

function copySummary() {
    const summaryBody = document.querySelector('.summary-body');
    if (summaryBody) {
        const text = summaryBody.textContent;
        navigator.clipboard.writeText(text).then(() => {
            const btn = document.getElementById('copySummaryBtn');
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<span style="margin-right: 5px;">✅</span> Copied!';
            btn.style.background = '#27ae60';
            
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.style.background = '';
            }, 2000);
        });
    } else {
        alert('Please generate a summary first');
    }
}