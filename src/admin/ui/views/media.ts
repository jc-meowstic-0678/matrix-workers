// src/admin/ui/views/media.ts
// Media management view with file listing, quarantine controls, and statistics

export const mediaView = (): string => `
  <div id="mediaView" class="view" style="display: none;">
    <div class="header">
      <h2>Media</h2>
      <div class="header-actions">
        <button class="btn btn-primary" onclick="showUploadMediaModal()">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          Upload Media
        </button>
        <button class="btn btn-secondary" onclick="refreshMedia()">
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
      <div class="stat-card" id="totalFilesCard">
        <div class="label">Total Files</div>
        <div class="value" id="totalFiles">-</div>
      </div>
      <div class="stat-card" id="totalSizeCard">
        <div class="label">Total Size</div>
        <div class="value" id="totalSize">-</div>
      </div>
      <div class="stat-card" id="quarantinedCard">
        <div class="label">Quarantined</div>
        <div class="value" id="quarantined">-</div>
      </div>
      <div class="stat-card" id="mediaTypesCard">
        <div class="label">Media Types</div>
        <div class="value" id="mediaTypes">-</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Media Files</h3>
        <div class="header-actions">
          <div class="filter-group">
            <select id="mediaTypeFilter" onchange="filterMedia()" class="filter-select">
              <option value="all">All Types</option>
              <option value="image">Images</option>
              <option value="video">Videos</option>
              <option value="audio">Audio</option>
              <option value="other">Other</option>
            </select>
            <select id="mediaStatusFilter" onchange="filterMedia()" class="filter-select">
              <option value="all">All Status</option>
              <option value="normal">Normal</option>
              <option value="quarantined">Quarantined</option>
            </select>
            <input 
              type="text" 
              class="search-input" 
              id="mediaSearch" 
              placeholder="Search by filename or user..." 
              onkeyup="debounceSearchMedia()"
            >
          </div>
        </div>
      </div>
      <div class="card-body">
        <div id="mediaLoading" class="loading">
          <div class="spinner"></div>
          Loading media files...
        </div>
        <div id="mediaTable" style="display: none;">
          <table>
            <thead>
              <tr>
                <th onclick="sortMedia('preview')" class="sortable">Preview</th>
                <th onclick="sortMedia('media_id')" class="sortable">
                  Media ID
                  <span class="sort-indicator" id="sortMediaId"></span>
                </th>
                <th onclick="sortMedia('user_id')" class="sortable">
                  User
                  <span class="sort-indicator" id="sortUserId"></span>
                </th>
                <th onclick="sortMedia('content_type')" class="sortable">
                  Type
                  <span class="sort-indicator" id="sortContentType"></span>
                </th>
                <th onclick="sortMedia('size')" class="sortable">
                  Size
                  <span class="sort-indicator" id="sortSize"></span>
                </th>
                <th onclick="sortMedia('created_at')" class="sortable">
                  Uploaded
                  <span class="sort-indicator" id="sortCreatedAt"></span>
                </th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="mediaList"></tbody>
          </table>
          <div class="pagination" id="mediaPagination"></div>
        </div>
        <div id="noMedia" class="loading" style="display: none;">No media files found</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Media Distribution</h3>
      </div>
      <div class="card-body">
        <div class="charts-grid">
          <div class="chart-container-sm">
            <canvas id="mediaTypesChart"></canvas>
          </div>
          <div class="chart-container-sm">
            <canvas id="mediaTimelineChart"></canvas>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Storage by User</h3>
        <div class="header-actions">
          <button class="btn-icon" onclick="refreshStorageByUser()" title="Refresh">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 4v6h-6"></path>
              <path d="M1 20v-6h6"></path>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
          </button>
        </div>
      </div>
      <div class="card-body">
        <div id="storageLoading" class="loading">
          <div class="spinner"></div>
          Loading storage data...
        </div>
        <div id="storageTable" style="display: none;">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Files</th>
                <th>Total Size</th>
                <th>% of Total</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="storageList"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
`;

