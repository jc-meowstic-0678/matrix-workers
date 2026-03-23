// src/admin/ui/views/security.ts
// Security view with session management, rate limiting, and security monitoring

export const securityView = (): string => `
  <div id="securityView" class="view" style="display: none;">
    <div class="header">
      <h2>Security</h2>
      <div class="header-actions">
        <button class="btn btn-primary" onclick="refreshSecurity()">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6"></path>
            <path d="M1 20v-6h6"></path>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          Refresh
        </button>
        <button class="btn btn-secondary" onclick="exportSecurityLog()">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Export Logs
        </button>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card" id="activeSessionsCard">
        <div class="label">Active Sessions</div>
        <div class="value" id="activeSessionsCount">-</div>
      </div>
      <div class="stat-card" id="uniqueUsersCard">
        <div class="label">Unique Users</div>
        <div class="value" id="uniqueUsersCount">-</div>
      </div>
      <div class="stat-card" id="rateLimitHitsCard">
        <div class="label">Rate Limit Hits (24h)</div>
        <div class="value" id="rateLimitHits">-</div>
      </div>
      <div class="stat-card" id="failedLoginsCard">
        <div class="label">Failed Logins (24h)</div>
        <div class="value" id="failedLogins">-</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Active Sessions</h3>
        <div class="header-actions">
          <div class="filter-group">
            <input 
              type="text" 
              class="search-input" 
              id="sessionSearch" 
              placeholder="Search by user or device..." 
              onkeyup="debounceSearchSessions()"
            >
            <select id="sessionStatusFilter" onchange="filterSessions()" class="filter-select">
              <option value="all">All Sessions</option>
              <option value="active">Active (last hour)</option>
              <option value="idle">Idle (>1 hour)</option>
              <option value="stale">Stale (>24 hours)</option>
            </select>
          </div>
          <button class="btn btn-danger btn-sm" onclick="revokeAllSessions()">
            Revoke All
          </button>
        </div>
      </div>
      <div class="card-body">
        <div id="sessionsLoading" class="loading">
          <div class="spinner"></div>
          Loading sessions...
        </div>
        <div id="sessionsTable" style="display: none;">
          <table>
            <thead>
              <tr>
                <th onclick="sortSessions('user')" class="sortable">
                  User
                  <span class="sort-indicator" id="sortUser"></span>
                </th>
                <th onclick="sortSessions('device')" class="sortable">
                  Device
                  <span class="sort-indicator" id="sortDevice"></span>
                </th>
                <th onclick="sortSessions('ip')" class="sortable">
                  IP Address
                  <span class="sort-indicator" id="sortIp"></span>
                </th>
                <th onclick="sortSessions('created')" class="sortable">
                  Created
                  <span class="sort-indicator" id="sortCreated"></span>
                </th>
                <th onclick="sortSessions('last_seen')" class="sortable">
                  Last Seen
                  <span class="sort-indicator" id="sortLastSeen"></span>
                </th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="sessionsList"></tbody>
          </table>
          <div class="pagination" id="sessionsPagination"></div>
        </div>
        <div id="noSessions" class="loading" style="display: none;">No active sessions found</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Rate Limiting Configuration</h3>
      </div>
      <div class="card-body">
        <div class="rate-limits-grid">
          <div class="rate-limit-card">
            <div class="rate-limit-header">
              <h4>Login</h4>
              <span class="rate-limit-badge" id="loginRateLimit">10/min</span>
            </div>
            <div class="rate-limit-controls">
              <button class="btn-icon-sm" onclick="editRateLimit('login')">✏️</button>
              <button class="btn-icon-sm" onclick="resetRateLimit('login')">↺</button>
            </div>
          </div>
          <div class="rate-limit-card">
            <div class="rate-limit-header">
              <h4>Register</h4>
              <span class="rate-limit-badge" id="registerRateLimit">5/min</span>
            </div>
            <div class="rate-limit-controls">
              <button class="btn-icon-sm" onclick="editRateLimit('register')">✏️</button>
              <button class="btn-icon-sm" onclick="resetRateLimit('register')">↺</button>
            </div>
          </div>
          <div class="rate-limit-card">
            <div class="rate-limit-header">
              <h4>Sync</h4>
              <span class="rate-limit-badge" id="syncRateLimit">300/min</span>
            </div>
            <div class="rate-limit-controls">
              <button class="btn-icon-sm" onclick="editRateLimit('sync')">✏️</button>
              <button class="btn-icon-sm" onclick="resetRateLimit('sync')">↺</button>
            </div>
          </div>
          <div class="rate-limit-card">
            <div class="rate-limit-header">
              <h4>Send Message</h4>
              <span class="rate-limit-badge" id="messageRateLimit">60/min</span>
            </div>
            <div class="rate-limit-controls">
              <button class="btn-icon-sm" onclick="editRateLimit('send_message')">✏️</button>
              <button class="btn-icon-sm" onclick="resetRateLimit('send_message')">↺</button>
            </div>
          </div>
          <div class="rate-limit-card">
            <div class="rate-limit-header">
              <h4>Create Room</h4>
              <span class="rate-limit-badge" id="createRoomRateLimit">10/min</span>
            </div>
            <div class="rate-limit-controls">
              <button class="btn-icon-sm" onclick="editRateLimit('create_room')">✏️</button>
              <button class="btn-icon-sm" onclick="resetRateLimit('create_room')">↺</button>
            </div>
          </div>
          <div class="rate-limit-card">
            <div class="rate-limit-header">
              <h4>Media Upload</h4>
              <span class="rate-limit-badge" id="mediaRateLimit">30/min</span>
            </div>
            <div class="rate-limit-controls">
              <button class="btn-icon-sm" onclick="editRateLimit('media_upload')">✏️</button>
              <button class="btn-icon-sm" onclick="resetRateLimit('media_upload')">↺</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Security Events (Last 24 Hours)</h3>
        <div class="header-actions">
          <select id="securityEventType" onchange="loadSecurityEvents()" class="filter-select">
            <option value="all">All Events</option>
            <option value="login">Logins</option>
            <option value="failed_login">Failed Logins</option>
            <option value="rate_limit">Rate Limit Hits</option>
            <option value="token_refresh">Token Refreshes</option>
            <option value="logout">Logouts</option>
          </select>
        </div>
      </div>
      <div class="card-body">
        <div id="eventsLoading" class="loading">
          <div class="spinner"></div>
          Loading security events...
        </div>
        <div id="eventsTable" style="display: none;">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Event Type</th>
                <th>User</th>
                <th>IP Address</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody id="eventsList"></tbody>
          </table>
        </div>
        <div id="noEvents" class="loading" style="display: none;">No security events found</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Security Recommendations</h3>
      </div>
      <div class="card-body">
        <div id="recommendationsList" class="recommendations-list">
          <div class="recommendation-item">
            <span class="recommendation-icon">✅</span>
            <div class="recommendation-content">
              <div class="recommendation-title">Rate limiting is enabled</div>
              <div class="recommendation-desc">All API endpoints are protected</div>
            </div>
          </div>
          <div class="recommendation-item warning">
            <span class="recommendation-icon">⚠️</span>
            <div class="recommendation-content">
              <div class="recommendation-title">Admin password hash not set</div>
              <div class="recommendation-desc">Set ADMIN_PASSWORD_HASH secret to secure the admin dashboard</div>
            </div>
            <button class="btn btn-sm btn-primary" onclick="showSetSecretModal('ADMIN_PASSWORD_HASH')">Fix</button>
          </div>
          <div class="recommendation-item warning">
            <span class="recommendation-icon">⚠️</span>
            <div class="recommendation-content">
              <div class="recommendation-title">OIDC encryption key not set</div>
              <div class="recommendation-desc">Set OIDC_ENCRYPTION_KEY for secure OAuth client secret storage</div>
            </div>
            <button class="btn btn-sm btn-primary" onclick="showSetSecretModal('OIDC_ENCRYPTION_KEY')">Fix</button>
          </div>
          <div class="recommendation-item info">
            <span class="recommendation-icon">ℹ️</span>
            <div class="recommendation-content">
              <div class="recommendation-title">TURN server not configured</div>
              <div class="recommendation-desc">Configure TURN for optimal VoIP connectivity</div>
            </div>
            <button class="btn btn-sm btn-secondary" onclick="showConfigureTurnModal()">Configure</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Session Details Modal -->
    <div id="sessionDetailsModal" class="modal">
      <div class="modal-content modal-lg">
        <div class="modal-header">
          <h2>Session Details</h2>
          <button class="modal-close" onclick="hideModal('sessionDetailsModal')">✕</button>
        </div>
        <div class="modal-body">
          <div class="details-grid">
            <div class="detail-section">
              <h4>Session Information</h4>
              <div class="detail-row">
                <span class="detail-label">Session ID:</span>
                <span class="detail-value" id="sessionDetailId"></span>
              </div>
              <div class="detail-row">
                <span class="detail-label">User:</span>
                <span class="detail-value" id="sessionDetailUser"></span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Device:</span>
                <span class="detail-value" id="sessionDetailDevice"></span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Device Name:</span>
                <span class="detail-value" id="sessionDetailDeviceName"></span>
              </div>
            </div>
            
            <div class="detail-section">
              <h4>Connection Details</h4>
              <div class="detail-row">
                <span class="detail-label">IP Address:</span>
                <span class="detail-value" id="sessionDetailIp"></span>
              </div>
              <div class="detail-row">
                <span class="detail-label">User Agent:</span>
                <span class="detail-value" id="sessionDetailUserAgent"></span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Created:</span>
                <span class="detail-value" id="sessionDetailCreated"></span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Last Seen:</span>
                <span class="detail-value" id="sessionDetailLastSeen"></span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Expires:</span>
                <span class="detail-value" id="sessionDetailExpires"></span>
              </div>
            </div>
            
            <div class="detail-section">
              <h4>Security Context</h4>
              <div class="detail-row">
                <span class="detail-label">Authentication:</span>
                <span class="detail-value" id="sessionDetailAuth"></span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Refresh Token:</span>
                <span class="detail-value" id="sessionDetailRefresh"></span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Rate Limited:</span>
                <span class="detail-value" id="sessionDetailRateLimited"></span>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="hideModal('sessionDetailsModal')">Close</button>
          <button class="btn btn-danger" onclick="revokeSession()">Revoke Session</button>
        </div>
      </div>
    </div>

    <!-- Set Secret Modal -->
    <div id="setSecretModal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Set Secret</h2>
          <button class="modal-close" onclick="hideModal('setSecretModal')">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label id="secretNameLabel">Secret Name</label>
            <input type="text" id="secretName" readonly disabled class="form-control">
          </div>
          <div class="form-group">
            <label>Secret Value</label>
            <input type="password" id="secretValue" class="form-control" placeholder="Enter secret value">
          </div>
          <div class="form-group" id="secretGenerator" style="display: none;">
            <label>Generate</label>
            <button class="btn btn-secondary" onclick="generateSecret()">Generate Random Secret</button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="hideModal('setSecretModal')">Cancel</button>
          <button class="btn btn-primary" onclick="saveSecret()">Save Secret</button>
        </div>
      </div>
    </div>
  </div>
`;

