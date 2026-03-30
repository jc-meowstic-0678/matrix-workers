// API client for frontend

export const ssoFunctions = (): string => `
  let currentIdps = [];

  async function loadSso() {
    document.getElementById('ssoLoading').style.display = 'block';
    document.getElementById('ssoTable').style.display = 'none';
    document.getElementById('noSso').style.display = 'none';

    try {
      const data = await api.get('/idp/providers');
      currentIdps = data.providers || [];
      
      if (currentIdps.length === 0) {
        document.getElementById('ssoLoading').style.display = 'none';
        document.getElementById('noSso').style.display = 'block';
        return;
      }

      const tbody = document.getElementById('ssoTableBody');
      tbody.innerHTML = '';
      
      currentIdps.forEach(idp => {
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td>\${idp.name}</td>
          <td><code style="font-size: 11px;">\${idp.id}</code></td>
          <td>\${idp.issuer_url}</td>
          <td>\${idp.enabled ? '<span class="badge badge-success">Enabled</span>' : '<span class="badge badge-secondary">Disabled</span>'}</td>
          <td>\${idp.auto_create_users ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-warning">No</span>'}</td>
          <td>\${idp.linked_users || 0}</td>
          <td>
            <button class="btn btn-sm btn-primary" onclick="editIdp('\${idp.id}')">Edit</button>
            <button class="btn btn-sm btn-info" onclick="testIdp('\${idp.id}')">Test</button>
            <button class="btn btn-sm btn-danger" onclick="deleteIdp('\${idp.id}')">Delete</button>
          </td>
        \`;
        tbody.appendChild(tr);
      });

      document.getElementById('ssoLoading').style.display = 'none';
      document.getElementById('ssoTable').style.display = 'table';
    } catch (err) {
      console.error('Failed to load SSO providers:', err);
      document.getElementById('ssoLoading').innerHTML = 'Failed to load SSO providers';
    }
  }

  async function saveIdp(idpData, isNew) {
    try {
      if (isNew) {
        const result = await api.post('/idp/providers', idpData);
        const msg = 'Provider created successfully! Provider ID: ' + result.id + ' Redirect URI: https://' + window.location.host + '/auth/oidc/' + result.id + '/callback';
        alert(msg);
      } else {
        await api.put('/idp/providers/' + idpData.id, idpData);
      }
      hideModal('idpModal');
      loadSso();
    } catch (err) {
      alert('Failed to save SSO provider: ' + (err.message || 'Unknown error'));
    }
  }

  async function editIdp(id) {
    const idp = currentIdps.find(i => i.id === id);
    if (!idp) return;
    
    document.getElementById('idpModalTitle').textContent = 'Edit SSO Provider - ID: ' + idp.id;
    document.getElementById('idpId').value = idp.id;
    document.getElementById('idpName').value = idp.name;
    document.getElementById('idpIssuer').value = idp.issuer_url;
    document.getElementById('idpClientId').value = idp.client_id;
    document.getElementById('idpClientSecret').value = '';
    document.getElementById('idpScopes').value = idp.scopes || 'openid profile email';
    document.getElementById('idpUsernameClaim').value = idp.username_claim || 'email';
    document.getElementById('idpAutoCreate').checked = idp.auto_create_users;
    document.getElementById('idpEnabled').checked = idp.enabled;
    document.getElementById('idpIconUrl').value = idp.icon_url || '';
    showModal('idpModal');
  }

  async function deleteIdp(id) {
    confirmAction('Delete SSO Provider', 'Are you sure you want to delete this SSO provider?', async () => {
      try {
        await api.delete('/idp/providers/' + id);
        loadSso();
      } catch (err) {
        alert('Failed to delete SSO provider');
      }
    });
  }

  async function testIdp(id) {
    const btn = event.target;
    btn.disabled = true;
    btn.textContent = 'Testing...';
    
    try {
      const result = await api.post('/idp/providers/' + id + '/test', {});
      alert('Connection successful! Provider is reachable.');
    } catch (err) {
      alert('Connection failed: ' + (err.message || 'Unknown error'));
    } finally {
      btn.disabled = false;
      btn.textContent = 'Test';
    }
  }

  function showAddIdpModal() {
    document.getElementById('idpModalTitle').textContent = 'Add SSO Provider';
    document.getElementById('idpForm').reset();
    document.getElementById('idpId').value = '';
    document.getElementById('idpAutoCreate').checked = true;
    document.getElementById('idpEnabled').checked = true;
    showModal('idpModal');
  }

  function submitIdpForm() {
    const idpData = {
      name: document.getElementById('idpName').value,
      issuer_url: document.getElementById('idpIssuer').value,
      client_id: document.getElementById('idpClientId').value,
      client_secret: document.getElementById('idpClientSecret').value,
      scopes: document.getElementById('idpScopes').value,
      username_claim: document.getElementById('idpUsernameClaim').value,
      auto_create_users: document.getElementById('idpAutoCreate').checked,
      enabled: document.getElementById('idpEnabled').checked,
      icon_url: document.getElementById('idpIconUrl').value || undefined
    };

    console.log('[SSO Form] Submitting:', JSON.stringify(idpData));

    if (!idpData.name || !idpData.issuer_url || !idpData.client_id || !idpData.client_secret) {
      alert('Please fill in all required fields');
      return;
    }

    const id = document.getElementById('idpId').value;
    saveIdp(idpData, !id);
  }
`;