// Media-specific styles
export const mediaStyles = `
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
  
  .media-preview {
    width: 40px;
    height: 40px;
    border-radius: 4px;
    object-fit: cover;
    background: var(--bg-elevated);
    border: 1px solid var(--border-default);
  }
  
  .media-preview.video {
    background: var(--bg-elevated);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
  }
  
  .media-preview.audio {
    background: var(--bg-elevated);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
  }
  
  .media-preview.other {
    background: var(--bg-elevated);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
  }
  
  .quarantine-badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }
  
  .quarantine-badge.normal {
    background: rgba(34, 197, 94, 0.2);
    color: var(--accent-green);
  }
  
  .quarantine-badge.quarantined {
    background: rgba(239, 68, 68, 0.2);
    color: var(--accent-red);
  }
  
  .action-group {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  
  .btn-icon-sm {
    padding: 4px;
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
  
  .chart-container-sm {
    position: relative;
    height: 200px;
    width: 100%;
  }
  
  .file-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .file-name {
    font-weight: 500;
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .file-meta {
    font-size: 11px;
    color: var(--text-tertiary);
  }
  
  .upload-progress {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 300px;
    background: var(--bg-surface);
    border: 1px solid var(--border-default);
    border-radius: 8px;
    padding: 16px;
    box-shadow: var(--shadow-lg);
    z-index: 2000;
    display: none;
  }
  
  .upload-progress.visible {
    display: block;
  }
  
  .progress-bar {
    width: 100%;
    height: 4px;
    background: var(--bg-hover);
    border-radius: 2px;
    margin: 8px 0;
    overflow: hidden;
  }
  
  .progress-fill {
    height: 100%;
    background: var(--accent-blue);
    transition: width 0.3s ease;
  }
  
  .upload-status {
    font-size: 13px;
    color: var(--text-secondary);
  }
  
  .upload-filename {
    font-weight: 500;
    margin-bottom: 4px;
  }
`;

