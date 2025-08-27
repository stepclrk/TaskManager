// Enhanced Task Management - Main Integration

let quillEditor = null;
let selectedDependencies = [];

document.addEventListener('DOMContentLoaded', function() {
    // Initialize enhanced features
    initializeEnhancedFeatures();
});

async function initializeEnhancedFeatures() {
    // Load templates
    const templates = await window.enhancedFeatures.loadTemplates();
    window.enhancedFeatures.populateTemplateSelector(templates);
    
    // Initialize Rich Text Editor
    initializeQuillEditor();
    
    // Setup tab switching
    setupTabSwitching();
    
    // Setup file upload
    setupFileUpload();
    
    // Setup event listeners for enhanced features
    setupEnhancedEventListeners();
    
    // Override the original showAddTaskModal to include template selector
    const originalShowAddTaskModal = window.showAddTaskModal;
    window.showAddTaskModal = async function() {
        if (originalShowAddTaskModal) originalShowAddTaskModal();
        document.getElementById('templateSelector').style.display = 'block';
        resetTabs();
        
        // Reload templates when opening modal
        const templates = await window.enhancedFeatures.loadTemplates();
        window.enhancedFeatures.populateTemplateSelector(templates);
    };
    
    // Override the original editTask to load enhanced data
    const originalEditTask = window.editTask;
    window.editTask = function(taskId) {
        if (originalEditTask) originalEditTask(taskId);
        document.getElementById('templateSelector').style.display = 'none';
        loadEnhancedTaskData(taskId);
        resetTabs();
    };
    
    // Override save task to include enhanced fields
    const originalSaveTask = window.saveTask;
    window.saveTask = async function(e) {
        e.preventDefault();
        
        // Get rich text content
        if (quillEditor) {
            document.getElementById('description').value = quillEditor.root.innerHTML;
        }
        
        // Call original save
        if (originalSaveTask) await originalSaveTask(e);
    };
}

function initializeQuillEditor() {
    const container = document.getElementById('descriptionEditor');
    if (!container) return;
    
    quillEditor = new Quill('#descriptionEditor', {
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
        placeholder: 'Enter task description...'
    });
    
    // Make quillEditor globally accessible for template application
    window.quillEditor = quillEditor;
    
    // Also store reference on the container for backup access
    container.__quill = quillEditor;
}

function setupTabSwitching() {
    document.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', function() {
            const tabName = this.dataset.tab;
            
            // Update active button
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            this.classList.add('active');
            
            // Update active panel
            document.querySelectorAll('.tab-panel').forEach(panel => {
                panel.classList.remove('active');
            });
            document.getElementById(tabName + 'Tab').classList.add('active');
        });
    });
}

function resetTabs() {
    // Reset to first tab
    document.querySelectorAll('.tab-btn').forEach((btn, index) => {
        btn.classList.toggle('active', index === 0);
    });
    document.querySelectorAll('.tab-panel').forEach((panel, index) => {
        panel.classList.toggle('active', index === 0);
    });
}

function setupFileUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    
    if (!uploadArea || !fileInput) return;
    
    uploadArea.addEventListener('click', () => fileInput.click());
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        handleFileUpload(files);
    });
    
    fileInput.addEventListener('change', (e) => {
        handleFileUpload(e.target.files);
    });
}

async function handleFileUpload(files) {
    const taskId = document.getElementById('taskId').value;
    if (!taskId) {
        alert('Please save the task first before adding attachments');
        return;
    }
    
    for (const file of files) {
        await window.enhancedFeatures.uploadAttachment(taskId, file);
    }
}

