let lastSummaryTime = null;

document.addEventListener('DOMContentLoaded', function() {
    loadDashboard();
    
    // Load last summary time from localStorage
    const savedTime = localStorage.getItem('lastSummaryTime');
    if (savedTime) {
        lastSummaryTime = new Date(savedTime);
    }
    
    // Check if we should auto-generate summary
    checkAndGenerateSummary();
    
    document.getElementById('refreshBtn').addEventListener('click', () => {
        loadDashboard();
        checkAndGenerateSummary();
    });
    
    document.getElementById('generateSummaryBtn').addEventListener('click', () => {
        generateAISummary(true); // Force manual generation
    });
    
    // Set up auto-refresh every 30 minutes to check if summary needs updating
    setInterval(() => {
        checkAndGenerateSummary();
    }, 30 * 60 * 1000); // 30 minutes
});

async function loadDashboard() {
    try {
        const response = await fetch('/api/tasks/summary');
        const summary = await response.json();
        
        document.getElementById('totalTasks').textContent = summary.total;
        document.getElementById('openTasks').textContent = summary.open;
        document.getElementById('dueToday').textContent = summary.due_today;
        document.getElementById('overdueTasks').textContent = summary.overdue;
        
        displayUrgentTasks(summary.urgent);
        displayUpcomingTasks(summary.upcoming);
        displayCustomerTasks(summary.by_customer);
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function displayUrgentTasks(tasks) {
    const container = document.getElementById('urgentTasks');
    
    if (tasks.length === 0) {
        container.innerHTML = '<p class="empty-message">No urgent tasks</p>';
        return;
    }
    
    container.innerHTML = tasks.map(task => `
        <div class="task-item urgent clickable" onclick="openTask('${task.id}')" title="Click to edit">
            <div class="task-item-title">${escapeHtml(task.title)}</div>
            <div class="task-item-meta">
                Customer: ${escapeHtml(task.customer_name || 'N/A')} | 
                Due: ${task.follow_up_date || 'No date'}
            </div>
        </div>
    `).join('');
}

function displayUpcomingTasks(tasks) {
    const container = document.getElementById('upcomingTasks');
    
    if (tasks.length === 0) {
        container.innerHTML = '<p class="empty-message">No upcoming tasks</p>';
        return;
    }
    
    container.innerHTML = tasks.map(task => {
        const isOverdue = task.follow_up_date && new Date(task.follow_up_date) < new Date();
        const className = isOverdue ? 'overdue' : '';
        
        return `
            <div class="task-item ${className} clickable" onclick="openTask('${task.id}')" title="Click to edit">
                <div class="task-item-title">${escapeHtml(task.title)}</div>
                <div class="task-item-meta">
                    Due: ${task.follow_up_date} | Priority: ${task.priority}
                </div>
            </div>
        `;
    }).join('');
}

function displayCustomerTasks(customerTasks) {
    const container = document.getElementById('customerTasks');
    
    const customers = Object.keys(customerTasks);
    if (customers.length === 0) {
        container.innerHTML = '<p class="empty-message">No tasks assigned</p>';
        return;
    }
    
    let html = '';
    for (const customer of customers) {
        const tasks = customerTasks[customer];
        const openTasks = tasks.filter(t => t.status !== 'Completed');
        
        html += `
            <div class="customer-group">
                <div class="customer-header">
                    <span>${escapeHtml(customer)}</span>
                    <span class="customer-count">${openTasks.length} open / ${tasks.length} total</span>
                </div>
                <div class="customer-tasks">
                    ${tasks.slice(0, 3).map(task => `
                        <div class="customer-task-item clickable" onclick="openTask('${task.id}')" title="Click to edit">
                            <span class="task-title-small">${escapeHtml(task.title)}</span>
                            <span class="task-status-badge ${task.status.toLowerCase().replace(' ', '-')}">${task.status}</span>
                        </div>
                    `).join('')}
                    ${tasks.length > 3 ? `<div class="more-tasks">+${tasks.length - 3} more tasks</div>` : ''}
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

function checkAndGenerateSummary() {
    const THREE_HOURS = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
    const now = new Date();
    
    // Check if we need to generate summary
    const shouldGenerate = !lastSummaryTime || 
                          (now - lastSummaryTime) > THREE_HOURS;
    
    if (shouldGenerate) {
        generateAISummary(false); // Auto-generate
    } else {
        // Load cached summary if available
        const cachedSummary = localStorage.getItem('cachedSummary');
        if (cachedSummary) {
            const summaryDiv = document.getElementById('aiSummary');
            summaryDiv.innerHTML = cachedSummary;
            updateSummaryTimestamp();
        }
    }
}

async function generateAISummary(isManual = false) {
    const summaryDiv = document.getElementById('aiSummary');
    const button = document.getElementById('generateSummaryBtn');
    
    // Show loading state
    button.disabled = true;
    button.textContent = 'Generating...';
    
    if (isManual) {
        summaryDiv.innerHTML = '<div class="summary-loading"><span class="loading-spinner">⟳</span> Generating AI summary...</div>';
    } else {
        // For auto-generation, show a more subtle loading indicator
        summaryDiv.innerHTML = '<div class="summary-loading auto"><span class="loading-spinner">⟳</span> Auto-generating summary...</div>';
    }
    
    try {
        const response = await fetch('/api/ai/summary', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Format the summary with timestamp
            const summaryContent = `
                <div class="summary-content">
                    <p>${escapeHtml(data.summary)}</p>
                    <div class="summary-meta">
                        <span class="summary-timestamp"></span>
                        <span class="auto-refresh-info">Auto-refreshes every 3 hours</span>
                    </div>
                </div>
            `;
            
            summaryDiv.innerHTML = summaryContent;
            
            // Save to localStorage
            localStorage.setItem('cachedSummary', summaryContent);
            lastSummaryTime = new Date();
            localStorage.setItem('lastSummaryTime', lastSummaryTime.toISOString());
            
            updateSummaryTimestamp();
            
            // Show success feedback for manual generation
            if (isManual) {
                button.style.background = '#27ae60';
                button.textContent = '✓ Generated';
                setTimeout(() => {
                    button.style.background = '';
                    button.textContent = 'Refresh Summary';
                }, 2000);
            }
        } else {
            // Handle API key not configured or other errors
            if (data.error && data.error.includes('API key')) {
                summaryDiv.innerHTML = `
                    <div class="summary-error">
                        <p>⚠️ API key not configured</p>
                        <small>Please add your Anthropic API key in Settings to enable AI summaries.</small>
                    </div>
                `;
            } else {
                summaryDiv.innerHTML = `<div class="summary-error"><p>❌ Error: ${escapeHtml(data.error)}</p></div>`;
            }
        }
    } catch (error) {
        summaryDiv.innerHTML = `<div class="summary-error"><p>❌ Error generating summary: ${error.message}</p></div>`;
    } finally {
        button.disabled = false;
        button.textContent = 'Refresh Summary';
    }
}

function updateSummaryTimestamp() {
    const timestampElement = document.querySelector('.summary-timestamp');
    if (timestampElement && lastSummaryTime) {
        const now = new Date();
        const diff = now - lastSummaryTime;
        
        let timeAgo;
        if (diff < 60000) { // Less than 1 minute
            timeAgo = 'just now';
        } else if (diff < 3600000) { // Less than 1 hour
            const minutes = Math.floor(diff / 60000);
            timeAgo = `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        } else { // Hours
            const hours = Math.floor(diff / 3600000);
            timeAgo = `${hours} hour${hours > 1 ? 's' : ''} ago`;
        }
        
        timestampElement.textContent = `Last updated: ${timeAgo}`;
    }
}

// Update timestamp every minute
setInterval(updateSummaryTimestamp, 60000);

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function openTask(taskId) {
    // Store the task ID in sessionStorage so the tasks page knows which task to open
    sessionStorage.setItem('openTaskId', taskId);
    // Navigate to the tasks page
    window.location.href = '/tasks';
}