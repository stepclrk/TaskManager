let lastSummaryTime = null;
window.hasApiKey = false;

async function checkApiKeyAndSetupAI() {
    try {
        const response = await fetch('/api/settings');
        const settings = await response.json();
        
        // Check if API key exists and is not empty
        if (settings.api_key && settings.api_key !== '' && !settings.api_key.startsWith('***')) {
            window.hasApiKey = true;
        } else if (settings.api_key && settings.api_key.startsWith('***')) {
            // API key is masked, so it exists
            window.hasApiKey = true;
        } else {
            window.hasApiKey = false;
        }
        
        // Show/hide AI features based on API key
        const aiSection = document.getElementById('aiSummarySection');
        if (window.hasApiKey) {
            aiSection.style.display = 'block';
            
            // Load last summary time from localStorage
            const savedTime = localStorage.getItem('lastSummaryTime');
            if (savedTime) {
                lastSummaryTime = new Date(savedTime);
            }
            
            // Check if we should auto-generate summary
            checkAndGenerateSummary();
            
            // Setup generate button listener
            document.getElementById('generateSummaryBtn').addEventListener('click', () => {
                generateAISummary(true); // Force manual generation
            });
            
            // Set up auto-refresh every 30 minutes to check if summary needs updating
            setInterval(() => {
                checkAndGenerateSummary();
            }, 30 * 60 * 1000); // 30 minutes
        } else {
            aiSection.style.display = 'none';
        }
    } catch (error) {
        console.error('Error checking API key:', error);
        window.hasApiKey = false;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    loadDashboard();
    
    // Check for API key and setup AI features
    checkApiKeyAndSetupAI();
    
    document.getElementById('refreshBtn').addEventListener('click', () => {
        loadDashboard();
        // Only check summary if API key exists
        if (window.hasApiKey) {
            checkAndGenerateSummary();
        }
    });
});

async function loadDashboard() {
    try {
        const response = await fetch('/api/tasks/summary');
        const summary = await response.json();
        
        document.getElementById('activeObjectives').textContent = summary.active_objectives || 0;
        document.getElementById('totalTasks').textContent = summary.total;
        document.getElementById('openTasks').textContent = summary.open;
        document.getElementById('dueToday').textContent = summary.due_today;
        document.getElementById('overdueTasks').textContent = summary.overdue;
        
        displayActiveObjectives(summary.objectives || []);
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

function formatAISummary(text) {
    if (!text) return '<p class="empty-message">No summary available</p>';
    
    // Escape HTML first
    let formatted = escapeHtml(text);
    
    // Handle "Summary:" prefix if present
    formatted = formatted.replace(/^Summary:\s*/i, '');
    
    // Split into paragraphs (double newlines)
    let paragraphs = formatted.split(/\n\n+/);
    
    let html = '';
    
    paragraphs.forEach(paragraph => {
        // Check if paragraph contains a list (lines starting with -, *, or numbers)
        const lines = paragraph.split('\n');
        
        // Check if this looks like a list
        const isBulletList = lines.some(line => /^\s*[-*•]\s+/.test(line));
        const isNumberedList = lines.some(line => /^\s*\d+[\.)]\s+/.test(line));
        
        if (isBulletList || isNumberedList) {
            // Process as a list
            html += '<ul class="summary-list">';
            lines.forEach(line => {
                // Remove bullet points and clean up
                const cleanLine = line
                    .replace(/^\s*[-*•]\s+/, '')
                    .replace(/^\s*\d+[\.)]\s+/, '')
                    .trim();
                
                if (cleanLine) {
                    // Check for key-value pairs (e.g., "Priority: High")
                    if (cleanLine.includes(':')) {
                        const [key, ...valueParts] = cleanLine.split(':');
                        const value = valueParts.join(':').trim();
                        
                        // Highlight certain keywords
                        let formattedValue = value;
                        if (/high|urgent|critical/i.test(value)) {
                            formattedValue = `<span class="highlight-urgent">${value}</span>`;
                        } else if (/medium|moderate/i.test(value)) {
                            formattedValue = `<span class="highlight-medium">${value}</span>`;
                        } else if (/low|minor/i.test(value)) {
                            formattedValue = `<span class="highlight-low">${value}</span>`;
                        } else if (/completed|done|finished/i.test(value)) {
                            formattedValue = `<span class="highlight-completed">${value}</span>`;
                        }
                        
                        html += `<li><strong>${key}:</strong> ${formattedValue}</li>`;
                    } else {
                        html += `<li>${cleanLine}</li>`;
                    }
                }
            });
            html += '</ul>';
        } else if (paragraph.trim()) {
            // Check if it's a heading (starts with uppercase and is short)
            if (paragraph.length < 50 && /^[A-Z]/.test(paragraph) && !paragraph.includes('.')) {
                html += `<h4 class="summary-heading">${paragraph}</h4>`;
            } else {
                // Regular paragraph
                // Highlight important keywords
                let highlightedParagraph = paragraph
                    .replace(/\b(\d+)\s+(task[s]?|item[s]?|ticket[s]?)\b/gi, '<strong>$1 $2</strong>')
                    .replace(/\b(urgent|critical|high priority|important)\b/gi, '<span class="highlight-urgent">$1</span>')
                    .replace(/\b(completed|done|finished|resolved)\b/gi, '<span class="highlight-completed">$1</span>')
                    .replace(/\b(pending|in progress|ongoing)\b/gi, '<span class="highlight-pending">$1</span>');
                
                html += `<p class="summary-paragraph">${highlightedParagraph}</p>`;
            }
        }
    });
    
    return html || '<p class="empty-message">No summary content</p>';
}

