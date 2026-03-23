// src/admin/ui/views/reports.ts
// Content reports management view with moderation tools

export const reportsView = (): string => `
  <div id="reportsView" class="view" style="display: none;">
    <div class="header">
      <h2>Content Reports</h2>
      <div class="header-actions">
        <button class="btn btn-primary" onclick="refreshReports()">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6"></path>
            <path d="M1 20v-6h6"></path>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          Refresh
        </button>
        <button class="btn btn-secondary" onclick="exportReports()">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Export
        </button>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card" id="totalReportsCard">
        <div class="label">Total Reports</div>
        <div class="value" id="totalReports">-</div>
      </div>
      <div class="stat-card" id="unresolvedCard">
        <div class="label">Unresolved</div>
        <div class="value" id="unresolvedReports">-</div>
      </div>
      <div class="stat-card" id="resolvedCard">
        <div class="label">Resolved</div>
        <div class="value" id="resolvedReports">-</div>
      </div>
      <div class="stat-card" id="avgResponseCard">
        <div class="label">Avg Resolution Time</div>
        <div class="value" id="avgResolutionTime">-</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Report Management</h3>
        <div class="header-actions">
          <div class="filter-group">
            <select id="reportTypeFilter" onchange="filterReports()" class="filter-select">
              <option value="all">All Types</option>
              <option value="event">Event Reports</option>
              <option value="room">Room Reports</option>
              <option value="user">User Reports</option>
            </select>
            <select id="reportStatusFilter" onchange="filterReports()" class="filter-select">
              <option value="all">All Status</option>
              <option value="unresolved">Unresolved</option>
              <option value="resolved">Resolved</option>
            </select>
            <select id="reportSeverityFilter" onchange="filterReports()" class="filter-select">
              <option value="all">All Scores</option>
              <option value="-100">Critical (-100)</option>
              <option value="-75">High (-75)</option>
              <option value="-50">Medium (-50)</option>
              <option value="-25">Low (-25)</option>
            </select>
            <input 
              type="text" 
              class="search-input" 
              id="reportSearch" 
              placeholder="Search reports..." 
              onkeyup="debounceSearchReports()"
            >
          </div>
        </div>
      </div>
      <div class="card-body">
        <div id="reportsLoading" class="loading">
          <div class="spinner"></div>
          Loading reports...
        </div>
        <div id="reportsTable" style="display: none;">
          <table>
            <thead>
              <tr>
                <th onclick="sortReports('id')" class="sortable">
                  ID
                  <span class="sort-indicator" id="sortId"></span>
                </th>
                <th onclick="sortReports('type')" class="sortable">
                  Type
                  <span class="sort-indicator" id="sortType"></span>
                </th>
                <th onclick="sortReports('reporter')" class="sortable">
                  Reporter
                  <span class="sort-indicator" id="sortReporter"></span>
                </th>
                <th onclick="sortReports('target')" class="sortable">
                  Target
                  <span class="sort-indicator" id="sortTarget"></span>
                </th>
                <th>Reason</th>
                <th onclick="sortReports('score')" class="sortable">
                  Score
                  <span class="sort-indicator" id="sortScore"></span>
                </th>
                <th onclick="sortReports('created_at')" class="sortable">
                  Reported
                  <span class="sort-indicator" id="sortCreatedAt"></span>
                </th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="reportsList"></tbody>
          </table>
          <div class="pagination" id="reportsPagination"></div>
        </div>
        <div id="noReports" class="loading" style="display: none;">No reports found</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Report Analytics</h3>
        <div class="header-actions">
          <select id="analyticsPeriod" onchange="updateReportAnalytics()" class="filter-select">
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>
      </div>
      <div class="card-body">
        <div class="charts-grid">
          <div class="chart-container">
            <canvas id="reportsByTypeChart"></canvas>
          </div>
          <div class="chart-container">
            <canvas id="reportsTimelineChart"></canvas>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Top Reported Users</h3>
      </div>
      <div class="card-body">
        <div id="topUsersLoading" class="loading">
          <div class="spinner"></div>
          Loading data...
        </div>
        <div id="topUsersTable" style="display: none;">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Reports</th>
                <th>Avg Score</th>
                <th>Last Reported</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="topUsersList"></tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Moderation Actions</h3>
      </div>
      <div class="card-body">
        <div class="action-grid">
          <button class="action-card" onclick="bulkResolveReports()">
            <span class="action-icon">✅</span>
            <span class="action-title">Bulk Resolve</span>
            <span class="action-desc">Resolve multiple reports at once</span>
          </button>
          <button class="action-card" onclick="generateModerationReport()">
            <span class="action-icon">📊</span>
            <span class="action-title">Generate Report</span>
            <span class="action-desc">Export moderation statistics</span>
          </button>
          <button class="action-card" onclick="reviewFlaggedContent()">
            <span class="action-icon">🔍</span>
            <span class="action-title">Review Content</span>
            <span class="action-desc">View flagged messages</span>
          </button>
          <button class="action-card" onclick="manageBlocklist()">
            <span class="action-icon">🚫</span>
            <span class="action-title">Manage Blocklist</span>
            <span class="action-desc">Block users or content</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Report Details Modal -->
    <div id="reportDetailsModal" class="modal">
      <div class="modal-content modal-lg">
        <div class="modal-header">
          <h2>Report Details #<span id="reportDetailsId"></span></h2>
          <button class="modal-close" onclick="hideModal('reportDetailsModal')">✕</button>
        </div>
        <div class="modal-body">
          <div class="details-grid">
            <div class="detail-section">
              <h4>Report Information</h4>
              <div class="detail-row">
                <span class="detail-label">Type:</span>
                <span class="detail-value" id="reportDetailsType"></span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Reporter:</span>
                <span class="detail-value" id="reportDetailsReporter"></span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Target:</span>
                <span class="detail-value" id="reportDetailsTarget"></span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Score:</span>
                <span class="detail-value" id="reportDetailsScore"></span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Reported:</span>
                <span class="detail-value" id="reportDetailsDate"></span>
              </div>
            </div>
            <div class="detail-section">
              <h4>Content</h4>
              <div class="content-preview" id="reportDetailsContent"></div>
            </div>
            <div class="detail-section">
              <h4>Reason</h4>
              <div class="reason-box" id="reportDetailsReason"></div>
            </div>
            <div class="detail-section">
              <h4>Resolution</h4>
              <div id="reportDetailsResolution">
                <div class="detail-row">
                  <span class="detail-label">Status:</span>
                  <span class="detail-value" id="reportDetailsStatus"></span>
                </div>
                <div class="detail-row" id="resolvedByRow" style="display: none;">
                  <span class="detail-label">Resolved By:</span>
                  <span class="detail-value" id="reportDetailsResolvedBy"></span>
                </div>
                <div class="detail-row" id="resolvedAtRow" style="display: none;">
                  <span class="detail-label">Resolved At:</span>
                  <span class="detail-value" id="reportDetailsResolvedAt"></span>
                </div>
                <div class="detail-row" id="resolutionNoteRow" style="display: none;">
                  <span class="detail-label">Note:</span>
                  <span class="detail-value" id="reportDetailsNote"></span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="hideModal('reportDetailsModal')">Close</button>
          <button class="btn btn-primary" id="resolveReportBtn" onclick="resolveCurrentReport()">Resolve Report</button>
          <button class="btn btn-danger" id="deleteReportBtn" onclick="deleteCurrentReport()">Delete Report</button>
        </div>
      </div>
    </div>
  </div>
`;

