const API_BASE = "http://127.0.0.1:8000";


function getHeaders() {
  const headers = { "Content-Type": "application/json" };
  const token = localStorage.getItem("supabase_token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// ── Query Endpoints ──────────────────────────────────────────────────────────

export async function submitQuery({ question, provider, databaseId, sessionId, sessionTitle }) {
  const res = await fetch(`${API_BASE}/api/query`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      question,
      provider,
      database_id: databaseId,
      session_id: sessionId,
      session_title: sessionTitle
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || "Query failed");
  }
  return res.json();
}

export async function fetchHistory(limit = 100) {
  const res = await fetch(`${API_BASE}/api/history?limit=${limit}`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error("API offline");
  return res.json();
}

// ── Database Registry Endpoints ──────────────────────────────────────────────

export async function fetchDatabases() {
  const res = await fetch(`${API_BASE}/api/databases`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch databases");
  return res.json();
}

export async function fetchDatabaseDetail(dbId) {
  const res = await fetch(`${API_BASE}/api/databases/${dbId}`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch database details");
  return res.json();
}

export async function connectDatabase(data) {
  const res = await fetch(`${API_BASE}/api/databases/connect`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || "Connection failed");
  }
  return res.json();
}

export async function connectSqliteDatabase({ name, file }) {
  const formData = new FormData();
  formData.append("name", name);
  formData.append("file", file);

  const token = localStorage.getItem("supabase_token");
  const headers = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/api/databases/connect/sqlite`, {
    method: "POST",
    headers,
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || "SQLite connection failed");
  }
  return res.json();
}

export async function deleteDatabase(dbId) {
  const res = await fetch(`${API_BASE}/api/databases/${dbId}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to remove database connection");
  return res.json();
}

export async function refreshSchema(dbId) {
  const res = await fetch(`${API_BASE}/api/databases/${dbId}/refresh`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || "Refresh failed");
  }
  return res.json();
}

export async function checkDatabaseHealth(dbId) {
  const res = await fetch(`${API_BASE}/api/databases/${dbId}/health`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Database health check failed");
  return res.json();
}

export async function fetchDatabaseSchema(dbId) {
  const res = await fetch(`${API_BASE}/api/databases/${dbId}/schema`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch schema catalog");
  return res.json();
}
