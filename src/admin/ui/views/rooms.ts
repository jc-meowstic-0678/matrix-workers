// src/admin/ui/views/rooms.ts
// Room management view with listing, details, and moderation tools

export const roomsView = (): string => `
  <div id="roomsView" class="view" style="display: none;">
    <div class="header">
      <h2>Rooms</h2>
      <div class="header-actions">
        <button class="btn btn-primary" onclick="showCreateRoomModal()">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Create Room
        </button>
        <button class="btn btn-secondary" onclick="refreshRooms()">
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
      <div class="stat-card" id="totalRoomsCard">
        <div class="label">Total Rooms</div>
        <div class="value" id="totalRoomsCount">-</div>
      </div>
      <div class="stat-card" id="publicRoomsCard">
        <div class="label">Public Rooms</div>
        <div class="value" id="publicRoomsCount">-</div>
      </div>
      <div class="stat-card" id="encryptedRoomsCard">
        <div class="label">Encrypted Rooms</div>
        <div class="value" id="encryptedRoomsCount">-</div>
      </div>
      <div class="stat-card" id="totalMembersCard">
        <div class="label">Total Members</div>
        <div class="value" id="totalMembersCount">-</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Room Management</h3>
        <div class="header-actions">
          <div class="filter-group">
            <select id="roomVisibilityFilter" onchange="filterRooms()" class="filter-select">
              <option value="all">All Rooms</option>
              <option value="public">Public Only</option>
              <option value="private">Private Only</option>
            </select>
            <select id="roomEncryptionFilter" onchange="filterRooms()" class="filter-select">
              <option value="all">All Encryption</option>
              <option value="encrypted">Encrypted</option>
              <option value="unencrypted">Unencrypted</option>
            </select>
            <select id="roomVersionFilter" onchange="filterRooms()" class="filter-select">
              <option value="all">All Versions</option>
              <option value="10">Version 10</option>
              <option value="9">Version 9</option>
              <option value="8">Version 8</option>
              <option value="7">Version 7</option>
              <option value="6">Version 6</option>
              <option value="5">Version 5</option>
              <option value="4">Version 4</option>
              <option value="3">Version 3</option>
              <option value="2">Version 2</option>
              <option value="1">Version 1</option>
            </select>
            <input 
              type="text" 
              class="search-input" 
              id="roomSearch" 
              placeholder="Search by name or ID..." 
              onkeyup="debounceSearchRooms()"
            >
          </div>
        </div>
      </div>
      <div class="card-body">
        <div id="roomsLoading" class="loading">
          <div class="spinner"></div>
          Loading rooms...
        </div>
        <div id="roomsTable" style="display: none;">
          <table>
            <thead>
              <tr>
                <th onclick="sortRooms('name')" class="sortable">
                  Name
                  <span class="sort-indicator" id="sortName"></span>
                </th>
                <th onclick="sortRooms('room_id')" class="sortable">
                  Room ID
                  <span class="sort-indicator" id="sortRoomId"></span>
                </th>
                <th onclick="sortRooms('member_count')" class="sortable">
                  Members
                  <span class="sort-indicator" id="sortMemberCount"></span>
                </th>
                <th onclick="sortRooms('version')" class="sortable">
                  Version
                  <span class="sort-indicator" id="sortVersion"></span>
                </th>
                <th>Visibility</th>
                <th>Encryption</th>
                <th onclick="sortRooms('created_at')" class="sortable">
                  Created
                  <span class="sort-indicator" id="sortCreatedAt"></span>
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="roomsList"></tbody>
          </table>
          <div class="pagination" id="roomsPagination"></div>
        </div>
        <div id="noRooms" class="loading" style="display: none;">No rooms found</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Room Statistics</h3>
        <div class="header-actions">
          <select id="roomStatsPeriod" onchange="updateRoomCharts()" class="filter-select">
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>
      </div>
      <div class="card-body">
        <div class="charts-grid">
          <div class="chart-container">
            <canvas id="roomsByVersionChart"></canvas>
          </div>
          <div class="chart-container">
            <canvas id="roomsCreationChart"></canvas>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Largest Rooms</h3>
      </div>
      <div class="card-body">
        <div id="largestRoomsLoading" class="loading">
          <div class="spinner"></div>
          Loading data...
        </div>
        <div id="largestRoomsTable" style="display: none;">
          <table>
            <thead>
              <tr>
                <th>Room</th>
                <th>Members</th>
                <th>Messages</th>
                <th>State Events</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="largestRoomsList"></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Room Details Modal -->
    <div id="roomDetailsModal" class="modal">
      <div class="modal-content modal-lg">
        <div class="modal-header">
          <h2>Room Details</h2>
          <button class="modal-close" onclick="hideModal('roomDetailsModal')">✕</button>
        </div>
        <div class="modal-body">
          <div class="details-tabs">
            <button class="tab-btn active" onclick="switchRoomTab('overview')">Overview</button>
            <button class="tab-btn" onclick="switchRoomTab('members')">Members</button>
            <button class="tab-btn" onclick="switchRoomTab('state')">State</button>
            <button class="tab-btn" onclick="switchRoomTab('aliases')">Aliases</button>
            <button class="tab-btn" onclick="switchRoomTab('events')">Events</button>
          </div>
          
          <div id="roomOverviewTab" class="tab-content active">
            <div class="details-grid">
              <div class="detail-section">
                <h4>Basic Information</h4>
                <div class="detail-row">
                  <span class="detail-label">Room ID:</span>
                  <span class="detail-value" id="roomDetailId"></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Name:</span>
                  <span class="detail-value" id="roomDetailName"></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Topic:</span>
                  <span class="detail-value" id="roomDetailTopic"></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Version:</span>
                  <span class="detail-value" id="roomDetailVersion"></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Creator:</span>
                  <span class="detail-value" id="roomDetailCreator"></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Created:</span>
                  <span class="detail-value" id="roomDetailCreated"></span>
                </div>
              </div>
              
              <div class="detail-section">
                <h4>Settings</h4>
                <div class="detail-row">
                  <span class="detail-label">Visibility:</span>
                  <span class="detail-value" id="roomDetailVisibility"></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Join Rule:</span>
                  <span class="detail-value" id="roomDetailJoinRule"></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">History Visibility:</span>
                  <span class="detail-value" id="roomDetailHistory"></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Guest Access:</span>
                  <span class="detail-value" id="roomDetailGuest"></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Encryption:</span>
                  <span class="detail-value" id="roomDetailEncryption"></span>
                </div>
              </div>
              
              <div class="detail-section">
                <h4>Statistics</h4>
                <div class="detail-row">
                  <span class="detail-label">Members:</span>
                  <span class="detail-value" id="roomDetailMembers"></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">State Events:</span>
                  <span class="detail-value" id="roomDetailStateEvents"></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Total Events:</span>
                  <span class="detail-value" id="roomDetailTotalEvents"></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Last Activity:</span>
                  <span class="detail-value" id="roomDetailLastActivity"></span>
                </div>
              </div>
            </div>
          </div>
          
          <div id="roomMembersTab" class="tab-content" style="display: none;">
            <div class="member-filters">
              <input type="text" id="memberSearch" placeholder="Search members..." class="search-input" onkeyup="filterMembers()">
              <select id="memberRoleFilter" onchange="filterMembers()" class="filter-select">
                <option value="all">All Roles</option>
                <option value="admin">Admins</option>
                <option value="moderator">Moderators</option>
                <option value="user">Users</option>
              </select>
            </div>
            <div id="membersLoading" class="loading">Loading members...</div>
            <div id="membersTable" style="display: none;">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Membership</th>
                    <th>Power Level</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="membersList"></tbody>
              </table>
            </div>
          </div>
          
          <div id="roomStateTab" class="tab-content" style="display: none;">
            <div class="state-filters">
              <input type="text" id="stateSearch" placeholder="Search state events..." class="search-input" onkeyup="filterState()">
              <select id="stateTypeFilter" onchange="filterState()" class="filter-select">
                <option value="all">All Types</option>
                <option value="m.room.name">Name</option>
                <option value="m.room.topic">Topic</option>
                <option value="m.room.avatar">Avatar</option>
                <option value="m.room.power_levels">Power Levels</option>
                <option value="m.room.join_rules">Join Rules</option>
                <option value="m.room.history_visibility">History</option>
                <option value="m.room.encryption">Encryption</option>
                <option value="m.room.member">Members</option>
              </select>
            </div>
            <div id="stateLoading" class="loading">Loading state...</div>
            <div id="stateTable" style="display: none;">
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>State Key</th>
                    <th>Sender</th>
                    <th>Content</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody id="stateList"></tbody>
              </table>
            </div>
          </div>
          
          <div id="roomAliasesTab" class="tab-content" style="display: none;">
            <div class="alias-actions">
              <button class="btn btn-primary btn-sm" onclick="addRoomAlias()">Add Alias</button>
            </div>
            <div id="aliasesLoading" class="loading">Loading aliases...</div>
            <div id="aliasesTable" style="display: none;">
              <table>
                <thead>
                  <tr>
                    <th>Alias</th>
                    <th>Created</th>
                    <th>Creator</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="aliasesList"></tbody>
              </table>
            </div>
          </div>
          
          <div id="roomEventsTab" class="tab-content" style="display: none;">
            <div class="event-filters">
              <input type="text" id="eventSearch" placeholder="Search events..." class="search-input" onkeyup="filterEvents()">
              <select id="eventTypeFilter" onchange="filterEvents()" class="filter-select">
                <option value="all">All Types</option>
                <option value="m.room.message">Messages</option>
                <option value="m.room.encrypted">Encrypted</option>
                <option value="m.room.member">Membership</option>
                <option value="m.reaction">Reactions</option>
                <option value="m.room.redaction">Redactions</option>
              </select>
              <select id="eventLimit" onchange="loadRoomEvents()" class="filter-select">
                <option value="50">50 events</option>
                <option value="100">100 events</option>
                <option value="200">200 events</option>
              </select>
            </div>
            <div id="eventsLoading" class="loading">Loading events...</div>
            <div id="eventsTable" style="display: none;">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Type</th>
                    <th>Sender</th>
                    <th>Content</th>
                    <th>Timestamp</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="eventsList"></tbody>
              </table>
              <div class="pagination" id="eventsPagination"></div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="hideModal('roomDetailsModal')">Close</button>
          <button class="btn btn-warning" onclick="upgradeRoom()">Upgrade Room</button>
          <button class="btn btn-danger" onclick="deleteRoom()">Delete Room</button>
        </div>
      </div>
    </div>
  </div>
`;

