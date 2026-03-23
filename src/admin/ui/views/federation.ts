// src/admin/ui/views/federation.ts
// Federation view with status, tests, and server list

export const federationView = (): string => `
  <div id="federationView" class="view" style="display: none;">
    <div class="header">
      <h2>Federation</h2>
      <div class="header-actions">
        <button class="btn btn-primary" onclick="runFederationTests()">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6"></path>
            <path d="M1 20v-6h6"></path>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          Run Tests
        </button>
        <button class="btn btn-secondary" onclick="refreshFederation()">
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
      <div class="stat-card" id="serverInfoCard">
        <div class="label">Server Name</div>
        <div class="value" id="serverName">-</div>
      </div>
      <div class="stat-card" id="signingKeyCard">
        <div class="label">Signing Key</div>
        <div class="value" id="signingKeyId">-</div>
      </div>
      <div class="stat-card" id="knownServersCard">
        <div class="label">Known Servers</div>
        <div class="value" id="knownServers">-</div>
      </div>
      <div class="stat-card" id="federationStatusCard">
        <div class="label">Federation Status</div>
        <div class="value" id="federationEnabled">-</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Federation Test Results</h3>
        <button class="btn btn-sm btn-secondary" onclick="copyTestResults()">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copy Results
        </button>
      </div>
      <div class="card-body">
        <div id="federationTestsLoading" class="loading">
          <div class="spinner"></div>
          Running tests...
        </div>
        <div id="federationTestsResults" style="display: none;">
          <table class="test-results-table">
            <thead>
              <tr>
                <th>Test</th>
                <th>Status</th>
                <th>Message</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody id="federationTestsList"></tbody>
          </table>
          <div class="test-summary" id="testSummary"></div>
        </div>
        <div id="noTests" class="loading" style="display: none;">No tests run yet. Click "Run Tests" to begin.</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Well-Known Endpoints</h3>
      </div>
      <div class="card-body">
        <div class="endpoints-grid">
          <div class="endpoint-item">
            <div class="endpoint-label">Server Discovery</div>
            <div class="endpoint-url">
              <code>/.well-known/matrix/server</code>
              <button class="btn-icon" onclick="copyToClipboard('/.well-known/matrix/server')" title="Copy path">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
            <div class="endpoint-status" id="wellKnownServerStatus">-</div>
          </div>
          <div class="endpoint-item">
            <div class="endpoint-label">Client Discovery</div>
            <div class="endpoint-url">
              <code>/.well-known/matrix/client</code>
              <button class="btn-icon" onclick="copyToClipboard('/.well-known/matrix/client')" title="Copy path">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
            <div class="endpoint-status" id="wellKnownClientStatus">-</div>
          </div>
          <div class="endpoint-item">
            <div class="endpoint-label">Support Info</div>
            <div class="endpoint-url">
              <code>/.well-known/matrix/support</code>
              <button class="btn-icon" onclick="copyToClipboard('/.well-known/matrix/support')" title="Copy path">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
            <div class="endpoint-status" id="wellKnownSupportStatus">-</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Key Endpoints</h3>
      </div>
      <div class="card-body">
        <div class="endpoints-grid">
          <div class="endpoint-item">
            <div class="endpoint-label">Server Keys</div>
            <div class="endpoint-url">
              <code>/_matrix/key/v2/server</code>
              <button class="btn-icon" onclick="copyToClipboard('/_matrix/key/v2/server')" title="Copy path">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
            <div class="endpoint-status" id="keyEndpointStatus">-</div>
          </div>
          <div class="endpoint-item">
            <div class="endpoint-label">Federation API</div>
            <div class="endpoint-url">
              <code>/_matrix/federation/v1/version</code>
              <button class="btn-icon" onclick="copyToClipboard('/_matrix/federation/v1/version')" title="Copy path">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
            <div class="endpoint-status" id="federationEndpointStatus">-</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Known Federation Servers</h3>
        <div class="header-actions">
          <input 
            type="text" 
            class="search-input" 
            id="serverSearch" 
            placeholder="Search servers..." 
            onkeyup="debounceSearchServers()"
          >
        </div>
      </div>
      <div class="card-body">
        <div id="serversLoading" class="loading">
          <div class="spinner"></div>
          Loading servers...
        </div>
        <div id="serversTable" style="display: none;">
          <table>
            <thead>
              <tr>
                <th onclick="sortServers('server_name')" class="sortable">
                  Server Name
                  <span class="sort-indicator" id="sortServerName"></span>
                </th>
                <th onclick="sortServers('last_seen')" class="sortable">
                  Last Seen
                  <span class="sort-indicator" id="sortLastSeen"></span>
                </th>
                <th onclick="sortServers('retry_count')" class="sortable">
                  Retry Count
                  <span class="sort-indicator" id="sortRetryCount"></span>
                </th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="serversList"></tbody>
          </table>
          <div class="pagination" id="serversPagination"></div>
        </div>
        <div id="noServers" class="loading" style="display: none;">No servers found</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Federation Statistics</h3>
      </div>
      <div class="card-body">
        <div class="stats-mini-grid">
          <div class="stat-mini">
            <div class="stat-mini-label">Outbound Transactions</div>
            <div class="stat-mini-value" id="outboundTransactions">0</div>
          </div>
          <div class="stat-mini">
            <div class="stat-mini-label">Inbound Events</div>
            <div class="stat-mini-value" id="inboundEvents">0</div>
          </div>
          <div class="stat-mini">
            <div class="stat-mini-label">Failed Transactions</div>
            <div class="stat-mini-value" id="failedTransactions">0</div>
          </div>
          <div class="stat-mini">
            <div class="stat-mini-label">Avg Response Time</div>
            <div class="stat-mini-value" id="avgResponseTime">0ms</div>
          </div>
        </div>
      </div>
    </div>
  </div>
`;

