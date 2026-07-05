/**
 * 사업 계층 API - Supabase 백엔드.
 * 로컬/배포 어디서나 동일하게 동작한다. 접근 제어는 RLS(이메일 화이트리스트)가 담당하므로
 * 화이트리스트에 없는 계정은 로그인해도 데이터가 보이지 않는다.
 */
import type { Session } from '@supabase/supabase-js';
import { DEFAULT_PARAMS, MetalKey, RingParams } from './ringMath';
import { supabase } from './supabaseClient';

export interface DesignSelection {
  start: number;
  end: number;
}

export interface DesignState {
  selection: DesignSelection;
  params: RingParams;
  metal: MetalKey;
}

export interface Snapshot {
  id: string;
  label: string;
  createdAt: string;
  params: RingParams;
  metal: MetalKey;
  selection: DesignSelection;
  favorite: boolean;
  tags: string[];
}

export interface ProjectMedia {
  fileName: string;
  path: string;
  sizeBytes?: number;
  uploadedAt?: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  client: string;
  story: string;
  ownerEmail: string;
  createdAt: string;
  updatedAt: string;
  media: ProjectMedia | null;
  design: DesignState | null;
  snapshots: Snapshot[];
}

export interface StudioFormula {
  version: number;
  updatedAt: string;
  name: string;
  designerNote: string;
  defaults: RingParams;
  defaultMetal: MetalKey;
  tasteTags: string[];
}

export interface Insights {
  totalEvents: number;
  favorites: number;
  byMetal: Record<string, number>;
  byMode: Record<string, number>;
  tagCounts: { tag: string; count: number }[];
  favoriteParamAverages: Record<string, number> | null;
}

/* ---------------- 인증 ---------------- */

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(callback: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? error.message : null;
}

export async function signUp(email: string, password: string): Promise<string | null> {
  const { error } = await supabase.auth.signUp({ email, password });
  return error ? error.message : null;
}

/** 현재 계정이 관리자인지 (관리자는 모든 작업실을 볼 수 있다) */
export async function fetchIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('ring_is_admin');
  return !error && data === true;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/* ---------------- 프로젝트 ---------------- */

interface ProjectRow {
  id: string;
  name: string;
  client: string;
  story: string;
  owner_email: string | null;
  created_at: string;
  updated_at: string;
  media: ProjectMedia | null;
  design: DesignState | null;
  snapshots: Snapshot[] | null;
}

function rowToProject(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    name: row.name,
    client: row.client,
    story: row.story,
    ownerEmail: row.owner_email ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    media: row.media,
    design: row.design,
    snapshots: row.snapshots ?? [],
  };
}

export async function listProjects(): Promise<ProjectRecord[]> {
  const { data, error } = await supabase
    .from('ring_projects')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error || !data) return [];
  return (data as ProjectRow[]).map(rowToProject);
}

export async function createProject(input: {
  name: string;
  client?: string;
  story?: string;
}): Promise<ProjectRecord | null> {
  const { data, error } = await supabase
    .from('ring_projects')
    .insert({ name: input.name, client: input.client ?? '', story: input.story ?? '' })
    .select()
    .single();
  if (error || !data) return null;
  return rowToProject(data as ProjectRow);
}

export async function patchProject(
  projectId: string,
  patch: Partial<Pick<ProjectRecord, 'name' | 'client' | 'story' | 'design' | 'snapshots' | 'media'>>
): Promise<ProjectRecord | null> {
  const { data, error } = await supabase
    .from('ring_projects')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', projectId)
    .select()
    .single();
  if (error || !data) return null;
  return rowToProject(data as ProjectRow);
}

/* ---------------- 원본 오디오 보존 (Supabase Storage) ---------------- */

const MEDIA_BUCKET = 'ring-media';

