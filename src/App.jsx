import { useEffect, useMemo, useState } from 'react';

const StatusPill = ({ text, tone = 'slate' }) => {
  const toneMap = {
    slate: 'bg-slate-800 text-slate-200',
    emerald: 'bg-emerald-500/20 text-emerald-200',
    sky: 'bg-sky-500/20 text-sky-200',
    rose: 'bg-rose-500/20 text-rose-200',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${toneMap[tone] || toneMap.slate}`}>
      {text}
    </span>
  );
};

const App = () => {
  const [csrfToken, setCsrfToken] = useState('');
  const [session, setSession] = useState({ loading: true, loggedIn: false, username: '' });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [users, setUsers] = useState([]);
  const [guilds, setGuilds] = useState([]);
  const [members, setMembers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState({ guildId: '', userId: '', roleId: '', days: '' });
  const [editTarget, setEditTarget] = useState(null);
  const [status, setStatus] = useState({ type: 'info', message: '' });
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [sortBy, setSortBy] = useState('username');
  const [sortDir, setSortDir] = useState('asc');
  const [search, setSearch] = useState('');

  const apiFetch = useMemo(() => {
    return async (url, options = {}) => {
      const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      };
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
      const response = await fetch(url, {
        credentials: 'include',
        ...options,
        headers,
      });
      if (response.status === 204) {
        return null;
      }
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        const error = new Error(json?.error || 'Request failed');
        error.status = response.status;
        throw error;
      }
      return json;
    };
  }, [csrfToken]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await apiFetch('/api/users', { method: 'GET' });
      setUsers(data?.users || []);
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadGuilds = async () => {
    try {
      const data = await apiFetch('/api/guilds', { method: 'GET' });
      const list = data?.guilds || [];
      setGuilds(list);
      if (list.length > 0) {
        setForm((prev) => ({ ...prev, guildId: prev.guildId || list[0].guildId }));
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  const loadGuildMembers = async (guildId) => {
    if (!guildId) {
      setMembers([]);
      return;
    }
    try {
      const data = await apiFetch(`/api/guilds/${guildId}/members`, { method: 'GET' });
      setMembers(data?.members || []);
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  const loadGuildRoles = async (guildId) => {
    if (!guildId) {
      setRoles([]);
      return;
    }
    try {
      const data = await apiFetch(`/api/guilds/${guildId}/roles`, { method: 'GET' });
      setRoles(data?.roles || []);
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  const loadSession = async () => {
    const sessionData = await apiFetch('/api/session', { method: 'GET' });
    setSession({ loading: false, ...sessionData });
    if (sessionData.loggedIn) {
      await loadUsers();
      await loadGuilds();
    }
  };

  const bootstrap = async () => {
    const csrfData = await apiFetch('/api/csrf', { method: 'GET' });
    setCsrfToken(csrfData?.csrfToken || '');
    await loadSession();
  };

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (event) => {
    event.preventDefault();
    setStatus({ type: 'info', message: '' });
    try {
      await apiFetch('/api/login', {
        method: 'POST',
        body: JSON.stringify({
          username: loginForm.username.trim(),
          password: loginForm.password,
        }),
      });
      setSession({ loading: false, loggedIn: true, username: loginForm.username });
      setLoginForm({ username: '', password: '' });
      setStatus({ type: 'success', message: 'Welcome back. Session started.' });
      await loadUsers();
      await loadGuilds();
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/logout', { method: 'POST' });
      setSession({ loading: false, loggedIn: false, username: '' });
      setUsers([]);
      setGuilds([]);
      setMembers([]);
      setRoles([]);
      setForm({ guildId: '', userId: '', roleId: '', days: '' });
      setStatus({ type: 'info', message: 'Logged out.' });
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  const resetForm = () => {
    setForm((prev) => ({
      guildId: prev.guildId,
      userId: '',
      roleId: '',
      days: '',
    }));
    setEditTarget(null);
  };

  const handleSubmitUser = async (event) => {
    event.preventDefault();
    setStatus({ type: 'info', message: '' });

    if (!form.guildId || !form.userId || !form.roleId || !form.days) {
      setStatus({ type: 'error', message: 'Please select a guild, user, role, and days.' });
      return;
    }

    try {
      await apiFetch('/api/temprole/assign', {
        method: 'POST',
        body: JSON.stringify({
          guildId: form.guildId,
          userId: form.userId,
          roleId: form.roleId,
          days: Number(form.days),
        }),
      });
      setStatus({ type: 'success', message: editTarget ? 'Role extended.' : 'Role assigned.' });
      resetForm();
      await loadUsers();
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  const handleEdit = (row) => {
    if (!form.guildId) {
      setStatus({ type: 'error', message: 'Select a guild first.' });
      return;
    }
    setEditTarget({ userId: row.userID, role: row.temporaryRole });
    setForm((prev) => ({
      ...prev,
      userId: row.userID,
      roleId: roles.find((role) => role.name === row.temporaryRole)?.id || '',
      days: '',
    }));
  };

  const handleDelete = async (row) => {
    setStatus({ type: 'info', message: '' });
    try {
      await apiFetch('/api/users', {
        method: 'DELETE',
        body: JSON.stringify({ userId: row.userID, role: row.temporaryRole }),
      });
      setStatus({ type: 'success', message: 'User removed.' });
      await loadUsers();
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  useEffect(() => {
    if (!form.guildId || !session.loggedIn) {
      return;
    }
    loadGuildMembers(form.guildId);
    loadGuildRoles(form.guildId);
  }, [form.guildId, session.loggedIn]);

  const toggleSort = (key) => {
    if (sortBy === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(key);
    setSortDir('asc');
  };

  const scopedUsers = form.guildId
    ? users.filter((row) => row.guildId === form.guildId)
    : users;

  const visibleUsers = scopedUsers
    .filter((row) => {
      if (!search.trim()) {
        return true;
      }
      const query = search.trim().toLowerCase();
      const name = (row.username || '').toLowerCase();
      return name.includes(query);
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      const toValue = (row) => {
        switch (sortBy) {
          case 'username':
            return (row.username || '').toLowerCase();
          case 'role':
            return (row.temporaryRole || '').toLowerCase();
          case 'guild':
            return (row.guildName || row.guildId || '').toLowerCase();
          case 'endDate':
            return row.endDate || '';
          default:
            return '';
        }
      };

      const aVal = toValue(a);
      const bVal = toValue(b);
      if (aVal < bVal) return -1 * dir;
      if (aVal > bVal) return 1 * dir;
      return 0;
    });

  if (session.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-300">Loading…</div>
      </div>
    );
  }

  if (!session.loggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-lg glass gradient-border rounded-2xl p-10">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Discord Role Manager</p>
              <h1 className="text-3xl font-semibold text-white">Sign in to the console</h1>
            </div>
            <StatusPill text="Secure" tone="emerald" />
          </div>
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-medium text-slate-200">Username</label>
              <input
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                value={loginForm.username}
                onChange={(event) => setLoginForm((prev) => ({ ...prev, username: event.target.value }))}
                placeholder="admin"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200">Password</label>
              <input
                type="password"
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                value={loginForm.password}
                onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 px-4 py-3 font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:scale-[1.01]"
            >
              Continue
            </button>
          </form>
          {status.message ? (
            <div
              className={`mt-6 rounded-xl px-4 py-3 text-sm ${
                status.type === 'error' ? 'bg-rose-500/20 text-rose-100' : 'bg-emerald-500/20 text-emerald-100'
              }`}
            >
              {status.message}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-10 lg:px-12">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Admin Console</p>
          <h1 className="text-3xl font-semibold text-white">Role Manager</h1>
          <p className="text-sm text-slate-400">Signed in as {session.username}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill text="Live" tone="sky" />
          <button
            onClick={handleLogout}
            className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-600"
          >
            Log out
          </button>
        </div>
      </header>

      <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="glass gradient-border rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Temporary roles</h2>
              <p className="text-sm text-slate-400">Manage manual role entries</p>
            </div>
            {loadingUsers ? <StatusPill text="Syncing" tone="slate" /> : null}
          </div>

          <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-xs uppercase tracking-wide text-slate-400">Search by username</div>
            <input
              className="w-full rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40 lg:max-w-xs"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Start typing..."
            />
          </div>

          <div className="mt-6 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="pb-3">User ID</th>
                  <th className="pb-3">
                    <button
                      className="inline-flex items-center gap-2 text-slate-300 hover:text-slate-100"
                      onClick={() => toggleSort('username')}
                      type="button"
                    >
                      Username
                      <span className="text-[10px]">
                        {sortBy === 'username' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                      </span>
                    </button>
                  </th>
                  <th className="pb-3">
                    <button
                      className="inline-flex items-center gap-2 text-slate-300 hover:text-slate-100"
                      onClick={() => toggleSort('role')}
                      type="button"
                    >
                      Role
                      <span className="text-[10px]">{sortBy === 'role' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
                    </button>
                  </th>
                  <th className="pb-3">
                    <button
                      className="inline-flex items-center gap-2 text-slate-300 hover:text-slate-100"
                      onClick={() => toggleSort('guild')}
                      type="button"
                    >
                      Guild
                      <span className="text-[10px]">{sortBy === 'guild' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
                    </button>
                  </th>
                  <th className="pb-3">
                    <button
                      className="inline-flex items-center gap-2 text-slate-300 hover:text-slate-100"
                      onClick={() => toggleSort('endDate')}
                      type="button"
                    >
                      End date
                      <span className="text-[10px]">{sortBy === 'endDate' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
                    </button>
                  </th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {visibleUsers.length === 0 ? (
                  <tr>
                    <td className="py-6 text-center text-slate-400" colSpan="6">
                      No entries yet
                    </td>
                  </tr>
                ) : (
                  visibleUsers.map((row) => (
                    <tr className="border-t border-slate-800/70" key={`${row.userID}-${row.temporaryRole}`}>
                      <td className="py-4 pr-2">{row.userID}</td>
                      <td className="py-4 pr-2">{row.username || '-'}</td>
                      <td className="py-4 pr-2">{row.temporaryRole}</td>
                      <td className="py-4 pr-2">{row.guildName || row.guildId || '-'}</td>
                      <td className="py-4 pr-2">{row.endDate || '-'}</td>
                      <td className="py-4 text-right space-x-2">
                        <button
                          className="rounded-lg border border-slate-800 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-slate-500"
                          onClick={() => handleEdit(row)}
                        >
                          Extend
                        </button>
                        <button
                          className="rounded-lg border border-rose-500/40 px-3 py-1 text-xs font-semibold text-rose-200 hover:border-rose-400"
                          onClick={() => handleDelete(row)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass gradient-border rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white">{editTarget ? 'Extend temporary role' : 'Assign temporary role'}</h2>
          <p className="text-sm text-slate-400">Pick a guild, user, role, and duration</p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmitUser}>
            <div>
              <label className="text-xs uppercase tracking-wide text-slate-400">Guild</label>
              <select
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                value={form.guildId}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    guildId: event.target.value,
                    userId: '',
                    roleId: '',
                  }))
                }
                required
              >
                <option value="">Select a guild</option>
                {guilds.map((guild) => (
                  <option value={guild.guildId} key={guild.guildId}>
                    {guild.guildName || guild.guildId}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-slate-400">User</label>
              <select
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                value={form.userId}
                onChange={(event) => setForm((prev) => ({ ...prev, userId: event.target.value }))}
                required
              >
                <option value="">Select a user</option>
                {members.map((member) => (
                  <option value={member.id} key={member.id}>
                    {member.displayName} ({member.tag})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-slate-400">Role</label>
              <select
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                value={form.roleId}
                onChange={(event) => setForm((prev) => ({ ...prev, roleId: event.target.value }))}
                required
              >
                <option value="">Select a role</option>
                {roles.map((role) => (
                  <option value={role.id} key={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-slate-400">Days</label>
              <input
                type="number"
                min="1"
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                value={form.days}
                onChange={(event) => setForm((prev) => ({ ...prev, days: event.target.value }))}
                placeholder="30"
                required
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="flex-1 rounded-xl bg-gradient-to-r from-emerald-400 via-teal-400 to-sky-400 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-500/30"
              >
                {editTarget ? 'Extend role' : 'Assign role'}
              </button>
              {editTarget ? (
                <button
                  type="button"
                  className="rounded-xl border border-slate-800 px-4 py-2 text-sm font-semibold text-slate-200"
                  onClick={resetForm}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>

          {status.message ? (
            <div
              className={`mt-6 rounded-xl px-4 py-3 text-sm ${
                status.type === 'error'
                  ? 'bg-rose-500/20 text-rose-100'
                  : status.type === 'success'
                    ? 'bg-emerald-500/20 text-emerald-100'
                    : 'bg-slate-800 text-slate-200'
              }`}
            >
              {status.message}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
};

export default App;