export const createApiClient = (): string => `
  const api = {
    async login(password) {
      const response = await fetch('/admin/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      return response.json();
    },

    async logout() {
      await fetch('/admin/api/logout', { method: 'POST' });
    },

    async checkAuth() {
      const response = await fetch('/admin/api/status');
      return response.json();
    },

    async get(endpoint) {
      const response = await fetch('/admin/api' + endpoint, {
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') }
      });
      if (!response.ok) throw new Error('API error: ' + response.status);
      return response.json();
    },

    async post(endpoint, data) {
      const response = await fetch('/admin/api' + endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('API error: ' + response.status);
      return response.json();
    },

    async put(endpoint, data) {
      const response = await fetch('/admin/api' + endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('API error: ' + response.status);
      return response.json();
    },

    async delete(endpoint) {
      const response = await fetch('/admin/api' + endpoint, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') }
      });
      if (!response.ok) throw new Error('API error: ' + response.status);
      return response.json();
    },

    setToken(token) {
      localStorage.setItem('adminToken', token);
    },

    getToken() {
      return localStorage.getItem('adminToken');
    },

    clearToken() {
      localStorage.removeItem('adminToken');
    }
  };
`;

// View state management
export const viewState = (): string => `
  let currentPage = { users: 0, rooms: 0, media: 0 };
  let searchTimeout;
  let currentUsers = [];
  let currentRooms = [];
  let currentMedia = [];
  let currentReports = [];

  function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = message;
      el.style.display = 'block';
      setTimeout(() => { el.style.display = 'none'; }, 5000);
    }
  }

  function hideModal(modalId) {
    document.getElementById(modalId).classList.remove('visible');
  }

  function showModal(modalId) {
    document.getElementById(modalId).classList.add('visible');
  }

  async function confirmAction(title, message, callback) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmAction').onclick = async () => {
      hideModal('confirmModal');
      await callback();
    };
    showModal('confirmModal');
  }
`;

// View switching
export const viewSwitcher = (): string => `
  function switchView(viewName) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    
    const navItem = document.querySelector(\`[data-view="\${viewName}"]\`);
    if (navItem) navItem.classList.add('active');
    
    document.getElementById(viewName + 'View').style.display = 'block';
    
    // Load data for the view
    switch(viewName) {
      case 'dashboard': loadDashboard(); break;
      case 'users': loadUsers(); break;
      case 'rooms': loadRooms(); break;
      case 'federation': loadFederation(); break;
      case 'media': loadMedia(); break;
      case 'reports': loadReports(); break;
      case 'security': loadSessions(); break;
      case 'sso': loadSso(); break;
      case 'settings': loadSettings(); break;
    }
  }
`;

