import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type Project = { id: string; name: string; city?: string };

type Props = {
  value: string;
  onChange: (id: string) => void;
  className?: string;
};

export default function ProjectPicker({ value, onChange, className = '' }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    api.projects().then((list) => {
      setProjects(list);
      if (!value && list[0]) onChange(list[0].id);
    });
  }, []);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`border border-navy/15 rounded-lg px-3 py-2 text-sm text-navy bg-white ${className}`}
    >
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
          {p.city ? ` · ${p.city}` : ''}
        </option>
      ))}
    </select>
  );
}
