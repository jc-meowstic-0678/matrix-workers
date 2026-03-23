// src/admin/ui/views/users.ts
// User management view with listing, details, and moderation tools

export const usersView = (): string => `
  <div id="usersView" class="view" style="display: none;">
    <div class="header">
      <h2>Users</h2>
      <div class="header-actions">
        <button class="btn btn-primary" onclick="showCreateUserModal()">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Create User
        </button>
        <button class="btn btn-secondary" onclick="refreshUsers()">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6"></path>
            <path d="M1 20v-6h6"></path>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          Refresh
        </button>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card" id="totalUsersCard">
        <div class="label">Total Users</div>
        <div class="value" id="totalUsers">-</div>
      </div>
      <div class="stat-card" id="activeUsersCard">
        <div class="label">Active (24h)</div>
        <div class="value" id="activeUsers">-</div>
      </div>
      <div class="stat-card" id="adminsCard">
        <div class="label">Admins</div>
        <div class="value" id="adminCount">-</div>
      </div>
      <div class="stat-card" id="deactivatedCard">
        <div class="label">Deactivated</div>
        <div class="value" id="deactivatedCount">-</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>User Management</h3>
        <div class="header-actions">
          <div class="filter-group">
            <select id="userRoleFilter" onchange="filterUsers()" class="filter-select">
              <option value="all">All Users</option>
              <option value="admin">Admins</option>
              <option value="user">Regular Users</option>
            </select>
            <select id="userStatusFilter" onchange="filterUsers()" class="filter-select">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="deactivated">Deactivated</option>
            </select>
            <input 
              type="text" 
              class="search-input" 
              id="userSearch" 
              placeholder="Search by username or ID..." 
              onkeyup="debounceSearchUsers()"
            >
          </div>
        </div>
      </div>
      <div class="card-body">
        <div id="usersLoading" class="loading">
          <div class="spinner"></div>
          Loading users...
        </div>
        <div id="usersTable" style="display: none;">
          <table>
            <thead>
              <tr>
                <th onclick="sortUsers('user_id')" class="sortable">
                  User ID
                  <span class="sort-indicator" id="sortUserId"></span>
                </th>
                <th onclick="sortUsers('display_name')" class="sortable">
                  Display Name
                  <span class="sort-indicator" id="sortDisplayName"></span>
                </th>
                <th onclick="sortUsers('localpart')" class="sortable">
                  Localpart
                  <span class="sort-indicator" id="sortLocalpart"></span>
                </th>
                <th>Role</th>
                <th>Status</th>
                <th onclick="sortUsers('created_at')" class="sortable">
                  Created
                  <span class="sort-indicator" id="sortCreatedAt"></span>
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="usersList"></tbody>
          </table>
          <div class="pagination" id="usersPagination"></div>
        </div>
        <div id="noUsers" class="loading" style="display: none;">No users found</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>User Statistics</h3>
        <div class="header-actions">
          <select id="userStatsPeriod" onchange="updateUserCharts()" class="filter-select">
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>
      </div>
      <div class="card-body">
        <div class="charts-grid">
          <div class="chart-container">
            <canvas id="userRegistrationsChart"></canvas>
          </div>
          <div class="chart-container">
            <canvas id="userActivityChart"></canvas>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Most Active Users</h3>
      </div>
      <div class="card-body">
        <div id="activeUsersLoading" class="loading">
          <div class="spinner"></div>
          Loading data...
        </div>
        <div id="activeUsersTable" style="display: none;">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Messages</th>
                <th>Rooms Joined</th>
                <th>Last Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="activeUsersList"></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- User Details Modal -->
    <div id="userDetailsModal" class="modal">
      <div class="modal-content modal-lg">
        <div class="modal-header">
          <h2>User Details</h2>
          <button class="modal-close" onclick="hideModal('userDetailsModal')">✕</button>
        </div>
        <div class="modal-body">
          <div class="details-tabs">
            <button class="tab-btn active" onclick="switchUserTab('profile')">Profile</button>
            <button class="tab-btn" onclick="switchUserTab('devices')">Devices</button>
            <button class="tab-btn" onclick="switchUserTab('sessions')">Sessions</button>
            <button class="tab-btn" onclick="switchUserTab('rooms')">Rooms</button>
            <button class="tab-btn" onclick="switchUserTab('e2ee')">E2EE Keys</button>
          </div>
          
          <div id="userProfileTab" class="tab-content active">
            <div class="details-grid">
              <div class="detail-section">
                <h4>Basic Information</h4>
                <div class="detail-row">
                  <span class="detail-label">User ID:</span>
                  <span class="detail-value" id="userDetailId"></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Localpart:</span>
                  <span class="detail-value" id="userDetailLocalpart"></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Display Name:</span>
                  <span class="detail-value" id="userDetailDisplayName"></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Avatar:</span>
                  <span class="detail-value" id="userDetailAvatar"></span>
                </div>
              </div>
              
              <div class="detail-section">
                <h4>Account Status</h4>
                <div class="detail-row">
                  <span class="detail-label">Role:</span>
                  <span class="detail-value" id="userDetailRole"></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Status:</span>
                  <span class="detail-value" id="userDetailStatus"></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Guest:</span>
                  <span class="detail-value" id="userDetailGuest"></span>
                </div>
              </div>
              
              <div class="detail-section">
                <h4>Timestamps</h4>
                <div class="detail-row">
                  <span class="detail-label">Created:</span>
                  <span class="detail-value" id="userDetailCreated"></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Last Updated:</span>
                  <span class="detail-value" id="userDetailUpdated"></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Last Seen:</span>
                  <span class="detail-value" id="userDetailLastSeen"></span>
                </div>
              </div>
            </div>
          </div>
          
          <div id="userDevicesTab" class="tab-content" style="display: none;">
            <div class="device-actions">
              <button class="btn btn-primary btn-sm" onclick="showAddDeviceModal()">Add Device</button>
            </div>
            <div id="devicesLoading" class="loading">Loading devices...</div>
            <div id="devicesTable" style="display: none;">
              <table>
                <thead>
                  <tr>
                    <th>Device ID</th>
                    <th>Display Name</th>
                    <th>Last Seen</th>
                    <th>IP Address</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="devicesList"></tbody>
              </table>
            </div>
          </div>
          
          <div id="userSessionsTab" class="tab-content" style="display: none;">
            <div class="session-actions">
              <button class="btn btn-danger btn-sm" onclick="revokeAllUserSessions()">Revoke All Sessions</button>
            </div>
            <div id="sessionsLoading" class="loading">Loading sessions...</div>
            <div id="sessionsTable" style="display: none;">
              <table>
                <thead>
                  <tr>
                    <th>Session ID</th>
                    <th>Device</th>
                    <th>Created</th>
                    <th>Last Seen</th>
                    <th>IP</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="sessionsList"></tbody>
              </table>
            </div>
          </div>
          
          <div id="userRoomsTab" class="tab-content" style="display: none;">
            <div class="room-filters">
              <select id="roomMembershipFilter" onchange="filterUserRooms()" class="filter-select">
                <option value="all">All Rooms</option>
                <option value="join">Joined</option>
                <option value="invite">Invited</option>
                <option value="leave">Left</option>
                <option value="ban">Banned</option>
                <option value="knock">Knocked</option>
              </select>
            </div>
            <div id="roomsLoading" class="loading">Loading rooms...</div>
            <div id="roomsTable" style="display: none;">
              <table>
                <thead>
                  <tr>
                    <th>Room ID</th>
                    <th>Name</th>
                    <th>Membership</th>
                    <th>Joined At</th>
                    <th>Power Level</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="roomsList"></tbody>
              </table>
            </div>
          </div>
          
          <div id="userE2EETab" class="tab-content" style="display: none;">
            <div class="e2ee-sections">
              <div class="e2ee-section">
                <h4>Cross-Signing Keys</h4>
                <div id="crossSigningKeys" class="key-display">
                  <div class="loading">Loading keys...</div>
                </div>
              </div>
              <div class="e2ee-section">
                <h4>Device Keys</h4>
                <div id="deviceKeysList" class="key-display">
                  <div class="loading">Loading device keys...</div>
                </div>
              </div>
              <div class="e2ee-section">
                <h4>Signatures</h4>
                <div id="signaturesList" class="key-display">
                  <div class="loading">Loading signatures...</div>
                </div>
              </div>
              <div class="e2ee-section">
                <h4>Verification Status</h4>
                <div id="verificationStatus" class="key-display">
                  <div class="loading">Loading verification status...</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="hideModal('userDetailsModal')">Close</button>
          <button class="btn btn-warning" onclick="resetUserPassword()">Reset Password</button>
          <button class="btn btn-danger" id="deactivateUserBtn" onclick="toggleUserDeactivation()">Deactivate User</button>
          <button class="btn btn-primary" onclick="makeUserAdmin()" id="makeAdminBtn">Make Admin</button>
        </div>
      </div>
    </div>

    <!-- Create User Modal -->
    <div id="createUserModal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Create User</h2>
          <button class="modal-close" onclick="hideModal('createUserModal')">✕</button>
        </div>
        <div class="modal-body">
          <div id="createUserError" class="error-message" style="display: none;"></div>
          <div class="form-group">
            <label>Username</label>
            <input type="text" id="newUsername" placeholder="username" class="form-control">
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="newPassword" placeholder="password" class="form-control">
          </div>
          <div class="form-group">
            <label>Display Name (optional)</label>
            <input type="text" id="newDisplayName" placeholder="Display Name" class="form-control">
          </div>
          <div class="form-group checkbox">
            <input type="checkbox" id="newIsAdmin">
            <label>Make admin</label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="hideModal('createUserModal')">Cancel</button>
          <button class="btn btn-primary" onclick="createUser()">Create</button>
        </div>
      </div>
    </div>

    <!-- Reset Password Modal -->
    <div id="resetPasswordModal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Reset Password</h2>
          <button class="modal-close" onclick="hideModal('resetPasswordModal')">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>New Password</label>
            <input type="password" id="newUserPassword" placeholder="Enter new password" class="form-control">
          </div>
          <div class="form-group">
            <label>Confirm Password</label>
            <input type="password" id="confirmUserPassword" placeholder="Confirm password" class="form-control">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="hideModal('resetPasswordModal')">Cancel</button>
          <button class="btn btn-warning" onclick="confirmResetPassword()">Reset Password</button>
        </div>
      </div>
    </div>

    <!-- Add Device Modal -->
    <div id="addDeviceModal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Add Device</h2>
          <button class="modal-close" onclick="hideModal('addDeviceModal')">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Device ID</label>
            <input type="text" id="newDeviceId" placeholder="Device ID" class="form-control">
          </div>
          <div class="form-group">
            <label>Display Name</label>
            <input type="text" id="newDeviceName" placeholder="Display Name" class="form-control">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="hideModal('addDeviceModal')">Cancel</button>
          <button class="btn btn-primary" onclick="addDevice()">Add Device</button>
        </div>
      </div>
    </div>
  </div>
`;

