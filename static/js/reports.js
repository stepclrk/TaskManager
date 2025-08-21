// Reports functionality
let currentReportData = [];
let allTasks = [];

document.addEventListener('DOMContentLoaded', function() {
    loadInitialData();
    setupEventListeners();
});

async function loadInitialData() {
    try {
        const response = await fetch('/api/tasks');
        allTasks = await response.json();
    } catch (error) {
        console.error('Error loading tasks:', error);
    }
}

function setupEventListeners() {
    document.getElementById('reportType').addEventListener('change', handleReportTypeChange);
    document.getElementById('generateReportBtn').addEventListener('click', generateReport);
    document.getElementById('copyTableBtn').addEventListener('click', copyTableToClipboard);
    document.getElementById('copyTextBtn').addEventListener('click', showTextCopy);
    document.getElementById('exportCsvBtn').addEventListener('click', exportToCSV);
    document.getElementById('printBtn').addEventListener('click', printReport);
    document.getElementById('doCopyBtn').addEventListener('click', copyTextToClipboard);
}

function handleReportTypeChange() {
    const reportType = document.getElementById('reportType').value;
    const filterValueGroup = document.getElementById('filterValueGroup');
    const filterValue = document.getElementById('filterValue');
    
    if (reportType === 'assignee' || reportType === 'customer') {
        filterValueGroup.style.display = 'block';
        
        // Populate filter options based on report type
        const options = new Set();
        
        allTasks.forEach(task => {
            if (reportType === 'assignee' && task.assigned_to) {
                options.add(task.assigned_to);
            } else if (reportType === 'customer' && task.customer_name) {
                options.add(task.customer_name);
            }
        });
        
        filterValue.innerHTML = '<option value="">-- All --</option>';
        Array.from(options).sort().forEach(option => {
            filterValue.innerHTML += `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`;
        });
    } else {
        filterValueGroup.style.display = 'none';
    }
}

async function generateReport() {
    const reportType = document.getElementById('reportType').value;
    
    if (!reportType) {
        alert('Please select a report type');
        return;
    }
    
    const filterValue = document.getElementById('filterValue').value;
    const statusFilter = document.getElementById('statusFilter').value;
    const dateRange = document.getElementById('dateRange').value;
    
    // Filter tasks based on criteria
    let filteredTasks = [...allTasks];
    
    // Apply report type filter
    if (reportType === 'assignee' && filterValue) {
        filteredTasks = filteredTasks.filter(task => task.assigned_to === filterValue);
    } else if (reportType === 'customer' && filterValue) {
        filteredTasks = filteredTasks.filter(task => task.customer_name === filterValue);
    } else if (reportType === 'status') {
        filteredTasks = filteredTasks.filter(task => task.status === statusFilter);
    } else if (reportType === 'priority') {
        filteredTasks = filteredTasks.filter(task => task.priority === filterValue);
    }
    
    // Apply status filter (if not already filtered by status)
    if (statusFilter && reportType !== 'status') {
        filteredTasks = filteredTasks.filter(task => task.status === statusFilter);
    }
    
    // Apply date range filter
    if (dateRange) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        filteredTasks = filteredTasks.filter(task => {
            if (!task.follow_up_date) return dateRange !== 'overdue';
            
            const taskDate = new Date(task.follow_up_date);
            
            switch(dateRange) {
                case 'today':
                    return taskDate.toDateString() === today.toDateString();
                case 'week':
                    const weekAgo = new Date(today);
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    return taskDate >= weekAgo;
                case 'month':
                    const monthAgo = new Date(today);
                    monthAgo.setMonth(monthAgo.getMonth() - 1);
                    return taskDate >= monthAgo;
                case 'overdue':
                    return taskDate < today && task.status !== 'Completed';
                default:
                    return true;
            }
        });
    }
    
    currentReportData = filteredTasks;
    displayReport(filteredTasks);
    updateSummary(filteredTasks);
}

