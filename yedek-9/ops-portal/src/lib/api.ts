const API_BASE = import.meta.env.VITE_OPS_API_URL || '/api/ops';

export type OpsUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

export type TaskLink = {
  id: string;
  link_type: string;
  ref_key: string;
  ref_label?: string;
};

export type Task = {
  id: string;
  project_id: string;
  column_id: string;
  title: string;
  description?: string;
  priority: string;
  assignee_id?: string;
  assignee_name?: string;
  due_date?: string;
  position: number;
  links?: TaskLink[];
};

export type HostPipeline = {
  id: string;
  project_id: string;
  production_user_id?: string;
  display_name: string;
  email?: string;
  city?: string;
  pipeline_status: string;
  rituals_hosted: number;
  host_feedback?: string;
  internal_notes?: string;
  owner_name?: string;
};

export type VenuePipeline = {
  id: string;
  project_id: string;
  name: string;
  city?: string;
  pipeline_status: string;
  internal_notes?: string;
  contact_name?: string;
  contact_email?: string;
};

export type VenueNomination = {
  id: string;
  nominator_id?: string;
  source: string;
  name?: string;
  lat?: number;
  lng?: number;
  note?: string;
  cluster_key?: string;
  status: string;
  created_at?: string;
};

export type ScreenItem = {
  id: string;
  spec_id: string;
  title: string;
  category: string;
  file_ref?: string;
  is_target: boolean;
  design_status: string;
  dev_status: string;
  designer_name?: string;
  developer_name?: string;
  design_notes?: string;
  dev_notes?: string;
};

export type BoardColumn = {
  id: string;
  name: string;
  position: number;
  tasks: Task[];
};

export function getToken(): string | null {
  return localStorage.getItem('ops_token');
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem('ops_token', token);
  else localStorage.removeItem('ops_token');
}

export function getStoredUser(): OpsUser | null {
  const raw = localStorage.getItem('ops_user');
  return raw ? JSON.parse(raw) : null;
}

export function setStoredUser(user: OpsUser | null) {
  if (user) localStorage.setItem('ops_user', JSON.stringify(user));
  else localStorage.removeItem('ops_user');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error || 'Request failed');
  }
  return json.data as T;
}

