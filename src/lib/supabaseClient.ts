import { createClient } from '@supabase/supabase-js';

/**
 * Supabase 연결.
 * publishable 키는 공개용으로 설계된 키다 — 실제 접근 제어는 전부 서버측 RLS가 담당하며,
 * ring_allowed_emails 화이트리스트에 있는 계정만 스튜디오 데이터에 접근할 수 있다.
 */
const SUPABASE_URL = 'https://muxgdpmsucycdbyxpgfm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_sMjKFZksLCeiPVy4J_DKgg_vK8Znxx3';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