// Rooms-specific styles
export const roomsStyles = `
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
  
  .visibility-badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }
  
  .visibility-public {
    background: rgba(34, 197, 94, 0.2);
    color: var(--accent-green);
  }
  
  .visibility-private {
    background: rgba(239, 68, 68, 0.2);
    color: var(--accent-red);
  }
  
  .encryption-badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }
  
  .encryption-enabled {
    background: rgba(59, 130, 246, 0.2);
    color: var(--accent-blue);
  }
  
  .encryption-disabled {
    background: rgba(100, 116, 139, 0.2);
    color: var(--text-secondary);
  }
  
  .version-badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    background: var(--bg-elevated);
    color: var(--text-secondary);
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
  
  .member-filters,
  .state-filters,
  .event-filters,
  .alias-actions {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  
  .alias-actions {
    justify-content: flex-end;
  }
  
  .power-level {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }
  
  .power-admin {
    background: rgba(139, 92, 246, 0.2);
    color: #a78bfa;
  }
  
  .power-moderator {
    background: rgba(59, 130, 246, 0.2);
    color: var(--accent-blue);
  }
  
  .power-user {
    background: rgba(100, 116, 139, 0.2);
    color: var(--text-secondary);
  }
  
  .membership-badge {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }
  
  .membership-join {
    background: rgba(34, 197, 94, 0.2);
    color: var(--accent-green);
  }
  
  .membership-invite {
    background: rgba(245, 158, 11, 0.2);
    color: var(--accent-amber);
  }
  
  .membership-leave {
    background: rgba(100, 116, 139, 0.2);
    color: var(--text-secondary);
  }
  
  .membership-ban {
    background: rgba(239, 68, 68, 0.2);
    color: var(--accent-red);
  }
  
  .content-preview {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    color: var(--text-secondary);
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
  
  .chart-container {
    position: relative;
    height: 300px;
    width: 100%;
  }
`;

