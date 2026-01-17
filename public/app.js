import React, { useEffect, useMemo, useState } from 'https://esm.sh/react@18.3.1';
import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client';
import htm from 'https://esm.sh/htm@3.1.1';

const html = htm.bind(React.createElement);

const StatusPill = ({ text, tone = 'slate' }) => {
  const toneMap = {
    slate: 'bg-slate-800 text-slate-200',
    emerald: 'bg-emerald-500/20 text-emerald-200',
    sky: 'bg-sky-500/20 text-sky-200',
    rose: 'bg-rose-500/20 text-rose-200',
  };

  return html`<span className=${`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${toneMap[tone] || toneMap.slate}`}>
    ${text}
  </span>`;
};

const App = () => {
  const [csrfToken, setCsrfToken] = useState('');
  const [session, setSession] = useState({ loading: true, loggedIn: false, username: '' });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ userId: '', username: '', role: '', guildId: '' });
  const [editTarget, setEditTarget] = useState(null);
  const [status, setStatus] = useState({ type: 'info', message: '' });
  const [loadingUsers, setLoadingUsers] = useState(false);

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

  const loadSession = async () => {
    const sessionData = await apiFetch('/api/session', { method: 'GET' });
    setSession({ loading: false, ...sessionData });
    if (sessionData.loggedIn) {
      await loadUsers();
    }
  };

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
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/logout', { method: 'POST' });
      setSession({ loading: false, loggedIn: false, username: '' });
      setUsers([]);
      setStatus({ type: 'info', message: 'Logged out.' });
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  const resetForm = () => {
    setForm({ userId: '', username: '', role: '', guildId: '' });
    setEditTarget(null);
  };

  const handleSubmitUser = async (event) => {
    event.preventDefault();
    setStatus({ type: 'info', message: '' });

    const payload = {
      userId: form.userId.trim(),
      username: form.username.trim(),
      role: form.role.trim(),
      guildId: form.guildId.trim() || null,
    };

    if (!payload.userId || !payload.username || !payload.role) {
      setStatus({ type: 'error', message: 'Please fill in user ID, username, and role.' });
      return;
    }

    try {
      if (editTarget) {
        await apiFetch('/api/users', {
          method: 'PUT',
          body: JSON.stringify({
            ...payload,
            originalUserId: editTarget.userId,
            originalRole: editTarget.role,
          }),
        });
        setStatus({ type: 'success', message: 'User updated successfully.' });
      } else {
        await apiFetch('/api/users', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setStatus({ type: 'success', message: 'User added successfully.' });
      }
      resetForm();
      await loadUsers();
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  const handleEdit = (row) => {
    setEditTarget({ userId: row.userID, role: row.temporaryRole });
    setForm({
      userId: row.userID,
      username: row.username || '',
      role: row.temporaryRole,
      guildId: row.guildId || '',
    });
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

  if (session.loading) {
    return html`<div className="min-h-screen flex items-center justify-center">
      <div className="text-slate-300">Loading…</div>
    </div>`;
  }

  if (!session.loggedIn) {
    return html`<div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-lg glass gradient-border rounded-2xl p-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Discord Role Manager</p>
            <h1 className="text-3xl font-semibold text-white">Sign in to the console</h1>
          </div>
          <${StatusPill} text="Secure" tone="emerald" />
        </div>
        <form className="space-y-6" onSubmit=${handleLogin}>
          <div>
            <label className="block text-sm font-medium text-slate-200">Username</label>
            <input
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              value=${loginForm.username}
              onInput=${(event) => setLoginForm((prev) => ({ ...prev, username: event.target.value }))}
              placeholder="admin"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-200">Password</label>
            <input
              type="password"
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              value=${loginForm.password}
              onInput=${(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
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
        ${status.message
          ? html`<div className=${`mt-6 rounded-xl px-4 py-3 text-sm ${status.type === 'error' ? 'bg-rose-500/20 text-rose-100' : 'bg-emerald-500/20 text-emerald-100'}`}>
              ${status.message}
            </div>`
          : null}
      </div>
    </div>`;
  }

  return html`<div className="min-h-screen px-6 py-10 lg:px-12">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Admin Console</p>
        <h1 className="text-3xl font-semibold text-white">Role Manager</h1>
        <p className="text-sm text-slate-400">Signed in as ${session.username}</p>
      </div>
      <div className="flex items-center gap-3">
        <${StatusPill} text="Live" tone="sky" />
        <button
          onClick=${handleLogout}
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
          ${loadingUsers ? html`<${StatusPill} text="Syncing" tone="slate" />` : null}
        </div>

        <div className="mt-6 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="pb-3">User ID</th>
                <th className="pb-3">Username</th>
                <th className="pb-3">Role</th>
                <th className="pb-3">Guild</th>
                <th className="pb-3">End date</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-slate-200">
              ${users.length === 0
                ? html`<tr>
                    <td className="py-6 text-center text-slate-400" colSpan="6">No entries yet</td>
                  </tr>`
                : users.map((row) => html`<tr className="border-t border-slate-800/70">
                    <td className="py-4 pr-2">${row.userID}</td>
                    <td className="py-4 pr-2">${row.username || '-'}</td>
                    <td className="py-4 pr-2">${row.temporaryRole}</td>
                    <td className="py-4 pr-2">${row.guildName || row.guildId || '-'}</td>
                    <td className="py-4 pr-2">${row.endDate || '-'}</td>
                    <td className="py-4 text-right space-x-2">
                      <button
                        className="rounded-lg border border-slate-800 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-slate-500"
                        onClick=${() => handleEdit(row)}
                      >
                        Edit
                      </button>
                      <button
                        className="rounded-lg border border-rose-500/40 px-3 py-1 text-xs font-semibold text-rose-200 hover:border-rose-400"
                        onClick=${() => handleDelete(row)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>`)}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass gradient-border rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white">${editTarget ? 'Update entry' : 'Add entry'}</h2>
        <p className="text-sm text-slate-400">Manual adjustments for temporary roles</p>

        <form className="mt-6 space-y-4" onSubmit=${handleSubmitUser}>
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-400">User ID</label>
            <input
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              value=${form.userId}
              onInput=${(event) => setForm((prev) => ({ ...prev, userId: event.target.value }))}
              required
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-400">Username</label>
            <input
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              value=${form.username}
              onInput=${(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
              required
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-400">Role</label>
            <input
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              value=${form.role}
              onInput=${(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
              required
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-400">Guild ID (optional)</label>
            <input
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              value=${form.guildId}
              onInput=${(event) => setForm((prev) => ({ ...prev, guildId: event.target.value }))}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="flex-1 rounded-xl bg-gradient-to-r from-emerald-400 via-teal-400 to-sky-400 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-500/30"
            >
              ${editTarget ? 'Save changes' : 'Add user'}
            </button>
            ${editTarget
              ? html`<button
                  type="button"
                  className="rounded-xl border border-slate-800 px-4 py-2 text-sm font-semibold text-slate-200"
                  onClick=${resetForm}
                >
                  Cancel
                </button>`
              : null}
          </div>
        </form>

        ${status.message
          ? html`<div className=${`mt-6 rounded-xl px-4 py-3 text-sm ${status.type === 'error' ? 'bg-rose-500/20 text-rose-100' : status.type === 'success' ? 'bg-emerald-500/20 text-emerald-100' : 'bg-slate-800 text-slate-200'}`}>
              ${status.message}
            </div>`
          : null}
      </div>
    </section>
  </div>`;
};

const root = createRoot(document.getElementById('root'));
root.render(html`<${App} />`);