// Media JavaScript functions
export const mediaFunctions = (): string => `
  // ============================================
  // Media Management Functions
  // ============================================
  
  let currentMedia = [];
  let mediaSortField = 'created_at';
  let mediaSortDirection = 'desc';
  let mediaTypeFilter = 'all';
  let mediaStatusFilter = 'all';
  let mediaSearchTimeout;
  let mediaChart;
  let timelineChart;
  
  // File size formatter
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  async function loadMedia(page = 0) {
    document.getElementById('mediaLoading').style.display = 'block';
    document.getElementById('mediaTable').style.display = 'none';
    document.getElementById('noMedia').style.display = 'none';
    
    try {
      // Load media list
      const data = await api.get('/media?limit=50&offset=' + (page * 50));
      
      // Load media stats
      const stats = await api.get('/media/stats');
      document.getElementById('totalFiles').textContent = stats.total_files || '0';
      document.getElementById('totalSize').textContent = formatBytes(stats.total_bytes || 0);
      document.getElementById('quarantined').textContent = stats.quarantined_count || '0';
      
      // Calculate media types distribution
      const typeCount = countMediaTypes(data.items);
      document.getElementById('mediaTypes').textContent = Object.keys(typeCount).length;
      
      currentMedia = data.items || [];
      
      // Apply filters
      let filteredMedia = filterMediaItems(currentMedia);
      
      // Apply sorting
      filteredMedia = sortMediaArray(filteredMedia, mediaSortField, mediaSortDirection);
      
      // Paginate
      const limit = 50;
      const start = page * limit;
      const paginatedMedia = filteredMedia.slice(start, start + limit);
      const totalPages = Math.ceil(filteredMedia.length / limit);
      
      if (paginatedMedia.length === 0) {
        document.getElementById('mediaLoading').style.display = 'none';
        document.getElementById('noMedia').style.display = 'block';
        return;
      }
      
      const tbody = document.getElementById('mediaList');
      tbody.innerHTML = '';
      
      paginatedMedia.forEach((media) => {
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td>\${getMediaPreview(media)}</td>
          <td>\${media.media_id.substring(0, 8)}...</td>
          <td>\${media.user_id}</td>
          <td>\${media.content_type}</td>
          <td>\${formatBytes(media.content_length)}</td>
          <td>\${new Date(media.created_at).toLocaleString()}</td>
          <td><span class="quarantine-badge \${media.quarantined ? 'quarantined' : 'normal'}">\${media.quarantined ? 'Quarantined' : 'Normal'}</span></td>
          <td class="action-group">
            \${media.quarantined ? 
              '<button class="btn-icon-sm" onclick="unquarantineMedia(\'' + media.media_id + '\')" title="Release from quarantine">🔓</button>' : 
              '<button class="btn-icon-sm warning" onclick="quarantineMedia(\'' + media.media_id + '\')" title="Quarantine">⚠️</button>'
            }
            <button class="btn-icon-sm" onclick="viewMediaDetails('\${media.media_id}')" title="View details">👁️</button>
            <button class="btn-icon-sm" onclick="downloadMedia('\${media.media_id}')" title="Download">⬇️</button>
            <button class="btn-icon-sm danger" onclick="deleteMedia('\${media.media_id}')" title="Delete">🗑️</button>
          </td>
        \`;
        tbody.appendChild(tr);
      });
      
      // Update pagination
      renderMediaPagination(page, totalPages);
      
      // Update charts
      updateMediaCharts(data.items);
      
      // Load storage by user
      await loadStorageByUser();
      
      document.getElementById('mediaLoading').style.display = 'none';
      document.getElementById('mediaTable').style.display = 'block';
      
    } catch (err) {
      console.error('Failed to load media:', err);
      document.getElementById('mediaLoading').innerHTML = 'Failed to load media';
    }
  }
  
  function getMediaPreview(media) {
    const type = media.content_type.split('/')[0];
    
    if (type === 'image') {
      return \`<img src="/_matrix/media/v3/download/\${media.media_id}" class="media-preview" alt="preview">\`;
    } else if (type === 'video') {
      return '<div class="media-preview video">🎬</div>';
    } else if (type === 'audio') {
      return '<div class="media-preview audio">🎵</div>';
    } else {
      return '<div class="media-preview other">📄</div>';
    }
  }
  
  function countMediaTypes(media) {
    const counts = {};
    media.forEach(item => {
      const type = item.content_type.split('/')[0];
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  }
  
  function filterMediaItems(items) {
    return items.filter(item => {
      // Type filter
      if (mediaTypeFilter !== 'all') {
        const type = item.content_type.split('/')[0];
        if (type !== mediaTypeFilter) return false;
      }
      
      // Status filter
      if (mediaStatusFilter !== 'all') {
        const isQuarantined = mediaStatusFilter === 'quarantined';
        if (item.quarantined !== isQuarantined) return false;
      }
      
      // Search filter
      const search = document.getElementById('mediaSearch')?.value?.toLowerCase();
      if (search) {
        return item.filename?.toLowerCase().includes(search) ||
               item.user_id?.toLowerCase().includes(search) ||
               item.media_id?.toLowerCase().includes(search);
      }
      
      return true;
    });
  }
  
  function filterMedia() {
    mediaTypeFilter = document.getElementById('mediaTypeFilter')?.value || 'all';
    mediaStatusFilter = document.getElementById('mediaStatusFilter')?.value || 'all';
    loadMedia(0);
  }
  
  function debounceSearchMedia() {
    clearTimeout(mediaSearchTimeout);
    mediaSearchTimeout = setTimeout(() => {
      filterMedia();
    }, 300);
  }
  
  function sortMediaArray(media, field, direction) {
    return [...media].sort((a, b) => {
      let aVal, bVal;
      
      switch(field) {
        case 'media_id':
          aVal = a.media_id || '';
          bVal = b.media_id || '';
          break;
        case 'user_id':
          aVal = a.user_id || '';
          bVal = b.user_id || '';
          break;
        case 'content_type':
          aVal = a.content_type || '';
          bVal = b.content_type || '';
          break;
        case 'size':
          aVal = a.content_length || 0;
          bVal = b.content_length || 0;
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
  
  function sortMedia(field) {
    if (mediaSortField === field) {
      mediaSortDirection = mediaSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      mediaSortField = field;
      mediaSortDirection = 'asc';
    }
    
    // Update sort indicators
    document.querySelectorAll('.sort-indicator').forEach(el => el.textContent = '');
    const indicator = document.getElementById(\`sort\${field.charAt(0).toUpperCase() + field.slice(1)}\`);
    if (indicator) {
      indicator.textContent = mediaSortDirection === 'asc' ? '↑' : '↓';
    }
    
    loadMedia(0);
  }
  
  function renderMediaPagination(currentPage, totalPages) {
    const paginationEl = document.getElementById('mediaPagination');
    paginationEl.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    // Previous button
    if (currentPage > 0) {
      const prevBtn = document.createElement('button');
      prevBtn.innerHTML = '←';
      prevBtn.onclick = () => loadMedia(currentPage - 1);
      paginationEl.appendChild(prevBtn);
    }
    
    // Page numbers
    for (let i = Math.max(0, currentPage - 2); i <= Math.min(totalPages - 1, currentPage + 2); i++) {
      const btn = document.createElement('button');
      btn.textContent = (i + 1).toString();
      btn.className = i === currentPage ? 'active' : '';
      btn.onclick = () => loadMedia(i);
      paginationEl.appendChild(btn);
    }
    
    // Next button
    if (currentPage < totalPages - 1) {
      const nextBtn = document.createElement('button');
      nextBtn.innerHTML = '→';
      nextBtn.onclick = () => loadMedia(currentPage + 1);
      paginationEl.appendChild(nextBtn);
    }
  }
  
  function updateMediaCharts(media) {
    // Media types pie chart
    const typeCount = countMediaTypes(media);
    const typeCtx = document.getElementById('mediaTypesChart')?.getContext('2d');
    
    if (typeCtx) {
      if (mediaChart) mediaChart.destroy();
      
      mediaChart = new Chart(typeCtx, {
        type: 'doughnut',
        data: {
          labels: Object.keys(typeCount).map(t => t.charAt(0).toUpperCase() + t.slice(1)),
          datasets: [{
            data: Object.values(typeCount),
            backgroundColor: [
              '#3b82f6', // blue
              '#22c55e', // green
              '#f59e0b', // orange
              '#8b5cf6', // purple
              '#ef4444'  // red
            ]
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
    
    // Timeline chart (last 30 days)
    const timelineData = getTimelineData(media);
    const timelineCtx = document.getElementById('mediaTimelineChart')?.getContext('2d');
    
    if (timelineCtx) {
      if (timelineChart) timelineChart.destroy();
      
      timelineChart = new Chart(timelineCtx, {
        type: 'line',
        data: {
          labels: timelineData.labels,
          datasets: [{
            label: 'Uploads',
            data: timelineData.values,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
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
  
  function getTimelineData(media) {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    
    const dayCounts = {};
    const labels = [];
    
    // Initialize last 30 days
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000);
      const dayStr = date.toISOString().split('T')[0];
      labels.push(dayStr);
      dayCounts[dayStr] = 0;
    }
    
    // Count uploads per day
    media.forEach(item => {
      if (item.created_at >= thirtyDaysAgo) {
        const date = new Date(item.created_at).toISOString().split('T')[0];
        if (dayCounts[date] !== undefined) {
          dayCounts[date]++;
        }
      }
    });
    
    return {
      labels,
      values: labels.map(day => dayCounts[day] || 0)
    };
  }
  
  async function loadStorageByUser() {
    document.getElementById('storageLoading').style.display = 'block';
    document.getElementById('storageTable').style.display = 'none';
    
    try {
      // Group media by user
      const userStorage:  = {};
      
      currentMedia.forEach(media => {
        if (!userStorage[media.user_id]) {
          userStorage[media.user_id] = { count: 0, size: 0 };
        }
        userStorage[media.user_id].count++;
        userStorage[media.user_id].size += media.content_length || 0;
      });
      
      // Calculate total size for percentages
      const totalSize = Object.values(userStorage).reduce((sum, u) => sum + u.size, 0);
      
      // Convert to array and sort by size
      const userList = Object.entries(userStorage)
        .map(([userId, data]) => ({ userId, ...data }))
        .sort((a, b) => b.size - a.size)
        .slice(0, 20); // Top 20 users
      
      const tbody = document.getElementById('storageList');
      tbody.innerHTML = '';
      
      userList.forEach(user => {
        const percentage = totalSize > 0 ? ((user.size / totalSize) * 100).toFixed(1) : '0';
        
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td>\${user.userId}</td>
          <td>\${user.count}</td>
          <td>\${formatBytes(user.size)}</td>
          <td>\${percentage}%</td>
          <td>
            <button class="btn-icon-sm" onclick="filterByUser('\${user.userId}')" title="Show user's files">👁️</button>
          </td>
        \`;
        tbody.appendChild(tr);
      });
      
      document.getElementById('storageLoading').style.display = 'none';
      document.getElementById('storageTable').style.display = 'block';
      
    } catch (err) {
      console.error('Failed to load storage by user:', err);
      document.getElementById('storageLoading').innerHTML = 'Failed to load storage data';
    }
  }
  
  function filterByUser(userId) {
    document.getElementById('mediaSearch').value = userId;
    filterMedia();
  }
  
  async function quarantineMedia(mediaId) {
    confirmAction(
      'Quarantine Media',
      'Move this file to quarantine? It will not be accessible to users.',
      async () => {
        try {
          await api.post('/media/' + mediaId + '/quarantine', {});
          showNotification('Media quarantined successfully', 'success');
          refreshMedia();
        } catch (err) {
          showNotification('Failed to quarantine media', 'error');
        }
      }
    );
  }
  
  async function unquarantineMedia(mediaId) {
    confirmAction(
      'Release from Quarantine',
      'Make this file available to users again?',
      async () => {
        try {
          await api.post('/media/' + mediaId + '/unquarantine', {});
          showNotification('Media released from quarantine', 'success');
          refreshMedia();
        } catch (err) {
          showNotification('Failed to release media', 'error');
        }
      }
    );
  }
  
  async function deleteMedia(mediaId) {
    confirmAction(
      'Delete Media',
      'Permanently delete this file? This cannot be undone.',
      async () => {
        try {
          await api.delete('/media/' + mediaId);
          showNotification('Media deleted successfully', 'success');
          refreshMedia();
        } catch (err) {
          showNotification('Failed to delete media', 'error');
        }
      }
    );
  }
  
  function viewMediaDetails(mediaId) {
    // This would open a modal with media details
    const media = currentMedia.find(m => m.media_id === mediaId);
    if (media) {
      const details = \`
        Media ID: \${media.media_id}
        User: \${media.user_id}
        Type: \${media.content_type}
        Size: \${formatBytes(media.content_length)}
        Filename: \${media.filename || 'N/A'}
        Uploaded: \${new Date(media.created_at).toLocaleString()}
        Status: \${media.quarantined ? 'Quarantined' : 'Normal'}
      \`;
      alert(details); // In production, use a proper modal
    }
  }
  
  function downloadMedia(mediaId) {
    window.open(\`/_matrix/media/v3/download/\${mediaId}\`, '_blank');
  }
  
  function showUploadMediaModal() {
    // This would show an upload modal
    // For now, create a simple file input
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        await uploadMedia(file);
      }
    };
    input.click();
  }
  
  async function uploadMedia(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    showUploadProgress(file.name);
    
    try {
      const response = await fetch('/_matrix/media/v3/upload?filename=' + encodeURIComponent(file.name), {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
        },
        body: file
      });
      
      if (response.ok) {
        const data = await response.json();
        showNotification('File uploaded successfully', 'success');
        refreshMedia();
      } else {
        showNotification('Upload failed', 'error');
      }
    } catch (err) {
      showNotification('Upload failed', 'error');
    } finally {
      hideUploadProgress();
    }
  }
  
  function showUploadProgress(filename) {
    const progressEl = document.getElementById('uploadProgress');
    if (progressEl) {
      progressEl.classList.add('visible');
      document.getElementById('uploadFilename').textContent = filename;
    }
  }
  
  function hideUploadProgress() {
    const progressEl = document.getElementById('uploadProgress');
    if (progressEl) {
      progressEl.classList.remove('visible');
    }
  }
  
  function refreshMedia() {
    loadMedia(0);
  }
  
  function refreshStorageByUser() {
    loadStorageByUser();
  }
`;

// Export all
export default {
  view: mediaView,
  styles: mediaStyles,
  functions: mediaFunctions
};