function setupEnhancedEventListeners() {
    // Template application
    const applyBtn = document.getElementById('applyTemplateBtn');
    if (applyBtn) {
        applyBtn.addEventListener('click', window.enhancedFeatures.applyTemplate);
    }
    
    // Create from template button
    const templateBtn = document.getElementById('createFromTemplateBtn');
    if (templateBtn) {
        templateBtn.addEventListener('click', () => {
            showAddTaskModal();
            document.getElementById('templateSelector').style.display = 'block';
        });
    }
    
    // AI text enhancement - Disabled to avoid duplicate event listeners
    // The enhance button click handler is already set up in tasks.js
    // This prevents the enhancement type prompt from appearing twice
    
    // Similar tasks detection on title change
    const titleInput = document.getElementById('title');
    if (titleInput) {
        let debounceTimer;
        titleInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const title = titleInput.value;
                const description = quillEditor ? quillEditor.getText() : '';
                const customer = document.getElementById('customerName').value;
                
                if (title.length > 3) {
                    window.enhancedFeatures.checkSimilarTasks(title, description, customer);
                }
            }, 500);
        });
    }
    
    // Initialize comment Quill editor
    let commentQuillEditor = null;
    if (document.getElementById('commentEditor')) {
        commentQuillEditor = new Quill('#commentEditor', {
            theme: 'snow',
            modules: {
                toolbar: [
                    ['bold', 'italic', 'underline'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['link', 'blockquote'],
                    ['clean']
                ]
            },
            placeholder: 'Add a comment...'
        });
    }
    
    // Add comment with rich text support
    const addCommentBtn = document.getElementById('addCommentBtn');
    if (addCommentBtn) {
        addCommentBtn.addEventListener('click', async () => {
            const taskId = document.getElementById('taskId').value;
            
            // Get HTML content from Quill editor
            let commentHtml = '';
            if (commentQuillEditor) {
                commentHtml = commentQuillEditor.root.innerHTML;
                // Also update hidden textarea
                document.getElementById('newComment').value = commentHtml;
            } else {
                // Fallback to plain textarea
                commentHtml = document.getElementById('newComment').value;
            }
            
            // Check if comment is not empty (strip HTML tags for check)
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = commentHtml;
            const textContent = tempDiv.textContent || tempDiv.innerText || '';
            
            if (taskId && textContent.trim()) {
                await window.enhancedFeatures.addComment(taskId, commentHtml);
                
                // Clear the editors
                if (commentQuillEditor) {
                    commentQuillEditor.setText('');
                }
                document.getElementById('newComment').value = '';
            }
        });
    }
    
    // Add dependency
    const addDepBtn = document.getElementById('addDependencyBtn');
    if (addDepBtn) {
        addDepBtn.addEventListener('click', showDependencyPicker);
    }
    
    // Dependency modal handlers
    const depModal = document.getElementById('dependencyModal');
    if (depModal) {
        document.getElementById('cancelDepBtn').addEventListener('click', () => {
            depModal.style.display = 'none';
        });
        
        document.getElementById('selectDepBtn').addEventListener('click', () => {
            addSelectedDependencies();
            depModal.style.display = 'none';
        });
    }
}

function loadEnhancedTaskData(taskId) {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;
    
    // Load rich text description
    if (quillEditor && task.description) {
        if (task.description.includes('<')) {
            quillEditor.root.innerHTML = task.description;
        } else {
            quillEditor.setText(task.description);
        }
    }
    
    // Load comments
    window.enhancedFeatures.loadComments(taskId);
    const commentCount = (task.comments || []).length;
    document.getElementById('commentCount').textContent = commentCount > 0 ? commentCount : '';
    
    // Load attachments
    window.enhancedFeatures.loadAttachments(taskId);
    const attachmentCount = (task.attachments || []).length;
    document.getElementById('attachmentCount').textContent = attachmentCount > 0 ? attachmentCount : '';
    
    // Load history
    window.enhancedFeatures.loadHistory(taskId);
    
    // Load dependencies
    window.enhancedFeatures.loadDependencies(taskId);
}

function showDependencyPicker() {
    const modal = document.getElementById('dependencyModal');
    const list = document.getElementById('depTaskList');
    const currentTaskId = document.getElementById('taskId').value;
    
    // Get current task's dependencies
    const currentTask = currentTaskId ? allTasks.find(t => t.id === currentTaskId) : null;
    const currentDependencies = currentTask?.dependencies || [];
    
    // Populate with available tasks
    const availableTasks = allTasks.filter(t => 
        t.id !== currentTaskId && 
        t.status !== 'Completed'
    );
    
    list.innerHTML = availableTasks.map(task => {
        const isSelected = currentDependencies.includes(task.id);
        return `
            <div class="dep-task-item ${isSelected ? 'selected' : ''}" data-task-id="${task.id}">
                <strong>${escapeHtml(task.title)}</strong>
                <small>${escapeHtml(task.customer_name || 'N/A')}</small>
            </div>
        `;
    }).join('');
    
    // Add click handlers
    list.querySelectorAll('.dep-task-item').forEach(item => {
        item.addEventListener('click', function() {
            this.classList.toggle('selected');
        });
    });
    
    modal.style.display = 'block';
}

function addSelectedDependencies() {
    const selected = document.querySelectorAll('.dep-task-item.selected');
    const taskId = document.getElementById('taskId').value;
    
    // Clear and rebuild the dependencies list based on current selection
    selectedDependencies = [];
    selected.forEach(item => {
        const depId = item.dataset.taskId;
        selectedDependencies.push(depId);
    });
    
    // Update the task with new dependencies and save to server
    if (taskId) {
        const task = allTasks.find(t => t.id === taskId);
        if (task) {
            task.dependencies = selectedDependencies;
            
            // Save dependencies to server
            fetch(`/api/tasks/${taskId}/dependencies`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    dependencies: selectedDependencies
                })
            }).then(response => {
                if (!response.ok) {
                    console.error('Failed to save dependencies');
                }
            }).catch(error => {
                console.error('Error saving dependencies:', error);
            });
        }
    }
    
    // Refresh dependencies display
    window.enhancedFeatures.loadDependencies(taskId);
}