function displayReport(tasks) {
    const container = document.getElementById('reportTableContainer');
    
    if (tasks.length === 0) {
        container.innerHTML = `
            <div class="no-data">
                <h3>No Tasks Found</h3>
                <p>No tasks match the selected criteria</p>
            </div>
        `;
        document.getElementById('reportActions').style.display = 'none';
        document.getElementById('reportSummary').style.display = 'none';
        return;
    }
    
    // Build the table
    let tableHTML = `
        <table class="report-table" id="reportTable">
            <thead>
                <tr>
                    <th>Task Title</th>
                    <th>Customer</th>
                    <th>Assigned To</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Due Date</th>
                    <th>Description</th>
                    <th>Comments</th>
                    <th>Tags</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    tasks.forEach(task => {
        const isOverdue = task.follow_up_date && 
                         new Date(task.follow_up_date) < new Date() && 
                         task.status !== 'Completed';
        
        // Format comments
        let commentsHTML = '';
        if (task.comments && task.comments.length > 0) {
            commentsHTML = '<div class="comment-list">';
            task.comments.forEach(comment => {
                const date = new Date(comment.timestamp).toLocaleDateString();
                commentsHTML += `
                    <div class="comment-item">
                        <span class="comment-date">${date}:</span> ${escapeHtml(comment.text)}
                    </div>
                `;
            });
            commentsHTML += '</div>';
        } else {
            commentsHTML = '<span style="color: #999;">No comments</span>';
        }
        
        // Clean description (remove HTML tags for display)
        let description = task.description || '';
        if (description.includes('<')) {
            // Strip HTML tags
            const temp = document.createElement('div');
            temp.innerHTML = description;
            description = temp.textContent || temp.innerText || '';
        }
        description = description.substring(0, 200) + (description.length > 200 ? '...' : '');
        
        tableHTML += `
            <tr class="${isOverdue ? 'overdue-row' : ''}">
                <td><strong>${escapeHtml(task.title)}</strong></td>
                <td>${escapeHtml(task.customer_name || '-')}</td>
                <td>${escapeHtml(task.assigned_to || '-')}</td>
                <td><span class="status-badge status-${task.status.toLowerCase().replace(' ', '-')}">${task.status}</span></td>
                <td><span class="priority-${task.priority.toLowerCase()}">${task.priority}</span></td>
                <td>${task.follow_up_date || '-'} ${isOverdue ? '<span style="color: red;">(Overdue)</span>' : ''}</td>
                <td class="description-cell">${escapeHtml(description)}</td>
                <td>${commentsHTML}</td>
                <td>${escapeHtml(task.tags || '-')}</td>
            </tr>
        `;
    });
    
    tableHTML += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = tableHTML;
    document.getElementById('reportActions').style.display = 'flex';
    document.getElementById('reportSummary').style.display = 'block';
}

function updateSummary(tasks) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const summary = {
        total: tasks.length,
        open: tasks.filter(t => t.status === 'Open').length,
        inProgress: tasks.filter(t => t.status === 'In Progress').length,
        completed: tasks.filter(t => t.status === 'Completed').length,
        overdue: tasks.filter(t => 
            t.follow_up_date && 
            new Date(t.follow_up_date) < today && 
            t.status !== 'Completed'
        ).length
    };
    
    document.getElementById('totalCount').textContent = summary.total;
    document.getElementById('openCount').textContent = summary.open;
    document.getElementById('inProgressCount').textContent = summary.inProgress;
    document.getElementById('completedCount').textContent = summary.completed;
    document.getElementById('overdueCount').textContent = summary.overdue;
}

function copyTableToClipboard() {
    const table = document.getElementById('reportTable');
    if (!table) {
        alert('No report to copy');
        return;
    }
    
    const range = document.createRange();
    range.selectNode(table);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    
    try {
        document.execCommand('copy');
        window.getSelection().removeAllRanges();
        
        // Show feedback
        const btn = document.getElementById('copyTableBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '✅ Copied!';
        btn.style.background = '#27ae60';
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = '';
        }, 2000);
    } catch (err) {
        alert('Failed to copy table');
    }
}

function showTextCopy() {
    const copySection = document.getElementById('copySection');
    const copyContent = document.getElementById('copyContent');
    
    if (currentReportData.length === 0) {
        alert('No report to copy');
        return;
    }
    
    // Generate text version of the report
    let textReport = generateTextReport();
    
    copyContent.textContent = textReport;
    copySection.style.display = 'block';
    copySection.scrollIntoView({ behavior: 'smooth' });
}

function generateTextReport() {
    const reportType = document.getElementById('reportType').value;
    const filterValue = document.getElementById('filterValue').value;
    
    let header = `TASK REPORT\n`;
    header += `Generated: ${new Date().toLocaleString()}\n`;
    header += `Report Type: ${reportType}\n`;
    if (filterValue) {
        header += `Filter: ${filterValue}\n`;
    }
    header += `Total Tasks: ${currentReportData.length}\n`;
    header += `${'='.repeat(80)}\n\n`;
    
    let content = '';
    
    currentReportData.forEach((task, index) => {
        content += `${index + 1}. ${task.title}\n`;
        content += `   Customer: ${task.customer_name || 'N/A'}\n`;
        content += `   Assigned To: ${task.assigned_to || 'N/A'}\n`;
        content += `   Status: ${task.status} | Priority: ${task.priority}\n`;
        content += `   Due Date: ${task.follow_up_date || 'Not set'}\n`;
        
        // Add description
        if (task.description) {
            let desc = task.description;
            if (desc.includes('<')) {
                const temp = document.createElement('div');
                temp.innerHTML = desc;
                desc = temp.textContent || temp.innerText || '';
            }
            content += `   Description: ${desc.substring(0, 200)}${desc.length > 200 ? '...' : ''}\n`;
        }
        
        // Add comments
        if (task.comments && task.comments.length > 0) {
            content += `   Comments (${task.comments.length}):\n`;
            task.comments.forEach(comment => {
                const date = new Date(comment.timestamp).toLocaleDateString();
                content += `     - [${date}] ${comment.text}\n`;
            });
        }
        
        if (task.tags) {
            content += `   Tags: ${task.tags}\n`;
        }
        
        content += `\n`;
    });
    
    return header + content;
}

function copyTextToClipboard() {
    const copyContent = document.getElementById('copyContent');
    const text = copyContent.textContent;
    
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('doCopyBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '✅ Copied!';
        btn.style.background = '#27ae60';
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = '';
        }, 2000);
    }).catch(err => {
        alert('Failed to copy text');
    });
}

function exportToCSV() {
    if (currentReportData.length === 0) {
        alert('No report to export');
        return;
    }
    
    // Create CSV content
    let csv = 'Task Title,Customer,Assigned To,Status,Priority,Due Date,Description,Comments,Tags\n';
    
    currentReportData.forEach(task => {
        let description = task.description || '';
        if (description.includes('<')) {
            const temp = document.createElement('div');
            temp.innerHTML = description;
            description = temp.textContent || temp.innerText || '';
        }
        description = description.replace(/"/g, '""'); // Escape quotes
        
        let comments = '';
        if (task.comments && task.comments.length > 0) {
            comments = task.comments.map(c => {
                const date = new Date(c.timestamp).toLocaleDateString();
                return `[${date}] ${c.text}`;
            }).join('; ');
        }
        comments = comments.replace(/"/g, '""');
        
        csv += `"${task.title}","${task.customer_name || ''}","${task.assigned_to || ''}",`;
        csv += `"${task.status}","${task.priority}","${task.follow_up_date || ''}",`;
        csv += `"${description}","${comments}","${task.tags || ''}"\n`;
    });
    
    // Download CSV file
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `task_report_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function printReport() {
    window.print();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}