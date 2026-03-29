// SSO/IdP Management View

export const ssoView = (serverName?: string): string => `
  <div id="ssoView" class="view" style="display: none;">
    <div class="header">
      <h2>SSO / Identity Providers</h2>
      <div class="header-actions">
        <button class="btn btn-primary" onclick="loadSso()">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6"></path>
            <path d="M1 20v-6h6"></path>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          Refresh
        </button>
        <button class="btn btn-primary" onclick="showAddIdpModal()">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Add Identity Provider
        </button>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Configured Identity Providers</h3>
      </div>
      <div class="card-body">
        <div id="ssoLoading" class="loading">
          <div class="spinner"></div>
          Loading SSO providers...
        </div>
        <div id="noSso" style="display: none;">
          <p>No identity providers configured.</p>
          <p>Add an identity provider to enable SSO login for your users.</p>
          <button class="btn btn-primary" onclick="showAddIdpModal()">Add Your First Provider</button>
        </div>
        <table id="ssoTable" style="display: none;">
          <thead>
            <tr>
              <th>Name</th>
              <th>Issuer URL</th>
              <th>Status</th>
              <th>Auto-create Users</th>
              <th>Linked Users</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="ssoTableBody">
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" style="margin-top: 20px;">
      <div class="card-header">
        <h3>About SSO</h3>
      </div>
      <div class="card-body">
        <p>Single Sign-On (SSO) allows users to authenticate using external identity providers like Google, Microsoft, Okta, or any OIDC-compliant service.</p>
        
        <h4>Supported Providers</h4>
        <ul>
          <li><strong>Google</strong> - accounts.google.com</li>
          <li><strong>Microsoft Azure AD</strong> - login.microsoftonline.com</li>
          <li><strong>Okta</strong> - your-domain.okta.com</li>
          <li><strong>Auth0</strong> - your-domain.auth0.com</li>
          <li><strong>Keycloak</strong> - Self-hosted</li>
          <li><strong>LemonLDAP::NG</strong> - Open source</li>
        </ul>

        <h4>Configuration Steps</h4>
        <ol>
          <li>Register an OAuth/OIDC application in your identity provider</li>
          <li>Set the redirect URI to: <code id="ssoRedirectUri">https://${serverName || 'your-server'}/auth/oidc/{providerId}/callback</code></li>
          <li>Get the client ID and client secret</li>
          <li>Add the provider using the form above</li>
        </ol>

        <h4>Matrix Client Support</h4>
        <p>Element Web and other Matrix clients will automatically detect SSO when configured. Users will see an "SSO" button on the login page.</p>
      </div>
    </div>
  </div>

  <!-- IdP Modal -->
  <div id="idpModal" class="modal">
    <div class="modal-content">
      <div class="modal-header">
        <h3 id="idpModalTitle">Add SSO Provider</h3>
        <span class="modal-close" onclick="hideModal('idpModal')">&times;</span>
      </div>
      <div class="modal-body">
        <form id="idpForm" onsubmit="event.preventDefault(); submitIdpForm();">
          <input type="hidden" id="idpId">
          
          <div class="form-group">
            <label for="idpName">Provider Name *</label>
            <input type="text" id="idpName" placeholder="e.g., Google, Okta" required>
          </div>

          <div class="form-group">
            <label for="idpIssuer">Issuer URL *</label>
            <input type="url" id="idpIssuer" placeholder="https://accounts.google.com" required>
            <small>The OIDC issuer URL from your identity provider</small>
          </div>

          <div class="form-group">
            <label for="idpClientId">Client ID *</label>
            <input type="text" id="idpClientId" required>
          </div>

          <div class="form-group">
            <label for="idpClientSecret">Client Secret</label>
            <input type="password" id="idpClientSecret" placeholder="Leave blank to keep existing">
            <small>Required for new providers. Leave blank when editing to keep current secret.</small>
          </div>

          <div class="form-group">
            <label for="idpScopes">Scopes</label>
            <input type="text" id="idpScopes" value="openid profile email">
          </div>

          <div class="form-group">
            <label for="idpUsernameClaim">Username Claim</label>
            <select id="idpUsernameClaim">
              <option value="email">Email (part before @)</option>
              <option value="preferred_username">Preferred Username</option>
              <option value="sub">Subject ID</option>
            </select>
          </div>

          <div class="form-group">
            <label for="idpIconUrl">Icon URL (optional)</label>
            <input type="url" id="idpIconUrl" placeholder="e.g., https://example.com/logo.png">
          </div>

          <div class="form-group">
            <label>
              <input type="checkbox" id="idpAutoCreate" checked>
              Auto-create users
            </label>
            <small>Create a Matrix account automatically when a new user logs in via this IdP</small>
          </div>

          <div class="form-group">
            <label>
              <input type="checkbox" id="idpEnabled" checked>
              Enabled
            </label>
          </div>

          <div class="form-actions">
            <button type="button" class="btn btn-secondary" onclick="hideModal('idpModal')">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Provider</button>
          </div>
        </form>
      </div>
    </div>
  </div>
`;