// Federation-specific styles
export const federationStyles = `
  .endpoints-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 16px;
  }
  
  .endpoint-item {
    background: var(--bg-elevated);
    border-radius: 8px;
    padding: 16px;
  }
  
  .endpoint-label {
    font-size: 13px;
    color: var(--text-secondary);
    margin-bottom: 8px;
  }
  
  .endpoint-url {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  
  .endpoint-url code {
    flex: 1;
    padding: 6px 10px;
    background: var(--bg-base);
    border-radius: 4px;
    font-size: 12px;
    color: var(--text-primary);
  }
  
  .btn-icon {
    padding: 4px 8px;
    background: var(--bg-hover);
    border: 1px solid var(--border-default);
    border-radius: 4px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  
  .btn-icon:hover {
    background: var(--bg-active);
    color: var(--text-primary);
  }
  
  .endpoint-status {
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 4px;
    display: inline-block;
  }
  
  .endpoint-status.healthy {
    background: rgba(34, 197, 94, 0.1);
    color: var(--accent-green);
  }
  
  .endpoint-status.unhealthy {
    background: rgba(239, 68, 68, 0.1);
    color: var(--accent-red);
  }
  
  .endpoint-status.unknown {
    background: rgba(245, 158, 11, 0.1);
    color: var(--accent-amber);
  }
  
  .test-results-table {
    width: 100%;
  }
  
  .test-results-table td {
    padding: 12px 8px;
  }
  
  .test-results-table .status-badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }
  
  .status-badge.passed {
    background: rgba(34, 197, 94, 0.2);
    color: var(--accent-green);
  }
  
  .status-badge.failed {
    background: rgba(239, 68, 68, 0.2);
    color: var(--accent-red);
  }
  
  .test-summary {
    margin-top: 16px;
    padding: 12px;
    background: var(--bg-elevated);
    border-radius: 8px;
    text-align: center;
    font-size: 14px;
  }
  
  .test-summary.passed {
    border-left: 4px solid var(--accent-green);
  }
  
  .test-summary.failed {
    border-left: 4px solid var(--accent-red);
  }
  
  .stats-mini-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 16px;
  }
  
  .stat-mini {
    text-align: center;
    padding: 16px;
    background: var(--bg-elevated);
    border-radius: 8px;
  }
  
  .stat-mini-label {
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 8px;
  }
  
  .stat-mini-value {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .search-input {
    padding: 8px 12px;
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
  
  .sortable {
    cursor: pointer;
    user-select: none;
  }
  
  .sortable:hover {
    background: var(--bg-hover);
  }
  
  .sort-indicator {
    display: inline-block;
    width: 16px;
    text-align: center;
  }
  
  .server-status {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 8px;
  }
  
  .server-status.online {
    background: var(--accent-green);
    box-shadow: 0 0 8px var(--accent-green);
  }
  
  .server-status.offline {
    background: var(--bg-active);
  }
  
  .server-status.degraded {
    background: var(--accent-amber);
  }
`;