// Rooms JavaScript functions
export const roomsFunctions = (): string => `
  // ============================================
  // Room Management Functions
  // ============================================
  
  let currentRooms = [];
  let currentRoomId = null;
  let currentRoomMembers = [];
  let currentRoomState = [];
  let currentRoomAliases = [];
  let currentRoomEvents = [];
  let roomsSortField = 'created_at';
  let roomsSortDirection = 'desc';
  let roomsVisibilityFilter = 'all';
  let roomsEncryptionFilter = 'all';
  let roomsVersionFilter = 'all';
  let roomsSearchTimeout;
  let currentRoomTab = 'overview';
  let roomsChart;
  let creationChart;
  
  async function loadRooms(page = 0, search = '') {
    document.getElementById('roomsLoading').style.display = 'block';
    document.getElementById('roomsTable').style.display = 'none';
    document.getElementById('noRooms').style.display = 'none';
    
    try {
      let url = '/rooms?limit=50&offset=' + (page * 50);
      if (search) url += '&search=' + encodeURIComponent(search);
      
      const data = await api.get(url);
      
      // Update stats
      await loadRoomStats();
      
      currentRooms = data.items || [];
      
      // Apply filters
      let filteredRooms = filterRoomItems(currentRooms);
      
      // Apply sorting
      filteredRooms = sortRoomsArray(filteredRooms, roomsSortField, roomsSortDirection);
      
      // Paginate
      const limit = 50;
      const start = page * limit;
      const paginatedRooms = filteredRooms.slice(start, start + limit);
      const totalPages = Math.ceil(filteredRooms.length / limit);
      
      if (paginatedRooms.length === 0) {
        document.getElementById('roomsLoading').style.display = 'none';
        document.getElementById('noRooms').style.display = 'block';
        return;
      }
      
      const tbody = document.getElementById('roomsList');
      tbody.innerHTML = '';
      
      paginatedRooms.forEach((room) => {
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td>\${room.name || '<em>Unnamed</em>'}</td>
          <td>\${truncateString(room.room_id, 20)}</td>
          <td>\${room.member_count || 0}</td>
          <td><span class="version-badge">v\${room.room_version || '10'}</span></td>
          <td><span class="visibility-badge \${room.is_public ? 'visibility-public' : 'visibility-private'}">\${room.is_public ? 'Public' : 'Private'}</span></td>
          <td><span class="encryption-badge \${room.encrypted ? 'encryption-enabled' : 'encryption-disabled'}">\${room.encrypted ? '✅ Encrypted' : '❌ Unencrypted'}</span></td>
          <td>\${new Date(room.created_at).toLocaleDateString()}</td>
            <td class="action-group">
            <button class="btn-icon-sm" onclick="viewRoomDetails('\${room.room_id}')" title="View details">👁️</button>
            <button class="btn-icon-sm" onclick="showRoomMembers('\${room.room_id}')" title="View members">👥</button>
            <button class="btn-icon-sm warning" onclick="showUpgradeRoom('\${room.room_id}')" title="Upgrade room">⬆️</button>
            <button class="btn-icon-sm danger" onclick="showDeleteRoom('\${room.room_id}')" title="Delete room">🗑️</button>
           </td>
        \`;
        tbody.appendChild(tr);
      });
      
      // Update pagination
      renderRoomsPagination(page, totalPages);
      
      // Update charts
      updateRoomCharts();
      
      // Load largest rooms
      await loadLargestRooms();
      
      document.getElementById('roomsLoading').style.display = 'none';
      document.getElementById('roomsTable').style.display = 'block';
      
    } catch (err) {
      console.error('Failed to load rooms:', err);
      document.getElementById('roomsLoading').innerHTML = 'Failed to load rooms';
    }
  }
  
  async function loadRoomStats() {
    try {
      const allRooms = await api.get('/rooms?limit=1');
      const total = allRooms.total || 0;
      document.getElementById('totalRoomsCount').textContent = total;
      
      // Count public/private
      let publicCount = 0;
      let encryptedCount = 0;
      let totalMembers = 0;
      
      // We need to fetch more rooms to get accurate stats
      // For now, use currentRooms if available
      if (currentRooms.length > 0) {
        publicCount = currentRooms.filter(r => r.is_public).length;
        encryptedCount = currentRooms.filter(r => r.encrypted).length;
        totalMembers = currentRooms.reduce((sum, r) => sum + (r.member_count || 0), 0);
      }
      
      document.getElementById('publicRoomsCount').textContent = publicCount;
      document.getElementById('encryptedRoomsCount').textContent = encryptedCount;
      document.getElementById('totalMembersCount').textContent = totalMembers;
      
    } catch (err) {
      console.error('Failed to load room stats:', err);
    }
  }
  
  function truncateString(str, length) {
    if (!str) return '-';
    return str.length > length ? str.substring(0, length) + '...' : str;
  }
  
  function filterRoomItems(items) {
    return items.filter(item => {
      // Visibility filter
      if (roomsVisibilityFilter !== 'all') {
        const isPublic = roomsVisibilityFilter === 'public';
        if (item.is_public !== isPublic) return false;
      }
      
      // Encryption filter
      if (roomsEncryptionFilter !== 'all') {
        const isEncrypted = roomsEncryptionFilter === 'encrypted';
        if ((item.encrypted || false) !== isEncrypted) return false;
      }
      
      // Version filter
      if (roomsVersionFilter !== 'all' && item.room_version !== roomsVersionFilter) {
        return false;
      }
      
      // Search filter
      const search = document.getElementById('roomSearch')?.value?.toLowerCase();
      if (search) {
        return (item.name?.toLowerCase().includes(search) ||
                item.room_id?.toLowerCase().includes(search));
      }
      
      return true;
    });
  }
  
  function filterRooms() {
    roomsVisibilityFilter = document.getElementById('roomVisibilityFilter')?.value || 'all';
    roomsEncryptionFilter = document.getElementById('roomEncryptionFilter')?.value || 'all';
    roomsVersionFilter = document.getElementById('roomVersionFilter')?.value || 'all';
    loadRooms(0, document.getElementById('roomSearch')?.value || '');
  }
  
  function debounceSearchRooms() {
    clearTimeout(roomsSearchTimeout);
    roomsSearchTimeout = setTimeout(() => {
      const search = document.getElementById('roomSearch')?.value || '';
      loadRooms(0, search);
    }, 300);
  }
  
  function sortRoomsArray(rooms, field, direction) {
    return [...rooms].sort((a, b) => {
      let aVal, bVal;
      
      switch(field) {
        case 'name':
          aVal = (a.name || '').toLowerCase();
          bVal = (b.name || '').toLowerCase();
          break;
        case 'room_id':
          aVal = a.room_id || '';
          bVal = b.room_id || '';
          break;
        case 'member_count':
          aVal = a.member_count || 0;
          bVal = b.member_count || 0;
          break;
        case 'version':
          aVal = parseInt(a.room_version) || 0;
          bVal = parseInt(b.room_version) || 0;
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
  
  function sortRooms(field) {
    if (roomsSortField === field) {
      roomsSortDirection = roomsSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      roomsSortField = field;
      roomsSortDirection = 'asc';
    }
    
    // Update sort indicators
    document.querySelectorAll('.sort-indicator').forEach(el => el.textContent = '');
    const indicator = document.getElementById(\`sort\${field.charAt(0).toUpperCase() + field.slice(1)}\`);
    if (indicator) {
      indicator.textContent = roomsSortDirection === 'asc' ? '↑' : '↓';
    }
    
    loadRooms(0, document.getElementById('roomSearch')?.value || '');
  }
  
  function renderRoomsPagination(currentPage, totalPages) {
    const paginationEl = document.getElementById('roomsPagination');
    paginationEl.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    // Previous button
    if (currentPage > 0) {
      const prevBtn = document.createElement('button');
      prevBtn.innerHTML = '←';
      prevBtn.onclick = () => loadRooms(currentPage - 1, document.getElementById('roomSearch')?.value || '');
      paginationEl.appendChild(prevBtn);
    }
    
    // Page numbers
    for (let i = Math.max(0, currentPage - 2); i <= Math.min(totalPages - 1, currentPage + 2); i++) {
      const btn = document.createElement('button');
      btn.textContent = (i + 1).toString();
      btn.className = i === currentPage ? 'active' : '';
      btn.onclick = () => loadRooms(i, document.getElementById('roomSearch')?.value || '');
      paginationEl.appendChild(btn);
    }
    
    // Next button
    if (currentPage < totalPages - 1) {
      const nextBtn = document.createElement('button');
      nextBtn.innerHTML = '→';
      nextBtn.onclick = () => loadRooms(currentPage + 1, document.getElementById('roomSearch')?.value || '');
      paginationEl.appendChild(nextBtn);
    }
  }
  
  function updateRoomCharts() {
    // Rooms by version chart
    const versionCounts = {};
    currentRooms.forEach(room => {
      const version = room.room_version || '10';
      versionCounts[version] = (versionCounts[version] || 0) + 1;
    });
    
    const versionCtx = document.getElementById('roomsByVersionChart')?.getContext('2d');
    if (versionCtx) {
      if (roomsChart) roomsChart.destroy();
      
      roomsChart = new Chart(versionCtx, {
        type: 'bar',
        data: {
          labels: Object.keys(versionCounts).sort(),
          datasets: [{
            label: 'Rooms by Version',
            data: Object.values(versionCounts),
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
    
    // Rooms creation timeline
    const period = document.getElementById('roomStatsPeriod')?.value || '30d';
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const now = Date.now();
    
    const dayLabels = [];
    const dayCounts = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000);
      dayLabels.push(date.toISOString().split('T')[0]);
      dayCounts.push(0);
    }
    
    currentRooms.forEach(room => {
      const roomDate = new Date(room.created_at).toISOString().split('T')[0];
      const index = dayLabels.indexOf(roomDate);
      if (index !== -1) {
        dayCounts[index]++;
      }
    });
    
    const creationCtx = document.getElementById('roomsCreationChart')?.getContext('2d');
    if (creationCtx) {
      if (creationChart) creationChart.destroy();
      
      creationChart = new Chart(creationCtx, {
        type: 'line',
        data: {
          labels: dayLabels,
          datasets: [{
            label: 'Rooms Created',
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
  }
  
  async function loadLargestRooms() {
    document.getElementById('largestRoomsLoading').style.display = 'block';
    document.getElementById('largestRoomsTable').style.display = 'none';
    
    try {
      const sorted = [...currentRooms]
        .sort((a, b) => (b.member_count || 0) - (a.member_count || 0))
        .slice(0, 10);
      
      const tbody = document.getElementById('largestRoomsList');
      tbody.innerHTML = '';
      
      sorted.forEach(room => {
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td>\${room.name || truncateString(room.room_id, 20)}</td>
          <td>\${room.member_count || 0}</td>
          <td>\${room.event_count || 0}</td>
          <td>\${room.state_events || 0}</td>
          <td>
            <button class="btn-icon-sm" onclick="viewRoomDetails('\${room.room_id}')">👁️</button>
          </td>
        \`;
        tbody.appendChild(tr);
      });
      
      document.getElementById('largestRoomsLoading').style.display = 'none';
      document.getElementById('largestRoomsTable').style.display = 'block';
      
    } catch (err) {
      console.error('Failed to load largest rooms:', err);
      document.getElementById('largestRoomsLoading').innerHTML = 'Failed to load data';
    }
  }
  
  async function viewRoomDetails(roomId) {
    try {
      const room = await api.get('/rooms/' + encodeURIComponent(roomId));
      currentRoomId = roomId;
      
      // Populate basic info
      document.getElementById('roomDetailId').textContent = room.room_id;
      document.getElementById('roomDetailName').textContent = room.name || '<em>Unnamed</em>';
      document.getElementById('roomDetailTopic').textContent = room.topic || '<em>No topic</em>';
      document.getElementById('roomDetailVersion').textContent = 'v' + (room.room_version || '10');
      document.getElementById('roomDetailCreator').textContent = room.creator_id || 'Unknown';
      document.getElementById('roomDetailCreated').textContent = new Date(room.created_at).toLocaleString();
      
      // Settings
      document.getElementById('roomDetailVisibility').innerHTML = \`<span class="visibility-badge \${room.is_public ? 'visibility-public' : 'visibility-private'}">\${room.is_public ? 'Public' : 'Private'}</span>\`;
      document.getElementById('roomDetailJoinRule').textContent = room.join_rule || 'invite';
      document.getElementById('roomDetailHistory').textContent = room.history_visibility || 'shared';
      document.getElementById('roomDetailGuest').textContent = room.guest_can_join ? 'Allowed' : 'Forbidden';
      document.getElementById('roomDetailEncryption').innerHTML = \`<span class="encryption-badge \${room.encrypted ? 'encryption-enabled' : 'encryption-disabled'}">\${room.encrypted ? 'Enabled' : 'Disabled'}</span>\`;
      
      // Stats
      document.getElementById('roomDetailMembers').textContent = room.member_count || 0;
      document.getElementById('roomDetailStateEvents').textContent = room.state_events || 0;
      document.getElementById('roomDetailTotalEvents').textContent = room.event_count || 0;
      document.getElementById('roomDetailLastActivity').textContent = room.last_activity ? new Date(room.last_activity).toLocaleString() : 'Never';
      
      // Load members, state, aliases
      await loadRoomMembers(roomId);
      await loadRoomState(roomId);
      await loadRoomAliases(roomId);
      
      showModal('roomDetailsModal');
      
    } catch (err) {
      console.error('Failed to load room details:', err);
      showNotification('Failed to load room details', 'error');
    }
  }
  
  async function loadRoomMembers(roomId) {
    document.getElementById('membersLoading').style.display = 'block';
    document.getElementById('membersTable').style.display = 'none';
    
    try {
      const data = await api.get('/rooms/' + encodeURIComponent(roomId) + '/members');
      currentRoomMembers = data.chunk || [];
      
      filterMembers();
      
      document.getElementById('membersLoading').style.display = 'none';
      document.getElementById('membersTable').style.display = 'block';
      
    } catch (err) {
      console.error('Failed to load room members:', err);
      document.getElementById('membersLoading').innerHTML = 'Failed to load members';
    }
  }
  
  function filterMembers() {
    const search = document.getElementById('memberSearch')?.value?.toLowerCase() || '';
    const roleFilter = document.getElementById('memberRoleFilter')?.value || 'all';
    
    const filtered = currentRoomMembers.filter((member) => {
      // Search filter
      if (search && !member.user_id?.toLowerCase().includes(search)) {
        return false;
      }
      
      // Role filter (simplified - you'd need actual power levels)
      if (roleFilter === 'admin') {
        return member.power_level >= 100;
      } else if (roleFilter === 'moderator') {
        return member.power_level >= 50 && member.power_level < 100;
      } else if (roleFilter === 'user') {
        return member.power_level < 50;
      }
      
      return true;
    });
    
    const tbody = document.getElementById('membersList');
    tbody.innerHTML = '';
    
    filtered.forEach((member) => {
      const powerLevel = member.power_level || 0;
      const powerClass = powerLevel >= 100 ? 'power-admin' : powerLevel >= 50 ? 'power-moderator' : 'power-user';
      const membershipClass = \`membership-\${member.membership || 'join'}\`;
      
      const tr = document.createElement('tr');
      tr.innerHTML = \`
        <td>\${member.user_id}</td>
        <td><span class="membership-badge \${membershipClass}">\${member.membership || 'join'}</span></td>
        <td><span class="power-level \${powerClass}">\${powerLevel}</span></td>
        <td>\${member.joined_at ? new Date(member.joined_at).toLocaleDateString() : '-'}</td>
        <td>
          <button class="btn-icon-sm" onclick="kickUser('\${member.user_id}')" title="Kick">👢</button>
          <button class="btn-icon-sm warning" onclick="banUser('\${member.user_id}')" title="Ban">🚫</button>
        </td>
      \`;
      tbody.appendChild(tr);
    });
  }
  
  async function loadRoomState(roomId) {
    document.getElementById('stateLoading').style.display = 'block';
    document.getElementById('stateTable').style.display = 'none';
    
    try {
      const data = await api.get('/rooms/' + encodeURIComponent(roomId) + '/state');
      currentRoomState = data || [];
      
      filterState();
      
      document.getElementById('stateLoading').style.display = 'none';
      document.getElementById('stateTable').style.display = 'block';
      
    } catch (err) {
      console.error('Failed to load room state:', err);
      document.getElementById('stateLoading').innerHTML = 'Failed to load state';
    }
  }
  
  function filterState() {
    const search = document.getElementById('stateSearch')?.value?.toLowerCase() || '';
    const typeFilter = document.getElementById('stateTypeFilter')?.value || 'all';
    
    const filtered = currentRoomState.filter((state) => {
      // Type filter
      if (typeFilter !== 'all' && state.type !== typeFilter) {
        return false;
      }
      
      // Search filter
      if (search) {
        return state.type?.toLowerCase().includes(search) ||
               state.state_key?.toLowerCase().includes(search) ||
               JSON.stringify(state.content)?.toLowerCase().includes(search);
      }
      
      return true;
    });
    
    const tbody = document.getElementById('stateList');
    tbody.innerHTML = '';
    
    filtered.forEach((state) => {
      const content = typeof state.content === 'object' ? JSON.stringify(state.content).substring(0, 50) + '...' : state.content;
      
      const tr = document.createElement('tr');
      tr.innerHTML = \`
        <td>\${state.type}</td>
        <td>\${state.state_key || ''}</td>
        <td>\${state.sender || ''}</td>
        <td class="content-preview" title="\${JSON.stringify(state.content)}">\${content}</td>
        <td>\${state.origin_server_ts ? new Date(state.origin_server_ts).toLocaleString() : '-'}</td>
      \`;
      tbody.appendChild(tr);
    });
  }
  
  async function loadRoomAliases(roomId) {
    document.getElementById('aliasesLoading').style.display = 'block';
    document.getElementById('aliasesTable').style.display = 'none';
    
    try {
      const data = await api.get('/rooms/' + encodeURIComponent(roomId) + '/aliases');
      currentRoomAliases = data.aliases || [];
      
      const tbody = document.getElementById('aliasesList');
      tbody.innerHTML = '';
      
      currentRoomAliases.forEach((alias) => {
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td>\${alias}</td>
          <td>-</td>
          <td>-</td>
          <td>
            <button class="btn-icon-sm danger" onclick="deleteAlias('\${alias}')">🗑️</button>
          </td>
        \`;
        tbody.appendChild(tr);
      });
      
      document.getElementById('aliasesLoading').style.display = 'none';
      document.getElementById('aliasesTable').style.display = 'block';
      
    } catch (err) {
      console.error('Failed to load room aliases:', err);
      document.getElementById('aliasesLoading').innerHTML = 'Failed to load aliases';
    }
  }
  
  async function loadRoomEvents(page = 0) {
    if (!currentRoomId) return;
    
    document.getElementById('eventsLoading').style.display = 'block';
    document.getElementById('eventsTable').style.display = 'none';
    
    try {
      const limit = document.getElementById('eventLimit')?.value || '50';
      const url = '/rooms/' + encodeURIComponent(currentRoomId) + '/events?limit=' + limit + '&offset=' + (page * parseInt(limit));
      
      const data = await api.get(url);
      currentRoomEvents = data.events || [];
      
      filterEvents();
      
      document.getElementById('eventsLoading').style.display = 'none';
      document.getElementById('eventsTable').style.display = 'block';
      
    } catch (err) {
      console.error('Failed to load room events:', err);
      document.getElementById('eventsLoading').innerHTML = 'Failed to load events';
    }
  }
  
  function filterEvents() {
    const search = document.getElementById('eventSearch')?.value?.toLowerCase() || '';
    const typeFilter = document.getElementById('eventTypeFilter')?.value || 'all';
    
    const filtered = currentRoomEvents.filter((event) => {
      // Type filter
      if (typeFilter !== 'all' && event.type !== typeFilter) {
        return false;
      }
      
      // Search filter
      if (search) {
        return event.sender?.toLowerCase().includes(search) ||
               JSON.stringify(event.content)?.toLowerCase().includes(search);
      }
      
      return true;
    });
    
    const tbody = document.getElementById('eventsList');
    tbody.innerHTML = '';
    
    filtered.forEach((event) => {
      const content = typeof event.content === 'object' ? JSON.stringify(event.content).substring(0, 50) + '...' : event.content;
      
      const tr = document.createElement('tr');
      tr.innerHTML = \`
        <td>\${truncateString(event.event_id, 16)}</td>
        <td>\${event.type}</td>
        <td>\${event.sender || ''}</td>
        <td class="content-preview" title="\${JSON.stringify(event.content)}">\${content}</td>
        <td>\${event.origin_server_ts ? new Date(event.origin_server_ts).toLocaleString() : '-'}</td>
        <td>
          <button class="btn-icon-sm" onclick="viewEvent('\${event.event_id}')">👁️</button>
          <button class="btn-icon-sm danger" onclick="redactEvent('\${event.event_id}')">✂️</button>
        </td>
      \`;
      tbody.appendChild(tr);
    });
  }
  
  function switchRoomTab(tab) {
    currentRoomTab = tab;
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
    
    const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(
      btn => btn.textContent?.toLowerCase().includes(tab)
    );
    if (activeBtn) activeBtn.classList.add('active');
    
    const activeContent = document.getElementById(\`room\${tab.charAt(0).toUpperCase() + tab.slice(1)}Tab\`);
    if (activeContent) activeContent.style.display = 'block';
    
    // Load tab-specific data if needed
    if (tab === 'events' && currentRoomId) {
      loadRoomEvents(0);
    }
  }
  
  function showRoomMembers(roomId) {
    viewRoomDetails(roomId).then(() => {
      switchRoomTab('members');
    });
  }
  
  function showUpgradeRoom(roomId) {
    confirmAction(
      'Upgrade Room',
      'Upgrade this room to the latest version? This may affect client compatibility.',
      async () => {
        try {
          await api.post('/rooms/' + encodeURIComponent(roomId) + '/upgrade', {
            new_version: '10' // Or let user choose version
          });
          showNotification('Room upgraded successfully', 'success');
          refreshRooms();
        } catch (err) {
          showNotification('Failed to upgrade room', 'error');
        }
      }
    );
  }
  
  function showDeleteRoom(roomId) {
    confirmAction(
      'Delete Room',
      'Permanently delete this room? This cannot be undone.',
      async () => {
        try {
          await api.delete('/rooms/' + encodeURIComponent(roomId));
          showNotification('Room deleted successfully', 'success');
          refreshRooms();
          hideModal('roomDetailsModal');
        } catch (err) {
          showNotification('Failed to delete room', 'error');
        }
      }
    );
  }
  
  function upgradeRoom() {
    if (currentRoomId) {
      showUpgradeRoom(currentRoomId);
    }
  }
  
  function deleteRoom() {
    if (currentRoomId) {
      showDeleteRoom(currentRoomId);
    }
  }
  
  function addRoomAlias() {
    const alias = prompt('Enter room alias (without #):');
    if (alias && currentRoomId) {
      // This would call the alias creation API
      showNotification('Add alias functionality not implemented', 'info');
    }
  }
  
  function deleteAlias(alias) {
    confirmAction(
      'Delete Alias',
      \`Delete alias \${alias}?\`,
      async () => {
        // This would call the alias deletion API
        showNotification('Delete alias functionality not implemented', 'info');
      }
    );
  }
  
  function kickUser(userId) {
    confirmAction(
      'Kick User',
      \`Kick user \${userId} from the room?\`,
      async () => {
        // This would call the kick API
        showNotification('Kick functionality not implemented', 'info');
      }
    );
  }
  
  function banUser(userId) {
    confirmAction(
      'Ban User',
      \`Ban user \${userId} from the room?\`,
      async () => {
        // This would call the ban API
        showNotification('Ban functionality not implemented', 'info');
      }
    );
  }
  
  function viewEvent(eventId) {
    // This would show event details
    showNotification('View event: ' + eventId, 'info');
  }
  
  function redactEvent(eventId) {
    confirmAction(
      'Redact Event',
      'Remove this event from the room?',
      async () => {
        // This would call the redaction API
        showNotification('Redaction functionality not implemented', 'info');
      }
    );
  }
  
  function refreshRooms() {
    loadRooms(0, document.getElementById('roomSearch')?.value || '');
  }
`;

// Export all
export default {
  view: roomsView,
  styles: roomsStyles,
  functions: roomsFunctions
};