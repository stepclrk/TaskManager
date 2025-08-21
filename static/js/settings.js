let currentConfig = {};
let currentSettings = {};
let currentTemplates = [];

document.addEventListener('DOMContentLoaded', function() {
    loadSettings();
    loadConfig();
    loadTemplates();
    
    document.getElementById('apiSettingsForm').addEventListener('submit', saveApiSettings);
    document.getElementById('notificationSettingsForm').addEventListener('submit', saveNotificationSettings);
    
    document.getElementById('addCategoryBtn').addEventListener('click', () => addItem('categories'));
    document.getElementById('addStatusBtn').addEventListener('click', () => addItem('statuses'));
    document.getElementById('addPriorityBtn').addEventListener('click', () => addItem('priorities'));
    document.getElementById('addTagBtn').addEventListener('click', () => addItem('tags'));
    
    document.getElementById('addTemplateBtn').addEventListener('click', addTemplate);
    
    document.getElementById('saveAllBtn').addEventListener('click', saveAllConfig);
    document.getElementById('resetBtn').addEventListener('click', resetToDefaults);
    
    document.getElementById('newCategory').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addItem('categories');
    });
    document.getElementById('newStatus').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addItem('statuses');
    });
    document.getElementById('newPriority').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addItem('priorities');
    });
    document.getElementById('newTag').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addItem('tags');
    });
});

async function loadSettings() {
    try {
        const response = await fetch('/api/settings');
        currentSettings = await response.json();
        
        document.getElementById('apiKey').value = currentSettings.api_key || '';
        document.getElementById('notificationsEnabled').checked = currentSettings.notifications_enabled;
        document.getElementById('checkInterval').value = currentSettings.check_interval || 60;
        
        // Show AI status
        const statusMessage = document.getElementById('aiStatusMessage');
        if (currentSettings.api_key && currentSettings.api_key !== '') {
            statusMessage.style.display = 'block';
            statusMessage.style.background = '#d4edda';
            statusMessage.style.color = '#155724';
            statusMessage.innerHTML = '✅ <strong>AI Features Enabled</strong> - Your Claude API key is configured.';
        } else {
            statusMessage.style.display = 'block';
            statusMessage.style.background = '#fff3cd';
            statusMessage.style.color = '#856404';
            statusMessage.innerHTML = '⚠️ <strong>AI Features Disabled</strong> - Add your Claude API key to enable AI features.';
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        currentConfig = await response.json();
        
        displayList('categories', currentConfig.categories);
        displayList('statuses', currentConfig.statuses);
        displayList('priorities', currentConfig.priorities);
        displayList('tags', currentConfig.tags);
    } catch (error) {
        console.error('Error loading config:', error);
    }
}

function displayList(type, items) {
    const container = document.getElementById(`${type}List`);
    
    container.innerHTML = items.map((item, index) => `
        <div class="list-item">
            <span>${escapeHtml(item)}</span>
            <button class="remove-btn" onclick="removeItem('${type}', ${index})">Remove</button>
        </div>
    `).join('');
}

function addItem(type) {
    const inputId = type === 'categories' ? 'newCategory' :
                   type === 'statuses' ? 'newStatus' :
                   type === 'priorities' ? 'newPriority' : 'newTag';
    
    const input = document.getElementById(inputId);
    const value = input.value.trim();
    
    if (!value) return;
    
    if (!currentConfig[type].includes(value)) {
        currentConfig[type].push(value);
        displayList(type, currentConfig[type]);
        input.value = '';
    } else {
        alert('This item already exists');
    }
}

function removeItem(type, index) {
    currentConfig[type].splice(index, 1);
    displayList(type, currentConfig[type]);
}

async function saveApiSettings(e) {
    e.preventDefault();
    
    const apiKey = document.getElementById('apiKey').value;
    
    if (!apiKey.startsWith('***')) {
        currentSettings.api_key = apiKey;
    }
    
    try {
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                api_key: apiKey
            })
        });
        
        if (response.ok) {
            if (apiKey && apiKey !== '') {
                alert('API settings saved successfully!\n\nAI features are now enabled:\n• AI Summary on Dashboard\n• Generate Follow-up Messages\n• Text Enhancement in Tasks');
            } else {
                alert('API key removed.\n\nAI features have been disabled.');
            }
        }
    } catch (error) {
        console.error('Error saving API settings:', error);
        alert('Error saving API settings');
    }
}

