import { useState } from 'react';
import { signIn, signUp } from '../lib/studioApi';

/** Supabase 인증 에러를 한국어로 번역 */
function koError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (m.includes('email not confirmed')) return '이메일 확인이 완료되지 않았습니다. 받은 편지함(스팸함 포함)의 확인 메일을 눌러주세요.';
  if (m.includes('user already registered')) return '이미 가입된 이메일입니다. 로그인해 주세요.';
  if (m.includes('password should be at least')) return '비밀번호는 6자 이상이어야 합니다.';
  if (m.includes('rate limit') || m.includes('too many')) return '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.';
  if (m.includes('invalid email') || m.includes('unable to validate email')) return '이메일 형식이 올바르지 않습니다.';
  return `오류: ${message}`;
}

interface Props {
  onClose: () => void;
}

/**
 * 스튜디오 로그인 모달.
 * 허용된 이메일(화이트리스트)로 로그인해야 프로젝트/시안/공식이 열린다.
 * 그 외 계정은 로그인해도 RLS가 모든 데이터를 차단한다.
 */
export default function LoginPanel({ onClose }: Props) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const submit = async () => {
    if (!email.trim() || password.length < 6) {
      setMessage('이메일과 6자 이상 비밀번호를 입력하세요.');
      return;
    }
    setBusy(true);
    setMessage('');
    if (mode === 'signin') {
      const error = await signIn(email.trim(), password);
      setBusy(false);
      if (error) {
        setMessage(koError(error));
      } else {
        onClose();
      }
    } else {
      const error = await signUp(email.trim(), password);
      if (error) {
        setBusy(false);
        setMessage(koError(error));
        return;
      }
      // 화이트리스트 계정은 서버에서 즉시 승인되므로 곧바로 로그인을 시도한다
      const loginError = await signIn(email.trim(), password);
      setBusy(false);
      if (loginError) {
        setMessage('가입은 완료됐습니다. 이메일 확인 후 로그인하세요.');
        setMode('signin');
      } else {
        onClose();
      }
    }
  };

  return (
    <div className="login-backdrop" onClick={onClose}>
      <div className="login-modal" onClick={(e) => e.stopPropagation()}>
        <h2>스튜디오 {mode === 'signin' ? '로그인' : '가입'}</h2>
        <p className="login-hint">
          가입하면 나만의 작업실이 생깁니다. 프로젝트·시안·공식은 내 계정에서만 보입니다.
        </p>
        <input
          type="email"
          placeholder="이메일"
          value={email}
          autoFocus
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
        />
        <input
          type="password"
          placeholder="비밀번호 (6자 이상)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
        />
        <button className="btn btn-primary" onClick={() => void submit()} disabled={busy}>
          {busy ? '처리 중' : mode === 'signin' ? '로그인' : '가입하기'}
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => {
            setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
            setMessage('');
          }}
        >
          {mode === 'signin' ? '처음이면 가입하기' : '이미 계정이 있으면 로그인'}
        </button>
        {message ? <p className="login-msg">{message}</p> : null}
      </div>
    </div>
  );
}
