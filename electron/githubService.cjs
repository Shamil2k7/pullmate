const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';
const GITHUB_ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_API_BASE = 'https://api.github.com';

class GitHubService {
  constructor(clientId = null) {
    this.clientId = clientId || process.env.GITHUB_CLIENT_ID || '';
    this.abortController = null;
  }

  setClientId(clientId) {
    if (clientId) {
      this.clientId = clientId.trim();
    }
  }

  getClientId() {
    return this.clientId;
  }

  /**
   * Initiates GitHub Device Authorization flow
   * @param {string} scope 
   * @returns {Promise<{device_code: string, user_code: string, verification_uri: string, expires_in: number, interval: number}>}
   */
  async requestDeviceCode(scope = 'repo,read:user') {
    if (!this.clientId) {
      throw new Error('GitHub Client ID is not configured. Please set GITHUB_CLIENT_ID or provide it in Settings.');
    }

    const response = await fetch(GITHUB_DEVICE_CODE_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'PullMate-App'
      },
      body: JSON.stringify({
        client_id: this.clientId,
        scope: scope
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Device code request failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`GitHub authorization error: ${data.error_description || data.error}`);
    }

    return {
      device_code: data.device_code,
      user_code: data.user_code,
      verification_uri: data.verification_uri || 'https://github.com/login/device',
      expires_in: data.expires_in || 900,
      interval: data.interval || 5
    };
  }

  /**
   * Cancels any pending poll
   */
  cancelPolling() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Polls GitHub until user authorizes or device code expires
   * @param {string} deviceCode 
   * @param {number} intervalSeconds 
   * @param {number} expiresInSeconds 
   * @param {Function} onProgress 
   * @returns {Promise<string>} access_token
   */
  async pollForToken(deviceCode, intervalSeconds = 5, expiresInSeconds = 900, onProgress = null) {
    this.cancelPolling();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    let pollInterval = (intervalSeconds || 5) * 1000;
    const expiresAt = Date.now() + (expiresInSeconds * 1000);

    while (Date.now() < expiresAt) {
      if (signal.aborted) {
        throw new Error('Authorization was cancelled.');
      }

      // Wait interval
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, pollInterval);
        signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new Error('Authorization was cancelled.'));
        }, { once: true });
      });

      if (signal.aborted) {
        throw new Error('Authorization was cancelled.');
      }

      if (onProgress) {
        onProgress({ status: 'checking', remainingSeconds: Math.round((expiresAt - Date.now()) / 1000) });
      }

      try {
        const response = await fetch(GITHUB_ACCESS_TOKEN_URL, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'PullMate-App'
          },
          body: JSON.stringify({
            client_id: this.clientId,
            device_code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
          }),
          signal
        });

        if (!response.ok) {
          throw new Error(`Token poll request failed (${response.status})`);
        }

        const data = await response.json();

        if (data.access_token) {
          return data.access_token;
        }

        if (data.error) {
          if (data.error === 'authorization_pending') {
            // Keep waiting
            continue;
          } else if (data.error === 'slow_down') {
            pollInterval += 5000;
            continue;
          } else if (data.error === 'expired_token') {
            throw new Error('Verification code expired. Please request a new code.');
          } else if (data.error === 'access_denied') {
            throw new Error('Authorization was denied by the user on GitHub.');
          } else {
            throw new Error(`GitHub error: ${data.error_description || data.error}`);
          }
        }
      } catch (err) {
        if (err.name === 'AbortError' || signal.aborted) {
          throw new Error('Authorization was cancelled.');
        }
        // Transient network error, retry next interval
        console.warn('[GitHubService] Transient polling error, will retry:', err.message);
      }
    }

    throw new Error('Authorization timed out. Please try again.');
  }

  /**
   * Fetches authenticated user profile
   * @param {string} token 
   * @returns {Promise<object>}
   */
  async getUserProfile(token) {
    if (!token) throw new Error('Authentication token required');

    const res = await fetch(`${GITHUB_API_BASE}/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'PullMate-App'
      }
    });

    if (res.status === 401) {
      throw new Error('GitHub session expired. Please re-authenticate.');
    }

    if (!res.ok) {
      throw new Error(`Failed to load GitHub user profile (${res.status})`);
    }

    const data = await res.json();
    return {
      id: data.id,
      login: data.login,
      name: data.name || data.login,
      avatar_url: data.avatar_url,
      html_url: data.html_url,
      email: data.email || null,
      public_repos: data.public_repos,
      total_private_repos: data.total_private_repos || 0
    };
  }

  /**
   * Fetches accessible user repositories
   * @param {string} token 
   * @param {number} page 
   * @param {number} perPage 
   * @returns {Promise<{repositories: Array<object>, hasNextPage: boolean}>}
   */
  async getUserRepositories(token, page = 1, perPage = 50) {
    if (!token) throw new Error('Authentication token required');

    const url = new URL(`${GITHUB_API_BASE}/user/repos`);
    url.searchParams.set('page', page.toString());
    url.searchParams.set('per_page', perPage.toString());
    url.searchParams.set('sort', 'updated');
    url.searchParams.set('direction', 'desc');
    url.searchParams.set('affiliation', 'owner,collaborator,organization_member');

    const res = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'PullMate-App'
      }
    });

    if (res.status === 401) {
      throw new Error('GitHub session expired. Please re-authenticate.');
    }

    if (!res.ok) {
      throw new Error(`Failed to fetch repositories (${res.status})`);
    }

    const linkHeader = res.headers.get('link') || '';
    const hasNextPage = linkHeader.includes('rel="next"');

    const data = await res.json();
    const repos = data.map(r => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      owner: r.owner ? r.owner.login : '',
      isPrivate: Boolean(r.private),
      defaultBranch: r.default_branch || 'main',
      htmlUrl: r.html_url,
      cloneUrl: r.clone_url,
      sshUrl: r.ssh_url,
      description: r.description || '',
      updatedAt: r.updated_at,
      pushedAt: r.pushed_at,
      stargazersCount: r.stargazers_count,
      fork: r.fork
    }));

    return {
      repositories: repos,
      hasNextPage
    };
  }
}

module.exports = GitHubService;