// Users-specific styles
export const usersStyles = `
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
  
  .role-badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }
  
  .role-admin {
    background: rgba(139, 92, 246, 0.2);
    color: #a78bfa;
  }
  
  .role-user {
    background: rgba(59, 130, 246, 0.2);
    color: var(--accent-blue);
  }
  
  .status-badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }
  
  .status-active {
    background: rgba(34, 197, 94, 0.2);
    color: var(--accent-green);
  }
  
  .status-deactivated {
    background: rgba(239, 68, 68, 0.2);
    color: var(--accent-red);
  }
  
  .status-guest {
    background: rgba(245, 158, 11, 0.2);
    color: var(--accent-amber);
  }
  
  .modal-lg {
    max-width: 900px;
    width: 90%;
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
  
  .form-group.checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .form-group.checkbox input {
    width: auto;
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
  
  .error-message {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: var(--accent-red);
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 20px;
    font-size: 14px;
  }
  
  .details-tabs {
    display: flex;
    gap: 2px;
    background: var(--bg-elevated);
    padding: 4px;
    border-radius: 8px;
    margin-bottom: 20px;
  }
  
  .tab-btn {
    flex: 1;
    padding: 10px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: all var(--transition-fast);
  }
  
  .tab-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  
  .tab-btn.active {
    background: var(--bg-active);
    color: var(--text-primary);
  }
  
  .tab-content {
    display: none;
  }
  
  .tab-content.active {
    display: block;
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
  
  .device-actions,
  .session-actions,
  .room-filters {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-bottom: 16px;
  }
  
  .room-filters {
    justify-content: flex-start;
  }
  
  .e2ee-sections {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  
  .e2ee-section {
    border: 1px solid var(--border-default);
    border-radius: 8px;
    overflow: hidden;
  }
  
  .e2ee-section h4 {
    padding: 12px 16px;
    background: var(--bg-elevated);
    border-bottom: 1px solid var(--border-default);
    margin: 0;
    font-size: 14px;
    color: var(--text-secondary);
  }
  
  .key-display {
    padding: 16px;
    font-family: monospace;
    font-size: 12px;
    background: var(--bg-base);
    max-height: 200px;
    overflow-y: auto;
  }
  
  .key-item {
    padding: 8px;
    border-bottom: 1px solid var(--border-default);
  }
  
  .key-item:last-child {
    border-bottom: none;
  }
  
  .key-label {
    color: var(--accent-blue);
    font-weight: 500;
  }
  
  .key-value {
    color: var(--text-secondary);
    word-break: break-all;
  }
  
  .verification-badge {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    margin-left: 8px;
  }
  
  .verification-verified {
    background: rgba(34, 197, 94, 0.2);
    color: var(--accent-green);
  }
  
  .verification-unverified {
    background: rgba(239, 68, 68, 0.2);
    color: var(--accent-red);
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
  
  .chart-container {
    position: relative;
    height: 300px;
    width: 100%;
  }
  
  .action-group {
    display: flex;
    gap: 4px;
  }
  
  .btn-icon-sm {
    padding: 4px 8px;
    background: var(--bg-hover);
    border: 1px solid var(--border-default);
    border-radius: 4px;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 12px;
  }
  
  .btn-icon-sm:hover {
    background: var(--bg-active);
    color: var(--text-primary);
  }
  
  .btn-icon-sm.danger:hover {
    background: rgba(239, 68, 68, 0.2);
    color: var(--accent-red);
    border-color: var(--accent-red);
  }
  
  .btn-icon-sm.warning:hover {
    background: rgba(245, 158, 11, 0.2);
    color: var(--accent-amber);
    border-color: var(--accent-amber);
  }
  
  .btn-icon-sm.success:hover {
    background: rgba(34, 197, 94, 0.2);
    color: var(--accent-green);
    border-color: var(--accent-green);
  }
`;

