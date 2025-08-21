// Enhanced Task Management Features

// Template Management
async function loadTemplates() {
    try {
        const response = await fetch('/api/templates');
        const data = await response.json();
        return data.templates || [];
    } catch (error) {
        console.error('Error loading templates:', error);
        return [];
    }
}

function populateTemplateSelector(templates) {
    const select = document.getElementById('templateSelect');
    select.innerHTML = '<option value="">-- Select Template --</option>';
    
    templates.forEach(template => {
        const option = document.createElement('option');
        option.value = template.id;
        option.textContent = template.name;
        option.dataset.template = JSON.stringify(template);
        select.appendChild(option);
    });
}

function applyTemplate() {
    const select = document.getElementById('templateSelect');
    const selectedOption = select.options[select.selectedIndex];
    
    if (!selectedOption.value) return;
    
    const template = JSON.parse(selectedOption.dataset.template);
    
    // Apply template values
    if (template.title_pattern) {
        document.getElementById('title').value = template.title_pattern;
    }
    if (template.description) {
        const descField = document.getElementById('description');
        if (descField.quill) {
            descField.quill.setText(template.description);
        } else {
            descField.value = template.description;
        }
    }
    if (template.category) {
        document.getElementById('category').value = template.category;
    }
    if (template.priority) {
        document.getElementById('priority').value = template.priority;
    }
    if (template.tags) {
        document.getElementById('tags').value = template.tags;
    }
}

// Similar Tasks Detection
async function checkSimilarTasks(title, description, customer) {
    try {
        const response = await fetch('/api/tasks/similar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title, description, customer })
        });
        
        const similar = await response.json();
        
        if (similar && similar.length > 0) {
            showSimilarTasksWarning(similar);
        } else {
            hideSimilarTasksWarning();
        }
    } catch (error) {
        console.error('Error checking similar tasks:', error);
    }
}

function showSimilarTasksWarning(similarTasks) {
    const warning = document.getElementById('similarTasksWarning');
    const list = document.getElementById('similarTasksList');
    
    list.innerHTML = similarTasks.map(item => `
        <div class="similar-task-item">
            <span class="similarity-score">${Math.round(item.score)}% match</span>
            <strong>${escapeHtml(item.task.title)}</strong>
            <small>Customer: ${escapeHtml(item.task.customer_name || 'N/A')}</small>
            <button type="button" class="btn btn-small" onclick="viewTask('${item.task.id}')">View</button>
        </div>
    `).join('');
    
    warning.style.display = 'block';
}

function hideSimilarTasksWarning() {
    document.getElementById('similarTasksWarning').style.display = 'none';
}

// Comments System
function loadComments(taskId) {
    const task = allTasks.find(t => t.id === taskId);
    const comments = task?.comments || [];
    
    const container = document.getElementById('commentsContainer');
    if (!container) return;
    
    if (comments.length === 0) {
        container.innerHTML = '<p class="no-comments">No comments yet</p>';
    } else {
        container.innerHTML = comments.map(comment => `
            <div class="comment">
                <div class="comment-header">
                    <span class="comment-author">${escapeHtml(comment.author || 'Anonymous')}</span>
                    <span class="comment-time">${formatDate(comment.timestamp)}</span>
                </div>
                <div class="comment-text">${escapeHtml(comment.text)}</div>
            </div>
        `).join('');
    }
}