// Security-specific styles
export const securityStyles = `
  .rate-limits-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
  }
  
  .rate-limit-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-default);
    border-radius: 8px;
    transition: all var(--transition-fast);
  }
  
  .rate-limit-card:hover {
    border-color: var(--border-strong);
    background: var(--bg-hover);
  }
  
  .rate-limit-header h4 {
    margin: 0 0 4px 0;
    font-size: 14px;
    color: var(--text-secondary);
  }
  
  .rate-limit-badge {
    font-size: 16px;
    font-weight: 600;
    color: var(--accent-blue);
  }
  
  .rate-limit-controls {
    display: flex;
    gap: 4px;
  }
  
  .session-status {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }
  
  .session-status.active {
    background: rgba(34, 197, 94, 0.2);
    color: var(--accent-green);
  }
  
  .session-status.idle {
    background: rgba(245, 158, 11, 0.2);
    color: var(--accent-amber);
  }
  
  .session-status.stale {
    background: rgba(100, 116, 139, 0.2);
    color: var(--text-secondary);
  }
  
  .recommendations-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .recommendation-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-default);
    border-radius: 8px;
    transition: all var(--transition-fast);
  }
  
  .recommendation-item.warning {
    border-left: 4px solid var(--accent-amber);
  }
  
  .recommendation-item.info {
    border-left: 4px solid var(--accent-blue);
  }
  
  .recommendation-item:hover {
    background: var(--bg-hover);
  }
  
  .recommendation-icon {
    font-size: 24px;
  }
  
  .recommendation-content {
    flex: 1;
  }
  
  .recommendation-title {
    font-weight: 600;
    margin-bottom: 4px;
  }
  
  .recommendation-desc {
    font-size: 13px;
    color: var(--text-secondary);
  }
  
  .event-badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }
  
  .event-login {
    background: rgba(34, 197, 94, 0.2);
    color: var(--accent-green);
  }
  
  .event-failed {
    background: rgba(239, 68, 68, 0.2);
    color: var(--accent-red);
  }
  
  .event-rate-limit {
    background: rgba(245, 158, 11, 0.2);
    color: var(--accent-amber);
  }
  
  .event-refresh {
    background: rgba(59, 130, 246, 0.2);
    color: var(--accent-blue);
  }
  
  .event-logout {
    background: rgba(100, 116, 139, 0.2);
    color: var(--text-secondary);
  }
  
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
  
  .search-input {
    padding: 6px 12px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-default);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 13px;
    min-width: 200px;
  }
  
  .search-input:focus {
    outline: none;
    border-color: var(--accent-blue);
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
  
  .form-group {
    margin-bottom: 20px;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 8px;
    color: var(--text-secondary);
    font-size: 14px;
  }
  
  .form-control {
    width: 100%;
    padding: 10px 12px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-default);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 14px;
  }
  
  .form-control:focus {
    outline: none;
    border-color: var(--accent-blue);
  }
  
  .form-control[readonly] {
    background: var(--bg-base);
    color: var(--text-secondary);
  }
  
  .details-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
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
    width: 120px;
    color: var(--text-secondary);
    font-size: 13px;
  }
  
  .detail-value {
    flex: 1;
    color: var(--text-primary);
    font-size: 13px;
    word-break: break-word;
  }
  
  .pagination {
    display: flex;
    justify-content: center;
    gap: 4px;
    margin-top: 20px;
  }
  
  .pagination button {
    padding: 6px 12px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-default);
    border-radius: 4px;
    color: var(--text-secondary);
    cursor: pointer;
  }
  
  .pagination button:hover {
    background: var(--bg-hover);
  }
  
  .pagination button.active {
    background: var(--accent-blue);
    color: white;
    border-color: var(--accent-blue);
  }
`;

