// Table rendering utilities

export const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString();
};

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const userTableRow = (user: any, onView: string, onResetPassword: string, onDeactivate: string, onMakeAdmin: string): string => {
  const isAdmin = user.admin === 1 || user.admin === true;
  const isDeactivated = user.is_deactivated === 1 || user.is_deactivated === true;
  
  return `
    <tr>
      <td>${user.user_id}</td>
      <td>${user.display_name || '-'}</td>
      <td><span class="badge ${isAdmin ? 'admin' : ''} ${isDeactivated ? 'deactivated' : ''}">
        ${isAdmin ? 'Admin' : isDeactivated ? 'Deactivated' : 'User'}
      </span></td>
      <td>${formatDate(user.created_at)}</td>
      <td class="action-buttons">
        <button class="btn btn-sm btn-secondary" onclick="${onView}">View</button>
        <button class="btn btn-sm btn-warning" onclick="${onResetPassword}">Reset Password</button>
        ${isDeactivated 
          ? `<button class="btn btn-sm btn-success" onclick="reactivateUser('${user.user_id}')">Reactivate</button>`
          : `<button class="btn btn-sm btn-danger" onclick="${onDeactivate}">Deactivate</button>`
        }
        ${!isAdmin ? `<button class="btn btn-sm btn-primary" onclick="${onMakeAdmin}">Make Admin</button>` : ''}
      </td>
    </tr>
  `;
};

export const roomTableRow = (room: any, onView: string, onDelete: string): string => `
  <tr>
    <td>${room.room_id}</td>
    <td>${room.name || '-'}</td>
    <td>${room.member_count || 0}</td>
    <td>${room.room_version || '10'}</td>
    <td>${room.is_public ? '✅' : '❌'}</td>
    <td class="action-buttons">
      <button class="btn btn-sm btn-secondary" onclick="${onView}">View</button>
      <button class="btn btn-sm btn-danger" onclick="${onDelete}">Delete</button>
    </td>
  </tr>
`;

export const mediaTableRow = (media: any, onQuarantine: string, onUnquarantine: string, onDelete: string): string => `
  <tr>
    <td>${media.media_id.substring(0, 8)}...</td>
    <td>${media.user_id}</td>
    <td>${media.content_type}</td>
    <td>${formatBytes(media.content_length)}</td>
    <td>${formatDate(media.created_at)}</td>
    <td><span class="badge ${media.quarantined ? 'deactivated' : 'online'}">
      ${media.quarantined ? 'Quarantined' : 'Normal'}
    </span></td>
    <td class="action-buttons">
      ${media.quarantined 
        ? `<button class="btn btn-sm btn-success" onclick="${onUnquarantine}">Release</button>`
        : `<button class="btn btn-sm btn-warning" onclick="${onQuarantine}">Quarantine</button>`
      }
      <button class="btn btn-sm btn-danger" onclick="${onDelete}">Delete</button>
    </td>
  </tr>
`;

export const reportTableRow = (report: any, onResolve: string, onUnresolve: string): string => `
  <tr>
    <td>${report.id}</td>
    <td>${report.reporter_user_id}</td>
    <td>${report.room_id ? report.room_id.substring(0, 16) + '...' : '-'}</td>
    <td>${report.reason}</td>
    <td>${report.score}</td>
    <td><span class="badge ${report.resolved ? 'online' : 'unresolved'}">
      ${report.resolved ? 'Resolved' : 'Unresolved'}
    </span></td>
    <td class="action-buttons">
      ${!report.resolved 
        ? `<button class="btn btn-sm btn-success" onclick="${onResolve}">Resolve</button>`
        : `<button class="btn btn-sm btn-warning" onclick="${onUnresolve}">Unresolve</button>`
      }
    </td>
  </tr>
`;

export const pagination = (currentPage: number, totalPages: number, onPageChange: string): string => {
  if (totalPages <= 1) return '';

  let html = '<div class="pagination">';
  
  if (currentPage > 0) {
    html += `<button onclick="${onPageChange}(${currentPage - 1})">Previous</button>`;
  }

  for (let i = Math.max(0, currentPage - 2); i <= Math.min(totalPages - 1, currentPage + 2); i++) {
    html += `<button class="${i === currentPage ? 'active' : ''}" onclick="${onPageChange}(${i})">${i + 1}</button>`;
  }

  if (currentPage < totalPages - 1) {
    html += `<button onclick="${onPageChange}(${currentPage + 1})">Next</button>`;
  }

  html += '</div>';
  return html;
};