function checkAndGenerateSummary() {
    // Always load summary - server handles caching logic
    generateAISummary(false); // Auto-load/generate (server decides if cached or new)
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
        // Check if we should include completed/cancelled tasks
        const includeCompletedCancelled = document.getElementById('includeCompletedCancelled')?.checked || false;
        
        const response = await fetch('/api/ai/summary', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                includeCompletedCancelled: includeCompletedCancelled,
                forceRegenerate: isManual  // Force regenerate on manual refresh
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Format the summary with better styling
            const formattedSummary = formatAISummary(data.summary);
            
            // Show cache status if cached
            let cacheInfo = '';
            if (data.cached) {
                const ageMinutes = data.cache_age_minutes;
                if (ageMinutes < 60) {
                    cacheInfo = `<span style="color: #666; font-size: 0.9em;">(Cached ${ageMinutes} minute${ageMinutes !== 1 ? 's' : ''} ago)</span>`;
                } else {
                    const ageHours = Math.floor(ageMinutes / 60);
                    cacheInfo = `<span style="color: #666; font-size: 0.9em;">(Cached ${ageHours} hour${ageHours !== 1 ? 's' : ''} ago)</span>`;
                }
            }
            
            const summaryContent = `
                <div class="summary-content">
                    ${formattedSummary}
                    <div class="summary-meta">
                        <span class="summary-timestamp"></span>
                        ${cacheInfo}
                        <span class="auto-refresh-info">Auto-refreshes every 3 hours</span>
                    </div>
                </div>
            `;
            
            summaryDiv.innerHTML = summaryContent;
            
            // Update the timestamp based on server data
            if (data.cache_timestamp) {
                lastSummaryTime = new Date(data.cache_timestamp);
            } else {
                lastSummaryTime = new Date();
            }
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

function displayActiveObjectives(objectives) {
    const container = document.getElementById('activeObjectivesList');
    
    if (!objectives || objectives.length === 0) {
        container.innerHTML = '<p class="empty-message">No active objectives</p>';
        return;
    }
    
    container.innerHTML = objectives.map(obj => {
        const scorePercent = Math.round((obj.okr_score || 0) * 100);
        const confidencePercent = Math.round((obj.confidence || 0.5) * 100);
        const scoreClass = scorePercent < 30 ? 'danger' : scorePercent < 70 ? 'warning' : 'success';
        
        return `
            <div class="objective-item clickable" onclick="window.location.href='/topics/${obj.id}'" 
                 style="padding: 12px; margin-bottom: 10px; border-left: 3px solid ${scoreClass === 'danger' ? '#e74c3c' : scoreClass === 'warning' ? '#f39c12' : '#27ae60'}; 
                        background: #f8f9fa; border-radius: 4px; cursor: pointer; transition: all 0.2s;"
                 onmouseover="this.style.background='#e9ecef'" 
                 onmouseout="this.style.background='#f8f9fa'">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: #2c3e50; margin-bottom: 4px;">
                            ${escapeHtml(obj.title)}
                        </div>
                        <div style="font-size: 0.85em; color: #666;">
                            <span style="display: inline-block; padding: 2px 6px; background: ${obj.type === 'committed' ? '#e3f2fd' : '#f3e5f5'}; 
                                         color: ${obj.type === 'committed' ? '#1976d2' : '#7b1fa2'}; border-radius: 3px; margin-right: 8px;">
                                ${obj.type === 'committed' ? 'Committed' : 'Aspirational'}
                            </span>
                            <span>${obj.period}</span>
                            ${obj.target_date ? ` • Due: ${obj.target_date}` : ''}
                        </div>
                    </div>
                    <div style="text-align: right; min-width: 80px;">
                        <div style="font-size: 1.2em; font-weight: bold; color: ${scoreClass === 'danger' ? '#e74c3c' : scoreClass === 'warning' ? '#f39c12' : '#27ae60'};">
                            ${scorePercent}%
                        </div>
                        <div style="font-size: 0.75em; color: #999;">OKR Score</div>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 10px; margin-top: 10px;">
                    <div style="background: white; padding: 8px; border-radius: 4px; text-align: center;">
                        <div style="font-size: 0.75em; color: #999;">Key Results</div>
                        <div style="font-weight: 600; color: #2c3e50;">
                            ${obj.key_results_completed}/${obj.key_results_count}
                        </div>
                    </div>
                    <div style="background: white; padding: 8px; border-radius: 4px; text-align: center;">
                        <div style="font-size: 0.75em; color: #999;">Tasks</div>
                        <div style="font-weight: 600; color: #2c3e50;">
                            ${obj.active_tasks}/${obj.total_tasks}
                        </div>
                    </div>
                    <div style="background: white; padding: 8px; border-radius: 4px; text-align: center;">
                        <div style="font-size: 0.75em; color: #999;">Confidence</div>
                        <div style="font-weight: 600; color: #2c3e50;">
                            ${confidencePercent}%
                        </div>
                    </div>
                </div>
                
                ${obj.key_results_count > 0 ? `
                    <div style="margin-top: 10px;">
                        <div style="background: #e0e0e0; height: 6px; border-radius: 3px; overflow: hidden;">
                            <div style="background: linear-gradient(90deg, ${scoreClass === 'danger' ? '#e74c3c' : scoreClass === 'warning' ? '#f39c12' : '#27ae60'}, 
                                        ${scoreClass === 'danger' ? '#c0392b' : scoreClass === 'warning' ? '#e67e22' : '#229954'}); 
                                        height: 100%; width: ${scorePercent}%; transition: width 0.3s;"></div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function openTask(taskId) {
    // Store the task ID in sessionStorage so the tasks page knows which task to open
    sessionStorage.setItem('openTaskId', taskId);
    // Navigate to the tasks page
    window.location.href = '/tasks';
}