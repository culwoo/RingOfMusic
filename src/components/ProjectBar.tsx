import { useState } from 'react';
import { ProjectRecord } from '../lib/studioApi';

interface Props {
  projects: ProjectRecord[];
  activeId: string | null;
  saveState: string;
  onSelect: (id: string) => void;
  onCreate: (input: { name: string; client: string; story: string }) => void;
  onLogout: () => void;
}

/** 고객 프로젝트 선택/생성 바. 모든 디자인 작업은 프로젝트에 귀속되어 자동 저장된다. */
export default function ProjectBar({ projects, activeId, saveState, onSelect, onCreate, onLogout }: Props) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [story, setStory] = useState('');
  const active = projects.find((p) => p.id === activeId);

  const submit = () => {
    if (!name.trim()) return;
    onCreate({ name: name.trim(), client: client.trim(), story: story.trim() });
    setName('');
    setClient('');
    setStory('');
    setCreating(false);
  };

  return (
    <div className="project-bar">
      <span className="project-bar-label">프로젝트</span>
      <select
        value={activeId ?? ''}
        onChange={(e) => e.target.value && onSelect(e.target.value)}
      >
        <option value="" disabled>
          {projects.length === 0 ? '프로젝트 없음 - 새로 만드세요' : '프로젝트 선택'}
        </option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.client ? ` - ${p.client}` : ''}
          </option>
        ))}
      </select>
      <button className="btn btn-ghost" onClick={() => setCreating((v) => !v)}>
        {creating ? '취소' : '+ 새 프로젝트'}
      </button>
      {active?.story ? (
        <span className="project-story" title={active.story}>
          {active.story}
        </span>
      ) : null}
      <span className="save-state">{saveState}</span>
      <button className="btn btn-ghost" onClick={onLogout}>
        로그아웃
      </button>

      {creating ? (
        <div className="project-create">
          <input
            autoFocus
            placeholder="프로젝트명 (예: 노을 프러포즈)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <input
            placeholder="고객 (예: 민서 & 준)"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <input
            placeholder="이야기/메모 (선택)"
            value={story}
            onChange={(e) => setStory(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <button className="btn btn-primary" onClick={submit} disabled={!name.trim()}>
            만들기
          </button>
        </div>
      ) : null}
    </div>
  );
}
