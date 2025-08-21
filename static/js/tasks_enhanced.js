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
    window.showAddTaskModal = function() {
        if (originalShowAddTaskModal) originalShowAddTaskModal();
        document.getElementById('templateSelector').style.display = 'block';
        resetTabs();
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
    
    // AI text enhancement
    const enhanceBtn = document.getElementById('enhanceTextBtn');
    if (enhanceBtn) {
        enhanceBtn.addEventListener('click', async () => {
            if (!quillEditor) return;
            
            const text = quillEditor.getText();
            if (!text.trim()) {
                alert('Please enter some text to enhance');
                return;
            }
            
            const types = ['improve', 'grammar', 'professional'];
            const type = types[prompt('Choose:\n1. Improve clarity\n2. Fix grammar\n3. Professional tone\n\nEnter 1, 2, or 3:') - 1] || 'improve';
            
            try {
                const response = await fetch('/api/ai/enhance-text', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text, type })
                });
                
                const data = await response.json();
                if (response.ok && data.enhanced_text) {
                    if (confirm('Replace with enhanced version?')) {
                        quillEditor.setText(data.enhanced_text);
                    }
                }
            } catch (error) {
                console.error('Error enhancing text:', error);
            }
        });
    }
    
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
    
    // Add comment
    const addCommentBtn = document.getElementById('addCommentBtn');
    if (addCommentBtn) {
        addCommentBtn.addEventListener('click', async () => {
            const taskId = document.getElementById('taskId').value;
            const text = document.getElementById('newComment').value;
            
            if (taskId && text.trim()) {
                await window.enhancedFeatures.addComment(taskId, text);
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
    
    // Populate with available tasks
    const availableTasks = allTasks.filter(t => 
        t.id !== currentTaskId && 
        t.status !== 'Completed'
    );
    
    list.innerHTML = availableTasks.map(task => `
        <div class="dep-task-item" data-task-id="${task.id}">
            <strong>${escapeHtml(task.title)}</strong>
            <small>${escapeHtml(task.customer_name || 'N/A')}</small>
        </div>
    `).join('');
    
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
    
    selected.forEach(item => {
        const depId = item.dataset.taskId;
        if (!selectedDependencies.includes(depId)) {
            selectedDependencies.push(depId);
        }
    });
    
    // Update the task with new dependencies
    if (taskId) {
        const task = allTasks.find(t => t.id === taskId);
        if (task) {
            task.dependencies = selectedDependencies;
            // This would normally save to server
        }
    }
    
    // Refresh dependencies display
    window.enhancedFeatures.loadDependencies(taskId);
}