// Users JavaScript functions
export const usersFunctions = (): string => `
  // ============================================
  // User Management Functions
  // ============================================
  
  let currentUsers = [];
  let currentUserId = null;
  let currentUserDevices = [];
  let currentUserSessions = [];
  let currentUserRooms = [];
  let usersSortField = 'created_at';
  let usersSortDirection = 'desc';
  let userRoleFilter = 'all';
  let userStatusFilter = 'all';
  let usersSearchTimeout;
  let currentUserTab = 'profile';
  let registrationsChart;
  let activityChart;
  
  async function loadUsers(page = 0, search = '') {
    document.getElementById('usersLoading').style.display = 'block';
    document.getElementById('usersTable').style.display = 'none';
    document.getElementById('noUsers').style.display = 'none';
    
    try {
      let url = '/users?limit=50&offset=' + (page * 50);
      if (search) url += '&search=' + encodeURIComponent(search);
      
      const data = await api.get(url);
      
      // Update stats
      await loadUserStats();
      
      currentUsers = data.items || [];
      
      // Apply filters
      let filteredUsers = filterUserItems(currentUsers);
      
      // Apply sorting
      filteredUsers = sortUsersArray(filteredUsers, usersSortField, usersSortDirection);
      
      // Paginate
      const limit = 50;
      const start = page * limit;
      const paginatedUsers = filteredUsers.slice(start, start + limit);
      const totalPages = Math.ceil(filteredUsers.length / limit);
      
      if (paginatedUsers.length === 0) {
        document.getElementById('usersLoading').style.display = 'none';
        document.getElementById('noUsers').style.display = 'block';
        return;
      }
      
      const tbody = document.getElementById('usersList');
      tbody.innerHTML = '';
      
      paginatedUsers.forEach((user) => {
        const roleClass = user.admin ? 'role-admin' : 'role-user';
        const roleText = user.admin ? 'Admin' : 'User';
        const statusClass = user.is_deactivated ? 'status-deactivated' : (user.is_guest ? 'status-guest' : 'status-active');
        const statusText = user.is_deactivated ? 'Deactivated' : (user.is_guest ? 'Guest' : 'Active');
        
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td>\${truncateString(user.user_id, 30)}</td>
          <td>\${user.display_name || '-'}</td>
          <td>\${user.localpart || '-'}</td>
          <td><span class="role-badge \${roleClass}">\${roleText}</span></td>
          <td><span class="status-badge \${statusClass}">\${statusText}</span></td>
          <td>\${new Date(user.created_at).toLocaleDateString()}</td>
          <td class="action-group">
            <button class="btn-icon-sm" onclick="viewUserDetails('\${user.user_id}')" title="View details">👁️</button>
            <button class="btn-icon-sm warning" onclick="showResetPasswordModal('\${user.user_id}')" title="Reset password">🔑</button>
            \${!user.admin ? 
              `<button class="btn-icon-sm success" onclick="makeUserAdmin('${user.user_id}')" title="Make admin">⭐</button>` : 
              `<button class="btn-icon-sm" onclick="removeUserAdmin('${user.user_id}')" title="Remove admin">⬇️</button>`
            }
            \${user.is_deactivated ? 
              `<button class="btn-icon-sm success" onclick="reactivateUser('${user.user_id}')" title="Reactivate">✅</button>` : 
              `<button class="btn-icon-sm danger" onclick="deactivateUser('${user.user_id}')" title="Deactivate">⛔</button>`
            }
          </td>
        \`;
        tbody.appendChild(tr);
      });
      
      // Update pagination
      renderUsersPagination(page, totalPages);
      
      // Update charts
      updateUserCharts();
      
      // Load most active users
      await loadMostActiveUsers();
      
      document.getElementById('usersLoading').style.display = 'none';
      document.getElementById('usersTable').style.display = 'block';
      
    } catch (err) {
      console.error('Failed to load users:', err);
      document.getElementById('usersLoading').innerHTML = 'Failed to load users';
    }
  }
  
  async function loadUserStats() {
    try {
      const allUsers = await api.get('/users?limit=1');
      const total = allUsers.total || 0;
      document.getElementById('totalUsers').textContent = total;
      
      // Get counts from current users if available
      let adminCount = 0;
      let deactivatedCount = 0;
      
      if (currentUsers.length > 0) {
        adminCount = currentUsers.filter(u => u.admin).length;
        deactivatedCount = currentUsers.filter(u => u.is_deactivated).length;
      }
      
      document.getElementById('adminCount').textContent = adminCount;
      document.getElementById('deactivatedCount').textContent = deactivatedCount;
      document.getElementById('activeUsers').textContent = total - deactivatedCount;
      
    } catch (err) {
      console.error('Failed to load user stats:', err);
    }
  }
  
  function truncateString(str, length) {
    if (!str) return '-';
    return str.length > length ? str.substring(0, length) + '...' : str;
  }
  
  function filterUserItems(items) {
    const roleFilter = document.getElementById('userRoleFilter')?.value || 'all';
    const statusFilter = document.getElementById('userStatusFilter')?.value || 'all';
    const search = document.getElementById('userSearch')?.value?.toLowerCase() || '';
    
    return items.filter(item => {
      // Role filter
      if (roleFilter !== 'all') {
        const isAdmin = roleFilter === 'admin';
        if (item.admin !== isAdmin) return false;
      }
      
      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'active' && item.is_deactivated) return false;
        if (statusFilter === 'deactivated' && !item.is_deactivated) return false;
      }
      
      // Search filter
      if (search) {
        return item.user_id?.toLowerCase().includes(search) ||
               item.localpart?.toLowerCase().includes(search) ||
               item.display_name?.toLowerCase().includes(search);
      }
      
      return true;
    });
  }
  
  function filterUsers() {
    loadUsers(0, document.getElementById('userSearch')?.value || '');
  }
  
  function debounceSearchUsers() {
    clearTimeout(usersSearchTimeout);
    usersSearchTimeout = setTimeout(() => {
      const search = document.getElementById('userSearch')?.value || '';
      loadUsers(0, search);
    }, 300);
  }
  
  function sortUsersArray(users, field, direction) {
    return [...users].sort((a, b) => {
      let aVal, bVal;
      
      switch(field) {
        case 'user_id':
          aVal = a.user_id || '';
          bVal = b.user_id || '';
          break;
        case 'display_name':
          aVal = (a.display_name || '').toLowerCase();
          bVal = (b.display_name || '').toLowerCase();
          break;
        case 'localpart':
          aVal = (a.localpart || '').toLowerCase();
          bVal = (b.localpart || '').toLowerCase();
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
  
  function sortUsers(field) {
    if (usersSortField === field) {
      usersSortDirection = usersSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      usersSortField = field;
      usersSortDirection = 'asc';
    }
    
    // Update sort indicators
    document.querySelectorAll('.sort-indicator').forEach(el => el.textContent = '');
    const indicator = document.getElementById(\`sort\${field.charAt(0).toUpperCase() + field.slice(1)}\`);
    if (indicator) {
      indicator.textContent = usersSortDirection === 'asc' ? '↑' : '↓';
    }
    
    loadUsers(0, document.getElementById('userSearch')?.value || '');
  }
  
  function renderUsersPagination(currentPage, totalPages) {
    const paginationEl = document.getElementById('usersPagination');
    paginationEl.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    // Previous button
    if (currentPage > 0) {
      const prevBtn = document.createElement('button');
      prevBtn.innerHTML = '←';
      prevBtn.onclick = () => loadUsers(currentPage - 1, document.getElementById('userSearch')?.value || '');
      paginationEl.appendChild(prevBtn);
    }
    
    // Page numbers
    for (let i = Math.max(0, currentPage - 2); i <= Math.min(totalPages - 1, currentPage + 2); i++) {
      const btn = document.createElement('button');
      btn.textContent = (i + 1).toString();
      btn.className = i === currentPage ? 'active' : '';
      btn.onclick = () => loadUsers(i, document.getElementById('userSearch')?.value || '');
      paginationEl.appendChild(btn);
    }
    
    // Next button
    if (currentPage < totalPages - 1) {
      const nextBtn = document.createElement('button');
      nextBtn.innerHTML = '→';
      nextBtn.onclick = () => loadUsers(currentPage + 1, document.getElementById('userSearch')?.value || '');
      paginationEl.appendChild(nextBtn);
    }
  }
  
  function updateUserCharts() {
    // Registrations chart
    const period = document.getElementById('userStatsPeriod')?.value || '30d';
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const now = Date.now();
    
    const dayLabels = [];
    const dayCounts = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000);
      dayLabels.push(date.toISOString().split('T')[0]);
      dayCounts.push(0);
    }
    
    currentUsers.forEach(user => {
      const userDate = new Date(user.created_at).toISOString().split('T')[0];
      const index = dayLabels.indexOf(userDate);
      if (index !== -1) {
        dayCounts[index]++;
      }
    });
    
    const regCtx = document.getElementById('userRegistrationsChart')?.getContext('2d');
    if (regCtx) {
      if (registrationsChart) registrationsChart.destroy();
      
      registrationsChart = new Chart(regCtx, {
        type: 'line',
        data: {
          labels: dayLabels,
          datasets: [{
            label: 'Registrations',
            data: dayCounts,
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            tension: 0.4,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
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
    
    // Activity chart (mock data for now)
    const activityCtx = document.getElementById('userActivityChart')?.getContext('2d');
    if (activityCtx) {
      if (activityChart) activityChart.destroy();
      
      activityChart = new Chart(activityCtx, {
        type: 'bar',
        data: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [{
            label: 'Active Users',
            data: [65, 59, 80, 81, 56, 55, 40],
            backgroundColor: '#3b82f6'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
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
  
  async function loadMostActiveUsers() {
    document.getElementById('activeUsersLoading').style.display = 'block';
    document.getElementById('activeUsersTable').style.display = 'none';
    
    try {
      // This would come from analytics
      // For now, use mock data
      const activeUsers = [
        { user_id: '@admin:matrix.deepmeow.cc', messages: 1243, rooms: 12, last_active: Date.now() - 3600000 },
        { user_id: '@user1:matrix.deepmeow.cc', messages: 876, rooms: 8, last_active: Date.now() - 7200000 },
        { user_id: '@user2:matrix.deepmeow.cc', messages: 543, rooms: 5, last_active: Date.now() - 14400000 },
        { user_id: '@user3:matrix.deepmeow.cc', messages: 321, rooms: 4, last_active: Date.now() - 86400000 },
        { user_id: '@user4:matrix.deepmeow.cc', messages: 123, rooms: 3, last_active: Date.now() - 172800000 }
      ];
      
      const tbody = document.getElementById('activeUsersList');
      tbody.innerHTML = '';
      
      activeUsers.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td>\${user.user_id}</td>
          <td>\${user.messages}</td>
          <td>\${user.rooms}</td>
          <td>\${new Date(user.last_active).toLocaleString()}</td>
          <td>
            <button class="btn-icon-sm" onclick="viewUserDetails('\${user.user_id}')">👁️</button>
          </td>
        \`;
        tbody.appendChild(tr);
      });
      
      document.getElementById('activeUsersLoading').style.display = 'none';
      document.getElementById('activeUsersTable').style.display = 'block';
      
    } catch (err) {
      console.error('Failed to load active users:', err);
      document.getElementById('activeUsersLoading').innerHTML = 'Failed to load data';
    }
  }
  
  async function viewUserDetails(userId) {
    try {
      const user = await api.get('/users/' + encodeURIComponent(userId));
      currentUserId = userId;
      
      // Populate profile tab
      document.getElementById('userDetailId').textContent = user.user_id;
      document.getElementById('userDetailLocalpart').textContent = user.localpart || '-';
      document.getElementById('userDetailDisplayName').textContent = user.display_name || '-';
      document.getElementById('userDetailAvatar').textContent = user.avatar_url || '-';
      
      const roleClass = user.admin ? 'role-admin' : 'role-user';
      const roleText = user.admin ? 'Admin' : 'User';
      document.getElementById('userDetailRole').innerHTML = \`<span class="role-badge \${roleClass}">\${roleText}</span>\`;
      
      const statusClass = user.is_deactivated ? 'status-deactivated' : (user.is_guest ? 'status-guest' : 'status-active');
      const statusText = user.is_deactivated ? 'Deactivated' : (user.is_guest ? 'Guest' : 'Active');
      document.getElementById('userDetailStatus').innerHTML = \`<span class="status-badge \${statusClass}">\${statusText}</span>\`;
      
      document.getElementById('userDetailGuest').textContent = user.is_guest ? 'Yes' : 'No';
      document.getElementById('userDetailCreated').textContent = new Date(user.created_at).toLocaleString();
      document.getElementById('userDetailUpdated').textContent = user.updated_at ? new Date(user.updated_at).toLocaleString() : '-';
      document.getElementById('userDetailLastSeen').textContent = user.last_seen_ts ? new Date(user.last_seen_ts).toLocaleString() : '-';
      
      // Update action buttons
      const deactivateBtn = document.getElementById('deactivateUserBtn');
      deactivateBtn.textContent = user.is_deactivated ? 'Reactivate User' : 'Deactivate User';
      deactivateBtn.className = user.is_deactivated ? 'btn btn-success' : 'btn btn-danger';
      
      const makeAdminBtn = document.getElementById('makeAdminBtn');
      makeAdminBtn.textContent = user.admin ? 'Remove Admin' : 'Make Admin';
      makeAdminBtn.className = user.admin ? 'btn btn-warning' : 'btn btn-primary';
      
      // Load devices, sessions, rooms
      await loadUserDevices(userId);
      await loadUserSessions(userId);
      await loadUserRooms(userId);
      await loadUserE2EE(userId);
      
      showModal('userDetailsModal');
      
    } catch (err) {
      console.error('Failed to load user details:', err);
      showNotification('Failed to load user details', 'error');
    }
  }
  
  async function loadUserDevices(userId) {
    document.getElementById('devicesLoading').style.display = 'block';
    document.getElementById('devicesTable').style.display = 'none';
    
    try {
      const user = await api.get('/users/' + encodeURIComponent(userId));
      const devices = user.devices || [];
      currentUserDevices = devices;
      
      const tbody = document.getElementById('devicesList');
      tbody.innerHTML = '';
      
      devices.forEach((device) => {
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td>\${device.device_id}</td>
          <td>\${device.display_name || '-'}</td>
          <td>\${device.last_seen_ts ? new Date(device.last_seen_ts).toLocaleString() : '-'}</td>
          <td>\${device.last_seen_ip || '-'}</td>
          <td>
            <button class="btn-icon-sm danger" onclick="deleteDevice('\${device.device_id}')">🗑️</button>
          </td>
        \`;
        tbody.appendChild(tr);
      });
      
      document.getElementById('devicesLoading').style.display = 'none';
      document.getElementById('devicesTable').style.display = 'block';
      
    } catch (err) {
      console.error('Failed to load user devices:', err);
      document.getElementById('devicesLoading').innerHTML = 'Failed to load devices';
    }
  }
  
  async function loadUserSessions(userId) {
    document.getElementById('sessionsLoading').style.display = 'block';
    document.getElementById('sessionsTable').style.display = 'none';
    
    try {
      const data = await api.get('/users/' + encodeURIComponent(userId) + '/sessions');
      const sessions = data.sessions || [];
      currentUserSessions = sessions;
      
      const tbody = document.getElementById('sessionsList');
      tbody.innerHTML = '';
      
      sessions.forEach((session) => {
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td>\${truncateString(session.id, 16)}</td>
          <td>\${session.device_id || '-'}</td>
          <td>\${new Date(session.created_at).toLocaleString()}</td>
          <td>-</td>
          <td>-</td>
          <td>
            <button class="btn-icon-sm danger" onclick="revokeSession('\${session.id}')">🗑️</button>
          </td>
        \`;
        tbody.appendChild(tr);
      });
      
      document.getElementById('sessionsLoading').style.display = 'none';
      document.getElementById('sessionsTable').style.display = 'block';
      
    } catch (err) {
      console.error('Failed to load user sessions:', err);
      document.getElementById('sessionsLoading').innerHTML = 'Failed to load sessions';
    }
  }
  
  async function loadUserRooms(userId) {
    document.getElementById('roomsLoading').style.display = 'block';
    document.getElementById('roomsTable').style.display = 'none';
    
    try {
      const user = await api.get('/users/' + encodeURIComponent(userId));
      const rooms = user.rooms || [];
      currentUserRooms = rooms;
      
      filterUserRooms();
      
      document.getElementById('roomsLoading').style.display = 'none';
      document.getElementById('roomsTable').style.display = 'block';
      
    } catch (err) {
      console.error('Failed to load user rooms:', err);
      document.getElementById('roomsLoading').innerHTML = 'Failed to load rooms';
    }
  }
  
  function filterUserRooms() {
    const filter = document.getElementById('roomMembershipFilter')?.value || 'all';
    
    const filtered = currentUserRooms.filter((room) => {
      if (filter === 'all') return true;
      return room.membership === filter;
    });
    
    const tbody = document.getElementById('roomsList');
    tbody.innerHTML = '';
    
    filtered.forEach((room) => {
      const tr = document.createElement('tr');
      tr.innerHTML = \`
        <td>\${truncateString(room.room_id, 30)}</td>
        <td>\${room.name || '-'}</td>
        <td><span class="membership-badge membership-\${room.membership}">\${room.membership}</span></td>
        <td>\${room.joined_at ? new Date(room.joined_at).toLocaleString() : '-'}</td>
        <td>\${room.power_level || 0}</td>
        <td>
          <button class="btn-icon-sm" onclick="viewRoomDetails('\${room.room_id}')">👁️</button>
        </td>
      \`;
      tbody.appendChild(tr);
    });
  }
  
  async function loadUserE2EE(userId) {
    try {
      // This would come from a debug endpoint
      // For now, show placeholder
      document.getElementById('crossSigningKeys').innerHTML = '<div class="key-item">No cross-signing keys</div>';
      document.getElementById('deviceKeysList').innerHTML = '<div class="key-item">No device keys</div>';
      document.getElementById('signaturesList').innerHTML = '<div class="key-item">No signatures</div>';
      document.getElementById('verificationStatus').innerHTML = '<div class="key-item">No verification data</div>';
      
    } catch (err) {
      console.error('Failed to load E2EE data:', err);
    }
  }
  
  function switchUserTab(tab) {
    currentUserTab = tab;
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
    
    const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(
      btn => btn.textContent?.toLowerCase().includes(tab)
    );
    if (activeBtn) activeBtn.classList.add('active');
    
    const activeContent = document.getElementById(\`user\${tab.charAt(0).toUpperCase() + tab.slice(1)}Tab\`);
    if (activeContent) activeContent.style.display = 'block';
  }
  
  function showCreateUserModal() {
    document.getElementById('newUsername').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('newDisplayName').value = '';
    document.getElementById('newIsAdmin').checked = false;
    document.getElementById('createUserError').style.display = 'none';
    showModal('createUserModal');
  }
  
  async function createUser() {
    const username = document.getElementById('newUsername').value;
    const password = document.getElementById('newPassword').value;
    const displayName = document.getElementById('newDisplayName').value;
    const isAdmin = document.getElementById('newIsAdmin').checked;
    
    if (!username || !password) {
      showError('createUserError', 'Username and password required');
      return;
    }
    
    try {
      await api.post('/users', { 
        username, 
        password, 
        display_name: displayName || undefined,
        admin: isAdmin 
      });
      hideModal('createUserModal');
      showNotification('User created successfully', 'success');
      refreshUsers();
    } catch (err) {
      showError('createUserError', err.message || 'Failed to create user');
    }
  }
  
  function showResetPasswordModal(userId) {
    currentUserId = userId;
    document.getElementById('newUserPassword').value = '';
    document.getElementById('confirmUserPassword').value = '';
    showModal('resetPasswordModal');
  }
  
  async function confirmResetPassword() {
    const password = document.getElementById('newUserPassword').value;
    const confirm = document.getElementById('confirmUserPassword').value;
    
    if (!password) {
      showNotification('Password is required', 'error');
      return;
    }
    
    if (password !== confirm) {
      showNotification('Passwords do not match', 'error');
      return;
    }
    
    try {
      await api.post('/users/' + encodeURIComponent(currentUserId) + '/reset-password', { password });
      hideModal('resetPasswordModal');
      showNotification('Password reset successfully', 'success');
    } catch (err) {
      showNotification('Failed to reset password', 'error');
    }
  }
  
  async function resetUserPassword() {
    if (currentUserId) {
      showResetPasswordModal(currentUserId);
    }
  }
  
  async function toggleUserDeactivation() {
    if (!currentUserId) return;
    
    const user = currentUsers.find(u => u.user_id === currentUserId);
    const isDeactivated = user?.is_deactivated;
    
    const action = isDeactivated ? 'reactivate' : 'deactivate';
    confirmAction(
      isDeactivated ? 'Reactivate User' : 'Deactivate User',
      isDeactivated ? 'Reactivate this user account?' : 'Deactivate this user account? They will not be able to log in.',
      async () => {
        try {
          if (isDeactivated) {
            await api.post('/users/' + encodeURIComponent(currentUserId) + '/reactivate', {});
          } else {
            await api.delete('/users/' + encodeURIComponent(currentUserId));
          }
          showNotification(\`User \${action}d successfully\`, 'success');
          hideModal('userDetailsModal');
          refreshUsers();
        } catch (err) {
          showNotification(\`Failed to \${action} user\`, 'error');
        }
      }
    );
  }
  
  async function deactivateUser(userId) {
    currentUserId = userId;
    toggleUserDeactivation();
  }
  
  async function reactivateUser(userId) {
    currentUserId = userId;
    toggleUserDeactivation();
  }
  
  async function makeUserAdmin(userId) {
    const targetUserId = userId || currentUserId;
    if (!targetUserId) return;
    
    const user = currentUsers.find(u => u.user_id === targetUserId);
    const isAdmin = user?.admin;
    
    const action = isAdmin ? 'remove admin from' : 'make admin';
    confirmAction(
      isAdmin ? 'Remove Admin' : 'Make Admin',
      isAdmin ? \`Remove admin privileges from \${targetUserId}?\` : \`Make \${targetUserId} an admin?\`,
      async () => {
        try {
          if (isAdmin) {
            await api.post('/remove-admin', { user_id: targetUserId });
          } else {
            await api.post('/make-admin', { user_id: targetUserId });
          }
          showNotification(\`User \${action} successfully\`, 'success');
          if (currentUserId === targetUserId) {
            hideModal('userDetailsModal');
          }
          refreshUsers();
        } catch (err) {
          showNotification(\`Failed to \${action} user\`, 'error');
        }
      }
    );
  }
  
  function removeUserAdmin(userId) {
    makeUserAdmin(userId);
  }
  
  function showAddDeviceModal() {
    document.getElementById('newDeviceId').value = '';
    document.getElementById('newDeviceName').value = '';
    showModal('addDeviceModal');
  }
  
  async function addDevice() {
    const deviceId = document.getElementById('newDeviceId').value;
    const deviceName = document.getElementById('newDeviceName').value;
    
    if (!deviceId) {
      showNotification('Device ID is required', 'error');
      return;
    }
    
    // This would call the device creation API
    showNotification('Add device functionality not implemented', 'info');
    hideModal('addDeviceModal');
  }
  
  async function deleteDevice(deviceId) {
    if (!currentUserId) return;
    
    confirmAction(
      'Delete Device',
      \`Delete device \${deviceId}? The user will need to re-authenticate.\`,
      async () => {
        // This would call the device deletion API
        showNotification('Delete device not implemented', 'info');
      }
    );
  }
  
  async function revokeSession(sessionId) {
    confirmAction(
      'Revoke Session',
      'Force logout this session?',
      async () => {
        try {
          await api.delete('/security/sessions/' + sessionId);
          showNotification('Session revoked successfully', 'success');
          if (currentUserId) {
            await loadUserSessions(currentUserId);
          }
        } catch (err) {
          showNotification('Failed to revoke session', 'error');
        }
      }
    );
  }
  
  async function revokeAllUserSessions() {
    if (!currentUserId) return;
    
    confirmAction(
      'Revoke All Sessions',
      'Force logout ALL sessions for this user? They will need to log in again.',
      async () => {
        try {
          await api.delete('/users/' + encodeURIComponent(currentUserId) + '/sessions');
          showNotification('All sessions revoked successfully', 'success');
          await loadUserSessions(currentUserId);
        } catch (err) {
          showNotification('Failed to revoke sessions', 'error');
        }
      }
    );
  }
  
  function viewRoomDetails(roomId) {
    // This would switch to rooms view and show the room
    showNotification('View room: ' + roomId, 'info');
  }
  
  function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = message;
      el.style.display = 'block';
      setTimeout(() => { el.style.display = 'none'; }, 5000);
    }
  }
  
  function refreshUsers() {
    loadUsers(0, document.getElementById('userSearch')?.value || '');
  }
`;

// Export all
export default {
  view: usersView,
  styles: usersStyles,
  functions: usersFunctions
};