// Modal components

export const createUserModal = (): string => `
  <div id="createUserModal" class="modal">
    <div class="modal-content">
      <h2>Create User</h2>
      <div id="createUserError" class="error-message" style="display: none;"></div>
      <div class="form-group">
        <label>Username</label>
        <input type="text" id="newUsername" placeholder="username" required>
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="newPassword" placeholder="password" required>
      </div>
      <div class="form-group">
        <label>Display Name</label>
        <input type="text" id="newDisplayName" placeholder="display name (optional)">
      </div>
      <div class="form-group checkbox">
        <input type="checkbox" id="newIsAdmin">
        <label>Make admin</label>
      </div>
      <div class="modal-buttons">
        <button class="btn btn-secondary" onclick="hideModal('createUserModal')">Cancel</button>
        <button class="btn btn-primary" onclick="createUser()">Create</button>
      </div>
    </div>
  </div>
`;

export const createRoomModal = (): string => `
  <div id="createRoomModal" class="modal">
    <div class="modal-content">
      <h2>Create Room</h2>
      <div id="createRoomError" class="error-message" style="display: none;"></div>
      <div class="form-group">
        <label>Room Name (optional)</label>
        <input type="text" id="newRoomName" placeholder="Room name">
      </div>
      <div class="form-group">
        <label>Room Alias (optional)</label>
        <input type="text" id="newRoomAlias" placeholder="room">
      </div>
      <div class="form-group">
        <label>Room Type</label>
        <select id="newRoomPreset">
          <option value="private_chat">Private Chat</option>
          <option value="public_chat">Public Chat</option>
          <option value="trusted_private_chat">Trusted Private Chat</option>
        </select>
      </div>
      <div class="modal-buttons">
        <button class="btn btn-secondary" onclick="hideModal('createRoomModal')">Cancel</button>
        <button class="btn btn-primary" onclick="createRoom()">Create</button>
      </div>
    </div>
  </div>
`;

export const userDetailsModal = (): string => `
  <div id="userDetailsModal" class="modal">
    <div class="modal-content">
      <h2>User Details</h2>
      <div id="userDetailsContent"></div>
      <div class="modal-buttons">
        <button class="btn btn-secondary" onclick="hideModal('userDetailsModal')">Close</button>
      </div>
    </div>
  </div>
`;

export const roomDetailsModal = (): string => `
  <div id="roomDetailsModal" class="modal">
    <div class="modal-content">
      <h2>Room Details</h2>
      <div id="roomDetailsContent"></div>
      <div class="modal-buttons">
        <button class="btn btn-secondary" onclick="hideModal('roomDetailsModal')">Close</button>
      </div>
    </div>
  </div>
`;

export const confirmModal = (): string => `
  <div id="confirmModal" class="modal">
    <div class="modal-content">
      <h2 id="confirmTitle">Confirm</h2>
      <p id="confirmMessage"></p>
      <div class="modal-buttons">
        <button class="btn btn-secondary" onclick="hideModal('confirmModal')">Cancel</button>
        <button class="btn btn-danger" id="confirmAction">Confirm</button>
      </div>
    </div>
  </div>
`;

export const allModals = (): string => `
  ${createUserModal()}
  ${createRoomModal()}
  ${userDetailsModal()}
  ${roomDetailsModal()}
  ${confirmModal()}
`;