export const api = {
  login: async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Login failed');
    return json.data as { token: string; user: OpsUser };
  },

  me: () => request<OpsUser>('/auth/me'),
  users: () => request<OpsUser[]>('/auth/users'),

  projects: () =>
    request<{ id: string; name: string; city?: string; status: string; task_count: number }[]>('/projects'),

  board: (projectId: string) =>
    request<{
      project: { id: string; name: string; city?: string };
      columns: BoardColumn[];
    }>(`/projects/${projectId}/board`),

  createTask: (body: Record<string, unknown>) =>
    request<Task>('/tasks', { method: 'POST', body: JSON.stringify(body) }),

  updateTask: (id: string, body: Record<string, unknown>) =>
    request<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  moveTask: (id: string, column_id: string, position: number) =>
    request<Task>(`/tasks/${id}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ column_id, position }),
    }),

  getTask: (id: string) => request<Task & { comments?: { id: string; body: string; author_name: string; created_at: string }[] }>(`/tasks/${id}`),

  addComment: (taskId: string, body: string) =>
    request(`/tasks/${taskId}/comments`, { method: 'POST', body: JSON.stringify({ body }) }),

  addLink: (taskId: string, link: { link_type: string; ref_key: string; ref_label?: string }) =>
    request(`/tasks/${taskId}/links`, { method: 'POST', body: JSON.stringify(link) }),

  deleteTask: (id: string) =>
    fetch(`${API_BASE}/tasks/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    }),

  inviteUser: (body: { email: string; name: string; password: string; role: string }) =>
    request<OpsUser>('/auth/invite', { method: 'POST', body: JSON.stringify(body) }),

  importSpecGaps: (projectId: string, source: 'canon' | 'markdown' = 'canon') =>
    request<{ created: number; skipped: number; total: number }>('/import/spec-gaps', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, source }),
    }),

  importPreview: () =>
    request<{ count: number; items: { title: string; column: string; priority: string }[] }>(
      '/import/spec-gaps/preview'
    ),

  bridgeHosts: (params: { city?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params.city) q.set('city', params.city);
    if (params.search) q.set('search', params.search);
    return request<
      { id: string; name: string; email: string; city?: string; rs_score?: number; is_verified?: boolean }[]
    >(`/bridge/hosts?${q}`);
  },

  bridgeVenues: (params: { city?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params.city) q.set('city', params.city);
    if (params.search) q.set('search', params.search);
    return request<
      { id: string; name: string; city?: string; subscription_tier?: string; is_verified?: boolean }[]
    >(`/bridge/venues?${q}`);
  },

  permissions: () =>
    request<import('./permissions').Permissions>('/dashboard/permissions'),

  dashboard: (projectId: string) => request<Record<string, unknown>>(`/dashboard?project_id=${projectId}`),

  pipelineHosts: (projectId: string, params?: { status?: string; search?: string }) => {
    const q = new URLSearchParams({ project_id: projectId });
    if (params?.status) q.set('status', params.status);
    if (params?.search) q.set('search', params.search);
    return request<HostPipeline[]>(`/hosts?${q}`);
  },

  updateHost: (id: string, body: Record<string, unknown>) =>
    request<HostPipeline>(`/hosts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  createHost: (body: Record<string, unknown>) =>
    request<HostPipeline>('/hosts', { method: 'POST', body: JSON.stringify(body) }),

  syncHostRituals: (id: string) =>
    request<HostPipeline>(`/hosts/${id}/sync-rituals`, { method: 'POST' }),

  pipelineVenues: (projectId: string, params?: { status?: string; search?: string }) => {
    const q = new URLSearchParams({ project_id: projectId });
    if (params?.status) q.set('status', params.status);
    if (params?.search) q.set('search', params.search);
    return request<{ list: VenuePipeline[]; grouped: Record<string, VenuePipeline[]> }>(`/venues-pipeline?${q}`);
  },

  updateVenue: (id: string, body: Record<string, unknown>) =>
    request<VenuePipeline>(`/venues-pipeline/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  createVenue: (body: Record<string, unknown>) =>
    request<VenuePipeline>('/venues-pipeline', { method: 'POST', body: JSON.stringify(body) }),

  nominations: (params?: { status?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return request<VenueNomination[]>(`/nominations${qs ? `?${qs}` : ''}`);
  },

  updateNomination: (id: string, body: { status: string }) =>
    request<VenueNomination>(`/nominations/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  eventGroups: (params?: { limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return request<
      { id: string; name: string; zone_id?: string; capacity_total?: number; ritual_count?: number }[]
    >(`/event-groups${qs ? `?${qs}` : ''}`);
  },

  createEventGroup: (body: { name: string; zone_id?: string; capacity_total?: number }) =>
    request('/event-groups', { method: 'POST', body: JSON.stringify(body) }),

  attachRitualToEventGroup: (groupId: string, ritualId: string) =>
    request(`/event-groups/${groupId}/rituals`, {
      method: 'POST',
      body: JSON.stringify({ ritual_id: ritualId }),
    }),

  eventGroup: (id: string) =>
    request<{
      id: string;
      name: string;
      tables?: Array<{
        id: string;
        title?: string;
        capacity?: number;
        joined?: number;
      }>;
    }>(`/event-groups/${id}`),

  screens: (projectId: string, params?: Record<string, string>) => {
    const q = new URLSearchParams({ project_id: projectId });
    if (params) Object.entries(params).forEach(([k, v]) => q.set(k, v));
    return request<{
      screens: ScreenItem[];
      stats: {
        design: Record<string, number>;
        dev: Record<string, number>;
        target_total: number;
        target_design_done: number;
        target_dev_done: number;
      };
    }>(`/screens?${q}`);
  },

  updateScreen: (id: string, body: Record<string, unknown>) =>
    request<ScreenItem>(`/screens/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  uploadAttachment: async (taskId: string, file: File) => {
    const token = getToken();
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/tasks/${taskId}/attachments`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Upload failed');
    return json.data;
  },
};
