export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

const TOKEN_KEY = 'pramiti.token';
const OFFICER_KEY = 'pramiti.officer';

export type Verdict = 'compliant' | 'non_compliant' | 'needs_review';
export type CheckStatus = 'pass' | 'fail' | 'unclear' | 'not_applicable';
export type Role = 'inspector' | 'controller' | 'admin';
export type Source = 'label' | 'ecommerce' | 'complaint';

export interface Officer {
  id: number;
  email: string;
  name: string;
  designation: string | null;
  role: Role;
}

export const ROLE_RANK: Record<Role, number> = { inspector: 0, controller: 1, admin: 2 };
export const hasRole = (o: Officer | null | undefined, min: Role) => !!o && ROLE_RANK[o.role] >= ROLE_RANK[min];

export interface Check {
  id: string;
  rule: string;
  title: string;
  source?: 'ai' | 'rule';
  status: CheckStatus;
  evidence: string;
  recommendation: string | null;
  officer_status?: CheckStatus | null;
  officer_note?: string | null;
  detail?: { declared: number; measured: number; shortfall: number; mpe: number; unit: string };
}

export const effectiveStatus = (c: Check): CheckStatus => c.officer_status || c.status;

export interface Region {
  field: string;
  image_index: number;
  box: [number, number, number, number]; // ymin, xmin, ymax, xmax (0-1000)
}

export interface ScanSummary {
  id: number;
  created_at: string;
  product_name: string | null;
  brand: string | null;
  manufacturer_name: string | null;
  manufacturer_key: string | null;
  category: string | null;
  source: Source;
  source_url: string | null;
  original_filename: string;
  image_url: string | null;
  verdict: Verdict;
  ai_verdict: Verdict | null;
  score: number;
  location: string | null;
  state: string | null;
  district: string | null;
  review_status: 'pending' | 'reviewed';
  is_demo: boolean;
  fail_count: number;
  unclear_count: number;
}

export interface ScanFields {
  product_name?: string | null;
  brand?: string | null;
  generic_name?: string | null;
  manufacturer?: string | null;
  manufacturer_name?: string | null;
  net_quantity?: string | null;
  mrp?: string | null;
  unit_sale_price?: string | null;
  date?: string | null;
  best_before?: string | null;
  consumer_care?: string | null;
  country_of_origin?: string | null;
  batch_no?: string | null;
  fssai_license?: string | null;
  seller?: string | null;
  category?: string | null;
  is_imported?: boolean;
  languages?: string[];
  image_quality?: 'good' | 'fair' | 'poor';
  estimated_pdp_area_cm2?: number | null;
  estimated_numeral_height_mm?: number | null;
}

export interface ScanDetail extends ScanSummary {
  inspector: string | null;
  image_urls: string[];
  measured_quantity: string | null;
  notes: string | null;
  summary: string | null;
  summary_hi: string | null;
  raw_text: string | null;
  fields: ScanFields;
  checks: Check[];
  regions: Region[];
  model: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notices: { id: number; number: string | null; status: NoticeStatus }[];
  complaint: { id: number; code: string; status: ComplaintStatus } | null;
}

export interface Stats {
  total: number;
  compliant: number;
  non_compliant: number;
  needs_review: number;
  pending_review: number;
  ecommerce: number;
  open_complaints: number;
  notices_pending: number;
  notices_issued: number;
  has_demo: boolean;
  average_score: number | null;
  top_violations: { id: string; rule: string; title: string; count: number }[];
  daily: { date: string; scans: number; non_compliant: number }[];
}

export interface StateStat {
  code: string;
  name: string;
  col: number;
  row: number;
  total: number;
  non_compliant: number;
  compliant: number;
  needs_review: number;
  rate: number | null;
}

export interface Offender {
  key: string;
  name: string;
  brands: string[];
  inspections: number;
  non_compliant: number;
  rate: number;
  states: string[];
  last_seen: string;
  notices: number;
  risk: 'high' | 'medium' | 'low';
  top_violations: { id: string; title: string; rule: string; count: number }[];
  is_demo: boolean;
}

