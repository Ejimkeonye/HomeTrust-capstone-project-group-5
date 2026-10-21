import { useCallback, useEffect, useRef, useState } from "react";

const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
const STORAGE_KEY = "homecompa_admin_key";

const EMPTY_STATS = {
  users: { total: 0, tenants: 0, landlords: 0 },
  properties: 0,
  inspections: 0,
  roomItems: 0,
  evidence: 0,
  invitations: 0,
};

function getErrorMessage(error) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export default function AdminStatsPage() {
  const [adminKey, setAdminKey] = useState(
    () => sessionStorage.getItem(STORAGE_KEY) || "",
  );
  const [keyInput, setKeyInput] = useState("");
  const [authenticated, setAuthenticated] = useState(() =>
    Boolean(sessionStorage.getItem(STORAGE_KEY)),
  );
  const [stats, setStats] = useState(EMPTY_STATS);
  const [users, setUsers] = useState([]);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestVersion = useRef(0);

  const logout = useCallback((message = "") => {
    requestVersion.current += 1;
    sessionStorage.removeItem(STORAGE_KEY);
    setAdminKey("");
    setKeyInput("");
    setAuthenticated(false);
    setStats(EMPTY_STATS);
    setUsers([]);
    setGeneratedAt(null);
    setError(message);
    setLoading(false);
  }, []);

  const fetchDashboard = useCallback(
    async (key) => {
      const version = ++requestVersion.current;
      setLoading(true);
      setError("");

      try {
        const headers = { "x-admin-key": key };

        const [statsResponse, usersResponse] = await Promise.all([
          fetch(`${API_URL}/api/admin/stats`, { headers }),
          fetch(`${API_URL}/api/admin/users`, { headers }),
        ]);

        if (version !== requestVersion.current) return;

        if (statsResponse.status === 401 || usersResponse.status === 401) {
          logout("Wrong key");
          return;
        }

        if (!statsResponse.ok || !usersResponse.ok) {
          throw new Error(
            `Request failed (stats: ${statsResponse.status}, users: ${usersResponse.status}).`,
          );
        }

        const statsData = await statsResponse.json();
        const usersData = await usersResponse.json();

        if (version !== requestVersion.current) return;

        setStats({
          ...EMPTY_STATS,
          ...(statsData || {}),
          users: {
            ...EMPTY_STATS.users,
            ...(statsData?.users || {}),
          },
        });

        setUsers(Array.isArray(usersData?.users) ? usersData.users : []);
        setGeneratedAt(
          statsData?.generatedAt || usersData?.generatedAt || null,
        );
      } catch (err) {
        if (version === requestVersion.current) {
          setError(getErrorMessage(err));
        }
      } finally {
        if (version === requestVersion.current) {
          setLoading(false);
        }
      }
    },
    [logout],
  );

  useEffect(() => {
    if (!authenticated || !adminKey) return;

    const timeoutId = setTimeout(() => fetchDashboard(adminKey), 0);
    return () => clearTimeout(timeoutId);
  }, [authenticated, adminKey, fetchDashboard]);

  const handleLogin = (event) => {
    event.preventDefault();
    const key = keyInput.trim();

    if (!key) {
      setError("Enter your admin key.");
      return;
    }

    sessionStorage.setItem(STORAGE_KEY, key);
    setAdminKey(key);
    setAuthenticated(true);
    setKeyInput("");
    setError("");
  };

  if (!authenticated) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            HomeTrust
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Admin dashboard
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Enter your admin key to view platform statistics.
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <label
              htmlFor="admin-key"
              className="block text-sm font-medium text-slate-700"
            >
              Admin key
            </label>
            <input
              id="admin-key"
              type="password"
              autoComplete="current-password"
              value={keyInput}
              onChange={(event) => setKeyInput(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:border-slate-600"
              placeholder="Enter admin key"
              required
            />

            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white hover:bg-slate-700"
            >
              Sign in
            </button>
          </form>
        </section>
      </main>
    );
  }

  const cards = [
    ["Total users", stats.users?.total ?? 0],
    ["Tenants", stats.users?.tenants ?? 0],
    ["Landlords", stats.users?.landlords ?? 0],
    ["Properties", stats.properties ?? 0],
    ["Inspections", stats.inspections ?? 0],
    ["Room items", stats.roomItems ?? 0],
    ["Evidence", stats.evidence ?? 0],
    ["Invitations", stats.invitations ?? 0],
  ];

  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              HomeCompa
            </p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Admin dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {generatedAt
                ? `Last updated: ${new Date(generatedAt).toLocaleString()}`
                : "Statistics have not loaded yet."}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => fetchDashboard(adminKey)}
              disabled={loading}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-800 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <button
              type="button"
              onClick={() => logout()}
              className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white"
            >
              Log out
            </button>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        <section aria-label="Platform statistics">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">
            Platform overview
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map(([label, value]) => (
              <article
                key={label}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {loading && !generatedAt
                    ? "—"
                    : Number(value).toLocaleString()}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-xl font-semibold text-slate-900">
              Registered users
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {users.length.toLocaleString()} users returned by the API
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-160 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Name
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Role
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Email
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user, index) => (
                  <tr
                    key={`${user.email || user.name || "user"}-${user.createdAt || index}`}
                  >
                    <td className="px-5 py-4 font-medium text-slate-900">
                      {user.name || "—"}
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      {user.role || "—"}
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      {user.email || "—"}
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      {user.createdAt
                        ? new Date(user.createdAt).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}

                {!loading && users.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-5 py-10 text-center text-slate-500"
                    >
                      No users to display.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
