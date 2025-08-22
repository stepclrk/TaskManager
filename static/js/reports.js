// Reports functionality
let currentReportData = [];
let allTasks = [];
let allObjectives = [];
let allTopics = [];
let progressChart = null;
let statusChart = null;
let typeChart = null;
let topicsStatusChart = null;
let topicsTaskChart = null;

document.addEventListener('DOMContentLoaded', function() {
    loadInitialData();
    setupEventListeners();
    setupTabSwitching();
});

async function loadInitialData() {
    try {
        // Load tasks
        const tasksResponse = await fetch('/api/tasks');
        allTasks = await tasksResponse.json();
        
        // Load objectives
        const objectivesResponse = await fetch('/api/topics');
        allObjectives = await objectivesResponse.json();
        
        // Load topics (projects)
        const topicsResponse = await fetch('/api/projects');
        allTopics = await topicsResponse.json();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

function setupEventListeners() {
    // Task report listeners
    document.getElementById('reportType').addEventListener('change', handleReportTypeChange);
    document.getElementById('generateReportBtn').addEventListener('click', generateReport);
    document.getElementById('copyTableBtn').addEventListener('click', copyTableToClipboard);
    document.getElementById('copyTextBtn').addEventListener('click', showTextCopy);
    document.getElementById('exportCsvBtn').addEventListener('click', exportToCSV);
    document.getElementById('printBtn').addEventListener('click', printReport);
    document.getElementById('doCopyBtn').addEventListener('click', copyTextToClipboard);
    
    // OKR report listeners
    document.getElementById('generateOKRReportBtn').addEventListener('click', generateOKRReport);
    document.getElementById('copyOKRReportBtn').addEventListener('click', copyOKRReport);
    document.getElementById('exportOKRCSVBtn').addEventListener('click', exportOKRToCSV);
    document.getElementById('printOKRBtn').addEventListener('click', printOKRReport);
    
    // Topics report listeners
    document.getElementById('generateTopicsReportBtn').addEventListener('click', generateTopicsReport);
    document.getElementById('copyTopicsReportBtn').addEventListener('click', copyTopicsReport);
    document.getElementById('exportTopicsCSVBtn').addEventListener('click', exportTopicsToCSV);
    document.getElementById('printTopicsBtn').addEventListener('click', printTopicsReport);
}

function setupTabSwitching() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active class from all tabs
            tabButtons.forEach(b => {
                b.classList.remove('active');
                b.style.borderBottom = '3px solid transparent';
            });
            
            // Add active class to clicked tab
            this.classList.add('active');
            this.style.borderBottom = '3px solid #3498db';
            
            // Show/hide content
            const tabName = this.dataset.tab;
            document.getElementById('tasksTab').style.display = tabName === 'tasks' ? 'block' : 'none';
            document.getElementById('objectivesTab').style.display = tabName === 'objectives' ? 'block' : 'none';
            document.getElementById('topicsTab').style.display = tabName === 'topics' ? 'block' : 'none';
        });
    });
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
                <td>${formatFollowUpDate(task.follow_up_date)} ${isOverdue ? '<span style="color: red;">(Overdue)</span>' : ''}</td>
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
        content += `   Due Date: ${formatFollowUpDate(task.follow_up_date)}\n`;
        
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

function formatFollowUpDate(dateStr) {
    if (!dateStr) return '-';
    
    // Check if it includes time
    if (dateStr.includes('T') || (dateStr.includes(' ') && dateStr.length > 10)) {
        const date = new Date(dateStr);
        // Format with both date and time
        const dateOptions = { year: 'numeric', month: 'short', day: 'numeric' };
        const timeOptions = { hour: '2-digit', minute: '2-digit' };
        return date.toLocaleDateString(undefined, dateOptions) + ' ' + date.toLocaleTimeString(undefined, timeOptions);
    } else {
        // Just date
        const date = new Date(dateStr + 'T00:00:00');
        const dateOptions = { year: 'numeric', month: 'short', day: 'numeric' };
        return date.toLocaleDateString(undefined, dateOptions);
    }
}

// ============= OKR Reporting Functions =============