// Reports-specific styles
export const reportsStyles = `
  .filter-group {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  
  .filter-select {
    padding: 6px 12px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-default);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 13px;
    min-width: 120px;
  }
  
  .filter-select:focus {
    outline: none;
    border-color: var(--accent-blue);
  }
  
  .score-badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }
  
  .score-critical {
    background: rgba(239, 68, 68, 0.2);
    color: var(--accent-red);
  }
  
  .score-high {
    background: rgba(245, 158, 11, 0.2);
    color: var(--accent-amber);
  }
  
  .score-medium {
    background: rgba(245, 158, 11, 0.1);
    color: var(--accent-amber);
  }
  
  .score-low {
    background: rgba(34, 197, 94, 0.1);
    color: var(--accent-green);
  }
  
  .status-badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }
  
  .status-unresolved {
    background: rgba(239, 68, 68, 0.2);
    color: var(--accent-red);
  }
  
  .status-resolved {
    background: rgba(34, 197, 94, 0.2);
    color: var(--accent-green);
  }
  
  .report-type-badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    background: var(--bg-elevated);
    color: var(--text-secondary);
  }
  
  .action-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }
  
  .action-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-default);
    border-radius: 12px;
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  
  .action-card:hover {
    background: var(--bg-hover);
    border-color: var(--border-strong);
    transform: translateY(-2px);
  }
  
  .action-icon {
    font-size: 32px;
    margin-bottom: 12px;
  }
  
  .action-title {
    font-weight: 600;
    margin-bottom: 4px;
  }
  
  .action-desc {
    font-size: 12px;
    color: var(--text-secondary);
    text-align: center;
  }
  
  .modal-lg {
    max-width: 800px;
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 1px solid var(--border-default);
  }
  
  .modal-body {
    padding: 20px;
    max-height: 70vh;
    overflow-y: auto;
  }
  
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 20px;
    border-top: 1px solid var(--border-default);
  }
  
  .modal-close {
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 20px;
    cursor: pointer;
    padding: 4px 8px;
  }
  
  .modal-close:hover {
    color: var(--text-primary);
  }
  
  .details-grid {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  
  .detail-section {
    border: 1px solid var(--border-default);
    border-radius: 8px;
    overflow: hidden;
  }
  
  .detail-section h4 {
    padding: 12px 16px;
    background: var(--bg-elevated);
    border-bottom: 1px solid var(--border-default);
    margin: 0;
    font-size: 14px;
    color: var(--text-secondary);
  }
  
  .detail-row {
    display: flex;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-default);
  }
  
  .detail-row:last-child {
    border-bottom: none;
  }
  
  .detail-label {
    width: 100px;
    color: var(--text-secondary);
    font-size: 13px;
  }
  
  .detail-value {
    flex: 1;
    color: var(--text-primary);
    font-size: 13px;
    word-break: break-word;
  }
  
  .content-preview {
    padding: 16px;
    background: var(--bg-base);
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
    white-space: pre-wrap;
    max-height: 200px;
    overflow-y: auto;
  }
  
  .reason-box {
    padding: 16px;
    background: var(--bg-base);
    border-radius: 4px;
    font-size: 13px;
    line-height: 1.6;
  }
  
  .bulk-actions {
    display: flex;
    gap: 8px;
    padding: 12px;
    background: var(--bg-elevated);
    border-radius: 8px;
    margin-top: 16px;
  }
  
  .bulk-checkbox {
    margin-right: 8px;
  }
  
  .chart-container {
    position: relative;
    height: 300px;
    width: 100%;
  }
`;