// Federation JavaScript functions
export const federationFunctions = (): string => `
  // ============================================
  // Federation Functions
  // ============================================
  
  let currentServers = [];
  let serverSortField = 'last_seen';
  let serverSortDirection = 'desc';
  let serverSearchTimeout;
  
  async function loadFederation() {
    try {
      // Load federation status
      const status = await api.get('/federation/status');
      
      document.getElementById('serverName').textContent = status.server_name || '-';
      document.getElementById('signingKeyId').textContent = status.signing_key_id || '-';
      document.getElementById('knownServers').textContent = status.known_servers_count || '0';
      document.getElementById('federationEnabled').innerHTML = status.federation_enabled ? '✅ Enabled' : '❌ Disabled';
      
      // Load well-known endpoint statuses
      await checkWellKnownEndpoints(status.server_name);
      
      // Load key endpoint status
      await checkKeyEndpoints(status.server_name);
      
      // Load servers list
      await loadServers();
      
      // Load federation statistics
      await loadFederationStats();
      
    } catch (err) {
      console.error('Failed to load federation status:', err);
      showNotification('Failed to load federation status', 'error');
    }
  }
  
  async function checkWellKnownEndpoints(serverName) {
    // Check .well-known/matrix/server
    try {
      const serverResp = await fetch(\`https://\${serverName}/.well-known/matrix/server\`);
      const statusEl = document.getElementById('wellKnownServerStatus');
      if (serverResp.ok) {
        const data = await serverResp.json();
        statusEl.textContent = \`✅ \${data['m.server'] || 'OK'}\`;
        statusEl.className = 'endpoint-status healthy';
      } else {
        statusEl.textContent = \`❌ HTTP \${serverResp.status}\`;
        statusEl.className = 'endpoint-status unhealthy';
      }
    } catch {
      document.getElementById('wellKnownServerStatus').textContent = '❌ Failed to fetch';
      document.getElementById('wellKnownServerStatus').className = 'endpoint-status unhealthy';
    }
    
    // Check .well-known/matrix/client
    try {
      const clientResp = await fetch(\`https://\${serverName}/.well-known/matrix/client\`);
      const statusEl = document.getElementById('wellKnownClientStatus');
      if (clientResp.ok) {
        const data = await clientResp.json();
        statusEl.textContent = \`✅ \${data['m.homeserver']?.base_url || 'OK'}\`;
        statusEl.className = 'endpoint-status healthy';
      } else {
        statusEl.textContent = \`❌ HTTP \${clientResp.status}\`;
        statusEl.className = 'endpoint-status unhealthy';
      }
    } catch {
      document.getElementById('wellKnownClientStatus').textContent = '❌ Failed to fetch';
      document.getElementById('wellKnownClientStatus').className = 'endpoint-status unhealthy';
    }
    
    // Check .well-known/matrix/support
    try {
      const supportResp = await fetch(\`https://\${serverName}/.well-known/matrix/support\`);
      const statusEl = document.getElementById('wellKnownSupportStatus');
      if (supportResp.ok) {
        statusEl.textContent = '✅ OK';
        statusEl.className = 'endpoint-status healthy';
      } else if (supportResp.status === 404) {
        statusEl.textContent = '⚠️ Not configured (optional)';
        statusEl.className = 'endpoint-status unknown';
      } else {
        statusEl.textContent = \`❌ HTTP \${supportResp.status}\`;
        statusEl.className = 'endpoint-status unhealthy';
      }
    } catch {
      document.getElementById('wellKnownSupportStatus').textContent = '⚠️ Not reachable';
      document.getElementById('wellKnownSupportStatus').className = 'endpoint-status unknown';
    }
  }
  
  async function checkKeyEndpoints(serverName) {
    // Check /_matrix/key/v2/server
    try {
      const keyResp = await fetch(\`https://\${serverName}/_matrix/key/v2/server\`);
      const statusEl = document.getElementById('keyEndpointStatus');
      if (keyResp.ok) {
        const data = await keyResp.json();
        const keyCount = Object.keys(data.verify_keys || {}).length;
        statusEl.textContent = \`✅ \${keyCount} key(s) published\`;
        statusEl.className = 'endpoint-status healthy';
      } else {
        statusEl.textContent = \`❌ HTTP \${keyResp.status}\`;
        statusEl.className = 'endpoint-status unhealthy';
      }
    } catch {
      document.getElementById('keyEndpointStatus').textContent = '❌ Failed to fetch';
      document.getElementById('keyEndpointStatus').className = 'endpoint-status unhealthy';
    }
    
    // Check /_matrix/federation/v1/version
    try {
      const fedResp = await fetch(\`https://\${serverName}/_matrix/federation/v1/version\`);
      const statusEl = document.getElementById('federationEndpointStatus');
      if (fedResp.ok) {
        const data = await fedResp.json();
        statusEl.textContent = \`✅ \${data.server?.name || 'OK'} \${data.server?.version || ''}\`;
        statusEl.className = 'endpoint-status healthy';
      } else {
        statusEl.textContent = \`❌ HTTP \${fedResp.status}\`;
        statusEl.className = 'endpoint-status unhealthy';
      }
    } catch {
      document.getElementById('federationEndpointStatus').textContent = '❌ Failed to fetch';
      document.getElementById('federationEndpointStatus').className = 'endpoint-status unhealthy';
    }
  }
  
  async function runFederationTests() {
    document.getElementById('federationTestsLoading').style.display = 'block';
    document.getElementById('federationTestsResults').style.display = 'none';
    document.getElementById('noTests').style.display = 'none';
    
    try {
      const results = await api.get('/federation/test');
      
      const tbody = document.getElementById('federationTestsList');
      tbody.innerHTML = '';
      
      let passedCount = 0;
      
      results.tests.forEach((test) => {
        const passed = test.passed;
        if (passed) passedCount++;
        
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td>\${test.name}</td>
          <td><span class="status-badge \${passed ? 'passed' : 'failed'}">\${passed ? 'PASSED' : 'FAILED'}</span></td>
          <td>\${test.message || '-'}</td>
          <td><button class="btn-icon" onclick={"showTestDetails('" + test.name + "')"}>ℹ️</button></td>
        \`;
        tbody.appendChild(tr);
      });
      
      const totalTests = results.tests.length;
      const summary = document.getElementById('testSummary');
      summary.className = \`test-summary \${passedCount === totalTests ? 'passed' : 'failed'}\`;
      summary.innerHTML = \`
        <strong>\${passedCount}/\${totalTests} tests passed</strong>
        \${passedCount === totalTests ? '✅ All systems operational' : '⚠️ Some checks failed'}
      \`;
      
      document.getElementById('federationTestsLoading').style.display = 'none';
      document.getElementById('federationTestsResults').style.display = 'block';
      
    } catch (err) {
      console.error('Failed to run federation tests:', err);
      document.getElementById('federationTestsLoading').style.display = 'none';
      document.getElementById('noTests').style.display = 'block';
      showNotification('Failed to run federation tests', 'error');
    }
  }
  
  function showTestDetails(testName) {
    // This would show more details about the test
    // For now, just a placeholder
    showNotification(\`Details for \${testName} would be shown here\`, 'info');
  }
  
  async function copyTestResults() {
    const results = document.getElementById('federationTestsList')?.innerText;
    if (results) {
      await navigator.clipboard.writeText(results);
      showNotification('Test results copied to clipboard', 'success');
    }
  }
  
  async function loadServers(page = 0, search = '') {
    document.getElementById('serversLoading').style.display = 'block';
    document.getElementById('serversTable').style.display = 'none';
    document.getElementById('noServers').style.display = 'none';
    
    try {
      let url = '/federation/servers';
      const data = await api.get(url);
      
      currentServers = data.servers || [];
      
      // Apply search filter
      let filteredServers = currentServers;
      if (search) {
        const searchLower = search.toLowerCase();
        filteredServers = currentServers.filter((s) => 
          s.server_name.toLowerCase().includes(searchLower)
        );
      }
      
      // Apply sorting
      filteredServers = sortServersArray(filteredServers, serverSortField, serverSortDirection);
      
      // Paginate
      const limit = 20;
      const start = page * limit;
      const paginatedServers = filteredServers.slice(start, start + limit);
      const totalPages = Math.ceil(filteredServers.length / limit);
      
      if (paginatedServers.length === 0) {
        document.getElementById('serversLoading').style.display = 'none';
        document.getElementById('noServers').style.display = 'block';
        return;
      }
      
      const tbody = document.getElementById('serversList');
      tbody.innerHTML = '';
      
      paginatedServers.forEach((server) => {
        const lastSeen = server.last_successful_fetch ? new Date(server.last_successful_fetch).toLocaleString() : 'Never';
        const retryCount = server.retry_count || 0;
        const status = getServerStatus(server);
        
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td>\${server.server_name}</td>
          <td>\${lastSeen}</td>
          <td>\${retryCount}</td>
          <td>
            <span class="server-status \${status.class}"></span>
            \${status.text}
          </td>
          <td>
            <button class="btn-icon" onclick={"testServerConnection('" + server.server_name + "')"} title="Test connection">🔌</button>
            <button class="btn-icon" onclick={"viewServerDetails('" + server.server_name + "')"} title="View details">📋</button>
          </td>
        \`;
        tbody.appendChild(tr);
      });
      
      // Update pagination
      const paginationEl = document.getElementById('serversPagination');
      paginationEl.innerHTML = '';
      
      if (totalPages > 1) {
        for (let i = 0; i < totalPages; i++) {
          const btn = document.createElement('button');
          btn.textContent = (i + 1).toString();
          btn.className = i === page ? 'active' : '';
          btn.onclick = () => loadServers(i, search);
          paginationEl.appendChild(btn);
        }
      }
      
      document.getElementById('serversLoading').style.display = 'none';
      document.getElementById('serversTable').style.display = 'block';
      
    } catch (err) {
      console.error('Failed to load servers:', err);
      document.getElementById('serversLoading').innerHTML = 'Failed to load servers';
    }
  }
  
  function getServerStatus(server) {
    if (!server.last_successful_fetch) {
      return { class: 'offline', text: 'Never connected' };
    }
    
    const lastSeen = server.last_successful_fetch;
    const now = Date.now();
    const hoursSinceLastSeen = (now - lastSeen) / (1000 * 60 * 60);
    
    if (hoursSinceLastSeen < 24) {
      return { class: 'online', text: 'Online' };
    } else if (hoursSinceLastSeen < 168) { // 7 days
      return { class: 'degraded', text: 'Stale' };
    } else {
      return { class: 'offline', text: 'Offline' };
    }
  }
  
  function sortServersArray(servers, field, direction) {
    return [...servers].sort((a, b) => {
      let aVal, bVal;
      
      switch(field) {
        case 'server_name':
          aVal = a.server_name || '';
          bVal = b.server_name || '';
          break;
        case 'last_seen':
          aVal = a.last_successful_fetch || 0;
          bVal = b.last_successful_fetch || 0;
          break;
        case 'retry_count':
          aVal = a.retry_count || 0;
          bVal = b.retry_count || 0;
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
  
  function sortServers(field) {
    if (serverSortField === field) {
      serverSortDirection = serverSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      serverSortField = field;
      serverSortDirection = 'asc';
    }
    
    // Update sort indicators
    document.querySelectorAll('.sort-indicator').forEach(el => el.textContent = '');
    const indicator = document.getElementById(\`sort\${field.charAt(0).toUpperCase() + field.slice(1)}\`);
    if (indicator) {
      indicator.textContent = serverSortDirection === 'asc' ? '↑' : '↓';
    }
    
    const search = document.getElementById('serverSearch')?.value || '';
    loadServers(0, search);
  }
  
  function debounceSearchServers() {
    clearTimeout(serverSearchTimeout);
    serverSearchTimeout = setTimeout(() => {
      const search = document.getElementById('serverSearch')?.value || '';
      loadServers(0, search);
    }, 300);
  }
  
  async function testServerConnection(serverName) {
    showNotification(\`Testing connection to \${serverName}...\`, 'info');
    
    try {
      // Try to fetch server keys
      const response = await fetch(\`https://\${serverName}/_matrix/key/v2/server\`);
      
      if (response.ok) {
        showNotification(\`✅ Successfully connected to \${serverName}\`, 'success');
      } else {
        showNotification(\`❌ Failed to connect to \${serverName} (HTTP \${response.status})\`, 'error');
      }
    } catch (err) {
      showNotification(\`❌ Could not reach \${serverName}\`, 'error');
    }
  }
  
  function viewServerDetails(serverName) {
    // This would show a modal with server details
    // For now, just log
    console.log('View details for:', serverName);
    showNotification(\`Viewing details for \${serverName}\`, 'info');
  }
  
  async function loadFederationStats() {
    try {
      // These would come from your API
      // For now, use placeholder values
      document.getElementById('outboundTransactions').textContent = '127';
      document.getElementById('inboundEvents').textContent = '1,432';
      document.getElementById('failedTransactions').textContent = '3';
      document.getElementById('avgResponseTime').textContent = '243ms';
    } catch (err) {
      console.error('Failed to load federation stats:', err);
    }
  }
  
  function refreshFederation() {
    loadFederation();
    runFederationTests();
  }
  
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    showNotification('Copied to clipboard', 'success');
  }
`;

// Export all
export default {
  view: federationView,
  styles: federationStyles,
  functions: federationFunctions
};