async function generateOKRReport() {
    // Get filter values
    const period = document.getElementById('okrPeriod').value;
    const type = document.getElementById('okrType').value;
    const status = document.getElementById('okrStatus').value;
    const owner = document.getElementById('okrOwner').value.toLowerCase();
    
    // Filter objectives
    let filteredObjectives = allObjectives.filter(obj => {
        if (period && obj.period !== period) return false;
        if (type && obj.objective_type !== type) return false;
        if (status && obj.status !== status) return false;
        if (owner && (!obj.owner || !obj.owner.toLowerCase().includes(owner))) return false;
        return true;
    });
    
    // Calculate statistics
    const stats = calculateOKRStatistics(filteredObjectives);
    
    // Display summary dashboard
    displayOKRSummary(stats);
    
    // Create charts
    createOKRCharts(filteredObjectives);
    
    // Generate detailed report
    generateDetailedOKRReport(filteredObjectives);
    
    // Show sections
    document.getElementById('okrSummaryDashboard').style.display = 'block';
    document.getElementById('okrDetailedReport').style.display = 'block';
    document.getElementById('okrReportActions').style.display = 'flex';
}

function calculateOKRStatistics(objectives) {
    const stats = {
        totalObjectives: objectives.length,
        avgOKRScore: 0,
        completedKRs: 0,
        totalKRs: 0,
        avgConfidence: 0,
        byStatus: {},
        byType: {},
        progressRanges: {
            '0-25%': 0,
            '26-50%': 0,
            '51-75%': 0,
            '76-100%': 0
        }
    };
    
    let totalScore = 0;
    let totalConfidence = 0;
    
    objectives.forEach(obj => {
        // Calculate OKR score
        const score = obj.okr_score || 0;
        totalScore += score;
        
        // Confidence
        totalConfidence += obj.confidence || 0;
        
        // Status counts
        stats.byStatus[obj.status || 'Active'] = (stats.byStatus[obj.status || 'Active'] || 0) + 1;
        
        // Type counts
        stats.byType[obj.objective_type || 'aspirational'] = (stats.byType[obj.objective_type || 'aspirational'] || 0) + 1;
        
        // Progress range
        const progressPercent = score * 100;
        if (progressPercent <= 25) stats.progressRanges['0-25%']++;
        else if (progressPercent <= 50) stats.progressRanges['26-50%']++;
        else if (progressPercent <= 75) stats.progressRanges['51-75%']++;
        else stats.progressRanges['76-100%']++;
        
        // Key Results
        if (obj.key_results) {
            stats.totalKRs += obj.key_results.length;
            stats.completedKRs += obj.key_results.filter(kr => kr.progress >= 1).length;
        }
    });
    
    stats.avgOKRScore = objectives.length > 0 ? totalScore / objectives.length : 0;
    stats.avgConfidence = objectives.length > 0 ? totalConfidence / objectives.length : 0;
    
    return stats;
}

function displayOKRSummary(stats) {
    document.getElementById('totalObjectives').textContent = stats.totalObjectives;
    document.getElementById('avgOKRScore').textContent = Math.round(stats.avgOKRScore * 100) + '%';
    document.getElementById('completedKRs').textContent = stats.completedKRs + '/' + stats.totalKRs;
    document.getElementById('avgConfidence').textContent = Math.round(stats.avgConfidence * 100) + '%';
}

