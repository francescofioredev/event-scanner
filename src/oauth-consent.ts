/**
 * OAuth consent page served at /oauth/consent.
 * Handles login + authorization approval/denial entirely client-side
 * using the Supabase JS SDK loaded from CDN.
 */

export function getConsentPageHtml(projectId: string, anonKey: string): string {
  const supabaseUrl = `https://${projectId}.supabase.co`;

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Authorize Application</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #f9fafb; --card-bg: #ffffff; --text: #111827; --text-muted: #6b7280;
      --border: #e5e7eb; --primary: #2563eb; --primary-hover: #1d4ed8;
      --danger: #dc2626; --danger-hover: #b91c1c; --danger-bg: #fef2f2;
      --info-bg: #f0f9ff; --info-border: #bae6fd; --info-text: #0c4a6e;
      --input-bg: #ffffff; --input-border: #d1d5db;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0f172a; --card-bg: #1e293b; --text: #f1f5f9; --text-muted: #94a3b8;
        --border: #334155; --primary: #3b82f6; --primary-hover: #2563eb;
        --danger: #ef4444; --danger-hover: #dc2626; --danger-bg: #1c1917;
        --info-bg: #0c4a6e20; --info-border: #0c4a6e; --info-text: #bae6fd;
        --input-bg: #0f172a; --input-border: #475569;
      }
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg); color: var(--text);
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      padding: 1rem;
    }

    .card {
      background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px;
      padding: 2rem; width: 100%; max-width: 420px; box-shadow: 0 1px 3px rgba(0,0,0,.1);
    }

    h1 { font-size: 1.5rem; font-weight: 600; text-align: center; margin-bottom: .5rem; }
    .subtitle { color: var(--text-muted); text-align: center; font-size: .9rem; margin-bottom: 1.5rem; }

    .field { margin-bottom: 1rem; }
    label { display: block; font-size: .85rem; font-weight: 500; margin-bottom: .35rem; }
    input[type="email"], input[type="password"] {
      width: 100%; padding: .6rem .75rem; border: 1px solid var(--input-border);
      border-radius: 8px; font-size: .95rem; background: var(--input-bg); color: var(--text);
      outline: none; transition: border-color .15s;
    }
    input:focus { border-color: var(--primary); }

    .btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 100%; padding: .65rem 1rem; border: none; border-radius: 8px;
      font-size: .95rem; font-weight: 500; cursor: pointer; transition: background .15s;
    }
    .btn:disabled { opacity: .6; cursor: not-allowed; }
    .btn-primary { background: var(--primary); color: #fff; }
    .btn-primary:hover:not(:disabled) { background: var(--primary-hover); }
    .btn-outline {
      background: transparent; color: var(--text); border: 1px solid var(--border);
    }
    .btn-outline:hover:not(:disabled) { background: var(--border); }
    .btn-danger { background: var(--danger); color: #fff; }
    .btn-danger:hover:not(:disabled) { background: var(--danger-hover); }

    .btn-row { display: flex; gap: .75rem; margin-top: 1.5rem; }
    .btn-row .btn { flex: 1; }

    .info-box {
      background: var(--info-bg); border: 1px solid var(--info-border); border-radius: 8px;
      padding: .85rem 1rem; margin-bottom: 1rem;
    }
    .info-box .label { font-size: .75rem; font-weight: 600; color: var(--info-text); text-transform: uppercase; letter-spacing: .03em; margin-bottom: .25rem; }
    .info-box .value { font-size: .9rem; color: var(--text); word-break: break-all; }

    .error-box {
      background: var(--danger-bg); border: 1px solid var(--danger); border-radius: 8px;
      padding: 1rem; text-align: center; color: var(--danger);
    }
    .error-box .icon { font-size: 1.5rem; margin-bottom: .5rem; }
    .error-box p { font-size: .9rem; }

    .toggle-link {
      display: block; text-align: center; margin-top: 1rem; font-size: .85rem;
      color: var(--primary); cursor: pointer; background: none; border: none; font-family: inherit;
    }
    .toggle-link:hover { text-decoration: underline; }

    .security-note {
      font-size: .75rem; color: var(--text-muted); text-align: center; margin-top: 1rem;
      line-height: 1.4;
    }

    .spinner {
      width: 20px; height: 20px; border: 2px solid rgba(255,255,255,.3);
      border-top-color: #fff; border-radius: 50%; animation: spin .6s linear infinite;
      display: inline-block; margin-right: .5rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    [hidden] { display: none !important; }
  </style>
</head>
<body>
  <div class="card">
    <!-- Loading state -->
    <div id="state-loading">
      <h1>Loading&hellip;</h1>
      <p class="subtitle">Checking authorization request</p>
    </div>

    <!-- Error state -->
    <div id="state-error" hidden>
      <div class="error-box">
        <div class="icon">&#9888;</div>
        <p id="error-message">An error occurred.</p>
      </div>
    </div>

    <!-- Login state -->
    <div id="state-login" hidden>
      <h1 id="login-title">Sign In</h1>
      <p class="subtitle" id="login-subtitle">Sign in to authorize this application</p>
      <form id="login-form">
        <div class="field">
          <label for="email">Email</label>
          <input type="email" id="email" required autocomplete="email" placeholder="you@example.com" />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input type="password" id="password" required autocomplete="current-password" placeholder="Your password" />
        </div>
        <div id="login-error" style="color:var(--danger);font-size:.85rem;margin-bottom:.75rem;" hidden></div>
        <button type="submit" class="btn btn-primary" id="login-btn">Sign In</button>
      </form>
      <button class="toggle-link" id="toggle-mode">Don&rsquo;t have an account? Sign Up</button>
    </div>

    <!-- Consent state -->
    <div id="state-consent" hidden>
      <h1>Authorize Application</h1>
      <p class="subtitle">This application is requesting access to your account</p>

      <div id="consent-details"></div>

      <div class="security-note">
        &#128274; Only approve if you trust this application. You can revoke access at any time.
      </div>

      <div class="btn-row">
        <button class="btn btn-primary" id="approve-btn">Approve</button>
        <button class="btn btn-outline" id="deny-btn">Deny</button>
      </div>
    </div>
  </div>

  <script type="module">
    import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

    const supabase = createClient("${supabaseUrl}", "${anonKey}");
    const params = new URLSearchParams(window.location.search);
    const authorizationId = params.get("authorization_id");

    // DOM refs
    const stateLoading = document.getElementById("state-loading");
    const stateError   = document.getElementById("state-error");
    const stateLogin   = document.getElementById("state-login");
    const stateConsent = document.getElementById("state-consent");
    const errorMessage = document.getElementById("error-message");

    function showState(id) {
      [stateLoading, stateError, stateLogin, stateConsent].forEach(el => el.hidden = true);
      id.hidden = false;
    }

    function showError(msg) {
      errorMessage.textContent = msg;
      showState(stateError);
    }

    // ── Boot ──────────────────────────────────────────────────────
    if (!authorizationId) {
      showError("Missing authorization_id parameter. This page requires a valid authorization request.");
    } else {
      init();
    }

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await loadConsent();
      } else {
        showState(stateLogin);
      }
    }

    // ── Login / Sign-up ──────────────────────────────────────────
    let isSignUp = false;
    const loginForm    = document.getElementById("login-form");
    const loginBtn     = document.getElementById("login-btn");
    const loginError   = document.getElementById("login-error");
    const toggleMode   = document.getElementById("toggle-mode");
    const loginTitle   = document.getElementById("login-title");
    const loginSubtitle = document.getElementById("login-subtitle");

    toggleMode.addEventListener("click", () => {
      isSignUp = !isSignUp;
      loginTitle.textContent    = isSignUp ? "Sign Up" : "Sign In";
      loginSubtitle.textContent = isSignUp
        ? "Create an account to authorize this application"
        : "Sign in to authorize this application";
      loginBtn.textContent      = isSignUp ? "Sign Up" : "Sign In";
      toggleMode.textContent    = isSignUp
        ? "Already have an account? Sign In"
        : "Don\\u2019t have an account? Sign Up";
      loginError.hidden = true;
    });

    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      loginError.hidden = true;
      loginBtn.disabled = true;
      loginBtn.innerHTML = '<span class="spinner"></span>' + (isSignUp ? "Signing up\\u2026" : "Signing in\\u2026");

      const email    = document.getElementById("email").value;
      const password = document.getElementById("password").value;

      const { error } = isSignUp
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        loginError.textContent = error.message;
        loginError.hidden = false;
        loginBtn.disabled = false;
        loginBtn.textContent = isSignUp ? "Sign Up" : "Sign In";
        return;
      }

      if (isSignUp) {
        loginError.textContent = "Check your email to confirm your account, then sign in.";
        loginError.style.color = "var(--info-text)";
        loginError.hidden = false;
        loginBtn.disabled = false;
        loginBtn.textContent = "Sign Up";
        return;
      }

      await loadConsent();
    });

    // ── Consent ──────────────────────────────────────────────────
    async function loadConsent() {
      showState(stateLoading);

      const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);

      if (error || !data) {
        showError(error?.message || "Failed to load authorization details.");
        return;
      }

      // If Supabase auto-approved (no consent needed), it returns redirect_to directly
      if ("redirect_to" in data) {
        window.location.href = data.redirect_to;
        return;
      }

      const details = document.getElementById("consent-details");
      details.innerHTML = "";

      if (data.client?.name) {
        details.innerHTML += '<div class="info-box"><div class="label">Application</div><div class="value">' + escapeHtml(data.client.name) + "</div></div>";
      }

      if (data.redirect_url) {
        details.innerHTML += '<div class="info-box"><div class="label">Redirect URI</div><div class="value" style="font-family:monospace;font-size:.8rem;">' + escapeHtml(data.redirect_url) + "</div></div>";
      }

      if (data.scope) {
        details.innerHTML += '<div class="info-box"><div class="label">Requested Permissions</div><div class="value">' + escapeHtml(data.scope) + "</div></div>";
      }

      showState(stateConsent);
    }

    // ── Approve / Deny ───────────────────────────────────────────
    const approveBtn = document.getElementById("approve-btn");
    const denyBtn    = document.getElementById("deny-btn");

    approveBtn.addEventListener("click", async () => {
      approveBtn.disabled = true;
      denyBtn.disabled = true;
      approveBtn.innerHTML = '<span class="spinner"></span>Approving\\u2026';

      const { data, error } = await supabase.auth.oauth.approveAuthorization(authorizationId);

      if (error || !data?.redirect_to) {
        showError(error?.message || "Authorization approval failed.");
        return;
      }

      window.location.href = data.redirect_to;
    });

    denyBtn.addEventListener("click", async () => {
      approveBtn.disabled = true;
      denyBtn.disabled = true;
      denyBtn.innerHTML = '<span class="spinner"></span>Denying\\u2026';

      const { data, error } = await supabase.auth.oauth.denyAuthorization(authorizationId);

      if (error || !data?.redirect_to) {
        showError(error?.message || "Authorization denial failed.");
        return;
      }

      window.location.href = data.redirect_to;
    });

    // ── Util ─────────────────────────────────────────────────────
    function escapeHtml(str) {
      const div = document.createElement("div");
      div.textContent = str;
      return div.innerHTML;
    }
  </script>
</body>
</html>`;
}