export async function uploadMedia(
  file: File,
  projectId?: string
): Promise<{ media: ProjectMedia; project: ProjectRecord | null } | null> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;
  const safeName = file.name.replace(/[^\w.\-가-힣]/g, '_').slice(-80);
  const path = `${uid}/${projectId ?? 'no-project'}/${Date.now().toString(36)}-${safeName}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (error) return null;

  const media: ProjectMedia = {
    fileName: file.name,
    path,
    sizeBytes: file.size,
    uploadedAt: new Date().toISOString(),
  };

  let project: ProjectRecord | null = null;
  if (projectId) {
    project = await patchProject(projectId, { media });
  }
  return { media, project };
}

/** 비공개 버킷의 원본을 재생하기 위한 서명 URL (1시간 유효) */
export async function getMediaUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, 3600);
  if (error || !data) return null;
  return data.signedUrl;
}

/* ---------------- 디자인 공식 ---------------- */

interface FormulaRow {
  version: number;
  created_at: string;
  data: Omit<StudioFormula, 'version' | 'updatedAt'>;
}

export async function fetchFormula(): Promise<StudioFormula | null> {
  const { data, error } = await supabase
    .from('ring_formula_versions')
    .select('*')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as FormulaRow;
  return { version: row.version, updatedAt: row.created_at, ...row.data };
}

/** 공식이 없는 신규 사용자에게 기본 공식 v1을 만들어 준다 */
export async function ensureFormula(): Promise<StudioFormula | null> {
  const existing = await fetchFormula();
  if (existing) return existing;
  return saveFormula({
    name: '기본 공식',
    designerNote: '나만의 공식으로 발전시키세요. 저장할 때마다 버전이 기록됩니다.',
    defaults: DEFAULT_PARAMS,
    defaultMetal: 'gold',
    tasteTags: ['비율 좋음', '질감 좋음', '서사 표현 좋음', '너무 과함', '밴드 두꺼움', '제작 어려움'],
  });
}

export async function saveFormula(
  formula: Omit<StudioFormula, 'version' | 'updatedAt'>
): Promise<StudioFormula | null> {
  const current = await fetchFormula();
  const version = (current?.version ?? 0) + 1;
  const { data, error } = await supabase
    .from('ring_formula_versions')
    .insert({ version, data: formula })
    .select()
    .single();
  if (error || !data) return null;
  const row = data as FormulaRow;
  return { version: row.version, updatedAt: row.created_at, ...row.data };
}

/* ---------------- 취향 피드백 ---------------- */

export function recordFeedback(event: {
  action: 'favorite' | 'unfavorite' | 'tag' | 'untag' | 'snapshot' | 'restore';
  projectId?: string;
  snapshotId?: string;
  tag?: string;
  metal?: MetalKey;
  mode?: string;
  params?: RingParams;
  formulaVersion?: number;
}): void {
  void supabase
    .from('ring_feedback_events')
    .insert({
      action: event.action,
      project_id: event.projectId ?? null,
      snapshot_id: event.snapshotId ?? null,
      tag: event.tag ?? null,
      metal: event.metal ?? null,
      mode: event.mode ?? null,
      params: event.params ?? null,
      formula_version: event.formulaVersion ?? null,
    })
    .then(() => undefined);
}

interface FeedbackRow {
  action: string;
  metal: string | null;
  mode: string | null;
  tag: string | null;
  params: Record<string, number> | null;
}

export async function fetchInsights(): Promise<Insights | null> {
  const { data, error } = await supabase
    .from('ring_feedback_events')
    .select('action, metal, mode, tag, params')
    .order('id', { ascending: true })
    .limit(5000);
  if (error || !data) return null;

  const ins: Insights = {
    totalEvents: data.length,
    favorites: 0,
    byMetal: {},
    byMode: {},
    tagCounts: [],
    favoriteParamAverages: null,
  };
  const tags = new Map<string, number>();
  const favParams: Record<string, number>[] = [];

  const bump = (rec: Record<string, number>, key: string | null, delta = 1) => {
    const k = key ?? 'unknown';
    rec[k] = Math.max(0, (rec[k] ?? 0) + delta);
  };

  for (const e of data as FeedbackRow[]) {
    if (e.action === 'favorite') {
      ins.favorites += 1;
      bump(ins.byMetal, e.metal);
      bump(ins.byMode, e.mode);
      if (e.params) favParams.push(e.params);
    }
    if (e.action === 'unfavorite') {
      ins.favorites = Math.max(0, ins.favorites - 1);
      bump(ins.byMetal, e.metal, -1);
      bump(ins.byMode, e.mode, -1);
    }
    if (e.action === 'tag' && e.tag) tags.set(e.tag, (tags.get(e.tag) ?? 0) + 1);
    if (e.action === 'untag' && e.tag) tags.set(e.tag, Math.max(0, (tags.get(e.tag) ?? 0) - 1));
  }

  ins.tagCounts = [...tags.entries()]
    .filter(([, c]) => c > 0)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  if (favParams.length > 0) {
    const keys = ['innerDiameter', 'bandWidth', 'baseThickness', 'amplitude', 'bandThickness', 'engraveDepth', 'smoothing'];
    ins.favoriteParamAverages = Object.fromEntries(
      keys.map((k) => [
        k,
        Number((favParams.reduce((s, p) => s + (Number(p[k]) || 0), 0) / favParams.length).toFixed(2)),
      ])
    );
  }
  return ins;
}