function createOKRCharts(objectives) {
    // Destroy existing charts if any
    if (progressChart) progressChart.destroy();
    if (statusChart) statusChart.destroy();
    if (typeChart) typeChart.destroy();
    
    // Progress Distribution Chart
    const progressCtx = document.getElementById('progressChart').getContext('2d');
    const progressData = {
        '0-25%': 0,
        '26-50%': 0,
        '51-75%': 0,
        '76-100%': 0
    };
    
    objectives.forEach(obj => {
        const score = (obj.okr_score || 0) * 100;
        if (score <= 25) progressData['0-25%']++;
        else if (score <= 50) progressData['26-50%']++;
        else if (score <= 75) progressData['51-75%']++;
        else progressData['76-100%']++;
    });
    
    progressChart = new Chart(progressCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(progressData),
            datasets: [{
                data: Object.values(progressData),
                backgroundColor: ['#e74c3c', '#f39c12', '#3498db', '#27ae60'],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 8,
                        font: {
                            size: 11
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.label + ': ' + context.parsed + ' objectives';
                        }
                    }
                }
            }
        }
    });
    
    // Status Breakdown Chart
    const statusCtx = document.getElementById('statusChart').getContext('2d');
    const statusData = {};
    
    objectives.forEach(obj => {
        const status = obj.status || 'Active';
        statusData[status] = (statusData[status] || 0) + 1;
    });
    
    statusChart = new Chart(statusCtx, {
        type: 'bar',
        data: {
            labels: Object.keys(statusData),
            datasets: [{
                label: 'Count',
                data: Object.values(statusData),
                backgroundColor: '#3498db',
                borderColor: '#2980b9',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        font: {
                            size: 10
                        }
                    },
                    grid: {
                        display: true,
                        drawBorder: false
                    }
                },
                x: {
                    ticks: {
                        font: {
                            size: 10
                        }
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
    
    // Type Distribution Chart
    const typeCtx = document.getElementById('typeChart').getContext('2d');
    const typeData = {};
    
    objectives.forEach(obj => {
        const type = obj.objective_type === 'committed' ? 'Committed' : 'Aspirational';
        typeData[type] = (typeData[type] || 0) + 1;
    });
    
    typeChart = new Chart(typeCtx, {
        type: 'pie',
        data: {
            labels: Object.keys(typeData),
            datasets: [{
                data: Object.values(typeData),
                backgroundColor: ['#9b59b6', '#3498db'],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 8,
                        font: {
                            size: 11
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((context.parsed / total) * 100);
                            return context.label + ': ' + context.parsed + ' (' + percentage + '%)';
                        }
                    }
                }
            }
        }
    });
}

function generateDetailedOKRReport(objectives) {
    const reportContent = document.getElementById('okrReportContent');
    
    if (objectives.length === 0) {
        reportContent.innerHTML = '<p>No objectives match the selected filters.</p>';
        return;
    }
    
    let html = '';
    
    objectives.forEach(obj => {
        const score = Math.round((obj.okr_score || 0) * 100);
        const scoreClass = score < 30 ? 'danger' : score < 70 ? 'warning' : 'success';
        const confidence = Math.round((obj.confidence || 0) * 100);
        
        html += `
            <div style="background: white; padding: 20px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); page-break-inside: avoid;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                    <div>
                        <h4 style="margin: 0; color: #2c3e50;">${escapeHtml(obj.title)}</h4>
                        <div style="margin-top: 5px;">
                            <span style="display: inline-block; padding: 3px 8px; background: ${obj.objective_type === 'committed' ? '#e3f2fd' : '#f3e5f5'}; 
                                         color: ${obj.objective_type === 'committed' ? '#1976d2' : '#7b1fa2'}; border-radius: 3px; font-size: 0.85em;">
                                ${obj.objective_type === 'committed' ? 'Committed' : 'Aspirational'}
                            </span>
                            <span style="margin-left: 10px; color: #666;">${obj.period || 'Q1'}</span>
                            <span style="margin-left: 10px; color: #666;">Status: ${obj.status || 'Active'}</span>
                            ${obj.owner ? `<span style="margin-left: 10px; color: #666;">Owner: ${escapeHtml(obj.owner)}</span>` : ''}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 1.5em; font-weight: bold; color: ${scoreClass === 'danger' ? '#e74c3c' : scoreClass === 'warning' ? '#f39c12' : '#27ae60'};">
                            ${score}%
                        </div>
                        <div style="font-size: 0.85em; color: #999;">OKR Score</div>
                        <div style="margin-top: 5px; font-size: 0.85em; color: #666;">Confidence: ${confidence}%</div>
                    </div>
                </div>
                
                ${obj.description ? `
                    <div style="margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                        <strong>Why this matters:</strong> ${escapeHtml(obj.description)}
                    </div>
                ` : ''}
                
                ${obj.key_results && obj.key_results.length > 0 ? `
                    <div style="margin-top: 15px;">
                        <h5 style="margin-bottom: 10px; color: #2c3e50;">Key Results</h5>
                        ${obj.key_results.map(kr => {
                            const krProgress = Math.round((kr.progress || 0) * 100);
                            const krClass = krProgress < 30 ? 'danger' : krProgress < 70 ? 'warning' : 'success';
                            
                            return `
                                <div style="margin-bottom: 10px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <div style="flex: 1;">
                                            <div>${escapeHtml(kr.title)}</div>
                                            <div style="margin-top: 5px; font-size: 0.85em; color: #666;">
                                                Progress: ${kr.current_value || 0} / ${kr.target_value || 0} 
                                                (Start: ${kr.start_value || 0})
                                            </div>
                                        </div>
                                        <div style="min-width: 60px; text-align: right; font-weight: bold; 
                                                    color: ${krClass === 'danger' ? '#e74c3c' : krClass === 'warning' ? '#f39c12' : '#27ae60'};">
                                            ${krProgress}%
                                        </div>
                                    </div>
                                    <div style="margin-top: 5px; background: #e0e0e0; height: 8px; border-radius: 4px;">
                                        <div style="background: ${krClass === 'danger' ? '#e74c3c' : krClass === 'warning' ? '#f39c12' : '#27ae60'}; 
                                                    height: 100%; width: ${krProgress}%; border-radius: 4px;"></div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : '<div style="margin-top: 10px; color: #999;">No key results defined</div>'}
                
                ${obj.notes ? `
                    <div style="margin-top: 15px; padding: 10px; background: #fffbf0; border-left: 3px solid #f39c12; border-radius: 3px;">
                        <strong>Notes:</strong> ${escapeHtml(obj.notes)}
                    </div>
                ` : ''}
            </div>
        `;
    });
    
    reportContent.innerHTML = html;
}

function copyOKRReport() {
    const reportContent = document.getElementById('okrReportContent').innerText;
    navigator.clipboard.writeText(reportContent).then(() => {
        alert('Report copied to clipboard!');
    }).catch(err => {
        alert('Failed to copy report');
    });
}

function exportOKRToCSV() {
    const period = document.getElementById('okrPeriod').value;
    const type = document.getElementById('okrType').value;
    const status = document.getElementById('okrStatus').value;
    const owner = document.getElementById('okrOwner').value.toLowerCase();
    
    // Filter objectives
    let filteredObjectives = allObjectives.filter(obj => {
        if (period && obj.period !== period) return false;
        if (type && obj.objective_type !== type) return false;
        if (status && obj.status !== status) return false;
        if (owner && (!obj.owner || !obj.owner.toLowerCase().includes(owner))) return false;
        return true;
    });
    
    // Create CSV content
    let csv = 'Objective,Type,Period,Status,Owner,OKR Score,Confidence,Key Results Count,Description\n';
    
    filteredObjectives.forEach(obj => {
        const score = Math.round((obj.okr_score || 0) * 100);
        const confidence = Math.round((obj.confidence || 0) * 100);
        const krCount = obj.key_results ? obj.key_results.length : 0;
        
        csv += `"${obj.title || ''}",`;
        csv += `"${obj.objective_type || 'aspirational'}",`;
        csv += `"${obj.period || ''}",`;
        csv += `"${obj.status || 'Active'}",`;
        csv += `"${obj.owner || ''}",`;
        csv += `${score}%,`;
        csv += `${confidence}%,`;
        csv += `${krCount},`;
        csv += `"${obj.description || ''}"\n`;
    });
    
    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `okr_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

function printOKRReport() {
    window.print();
}

// Topics Report Functions
async function generateTopicsReport() {
    const statusFilter = document.getElementById('topicStatus').value;
    const dateRangeFilter = document.getElementById('topicDateRange').value;
    
    // Filter topics based on criteria
    let filteredTopics = [...allTopics];
    
    // Apply status filter
    if (statusFilter) {
        filteredTopics = filteredTopics.filter(topic => topic.status === statusFilter);
    }
    
    // Apply date range filter
    const today = new Date();
    if (dateRangeFilter === 'current') {
        filteredTopics = filteredTopics.filter(topic => 
            topic.status === 'Active' || topic.status === 'Planning'
        );
    } else if (dateRangeFilter === 'overdue') {
        filteredTopics = filteredTopics.filter(topic => {
            if (topic.target_date && topic.status !== 'Completed') {
                return new Date(topic.target_date) < today;
            }
            return false;
        });
    } else if (dateRangeFilter === 'upcoming') {
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        filteredTopics = filteredTopics.filter(topic => {
            if (topic.target_date) {
                const targetDate = new Date(topic.target_date);
                return targetDate >= today && targetDate <= thirtyDaysFromNow;
            }
            return false;
        });
    } else if (dateRangeFilter === 'completed') {
        filteredTopics = filteredTopics.filter(topic => topic.status === 'Completed');
    }
    
    // Calculate statistics
    const stats = {
        total: filteredTopics.length,
        active: filteredTopics.filter(t => t.status === 'Active').length,
        planning: filteredTopics.filter(t => t.status === 'Planning').length,
        onHold: filteredTopics.filter(t => t.status === 'On Hold').length,
        completed: filteredTopics.filter(t => t.status === 'Completed').length
    };
    
    // Calculate total tasks across all topics
    let totalTasks = 0;
    for (const topic of filteredTopics) {
        const topicTasks = allTasks.filter(task => task.project_id === topic.id);
        topic.taskCount = topicTasks.length;
        topic.completedTasks = topicTasks.filter(t => t.status === 'Completed').length;
        topic.openTasks = topicTasks.filter(t => t.status === 'Open').length;
        totalTasks += topicTasks.length;
    }
    
    // Update summary dashboard
    document.getElementById('totalTopicsCount').textContent = stats.total;
    document.getElementById('activeTopicsCount').textContent = stats.active;
    document.getElementById('planningTopicsCount').textContent = stats.planning;
    document.getElementById('onHoldTopicsCount').textContent = stats.onHold;
    document.getElementById('completedTopicsCount').textContent = stats.completed;
    document.getElementById('totalTopicTasksCount').textContent = totalTasks;
    
    // Show dashboard
    document.getElementById('topicsSummaryDashboard').style.display = 'block';
    
    // Create charts
    createTopicsCharts(stats, filteredTopics);
    
    // Generate detailed report
    generateTopicsDetailedReport(filteredTopics);
    
    // Show actions
    document.getElementById('topicsReportActions').style.display = 'flex';
}

function createTopicsCharts(stats, topics) {
    // Status distribution chart
    const statusCtx = document.getElementById('topicsStatusChart').getContext('2d');
    if (topicsStatusChart) {
        topicsStatusChart.destroy();
    }
    topicsStatusChart = new Chart(statusCtx, {
        type: 'doughnut',
        data: {
            labels: ['Active', 'Planning', 'On Hold', 'Completed'],
            datasets: [{
                data: [stats.active, stats.planning, stats.onHold, stats.completed],
                backgroundColor: ['#27ae60', '#f39c12', '#e67e22', '#95a5a6']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 10,
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
    
    // Task distribution chart
    const taskCtx = document.getElementById('topicsTaskChart').getContext('2d');
    if (topicsTaskChart) {
        topicsTaskChart.destroy();
    }
    
    // Get top 10 topics by task count
    const topTopics = topics
        .sort((a, b) => (b.taskCount || 0) - (a.taskCount || 0))
        .slice(0, 10);
    
    topicsTaskChart = new Chart(taskCtx, {
        type: 'bar',
        data: {
            labels: topTopics.map(t => t.title.substring(0, 15) + (t.title.length > 15 ? '...' : '')),
            datasets: [{
                label: 'Tasks',
                data: topTopics.map(t => t.taskCount || 0),
                backgroundColor: '#3498db'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    ticks: {
                        font: {
                            size: 10
                        },
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        font: {
                            size: 10
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function generateTopicsDetailedReport(topics) {
    const reportContent = document.getElementById('topicsReportContent');
    
    if (topics.length === 0) {
        reportContent.innerHTML = '<p>No topics found matching the selected criteria.</p>';
        document.getElementById('topicsDetailedReport').style.display = 'block';
        return;
    }
    
    let html = `
        <table class="report-table" style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                    <th style="padding: 12px; text-align: left;">Topic</th>
                    <th style="padding: 12px; text-align: left;">Status</th>
                    <th style="padding: 12px; text-align: left;">Target Date</th>
                    <th style="padding: 12px; text-align: center;">Tasks</th>
                    <th style="padding: 12px; text-align: center;">Open</th>
                    <th style="padding: 12px; text-align: center;">Completed</th>
                    <th style="padding: 12px; text-align: center;">Progress</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    topics.forEach(topic => {
        const progress = topic.taskCount > 0 
            ? Math.round((topic.completedTasks / topic.taskCount) * 100) 
            : 0;
        const isOverdue = topic.target_date && new Date(topic.target_date) < new Date() && topic.status !== 'Completed';
        
        html += `
            <tr style="border-bottom: 1px solid #dee2e6;">
                <td style="padding: 12px;">
                    <strong>${escapeHtml(topic.title)}</strong>
                    ${topic.description ? `<br><small style="color: #6c757d;">${escapeHtml(topic.description.substring(0, 100))}${topic.description.length > 100 ? '...' : ''}</small>` : ''}
                </td>
                <td style="padding: 12px;">
                    <span class="status-badge status-${topic.status.toLowerCase().replace(' ', '-')}" 
                          style="padding: 4px 8px; border-radius: 4px; font-size: 0.85em;">
                        ${topic.status}
                    </span>
                </td>
                <td style="padding: 12px; ${isOverdue ? 'color: #dc3545; font-weight: bold;' : ''}">
                    ${topic.target_date || 'Not set'}
                    ${isOverdue ? ' (Overdue)' : ''}
                </td>
                <td style="padding: 12px; text-align: center;">
                    ${topic.taskCount || 0}
                </td>
                <td style="padding: 12px; text-align: center;">
                    ${topic.openTasks || 0}
                </td>
                <td style="padding: 12px; text-align: center;">
                    ${topic.completedTasks || 0}
                </td>
                <td style="padding: 12px; text-align: center;">
                    <div style="background: #e9ecef; border-radius: 4px; overflow: hidden; height: 20px;">
                        <div style="background: ${progress >= 75 ? '#28a745' : progress >= 50 ? '#ffc107' : '#17a2b8'}; 
                                    width: ${progress}%; height: 100%; text-align: center; line-height: 20px; 
                                    color: white; font-size: 0.75em;">
                            ${progress}%
                        </div>
                    </div>
                </td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    reportContent.innerHTML = html;
    document.getElementById('topicsDetailedReport').style.display = 'block';
}

function copyTopicsReport() {
    const reportContent = document.getElementById('topicsReportContent').innerText;
    navigator.clipboard.writeText(reportContent).then(() => {
        alert('Report copied to clipboard!');
    });
}

function exportTopicsToCSV() {
    const statusFilter = document.getElementById('topicStatus').value;
    const dateRangeFilter = document.getElementById('topicDateRange').value;
    
    // Use the same filtering logic as generateTopicsReport
    let filteredTopics = [...allTopics];
    
    if (statusFilter) {
        filteredTopics = filteredTopics.filter(topic => topic.status === statusFilter);
    }
    
    // Create CSV content
    let csv = 'Topic,Description,Status,Target Date,Total Tasks,Open Tasks,Completed Tasks,Progress\n';
    
    filteredTopics.forEach(topic => {
        const progress = topic.taskCount > 0 
            ? Math.round((topic.completedTasks / topic.taskCount) * 100) 
            : 0;
        
        csv += `"${topic.title || ''}",`;
        csv += `"${(topic.description || '').replace(/"/g, '""')}",`;
        csv += `"${topic.status || ''}",`;
        csv += `"${topic.target_date || 'Not set'}",`;
        csv += `${topic.taskCount || 0},`;
        csv += `${topic.openTasks || 0},`;
        csv += `${topic.completedTasks || 0},`;
        csv += `${progress}%\n`;
    });
    
    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `topics_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

function printTopicsReport() {
    window.print();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}