export interface Insights {
  states: StateStat[];
  offenders: Offender[];
  rules: { id: string; title: string; rule: string; count: number }[];
  sources: Record<string, number>;
  categories: { name: string; count: number }[];
  unlocated: number;
}

export interface AccuracyRow {
  id: string;
  title: string;
  rule: string;
  reviewed: number;
  agreed: number;
  agreement: number | null;
  precision: number | null;
  recall: number | null;
  tp: number;
  fp: number;
  fn: number;
}

export interface Accuracy {
  reviewed_scans: number;
  demo_scans: number;
  check_agreement: number | null;
  verdict_agreement: number | null;
  checks: AccuracyRow[];
  benchmark: {
    run_at: string;
    images: number;
    model: string;
    checks: { id: string; title: string; n: number; accuracy: number; precision: number | null; recall: number | null }[];
  } | null;
}

export type NoticeStatus = 'draft' | 'approved' | 'issued' | 'replied' | 'closed';

export interface Notice {
  id: number;
  number: string | null;
  status: NoticeStatus;
  scan_id: number;
  scan_ref: string | null;
  product_name: string | null;
  brand: string | null;
  addressee: string;
  violations: { id: string; rule: string; title: string; evidence: string }[];
  sections: string[];
  reply_days: number;
  remarks: string | null;
  reply_text: string | null;
  outcome: string | null;
  created_by: string;
  created_at: string;
  approved_by: string | null;
  approved_at: string | null;
  issued_at: string | null;
  reply_due: string | null;
  closed_at: string | null;
  overdue: boolean;
  is_demo: boolean;
}

export type ComplaintStatus = 'received' | 'under_review' | 'action_taken' | 'closed';

export interface Complaint {
  id: number;
  code: string;
  status: ComplaintStatus;
  name: string | null;
  contact: string | null;
  state: string | null;
  place: string | null;
  purchased_online: boolean;
  description: string | null;
  officer_note: string | null;
  assigned_to: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  scan: (ScanSummary & { reference: string }) | null;
}

export interface PublicComplaint {
  code: string;
  status: ComplaintStatus;
  submitted_at: string;
  updated_at: string;
  officer_note: string | null;
  product_name: string | null;
  preliminary: { verdict: Verdict; summary: string; summary_hi: string; issues: string[] } | null;
}

export interface BatchItem {
  id: number;
  kind: 'files' | 'url';
  label: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  error: string | null;
  scan_id: number | null;
  verdict: Verdict | null;
  score: number | null;
  product_name: string | null;
}

export interface Batch {
  id: number;
  name: string;
  created_by: string;
  created_at: string;
  status: 'queued' | 'running' | 'done';
  state: string | null;
  location: string | null;
  total: number;
  queued: number;
  running: number;
  done: number;
  failed: number;
  non_compliant: number;
  items?: BatchItem[];
}

export interface UserRow extends Officer {
  active: boolean;
  created_at: string;
}

export interface AuditRow {
  id: number;
  at: string;
  actor: string;
  action: string;
  target: string | null;
  details: string | null;
}

export interface RuleRef {
  id: string;
  rule: string;
  title: string;
  text: string;
}

export interface CheckRef {
  id: string;
  rule: string;
  title: string;
  requirement: string;
  source: 'ai' | 'rule';
  modes: string[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/* ---------------------------------------------------------------- request cache
   Several components ask for the same thing on one page (the header badges and the dashboard both
   read /api/stats; every state picker reads /api/meta). Identical GETs share one request and its
   answer for a short while. Any write (POST/PUT/PATCH/DELETE) or a change of user drops the cache,
   so nothing shown after an action is stale. */
const cache = new Map<string, { at: number; value: Promise<unknown> }>();

export function clearApiCache() {
  cache.clear();
}

function cachedGet<T>(path: string, maxAgeMs: number): Promise<T> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < maxAgeMs) return hit.value as Promise<T>;
  const value = request<T>(path).catch((err) => {
    cache.delete(path); // never keep a failure
    throw err;
  });
  cache.set(path, { at: Date.now(), value });
  return value;
}