async function saveNotificationSettings(e) {
    e.preventDefault();
    
    const settings = {
        notifications_enabled: document.getElementById('notificationsEnabled').checked,
        check_interval: parseInt(document.getElementById('checkInterval').value)
    };
    
    try {
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        });
        
        if (response.ok) {
            alert('Notification settings saved successfully');
        }
    } catch (error) {
        console.error('Error saving notification settings:', error);
        alert('Error saving notification settings');
    }
}

async function saveAllConfig() {
    try {
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(currentConfig)
        });
        
        if (response.ok) {
            alert('Configuration saved successfully');
        }
    } catch (error) {
        console.error('Error saving config:', error);
        alert('Error saving configuration');
    }
}

function resetToDefaults() {
    if (!confirm('Are you sure you want to reset all configuration to defaults?')) return;
    
    currentConfig = {
        categories: ['Development', 'Support', 'Bug', 'Feature', 'Documentation'],
        statuses: ['Open', 'In Progress', 'Pending', 'Completed', 'Cancelled'],
        priorities: ['Low', 'Medium', 'High', 'Urgent'],
        tags: ['Frontend', 'Backend', 'Database', 'API', 'UI', 'Security']
    };
    
    displayList('categories', currentConfig.categories);
    displayList('statuses', currentConfig.statuses);
    displayList('priorities', currentConfig.priorities);
    displayList('tags', currentConfig.tags);
    
    saveAllConfig();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}


// Template Management Functions
async function loadTemplates() {
    try {
        const response = await fetch('/api/templates');
        if (response.ok) {
            const data = await response.json();
            // Ensure currentTemplates is always an array
            currentTemplates = Array.isArray(data) ? data : [];
            displayTemplates();
        }
    } catch (error) {
        console.error('Error loading templates:', error);
        currentTemplates = []; // Initialize as empty array on error
    }
}

function displayTemplates() {
    const container = document.getElementById('templatesList');
    if (!container) return;
    
    if (currentTemplates.length === 0) {
        container.innerHTML = '<p>No templates defined yet.</p>';
        return;
    }
    
    container.innerHTML = currentTemplates.map((template, index) => `
        <div class="template-item">
            <div class="template-header">
                <strong>${escapeHtml(template.name)}</strong>
                <button class="remove-btn" onclick="removeTemplate(${index})">Remove</button>
            </div>
            <div class="template-details">
                <small>Title: ${escapeHtml(template.title_pattern)}</small>
                ${template.description ? `<br><small>Description: ${escapeHtml(template.description.substring(0, 100))}...</small>` : ''}
            </div>
        </div>
    `).join('');
}

async function addTemplate() {
    const name = document.getElementById('newTemplateName').value.trim();
    const titlePattern = document.getElementById('newTemplateTitle').value.trim();
    const description = document.getElementById('newTemplateDescription').value.trim();
    
    if (!name || !titlePattern) {
        alert('Template name and title pattern are required');
        return;
    }
    
    const template = {
        name: name,
        title_pattern: titlePattern,
        description: description,
        category: currentConfig.categories[0] || '',
        priority: currentConfig.priorities[1] || 'Medium',
        tags: []
    };
    
    try {
        const response = await fetch('/api/templates', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(template)
        });
        
        if (response.ok) {
            currentTemplates.push(template);
            displayTemplates();
            
            // Clear form
            document.getElementById('newTemplateName').value = '';
            document.getElementById('newTemplateTitle').value = '';
            document.getElementById('newTemplateDescription').value = '';
            
            alert('Template added successfully');
        } else {
            alert('Failed to add template');
        }
    } catch (error) {
        console.error('Error adding template:', error);
        alert('Error adding template');
    }
}

async function removeTemplate(index) {
    if (!confirm('Are you sure you want to remove this template?')) return;
    
    const template = currentTemplates[index];
    
    try {
        const response = await fetch(`/api/templates/${encodeURIComponent(template.name)}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            currentTemplates.splice(index, 1);
            displayTemplates();
        } else {
            alert('Failed to remove template');
        }
    } catch (error) {
        console.error('Error removing template:', error);
        alert('Error removing template');
    }
}