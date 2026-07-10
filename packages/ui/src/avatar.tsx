import { cn } from './cn';

export interface AvatarProps {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
}

export function Avatar({ src, name, size = 40, className }: AvatarProps) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <span
      className={cn('mq-avatar', className)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {src ? <img src={src} alt={name} /> : <span aria-hidden>{initials}</span>}
    </span>
  );
}