export const session = {
  get token(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  get officer(): Officer | null {
    try {
      const raw = localStorage.getItem(OFFICER_KEY);
      const o = raw ? (JSON.parse(raw) as Officer) : null;
      return o && o.role ? o : null; // sessions from older versions have no role
    } catch {
      return null;
    }
  },
  save(token: string, officer: Officer) {
    if (token !== this.token) clearApiCache();
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(OFFICER_KEY, JSON.stringify(officer));
    } catch {}
  },
  clear() {
    clearApiCache();
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(OFFICER_KEY);
    } catch {}
  },
};

/** Fired when the server rejects our token, so the auth provider can show the login screen. */
export const UNAUTHORIZED_EVENT = 'pramiti:unauthorized';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (init.method && init.method !== 'GET') clearApiCache();
  const headers = new Headers(init.headers);
  const token = session.token;
  if (token && !path.startsWith('/api/public')) headers.set('Authorization', `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(`Cannot reach the Pramiti server at ${API_URL}. Check your connection or that the backend is running.`, 0);
  }

  // a failed sign-in is not an expired session
  if (res.status === 401 && path !== '/api/auth/login' && path !== '/api/auth/google') {
    session.clear();
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body.detail === 'string') message = body.detail;
      else if (Array.isArray(body.detail)) message = body.detail.map((d: { msg: string }) => d.msg).join(', ');
    } catch {}
    throw new ApiError(message, res.status);
  }
  return res.json() as Promise<T>;
}

const json = (body: unknown, method = 'POST'): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

function form(entries: Record<string, string | boolean | undefined | null>, files: File[] = [], fileField = 'files') {
  const f = new FormData();
  files.forEach((file) => f.append(fileField, file));
  Object.entries(entries).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') f.append(k, String(v));
  });
  return f;
}

export interface ScanMeta {
  location?: string;
  state?: string;
  district?: string;
  measured_quantity?: string;
  notes?: string;
}

export const api = {
  login: (email: string, password: string) => request<{ token: string; officer: Officer }>('/api/auth/login', json({ email, password })),
  loginWithGoogle: (credential: string) => request<{ token: string; officer: Officer }>('/api/auth/google', json({ credential })),
  me: () => request<Officer>('/api/auth/me'),
  changePassword: (current_password: string, new_password: string) =>
    request<{ ok: boolean }>('/api/auth/password', json({ current_password, new_password })),

  meta: () => cachedGet<{ states: { code: string; name: string }[] }>('/api/meta', Infinity), // fixed reference data
  rules: () => request<{ rules: RuleRef[]; checks: CheckRef[] }>('/api/rules'),

  stats: () => cachedGet<Stats>('/api/stats', 30_000),
  insights: () => request<Insights>('/api/insights'),
  offender: (key: string) => request<Offender & { scans: ScanSummary[] }>(`/api/offenders/${encodeURIComponent(key)}`),
  accuracy: (includeDemo = true) => request<Accuracy>(`/api/accuracy?include_demo=${includeDemo}`),

  scans: (params: Record<string, string | number | undefined> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v !== undefined && v !== '' && qs.set(k, String(v)));
    return request<ScanSummary[]>(`/api/scans${qs.size ? `?${qs}` : ''}`);
  },
  scan: (id: number | string) => request<ScanDetail>(`/api/scans/${id}`),
  deleteScan: (id: number) => request<{ deleted: number }>(`/api/scans/${id}`, { method: 'DELETE' }),
  analyse: (files: File[], meta: ScanMeta) => request<ScanDetail>('/api/scan', { method: 'POST', body: form({ ...meta }, files) }),
  analyseListing: (data: { url?: string; listing_text?: string; state?: string; notes?: string }, files: File[]) =>
    request<ScanDetail>('/api/scan/listing', { method: 'POST', body: form(data, files) }),
  review: (id: number, checks: { id: string; officer_status: CheckStatus | null; officer_note: string | null }[], notes?: string) =>
    request<ScanDetail>(`/api/scans/${id}/review`, json({ checks, notes })),

  batches: () => request<Batch[]>('/api/batches'),
  batch: (id: number | string) => request<Batch>(`/api/batches/${id}`),
  createBatch: (data: { name?: string; urls?: string; state?: string; location?: string }, files: File[]) =>
    request<Batch>('/api/batches', { method: 'POST', body: form(data, files) }),

  notices: (status?: NoticeStatus) => request<Notice[]>(`/api/notices${status ? `?status=${status}` : ''}`),
  notice: (id: number | string) => request<Notice>(`/api/notices/${id}`),
  createNotice: (scan_id: number, reply_days: number, remarks?: string) =>
    request<Notice>('/api/notices', json({ scan_id, reply_days, remarks })),
  updateNotice: (id: number, data: { addressee?: string; remarks?: string; reply_days?: number }) =>
    request<Notice>(`/api/notices/${id}`, json(data, 'PATCH')),
  noticeAction: (id: number, action: 'approve' | 'issue') => request<Notice>(`/api/notices/${id}/${action}`, { method: 'POST' }),
  noticeReply: (id: number, reply_text: string) => request<Notice>(`/api/notices/${id}/reply`, json({ reply_text })),
  noticeClose: (id: number, outcome: string) => request<Notice>(`/api/notices/${id}/close`, json({ outcome })),
  deleteNotice: (id: number) => request<{ deleted: number }>(`/api/notices/${id}`, { method: 'DELETE' }),

  complaints: (status?: ComplaintStatus) => request<Complaint[]>(`/api/complaints${status ? `?status=${status}` : ''}`),
  updateComplaint: (id: number, data: { status?: ComplaintStatus; officer_note?: string; assign_to_me?: boolean }) =>
    request<Complaint>(`/api/complaints/${id}`, json(data, 'PATCH')),
  submitComplaint: (
    data: { description: string; name?: string; contact?: string; state?: string; place?: string; purchased_online?: boolean },
    files: File[],
  ) => request<PublicComplaint>('/api/public/complaints', { method: 'POST', body: form(data, files) }),
  trackComplaint: (code: string) => request<PublicComplaint>(`/api/public/complaints/${encodeURIComponent(code.trim())}`),

  users: () => request<UserRow[]>('/api/users'),
  createUser: (u: { email: string; name: string; designation?: string; role: Role; password: string }) =>
    request<UserRow>('/api/users', json(u)),
  updateUser: (id: number, u: { name?: string; designation?: string; role?: Role; active?: boolean; password?: string }) =>
    request<UserRow>(`/api/users/${id}`, json(u, 'PATCH')),
  audit: (params: { actor?: string; action?: string } = {}) =>
    request<AuditRow[]>(`/api/audit?${new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][])}`),
  loadDemo: () => request<Record<string, number>>('/api/admin/demo', { method: 'POST' }),
  clearDemo: () => request<Record<string, number>>('/api/admin/demo', { method: 'DELETE' }),
};

/** Download a PDF with the auth header (a plain link cannot send it). */
async function downloadPdf(path: string, filename: string) {
  const res = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${session.token ?? ''}` } });
  if (!res.ok) throw new ApiError('Could not generate the PDF.', res.status);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const downloadReport = (id: number) => downloadPdf(`/api/report/${id}`, `Pramiti_inspection_${id}.pdf`);
export const downloadNotice = (n: Pick<Notice, 'id' | 'number'>) =>
  downloadPdf(`/api/notices/${n.id}/pdf`, `Notice_${(n.number || `draft_${n.id}`).replace(/\//g, '-')}.pdf`);

export function referenceNo(id: number, iso: string) {
  return `PRAMITI/${new Date(iso).getFullYear()}/${String(id).padStart(5, '0')}`;
}

export function formatDate(iso: string, withTime = true) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}