// Reports JavaScript functions
export const reportsFunctions = (): string => `
  // ============================================
  // Reports Management Functions
  // ============================================
  
  let currentReports = [];
  let currentReportId = null;
  let reportsSortField = 'created_at';
  let reportsSortDirection = 'desc';
  let reportsTypeFilter = 'all';
  let reportsStatusFilter = 'all';
  let reportsSeverityFilter = 'all';
  let reportsSearchTimeout;
  let reportsChart;
  let timelineChart;
  
  async function loadReports(page = 0) {
    document.getElementById('reportsLoading').style.display = 'block';
    document.getElementById('reportsTable').style.display = 'none';
    document.getElementById('noReports').style.display = 'none';
    
    try {
      // Build URL with filters
      let url = '/reports?limit=50&offset=' + (page * 50);
      
      if (reportsStatusFilter !== 'all') {
        url += '&resolved=' + (reportsStatusFilter === 'resolved' ? 'true' : 'false');
      }
      
      const data = await api.get(url);
      
      // Update stats
      await loadReportStats();
      
      currentReports = data.items || [];
      
      // Apply filters
      let filteredReports = filterReportItems(currentReports);
      
      // Apply sorting
      filteredReports = sortReportsArray(filteredReports, reportsSortField, reportsSortDirection);
      
      // Paginate
      const limit = 50;
      const start = page * limit;
      const paginatedReports = filteredReports.slice(start, start + limit);
      const totalPages = Math.ceil(filteredReports.length / limit);
      
      if (paginatedReports.length === 0) {
        document.getElementById('reportsLoading').style.display = 'none';
        document.getElementById('noReports').style.display = 'block';
        return;
      }
      
      const tbody = document.getElementById('reportsList');
      tbody.innerHTML = '';
      
      paginatedReports.forEach((report) => {
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td>\${report.id}</td>
          <td><span class="report-type-badge">\${report.report_type || 'event'}</span></td>
          <td>\${truncateString(report.reporter_user_id, 20)}</td>
          <td>\${getReportTarget(report)}</td>
          <td>\${truncateString(report.reason || '-', 30)}</td>
          <td><span class="score-badge \${getScoreClass(report.score)}">\${report.score}</span></td>
          <td>\${new Date(report.created_at).toLocaleDateString()}</td>
          <td><span class="status-badge \${report.resolved ? 'status-resolved' : 'status-unresolved'}">\${report.resolved ? 'Resolved' : 'Unresolved'}</span></td>
          <td class="action-group">
            <button class="btn-icon-sm" onclick="viewReportDetails('\${report.id}')" title="View details">👁️</button>
            \${!report.resolved ? 
              '<button class="btn-icon-sm success" onclick="resolveReport(\'' + report.id + '\')" title="Resolve">✅</button>' : 
              '<button class="btn-icon-sm warning" onclick="unresolveReport(\'' + report.id + '\')" title="Reopen">↩️</button>'
            }
            <button class="btn-icon-sm" onclick="viewReportedContent('\${report.id}')" title="View content">📄</button>
          </td>
        \`;
        tbody.appendChild(tr);
      });
      
      // Update pagination
      renderReportsPagination(page, totalPages);
      
      // Update charts
      updateReportCharts(currentReports);
      
      // Update top reported users
      await loadTopReportedUsers();
      
      document.getElementById('reportsLoading').style.display = 'none';
      document.getElementById('reportsTable').style.display = 'block';
      
    } catch (err) {
      console.error('Failed to load reports:', err);
      document.getElementById('reportsLoading').innerHTML = 'Failed to load reports';
    }
  }
  
  async function loadReportStats() {
    try {
      const allReports = await api.get('/reports?limit=1');
      const unresolved = await api.get('/reports?resolved=false&limit=1');
      const resolved = await api.get('/reports?resolved=true&limit=1');
      
      document.getElementById('totalReports').textContent = allReports.total || '0';
      document.getElementById('unresolvedReports').textContent = unresolved.total || '0';
      document.getElementById('resolvedReports').textContent = resolved.total || '0';
      
      // Calculate average resolution time (simplified)
      const resolvedReports = await api.get('/reports?resolved=true&limit=100');
      let totalTime = 0;
      let count = 0;
      
      resolvedReports.items?.forEach((report) => {
        if (report.resolved_at && report.created_at) {
          totalTime += report.resolved_at - report.created_at;
          count++;
        }
      });
      
      const avgTime = count > 0 ? Math.round(totalTime / count / (1000 * 60 * 60)) : 0;
      document.getElementById('avgResolutionTime').textContent = avgTime > 0 ? \`\${avgTime} hours\` : 'N/A';
      
    } catch (err) {
      console.error('Failed to load report stats:', err);
    }
  }
  
  function getReportTarget(report) {
    switch(report.report_type) {
      case 'user':
        return report.reported_user_id || '-';
      case 'room':
        return truncateString(report.room_id || '-', 20);
      case 'event':
        return truncateString(report.event_id || '-', 20);
      default:
        return '-';
    }
  }
  
  function getScoreClass(score) {
    if (score <= -90) return 'score-critical';
    if (score <= -70) return 'score-high';
    if (score <= -40) return 'score-medium';
    return 'score-low';
  }
  
  function truncateString(str, length) {
    if (!str) return '-';
    return str.length > length ? str.substring(0, length) + '...' : str;
  }
  
  function filterReportItems(items) {
    return items.filter(item => {
      // Type filter
      if (reportsTypeFilter !== 'all' && item.report_type !== reportsTypeFilter) {
        return false;
      }
      
      // Status filter
      if (reportsStatusFilter !== 'all') {
        const isResolved = reportsStatusFilter === 'resolved';
        if (item.resolved !== isResolved) return false;
      }
      
      // Severity filter
      if (reportsSeverityFilter !== 'all') {
        const threshold = parseInt(reportsSeverityFilter);
        if (item.score > threshold) return false;
      }
      
      // Search filter
      const search = document.getElementById('reportSearch')?.value?.toLowerCase();
      if (search) {
        return item.reporter_user_id?.toLowerCase().includes(search) ||
               item.reason?.toLowerCase().includes(search) ||
               item.reported_user_id?.toLowerCase().includes(search) ||
               item.room_id?.toLowerCase().includes(search);
      }
      
      return true;
    });
  }
  
  function filterReports() {
    reportsTypeFilter = document.getElementById('reportTypeFilter')?.value || 'all';
    reportsStatusFilter = document.getElementById('reportStatusFilter')?.value || 'all';
    reportsSeverityFilter = document.getElementById('reportSeverityFilter')?.value || 'all';
    loadReports(0);
  }
  
  function debounceSearchReports() {
    clearTimeout(reportsSearchTimeout);
    reportsSearchTimeout = setTimeout(() => {
      filterReports();
    }, 300);
  }
  
  function sortReportsArray(reports, field, direction) {
    return [...reports].sort((a, b) => {
      let aVal, bVal;
      
      switch(field) {
        case 'id':
          aVal = a.id || 0;
          bVal = b.id || 0;
          break;
        case 'type':
          aVal = a.report_type || '';
          bVal = b.report_type || '';
          break;
        case 'reporter':
          aVal = a.reporter_user_id || '';
          bVal = b.reporter_user_id || '';
          break;
        case 'target':
          aVal = getReportTarget(a);
          bVal = getReportTarget(b);
          break;
        case 'score':
          aVal = a.score || 0;
          bVal = b.score || 0;
          break;
        case 'created_at':
          aVal = a.created_at || 0;
          bVal = b.created_at || 0;
          break;
        default:
          return 0;
      }
      
      if (direction === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  }
  
  function sortReports(field) {
    if (reportsSortField === field) {
      reportsSortDirection = reportsSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      reportsSortField = field;
      reportsSortDirection = 'asc';
    }
    
    // Update sort indicators
    document.querySelectorAll('.sort-indicator').forEach(el => el.textContent = '');
    const indicator = document.getElementById(\`sort\${field.charAt(0).toUpperCase() + field.slice(1)}\`);
    if (indicator) {
      indicator.textContent = reportsSortDirection === 'asc' ? '↑' : '↓';
    }
    
    loadReports(0);
  }
  
  function renderReportsPagination(currentPage, totalPages) {
    const paginationEl = document.getElementById('reportsPagination');
    paginationEl.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    // Previous button
    if (currentPage > 0) {
      const prevBtn = document.createElement('button');
      prevBtn.innerHTML = '←';
      prevBtn.onclick = () => loadReports(currentPage - 1);
      paginationEl.appendChild(prevBtn);
    }
    
    // Page numbers
    for (let i = Math.max(0, currentPage - 2); i <= Math.min(totalPages - 1, currentPage + 2); i++) {
      const btn = document.createElement('button');
      btn.textContent = (i + 1).toString();
      btn.className = i === currentPage ? 'active' : '';
      btn.onclick = () => loadReports(i);
      paginationEl.appendChild(btn);
    }
    
    // Next button
    if (currentPage < totalPages - 1) {
      const nextBtn = document.createElement('button');
      nextBtn.innerHTML = '→';
      nextBtn.onclick = () => loadReports(currentPage + 1);
      paginationEl.appendChild(nextBtn);
    }
  }
  
  function updateReportCharts(reports) {
    // Reports by type chart
    const typeCount = countByType(reports, 'report_type');
    const typeCtx = document.getElementById('reportsByTypeChart')?.getContext('2d');
    
    if (typeCtx) {
      if (reportsChart) reportsChart.destroy();
      
      reportsChart = new Chart(typeCtx, {
        type: 'pie',
        data: {
          labels: Object.keys(typeCount).map(t => t.charAt(0).toUpperCase() + t.slice(1)),
          datasets: [{
            data: Object.values(typeCount),
            backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#fafafa' }
            }
          }
        }
      });
    }
    
    // Timeline chart
    const timelineData = getTimelineData(reports);
    const timelineCtx = document.getElementById('reportsTimelineChart')?.getContext('2d');
    
    if (timelineCtx) {
      if (timelineChart) timelineChart.destroy();
      
      timelineChart = new Chart(timelineCtx, {
        type: 'line',
        data: {
          labels: timelineData.labels,
          datasets: [
            {
              label: 'New Reports',
              data: timelineData.new,
              borderColor: '#f59e0b',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              tension: 0.4
            },
            {
              label: 'Resolved',
              data: timelineData.resolved,
              borderColor: '#22c55e',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              tension: 0.4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: { color: '#fafafa' }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(255, 255, 255, 0.1)' },
              ticks: { color: '#94a3b8' }
            },
            x: {
              grid: { display: false },
              ticks: { color: '#94a3b8' }
            }
          }
        }
      });
    }
  }
  
  function countByType(items, field) {
    const counts = {};
    items.forEach(item => {
      const key = item[field] || 'unknown';
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }
  
  function getTimelineData(reports) {
    const now = Date.now();
    const period = document.getElementById('analyticsPeriod')?.value || '30d';
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    
    const dayLabels = [];
    const newCounts = [];
    const resolvedCounts = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000);
      const dayStr = date.toISOString().split('T')[0];
      dayLabels.push(dayStr);
      newCounts.push(0);
      resolvedCounts.push(0);
    }
    
    reports.forEach(report => {
      const reportDate = new Date(report.created_at).toISOString().split('T')[0];
      const index = dayLabels.indexOf(reportDate);
      if (index !== -1) {
        newCounts[index]++;
        
        if (report.resolved && report.resolved_at) {
          const resolvedDate = new Date(report.resolved_at).toISOString().split('T')[0];
          const resolvedIndex = dayLabels.indexOf(resolvedDate);
          if (resolvedIndex !== -1) {
            resolvedCounts[resolvedIndex]++;
          }
        }
      }
    });
    
    return {
      labels: dayLabels,
      new: newCounts,
      resolved: resolvedCounts
    };
  }
  
  function updateReportAnalytics() {
    updateReportCharts(currentReports);
  }
  
  async function loadTopReportedUsers() {
    document.getElementById('topUsersLoading').style.display = 'block';
    document.getElementById('topUsersTable').style.display = 'none';
    
    try {
      // Aggregate reports by target user
      const userStats:  = {};
      
      currentReports.forEach(report => {
        if (report.reported_user_id) {
          if (!userStats[report.reported_user_id]) {
            userStats[report.reported_user_id] = {
              count: 0,
              totalScore: 0,
              lastReport: 0
            };
          }
          userStats[report.reported_user_id].count++;
          userStats[report.reported_user_id].totalScore += report.score || 0;
          if (report.created_at > userStats[report.reported_user_id].lastReport) {
            userStats[report.reported_user_id].lastReport = report.created_at;
          }
        }
      });
      
      // Sort by count
      const sortedUsers = Object.entries(userStats)
        .map(([userId, stats]) => ({
          userId,
          count: stats.count,
          avgScore: Math.round(stats.totalScore / stats.count),
          lastReport: stats.lastReport
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      const tbody = document.getElementById('topUsersList');
      tbody.innerHTML = '';
      
      sortedUsers.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td>\${user.userId}</td>
          <td>\${user.count}</td>
          <td><span class="score-badge \${getScoreClass(user.avgScore)}">\${user.avgScore}</span></td>
          <td>\${new Date(user.lastReport).toLocaleDateString()}</td>
          <td>
            <button class="btn-icon-sm" onclick={"filterByUser('" + user.userId + "')"} title="Show user's reports">👁️</button>
            <button class="btn-icon-sm warning" onclick={"blockUser('" + user.userId + "')"} title="Block user">🚫</button>
          </td>
        \`;
        tbody.appendChild(tr);
      });
      
      document.getElementById('topUsersLoading').style.display = 'none';
      document.getElementById('topUsersTable').style.display = 'block';
      
    } catch (err) {
      console.error('Failed to load top users:', err);
      document.getElementById('topUsersLoading').innerHTML = 'Failed to load data';
    }
  }
  
  async function viewReportDetails(reportId) {
    try {
      const report = await api.get('/reports/' + reportId);
      currentReportId = reportId;
      
      document.getElementById('reportDetailsId').textContent = report.id;
      document.getElementById('reportDetailsType').textContent = report.report_type || 'event';
      document.getElementById('reportDetailsReporter').textContent = report.reporter_user_id;
      document.getElementById('reportDetailsTarget').textContent = getReportTarget(report);
      document.getElementById('reportDetailsScore').innerHTML = \`<span class="score-badge \${getScoreClass(report.score)}">\${report.score}</span>\`;
      document.getElementById('reportDetailsDate').textContent = new Date(report.created_at).toLocaleString();
      document.getElementById('reportDetailsReason').textContent = report.reason || 'No reason provided';
      document.getElementById('reportDetailsContent').textContent = report.event_content ? JSON.stringify(report.event_content, null, 2) : 'No content available';
      
      const statusEl = document.getElementById('reportDetailsStatus');
      statusEl.innerHTML = \`<span class="status-badge \${report.resolved ? 'status-resolved' : 'status-unresolved'}">\${report.resolved ? 'Resolved' : 'Unresolved'}</span>\`;
      
      if (report.resolved) {
        document.getElementById('resolvedByRow').style.display = 'flex';
        document.getElementById('resolvedAtRow').style.display = 'flex';
        document.getElementById('resolutionNoteRow').style.display = 'flex';
        document.getElementById('resolveReportBtn').style.display = 'none';
        
        document.getElementById('reportDetailsResolvedBy').textContent = report.resolved_by || 'Unknown';
        document.getElementById('reportDetailsResolvedAt').textContent = report.resolved_at ? new Date(report.resolved_at).toLocaleString() : 'Unknown';
        document.getElementById('reportDetailsNote').textContent = report.resolution_note || 'No note';
      } else {
        document.getElementById('resolvedByRow').style.display = 'none';
        document.getElementById('resolvedAtRow').style.display = 'none';
        document.getElementById('resolutionNoteRow').style.display = 'none';
        document.getElementById('resolveReportBtn').style.display = 'block';
      }
      
      showModal('reportDetailsModal');
      
    } catch (err) {
      console.error('Failed to load report details:', err);
      showNotification('Failed to load report details', 'error');
    }
  }
  
  async function resolveReport(reportId) {
    const note = prompt('Resolution note (optional):');
    
    try {
      await api.post('/reports/' + reportId + '/resolve', { note });
      showNotification('Report resolved successfully', 'success');
      loadReports(0);
      
      if (currentReportId === reportId) {
        hideModal('reportDetailsModal');
      }
    } catch (err) {
      showNotification('Failed to resolve report', 'error');
    }
  }
  
  async function unresolveReport(reportId) {
    confirmAction(
      'Reopen Report',
      'Are you sure you want to reopen this report?',
      async () => {
        try {
          await api.post('/reports/' + reportId + '/unresolve', {});
          showNotification('Report reopened', 'success');
          loadReports(0);
          
          if (currentReportId === reportId) {
            hideModal('reportDetailsModal');
          }
        } catch (err) {
          showNotification('Failed to reopen report', 'error');
        }
      }
    );
  }
  
  function resolveCurrentReport() {
    if (currentReportId) {
      resolveReport(currentReportId);
    }
  }
  
  function deleteCurrentReport() {
    if (currentReportId) {
      confirmAction(
        'Delete Report',
        'Permanently delete this report? This cannot be undone.',
        async () => {
          // Note: You might need to add a DELETE endpoint for reports
          showNotification('Delete functionality not implemented', 'info');
        }
      );
    }
  }
  
  function viewReportedContent(reportId) {
    const report = currentReports.find(r => r.id == reportId);
    if (report) {
      viewReportDetails(reportId);
    }
  }
  
  function filterByUser(userId) {
    document.getElementById('reportSearch').value = userId;
    filterReports();
  }
  
  function blockUser(userId) {
    confirmAction(
      'Block User',
      \`Block user \${userId}? They will not be able to interact with the server.\`,
      async () => {
        // This would call your user management API
        showNotification('Block functionality not implemented', 'info');
      }
    );
  }
  
  function bulkResolveReports() {
    // This would open a bulk resolution interface
    showNotification('Bulk resolve not implemented', 'info');
  }
  
  function generateModerationReport() {
    // This would generate and download a report
    showNotification('Report generation not implemented', 'info');
  }
  
  function reviewFlaggedContent() {
    // This would show flagged content
    showNotification('Content review not implemented', 'info');
  }
  
  function manageBlocklist() {
    // This would show blocklist management
    showNotification('Blocklist management not implemented', 'info');
  }
  
  function exportReports() {
    const dataStr = JSON.stringify(currentReports, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = \`reports_export_\${new Date().toISOString()}.json\`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }
  
  function refreshReports() {
    loadReports(0);
  }
`;

// Export all
export default {
  view: reportsView,
  styles: reportsStyles,
  functions: reportsFunctions
};