// User management functions
export const userFunctions = (): string => `
  async function loadUsers(page = 0, search = '') {
    document.getElementById('usersLoading').style.display = 'block';
    document.getElementById('usersTable').style.display = 'none';
    document.getElementById('noUsers').style.display = 'none';

    try {
      let url = \`/users?limit=50&offset=\${page * 50}\`;
      if (search) url += \`&search=\${encodeURIComponent(search)}\`;
      
      const data = await api.get(url);
      currentUsers = data.items || [];
      
      if (currentUsers.length === 0) {
        document.getElementById('usersLoading').style.display = 'none';
        document.getElementById('noUsers').style.display = 'block';
        return;
      }

      const tbody = document.getElementById('usersList');
      tbody.innerHTML = '';

      currentUsers.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td>\${user.user_id}</td>
          <td>\${user.display_name || '-'}</td>
          <td><span class="badge \${user.admin ? 'admin' : ''} \${user.is_deactivated ? 'deactivated' : ''}">\${user.admin ? 'Admin' : user.is_deactivated ? 'Deactivated' : 'User'}</span></td>
          <td>\${new Date(user.created_at).toLocaleDateString()}</td>
          <td class="action-buttons">
            <button class="btn btn-sm btn-secondary" onclick="viewUser('\${user.user_id}')">View</button>
            <button class="btn btn-sm btn-warning" onclick="resetUserPassword('\${user.user_id}')">Reset Password</button>
            \${user.is_deactivated ? 
              '<button class="btn btn-sm btn-success" onclick="reactivateUser(\'' + user.user_id + '\')">Reactivate</button>' : 
              '<button class="btn btn-sm btn-danger" onclick="deactivateUser(\'' + user.user_id + '\')">Deactivate</button>'
            }
            \${!user.admin ? '<button class="btn btn-sm btn-primary" onclick="makeAdmin(\'' + user.user_id + '\')">Make Admin</button>' : ''}
          </td>
        \`;
        tbody.appendChild(tr);
      });

      const totalPages = Math.ceil(data.total / 50);
      document.getElementById('usersPagination').innerHTML = pagination(page, totalPages, 'loadUsers');

      document.getElementById('usersLoading').style.display = 'none';
      document.getElementById('usersTable').style.display = 'table';
    } catch (err) {
      console.error('Failed to load users:', err);
      document.getElementById('usersLoading').innerHTML = 'Failed to load users';
    }
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
      await api.post('/users', { username, password, display_name: displayName, admin: isAdmin });
      hideModal('createUserModal');
      loadUsers();
    } catch (err) {
      showError('createUserError', err.message || 'Failed to create user');
    }
  }

  async function resetUserPassword(userId) {
    const newPassword = prompt('Enter new password for ' + userId);
    if (!newPassword) return;

    try {
      await api.post('/users/' + encodeURIComponent(userId) + '/reset-password', { password: newPassword });
      alert('Password reset successfully');
    } catch (err) {
      alert('Failed to reset password');
    }
  }

  async function deactivateUser(userId) {
    confirmAction('Deactivate User', 'Deactivate user ' + userId + '?', async () => {
      try {
        await api.delete('/users/' + encodeURIComponent(userId));
        loadUsers();
      } catch (err) {
        alert('Failed to deactivate user');
      }
    });
  }

  async function reactivateUser(userId) {
    try {
      await api.post('/users/' + encodeURIComponent(userId) + '/reactivate', {});
      loadUsers();
    } catch (err) {
      alert('Failed to reactivate user');
    }
  }

  async function makeAdmin(userId) {
    confirmAction('Make Admin', 'Make ' + userId + ' an admin?', async () => {
      try {
        await api.post('/make-admin', { user_id: userId });
        loadUsers();
      } catch (err) {
        alert('Failed to make admin');
      }
    });
  }
`;

// Room management functions
export const roomFunctions = (): string => `
  async function loadRooms(page = 0, search = '') {
    document.getElementById('roomsLoading').style.display = 'block';
    document.getElementById('roomsTable').style.display = 'none';
    document.getElementById('noRooms').style.display = 'none';

    try {
      let url = \`/rooms?limit=50&offset=\${page * 50}\`;
      if (search) url += \`&search=\${encodeURIComponent(search)}\`;
      
      const data = await api.get(url);
      currentRooms = data.items || [];
      
      if (currentRooms.length === 0) {
        document.getElementById('roomsLoading').style.display = 'none';
        document.getElementById('noRooms').style.display = 'block';
        return;
      }

      const tbody = document.getElementById('roomsList');
      tbody.innerHTML = '';

      currentRooms.forEach(room => {
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td>\${room.room_id}</td>
          <td>\${room.name || '-'}</td>
          <td>\${room.member_count || 0}</td>
          <td>\${room.room_version || '10'}</td>
          <td>\${room.is_public ? '✅' : '❌'}</td>
          <td class="action-buttons">
            <button class="btn btn-sm btn-secondary" onclick="viewRoom('\${room.room_id}')">View</button>
            <button class="btn btn-sm btn-danger" onclick="deleteRoom('\${room.room_id}')">Delete</button>
          </td>
        \`;
        tbody.appendChild(tr);
      });

      const totalPages = Math.ceil(data.total / 50);
      document.getElementById('roomsPagination').innerHTML = pagination(page, totalPages, 'loadRooms');

      document.getElementById('roomsLoading').style.display = 'none';
      document.getElementById('roomsTable').style.display = 'table';
    } catch (err) {
      console.error('Failed to load rooms:', err);
      document.getElementById('roomsLoading').innerHTML = 'Failed to load rooms';
    }
  }

  async function createRoom() {
    const name = document.getElementById('newRoomName').value;
    const alias = document.getElementById('newRoomAlias').value;
    const preset = document.getElementById('newRoomPreset').value;

    try {
      const data = {
        name: name || undefined,
        preset,
        room_alias_local_part: alias || undefined,
      };

      const result = await api.post('/rooms/create', data);
      hideModal('createRoomModal');
      loadRooms();
      alert('Room created: ' + result.room_id);
    } catch (err) {
      showError('createRoomError', err.message || 'Failed to create room');
    }
  }

  async function deleteRoom(roomId) {
    confirmAction('Delete Room', 'Delete room ' + roomId + '? This cannot be undone.', async () => {
      try {
        await api.delete('/rooms/' + encodeURIComponent(roomId));
        loadRooms();
      } catch (err) {
        alert('Failed to delete room');
      }
    });
  }
`;