async function addComment(taskId, text) {
    try {
        const response = await fetch(`/api/tasks/${taskId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                author: 'Current User' // In a real app, this would be the logged-in user
            })
        });
        
        if (response.ok) {
            // Reload comments
            await loadTasks();
            loadComments(taskId);
            
            // Clear comment input
            document.getElementById('newComment').value = '';
        }
    } catch (error) {
        console.error('Error adding comment:', error);
    }
}

// Attachments System
function loadAttachments(taskId) {
    const task = allTasks.find(t => t.id === taskId);
    const attachments = task?.attachments || [];
    
    const container = document.getElementById('attachmentsList');
    if (!container) return;
    
    if (attachments.length === 0) {
        container.innerHTML = '<p class="no-attachments">No attachments</p>';
    } else {
        container.innerHTML = attachments.map(attachment => `
            <div class="attachment-item">
                <span class="attachment-icon">📎</span>
                <span class="attachment-name">${escapeHtml(attachment.filename)}</span>
                <span class="attachment-size">${formatFileSize(attachment.size)}</span>
                <a href="/api/tasks/${taskId}/attachments/${attachment.id}" 
                   class="btn btn-small" download>Download</a>
            </div>
        `).join('');
    }
}

async function uploadAttachment(taskId, file) {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch(`/api/tasks/${taskId}/attachments`, {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            // Reload attachments
            await loadTasks();
            loadAttachments(taskId);
        }
    } catch (error) {
        console.error('Error uploading attachment:', error);
    }
}

// History Timeline
function loadHistory(taskId) {
    const task = allTasks.find(t => t.id === taskId);
    const history = task?.history || [];
    
    const container = document.getElementById('historyTimeline');
    if (!container) return;
    
    if (history.length === 0) {
        container.innerHTML = '<p class="no-history">No history available</p>';
    } else {
        // Sort history by timestamp (newest first)
        const sortedHistory = [...history].sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );
        
        container.innerHTML = sortedHistory.map(entry => `
            <div class="history-item">
                <div class="history-marker"></div>
                <div class="history-content">
                    <div class="history-time">${formatDate(entry.timestamp)}</div>
                    <div class="history-action">${formatHistoryAction(entry)}</div>
                </div>
            </div>
        `).join('');
    }
}

function formatHistoryAction(entry) {
    switch(entry.action) {
        case 'created':
            return 'Task created';
        case 'modified':
            return `Changed ${entry.field}: "${entry.old_value || 'empty'}" → "${entry.new_value}"`;
        case 'comment_added':
            return `Added comment: "${entry.new_value}"`;
        case 'attachment_added':
            return `Added attachment: ${entry.new_value}`;
        default:
            return entry.action;
    }
}

// Dependencies Management
function loadDependencies(taskId) {
    const task = allTasks.find(t => t.id === taskId);
    const dependencies = task?.dependencies || [];
    const blocks = task?.blocks || [];
    
    const depsContainer = document.getElementById('dependenciesList');
    const blocksContainer = document.getElementById('blocksList');
    
    if (depsContainer) {
        if (dependencies.length === 0) {
            depsContainer.innerHTML = '<p class="no-deps">No dependencies</p>';
        } else {
            depsContainer.innerHTML = dependencies.map(depId => {
                const depTask = allTasks.find(t => t.id === depId);
                return depTask ? `
                    <div class="dependency-item">
                        <span class="dep-status ${depTask.status.toLowerCase()}">${depTask.status}</span>
                        <span>${escapeHtml(depTask.title)}</span>
                        <button onclick="viewTask('${depId}')" class="btn btn-small">View</button>
                    </div>
                ` : '';
            }).join('');
        }
    }
    
    if (blocksContainer) {
        if (blocks.length === 0) {
            blocksContainer.innerHTML = '<p class="no-blocks">This task doesn\'t block any others</p>';
        } else {
            blocksContainer.innerHTML = blocks.map(blockId => {
                const blockTask = allTasks.find(t => t.id === blockId);
                return blockTask ? `
                    <div class="blocks-item">
                        <span>${escapeHtml(blockTask.title)}</span>
                        <button onclick="viewTask('${blockId}')" class="btn btn-small">View</button>
                    </div>
                ` : '';
            }).join('');
        }
    }
}

// Rich Text Editor with AI Enhancement
function initializeRichTextEditor(elementId) {
    const element = document.getElementById(elementId);
    if (!element || element.quill) return;
    
    // Create toolbar container
    const toolbarId = `${elementId}-toolbar`;
    const toolbar = document.createElement('div');
    toolbar.id = toolbarId;
    toolbar.className = 'quill-toolbar';
    element.parentNode.insertBefore(toolbar, element);
    
    // Initialize Quill
    const quill = new Quill(`#${elementId}`, {
        theme: 'snow',
        modules: {
            toolbar: {
                container: `#${toolbarId}`,
                handlers: {
                    'ai-enhance': function() {
                        enhanceTextWithAI(this.quill);
                    }
                }
            }
        }
    });
    
    // Add AI enhancement button to toolbar
    const aiButton = document.createElement('button');
    aiButton.className = 'ql-ai-enhance';
    aiButton.innerHTML = '✨ AI Enhance';
    aiButton.onclick = () => enhanceTextWithAI(quill);
    toolbar.appendChild(aiButton);
    
    element.quill = quill;
    return quill;
}

async function enhanceTextWithAI(quill) {
    const text = quill.getText();
    if (!text.trim()) {
        alert('Please enter some text to enhance');
        return;
    }
    
    // Show enhancement options
    const type = prompt('Choose enhancement type:\n1. Improve clarity\n2. Fix grammar\n3. Professional tone\n\nEnter 1, 2, or 3:');
    
    const typeMap = {
        '1': 'improve',
        '2': 'grammar',
        '3': 'professional'
    };
    
    const enhancementType = typeMap[type] || 'improve';
    
    try {
        const response = await fetch('/api/ai/enhance-text', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                type: enhancementType
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.enhanced_text) {
            if (confirm('Replace text with AI-enhanced version?')) {
                quill.setText(data.enhanced_text);
            }
        } else {
            alert('Error enhancing text: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error enhancing text:', error);
        alert('Error enhancing text');
    }
}

// Utility Functions
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`;
    
    return date.toLocaleDateString();
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

function viewTask(taskId) {
    // Close current modal if open
    const modal = document.getElementById('taskModal');
    if (modal) modal.style.display = 'none';
    
    // Open task for viewing
    setTimeout(() => editTask(taskId), 100);
}

// Export functions for use in main tasks.js
window.enhancedFeatures = {
    loadTemplates,
    populateTemplateSelector,
    applyTemplate,
    checkSimilarTasks,
    loadComments,
    addComment,
    loadAttachments,
    uploadAttachment,
    loadHistory,
    loadDependencies,
    initializeRichTextEditor,
    enhanceTextWithAI
};