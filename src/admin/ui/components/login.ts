// Login component

export const loginComponent = (isAuthenticated: boolean): string => `
  <div id="loginContainer" class="login-container" style="display: ${isAuthenticated ? 'none' : 'flex'}">
    <div class="login-box">
      <div class="logo">🔐</div>
      <h1>Admin Login</h1>
      <div id="loginError" class="error-message" style="display: none;"></div>
      <form id="loginForm" onsubmit="handleLogin(event)">
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" required autofocus autocomplete="current-password">
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%;">Login</button>
      </form>
    </div>
  </div>
`;

export const loginStyles = `
  .login-container {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 20px;
  }
  .login-box {
    background: var(--bg-surface);
    border-radius: 16px;
    padding: 40px;
    width: 100%;
    max-width: 400px;
    border: 1px solid var(--border-default);
    box-shadow: var(--shadow-lg);
  }
  .login-box .logo {
    text-align: center;
    font-size: 48px;
    margin-bottom: 20px;
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
`;