// Media management functions
export const mediaFunctions = (): string => `
  async function loadMedia(page = 0) {
    document.getElementById('mediaLoading').style.display = 'block';
    document.getElementById('mediaTable').style.display = 'none';
    document.getElementById('noMedia').style.display = 'none';

    try {
      const data = await api.get('/media?limit=50&offset=' + (page * 50));
      
      const stats = await api.get('/media/stats');
      document.getElementById('totalFiles').textContent = stats.total_files || 0;
      document.getElementById('totalSize').textContent = formatBytes(stats.total_bytes || 0);
      document.getElementById('quarantined').textContent = stats.quarantined_count || 0;

      if (data.items.length === 0) {
        document.getElementById('mediaLoading').style.display = 'none';
        document.getElementById('noMedia').style.display = 'block';
        return;
      }

      const tbody = document.getElementById('mediaList');
      tbody.innerHTML = '';

      data.items.forEach(media => {
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td>\${media.media_id.substring(0, 8)}...</td>
          <td>\${media.user_id}</td>
          <td>\${media.content_type}</td>
          <td>\${formatBytes(media.content_length)}</td>
          <td>\${new Date(media.created_at).toLocaleDateString()}</td>
          <td><span class="badge \${media.quarantined ? 'deactivated' : 'online'}">\${media.quarantined ? 'Quarantined' : 'Normal'}</span></td>
          <td class="action-buttons">
            \${media.quarantined ? 
              '<button class="btn btn-sm btn-success" onclick="unquarantineMedia(\'' + media.media_id + '\')">Release</button>' : 
              '<button class="btn btn-sm btn-warning" onclick="quarantineMedia(\'' + media.media_id + '\')">Quarantine</button>'
            }
            <button class="btn btn-sm btn-danger" onclick="deleteMedia('\${media.media_id}')">Delete</button>
          </td>
        \`;
        tbody.appendChild(tr);
      });

      document.getElementById('mediaLoading').style.display = 'none';
      document.getElementById('mediaTable').style.display = 'table';
    } catch (err) {
      console.error('Failed to load media:', err);
      document.getElementById('mediaLoading').innerHTML = 'Failed to load media';
    }
  }

  async function quarantineMedia(mediaId) {
    try {
      await api.post('/media/' + mediaId + '/quarantine', {});
      loadMedia(currentPage.media);
    } catch (err) {
      alert('Failed to quarantine media');
    }
  }

  async function unquarantineMedia(mediaId) {
    try {
      await api.post('/media/' + mediaId + '/unquarantine', {});
      loadMedia(currentPage.media);
    } catch (err) {
      alert('Failed to release media');
    }
  }

  async function deleteMedia(mediaId) {
    confirmAction('Delete Media', 'Delete media ' + mediaId + '?', async () => {
      try {
        await api.delete('/media/' + mediaId);
        loadMedia(currentPage.media);
      } catch (err) {
        alert('Failed to delete media');
      }
    });
  }

  // SSO/IdP Management
  let currentIdps = [];

  async function loadSso() {
    document.getElementById('ssoLoading').style.display = 'block';
    document.getElementById('ssoTable').style.display = 'none';
    document.getElementById('noSso').style.display = 'none';

    try {
      const data = await api.get('/idp/providers');
      currentIdps = data.providers || [];
      
      if (currentIdps.length === 0) {
        document.getElementById('ssoLoading').style.display = 'none';
        document.getElementById('noSso').style.display = 'block';
        return;
      }

      const tbody = document.getElementById('ssoTableBody');
      tbody.innerHTML = '';
      
      currentIdps.forEach(idp => {
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td>\${idp.name}</td>
          <td>\${idp.issuer_url}</td>
          <td>\${idp.enabled ? '<span class="badge badge-success">Enabled</span>' : '<span class="badge badge-secondary">Disabled</span>'}</td>
          <td>\${idp.auto_create_users ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-warning">No</span>'}</td>
          <td>\${idp.user_count || 0}</td>
          <td>
            <button class="btn btn-sm btn-primary" onclick="editIdp('\${idp.id}')">Edit</button>
            <button class="btn btn-sm btn-info" onclick="testIdp('\${idp.id}')">Test</button>
            <button class="btn btn-sm btn-danger" onclick="deleteIdp('\${idp.id}')">Delete</button>
          </td>
        \`;
        tbody.appendChild(tr);
      });

      document.getElementById('ssoLoading').style.display = 'none';
      document.getElementById('ssoTable').style.display = 'table';
    } catch (err) {
      console.error('Failed to load SSO providers:', err);
      document.getElementById('ssoLoading').innerHTML = 'Failed to load SSO providers';
    }
  }

  async function saveIdp(idpData, isNew) {
    try {
      if (isNew) {
        await api.post('/idp/providers', idpData);
      } else {
        await api.put('/idp/providers/' + idpData.id, idpData);
      }
      hideModal('idpModal');
      loadSso();
    } catch (err) {
      alert('Failed to save SSO provider: ' + (err.message || 'Unknown error'));
    }
  }

  async function editIdp(id) {
    const idp = currentIdps.find(i => i.id === id);
    if (!idp) return;
    
    document.getElementById('idpModalTitle').textContent = 'Edit SSO Provider';
    document.getElementById('idpId').value = idp.id;
    document.getElementById('idpName').value = idp.name;
    document.getElementById('idpIssuer').value = idp.issuer_url;
    document.getElementById('idpClientId').value = idp.client_id;
    document.getElementById('idpClientSecret').value = '';
    document.getElementById('idpScopes').value = idp.scopes || 'openid profile email';
    document.getElementById('idpUsernameClaim').value = idp.username_claim || 'email';
    document.getElementById('idpAutoCreate').checked = idp.auto_create_users === 1;
    document.getElementById('idpEnabled').checked = idp.enabled === 1;
    document.getElementById('idpIconUrl').value = idp.icon_url || '';
    showModal('idpModal');
  }

  async function deleteIdp(id) {
    confirmAction('Delete SSO Provider', 'Are you sure you want to delete this SSO provider?', async () => {
      try {
        await api.delete('/idp/providers/' + id);
        loadSso();
      } catch (err) {
        alert('Failed to delete SSO provider');
      }
    });
  }

  async function testIdp(id) {
    const btn = event.target;
    btn.disabled = true;
    btn.textContent = 'Testing...';
    
    try {
      const result = await api.post('/idp/providers/' + id + '/test', {});
      alert('Connection successful! Provider is reachable.');
    } catch (err) {
      alert('Connection failed: ' + (err.message || 'Unknown error'));
    } finally {
      btn.disabled = false;
      btn.textContent = 'Test';
    }
  }

  function showAddIdpModal() {
    document.getElementById('idpModalTitle').textContent = 'Add SSO Provider';
    document.getElementById('idpForm').reset();
    document.getElementById('idpId').value = '';
    document.getElementById('idpAutoCreate').checked = true;
    document.getElementById('idpEnabled').checked = true;
    showModal('idpModal');
  }

  function submitIdpForm() {
    const idpData = {
      name: document.getElementById('idpName').value,
      issuer_url: document.getElementById('idpIssuer').value,
      client_id: document.getElementById('idpClientId').value,
      client_secret: document.getElementById('idpClientSecret').value,
      scopes: document.getElementById('idpScopes').value,
      username_claim: document.getElementById('idpUsernameClaim').value,
      auto_create_users: document.getElementById('idpAutoCreate').checked,
      enabled: document.getElementById('idpEnabled').checked,
      icon_url: document.getElementById('idpIconUrl').value || undefined
    };

    if (!idpData.name || !idpData.issuer_url || !idpData.client_id) {
      alert('Please fill in all required fields');
      return;
    }

    const id = document.getElementById('idpId').value;
    saveIdp(idpData, !id);
  }
`;