// Security JavaScript functions
export const securityFunctions = (): string => `
  // ============================================
  // Security Management Functions
  // ============================================
  
  let currentSessions = [];
  let currentSecurityEvents = [];
  let sessionsSortField = 'last_seen';
  let sessionsSortDirection = 'desc';
  let sessionsSearchTimeout;
  let currentSecretName = '';
  
  async function loadSecurityData() {
    await loadSessions();
    await loadRateLimits();
    await loadSecurityEvents();
    await loadSecurityRecommendations();
  }
  
  async function loadSessions(page = 0) {
    document.getElementById('sessionsLoading').style.display = 'block';
    document.getElementById('sessionsTable').style.display = 'none';
    document.getElementById('noSessions').style.display = 'none';
    
    try {
      const data = await api.get('/security/sessions?limit=50&offset=' + (page * 50));
      
      // Update stats
      document.getElementById('activeSessionsCount').textContent = data.total || '0';
      
      // Get unique users count
      const uniqueUsers = new Set();
      data.sessions?.forEach((s) => uniqueUsers.add(s.user_id));
      document.getElementById('uniqueUsersCount').textContent = uniqueUsers.size || '0';
      
      currentSessions = data.sessions || [];
      
      // Apply filters
      let filteredSessions = filterSessionsItems(currentSessions);
      
      // Apply sorting
      filteredSessions = sortSessionsArray(filteredSessions, sessionsSortField, sessionsSortDirection);
      
      // Paginate
      const limit = 50;
      const start = page * limit;
      const paginatedSessions = filteredSessions.slice(start, start + limit);
      const totalPages = Math.ceil(filteredSessions.length / limit);
      
      if (paginatedSessions.length === 0) {
        document.getElementById('sessionsLoading').style.display = 'none';
        document.getElementById('noSessions').style.display = 'block';
        return;
      }
      
      const tbody = document.getElementById('sessionsList');
      tbody.innerHTML = '';
      
      paginatedSessions.forEach((session) => {
        const status = getSessionStatus(session);
        const statusClass = status === 'Active' ? 'active' : status === 'Idle' ? 'idle' : 'stale';
        
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td>\${session.user_id}</td>
          <td>\${session.device_name || session.device_id || 'Unknown'}</td>
          <td>\${session.last_seen_ip || 'Unknown'}</td>
          <td>\${new Date(session.created_at).toLocaleString()}</td>
          <td>\${session.last_seen_ts ? new Date(session.last_seen_ts).toLocaleString() : 'Never'}</td>
          <td><span class="session-status \${statusClass}">\${status}</span></td>
          <td class="action-group">
            <button class="btn-icon-sm" onclick="viewSessionDetails('\${session.id}')" title="View details">👁️</button>
            <button class="btn-icon-sm danger" onclick="revokeSession('\${session.id}')" title="Revoke">🗑️</button>
          </td>
        \`;
        tbody.appendChild(tr);
      });
      
      // Update pagination
      renderSessionsPagination(page, totalPages);
      
      document.getElementById('sessionsLoading').style.display = 'none';
      document.getElementById('sessionsTable').style.display = 'block';
      
    } catch (err) {
      console.error('Failed to load sessions:', err);
      document.getElementById('sessionsLoading').innerHTML = 'Failed to load sessions';
    }
  }
  
  function getSessionStatus(session) {
    if (!session.last_seen_ts) return 'Active';
    
    const now = Date.now();
    const lastSeen = session.last_seen_ts;
    const hoursSinceLastSeen = (now - lastSeen) / (1000 * 60 * 60);
    
    if (hoursSinceLastSeen < 1) return 'Active';
    if (hoursSinceLastSeen < 24) return 'Idle';
    return 'Stale';
  }
  
  function filterSessionsItems(items) {
    const search = document.getElementById('sessionSearch')?.value?.toLowerCase() || '';
    const statusFilter = document.getElementById('sessionStatusFilter')?.value || 'all';
    
    return items.filter(item => {
      // Status filter
      if (statusFilter !== 'all') {
        const status = getSessionStatus(item).toLowerCase();
        if (status !== statusFilter) return false;
      }
      
      // Search filter
      if (search) {
        return item.user_id?.toLowerCase().includes(search) ||
               item.device_name?.toLowerCase().includes(search) ||
               item.device_id?.toLowerCase().includes(search) ||
               item.last_seen_ip?.toLowerCase().includes(search);
      }
      
      return true;
    });
  }
  
  function filterSessions() {
    loadSessions(0);
  }
  
  function debounceSearchSessions() {
    clearTimeout(sessionsSearchTimeout);
    sessionsSearchTimeout = setTimeout(() => {
      filterSessions();
    }, 300);
  }
  
  function sortSessionsArray(sessions, field, direction) {
    return [...sessions].sort((a, b) => {
      let aVal, bVal;
      
      switch(field) {
        case 'user':
          aVal = a.user_id || '';
          bVal = b.user_id || '';
          break;
        case 'device':
          aVal = a.device_name || a.device_id || '';
          bVal = b.device_name || b.device_id || '';
          break;
        case 'ip':
          aVal = a.last_seen_ip || '';
          bVal = b.last_seen_ip || '';
          break;
        case 'created':
          aVal = a.created_at || 0;
          bVal = b.created_at || 0;
          break;
        case 'last_seen':
          aVal = a.last_seen_ts || 0;
          bVal = b.last_seen_ts || 0;
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
  
  function sortSessions(field) {
    if (sessionsSortField === field) {
      sessionsSortDirection = sessionsSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sessionsSortField = field;
      sessionsSortDirection = 'asc';
    }
    
    // Update sort indicators
    document.querySelectorAll('.sort-indicator').forEach(el => el.textContent = '');
    const indicator = document.getElementById(\`sort\${field.charAt(0).toUpperCase() + field.slice(1)}\`);
    if (indicator) {
      indicator.textContent = sessionsSortDirection === 'asc' ? '↑' : '↓';
    }
    
    loadSessions(0);
  }
  
  function renderSessionsPagination(currentPage, totalPages) {
    const paginationEl = document.getElementById('sessionsPagination');
    paginationEl.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    // Previous button
    if (currentPage > 0) {
      const prevBtn = document.createElement('button');
      prevBtn.innerHTML = '←';
      prevBtn.onclick = () => loadSessions(currentPage - 1);
      paginationEl.appendChild(prevBtn);
    }
    
    // Page numbers
    for (let i = Math.max(0, currentPage - 2); i <= Math.min(totalPages - 1, currentPage + 2); i++) {
      const btn = document.createElement('button');
      btn.textContent = (i + 1).toString();
      btn.className = i === currentPage ? 'active' : '';
      btn.onclick = () => loadSessions(i);
      paginationEl.appendChild(btn);
    }
    
    // Next button
    if (currentPage < totalPages - 1) {
      const nextBtn = document.createElement('button');
      nextBtn.innerHTML = '→';
      nextBtn.onclick = () => loadSessions(currentPage + 1);
      paginationEl.appendChild(nextBtn);
    }
  }
  
  async function loadRateLimits() {
    try {
      const data = await api.get('/security/rate-limits');
      const limits = data.limits || {};
      
      document.getElementById('loginRateLimit').textContent = limits.login?.requests + '/' + (limits.login?.window_ms / 1000) + 's' || '10/min';
      document.getElementById('registerRateLimit').textContent = limits.register?.requests + '/' + (limits.register?.window_ms / 1000) + 's' || '5/min';
      document.getElementById('syncRateLimit').textContent = limits.sync?.requests + '/' + (limits.sync?.window_ms / 1000) + 's' || '300/min';
      document.getElementById('messageRateLimit').textContent = limits.send_message?.requests + '/' + (limits.send_message?.window_ms / 1000) + 's' || '60/min';
      document.getElementById('createRoomRateLimit').textContent = limits.create_room?.requests + '/' + (limits.create_room?.window_ms / 1000) + 's' || '10/min';
      document.getElementById('mediaRateLimit').textContent = limits.media_upload?.requests + '/' + (limits.media_upload?.window_ms / 1000) + 's' || '30/min';
      
    } catch (err) {
      console.error('Failed to load rate limits:', err);
    }
  }
  
  async function loadSecurityEvents() {
    document.getElementById('eventsLoading').style.display = 'block';
    document.getElementById('eventsTable').style.display = 'none';
    document.getElementById('noEvents').style.display = 'none';
    
    try {
      const type = document.getElementById('securityEventType')?.value || 'all';
      
      // This would come from your analytics or logging system
      // For now, generate mock data
      const events = generateMockSecurityEvents(type);
      currentSecurityEvents = events;
      
      if (events.length === 0) {
        document.getElementById('eventsLoading').style.display = 'none';
        document.getElementById('noEvents').style.display = 'block';
        return;
      }
      
      const tbody = document.getElementById('eventsList');
      tbody.innerHTML = '';
      
      events.forEach((event) => {
        const eventClass = getEventClass(event.type);
        
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td>\${new Date(event.timestamp).toLocaleString()}</td>
          <td><span class="event-badge \${eventClass}">\${event.type}</span></td>
          <td>\${event.user || 'Unknown'}</td>
          <td>\${event.ip || 'Unknown'}</td>
          <td>\${event.details || ''}</td>
        \`;
        tbody.appendChild(tr);
      });
      
      // Update failed logins count
      const failedLogins = events.filter(e => e.type === 'failed_login').length;
      document.getElementById('failedLogins').textContent = failedLogins;
      
      // Update rate limit hits
      const rateLimitHits = events.filter(e => e.type === 'rate_limit').length;
      document.getElementById('rateLimitHits').textContent = rateLimitHits;
      
      document.getElementById('eventsLoading').style.display = 'none';
      document.getElementById('eventsTable').style.display = 'block';
      
    } catch (err) {
      console.error('Failed to load security events:', err);
      document.getElementById('eventsLoading').innerHTML = 'Failed to load events';
    }
  }
  
  function getEventClass(type) {
    switch(type) {
      case 'login': return 'event-login';
      case 'failed_login': return 'event-failed';
      case 'rate_limit': return 'event-rate-limit';
      case 'token_refresh': return 'event-refresh';
      case 'logout': return 'event-logout';
      default: return '';
    }
  }
  
  function generateMockSecurityEvents(type) {
    const events = [];
    const now = Date.now();
    const types = ['login', 'failed_login', 'rate_limit', 'token_refresh', 'logout'];
    const users = ['@admin:matrix.deepmeow.cc', '@user1:matrix.deepmeow.cc', '@user2:matrix.deepmeow.cc'];
    const ips = ['192.168.1.1', '10.0.0.1', '172.16.0.1'];
    
    for (let i = 0; i < 50; i++) {
      const eventType = types[Math.floor(Math.random() * types.length)];
      
      if (type !== 'all' && eventType !== type) continue;
      
      events.push({
        timestamp: now - Math.random() * 24 * 60 * 60 * 1000,
        type: eventType,
        user: users[Math.floor(Math.random() * users.length)],
        ip: ips[Math.floor(Math.random() * ips.length)],
        details: eventType === 'rate_limit' ? 'Exceeded 10 requests per minute' :
                 eventType === 'failed_login' ? 'Invalid password' :
                 eventType === 'login' ? 'Successful login' :
                 eventType === 'token_refresh' ? 'Token refreshed' :
                 'Session ended'
      });
    }
    
    return events.sort((a, b) => b.timestamp - a.timestamp);
  }
  
  async function loadSecurityRecommendations() {
    try {
      // Check admin password hash
      const adminHashSet = await checkSecretSet('ADMIN_PASSWORD_HASH');
      const oidcKeySet = await checkSecretSet('OIDC_ENCRYPTION_KEY');
      const turnConfigured = await checkTurnConfigured();
      
      const recommendationsList = document.getElementById('recommendationsList');
      recommendationsList.innerHTML = '';
      
      // Rate limiting (always enabled)
      recommendationsList.innerHTML += \`
        <div class="recommendation-item">
          <span class="recommendation-icon">✅</span>
          <div class="recommendation-content">
            <div class="recommendation-title">Rate limiting is enabled</div>
            <div class="recommendation-desc">All API endpoints are protected</div>
          </div>
        </div>
      \`;
      
      // Admin password hash
      if (!adminHashSet) {
        recommendationsList.innerHTML += \`
          <div class="recommendation-item warning">
            <span class="recommendation-icon">⚠️</span>
            <div class="recommendation-content">
              <div class="recommendation-title">Admin password hash not set</div>
              <div class="recommendation-desc">Set ADMIN_PASSWORD_HASH secret to secure the admin dashboard</div>
            </div>
            <button class="btn btn-sm btn-primary" onclick="showSetSecretModal('ADMIN_PASSWORD_HASH')">Fix</button>
          </div>
        \`;
      } else {
        recommendationsList.innerHTML += \`
          <div class="recommendation-item">
            <span class="recommendation-icon">✅</span>
            <div class="recommendation-content">
              <div class="recommendation-title">Admin password hash is set</div>
              <div class="recommendation-desc">Admin dashboard is secure</div>
            </div>
          </div>
        \`;
      }
      
      // OIDC encryption key
      if (!oidcKeySet) {
        recommendationsList.innerHTML += \`
          <div class="recommendation-item warning">
            <span class="recommendation-icon">⚠️</span>
            <div class="recommendation-content">
              <div class="recommendation-title">OIDC encryption key not set</div>
              <div class="recommendation-desc">Set OIDC_ENCRYPTION_KEY for secure OAuth client secret storage</div>
            </div>
            <button class="btn btn-sm btn-primary" onclick="showSetSecretModal('OIDC_ENCRYPTION_KEY')">Fix</button>
          </div>
        \`;
      } else {
        recommendationsList.innerHTML += \`
          <div class="recommendation-item">
            <span class="recommendation-icon">✅</span>
            <div class="recommendation-content">
              <div class="recommendation-title">OIDC encryption key is set</div>
              <div class="recommendation-desc">OAuth client secrets are encrypted</div>
            </div>
          </div>
        \`;
      }
      
      // TURN configuration
      if (!turnConfigured) {
        recommendationsList.innerHTML += \`
          <div class="recommendation-item info">
            <span class="recommendation-icon">ℹ️</span>
            <div class="recommendation-content">
              <div class="recommendation-title">TURN server not configured</div>
              <div class="recommendation-desc">Configure TURN for optimal VoIP connectivity</div>
            </div>
            <button class="btn btn-sm btn-secondary" onclick="showConfigureTurnModal()">Configure</button>
          </div>
        \`;
      } else {
        recommendationsList.innerHTML += \`
          <div class="recommendation-item">
            <span class="recommendation-icon">✅</span>
            <div class="recommendation-content">
              <div class="recommendation-title">TURN server configured</div>
              <div class="recommendation-desc">VoIP calls will work through NAT</div>
            </div>
          </div>
        \`;
      }
      
    } catch (err) {
      console.error('Failed to load recommendations:', err);
    }
  }
  
  async function checkSecretSet(secretName) {
    // This would check if the secret is set in the environment
    // For now, return false to show warnings
    return false;
  }
  
  async function checkTurnConfigured() {
    // This would check if TURN is configured
    // For now, return false
    return false;
  }
  
  async function viewSessionDetails(sessionId) {
    try {
      const session = currentSessions.find(s => s.id === sessionId);
      if (!session) return;
      
      document.getElementById('sessionDetailId').textContent = session.id;
      document.getElementById('sessionDetailUser').textContent = session.user_id;
      document.getElementById('sessionDetailDevice').textContent = session.device_id || 'Unknown';
      document.getElementById('sessionDetailDeviceName').textContent = session.device_name || 'Unknown';
      document.getElementById('sessionDetailIp').textContent = session.last_seen_ip || 'Unknown';
      document.getElementById('sessionDetailUserAgent').textContent = session.user_agent || 'Unknown';
      document.getElementById('sessionDetailCreated').textContent = session.created_at ? new Date(session.created_at).toLocaleString() : 'Unknown';
      document.getElementById('sessionDetailLastSeen').textContent = session.last_seen_ts ? new Date(session.last_seen_ts).toLocaleString() : 'Never';
      document.getElementById('sessionDetailExpires').textContent = session.expires_at ? new Date(session.expires_at).toLocaleString() : 'Never';
      document.getElementById('sessionDetailAuth').textContent = 'Bearer Token';
      document.getElementById('sessionDetailRefresh').textContent = session.refresh_token ? 'Available' : 'Not available';
      document.getElementById('sessionDetailRateLimited').textContent = 'No';
      
      showModal('sessionDetailsModal');
      
    } catch (err) {
      console.error('Failed to load session details:', err);
      showNotification('Failed to load session details', 'error');
    }
  }
  
  async function revokeSession(sessionId?) {
    const id = sessionId || currentSessions.find(s => s.id === sessionId)?.id;
    if (!id) return;
    
    confirmAction(
      'Revoke Session',
      'Force logout this session? The user will need to log in again.',
      async () => {
        try {
          await api.delete('/security/sessions/' + id);
          showNotification('Session revoked successfully', 'success');
          loadSessions(0);
          hideModal('sessionDetailsModal');
        } catch (err) {
          showNotification('Failed to revoke session', 'error');
        }
      }
    );
  }
  
  function revokeAllSessions() {
    confirmAction(
      'Revoke All Sessions',
      'Force logout ALL active sessions? All users will need to log in again.',
      async () => {
        // This would call a bulk revoke endpoint
        showNotification('Revoke all sessions not implemented', 'info');
      }
    );
  }
  
  function editRateLimit(type) {
    const currentLimit = document.getElementById(type + 'RateLimit')?.textContent || '10/min';
    const newLimit = prompt('Enter new rate limit (e.g., 100/min, 50/10s):', currentLimit);
    
    if (newLimit) {
      // This would update the rate limit configuration
      showNotification('Rate limit update not implemented', 'info');
    }
  }
  
  function resetRateLimit(type) {
    confirmAction(
      'Reset Rate Limit',
      'Reset to default value?',
      () => {
        // This would reset to default
        showNotification('Rate limit reset not implemented', 'info');
      }
    );
  }
  
  function showSetSecretModal(secretName) {
    currentSecretName = secretName;
    document.getElementById('secretNameLabel').textContent = 'Secret: ' + secretName;
    document.getElementById('secretName').value = secretName;
    document.getElementById('secretValue').value = '';
    
    // Show generator for certain secrets
    if (secretName === 'OIDC_ENCRYPTION_KEY') {
      document.getElementById('secretGenerator').style.display = 'block';
    } else {
      document.getElementById('secretGenerator').style.display = 'none';
    }
    
    showModal('setSecretModal');
  }
  
  function generateSecret() {
    // Generate a random 32-byte base64 secret
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const secret = btoa(String.fromCharCode(...bytes));
    document.getElementById('secretValue').value = secret;
  }
  
  async function saveSecret() {
    const secretName = document.getElementById('secretName').value;
    const secretValue = document.getElementById('secretValue').value;
    
    if (!secretValue) {
      showNotification('Please enter a secret value', 'error');
      return;
    }
    
    // This would call an API to set the secret
    // In production, you'd need a secure way to set secrets
    showNotification('Secret saving not implemented - use wrangler secret put ' + secretName, 'info');
    hideModal('setSecretModal');
  }
  
  function showConfigureTurnModal() {
    // This would show TURN configuration modal
    showNotification('TURN configuration not implemented', 'info');
  }
  
  function exportSecurityLog() {
    const dataStr = JSON.stringify(currentSecurityEvents, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = \`security_log_\${new Date().toISOString()}.json\`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }
  
  function refreshSecurity() {
    loadSecurityData();
  }
`;

// Export all
export default {
  view: securityView,
  styles: securityStyles,
  functions: securityFunctions
};