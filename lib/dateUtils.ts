import { Timestamp } from 'firebase/firestore';

export function format(ts: Timestamp | undefined | null): string {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts as any);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari lalu`;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatFull(ts: Timestamp | undefined | null): string {
  if (!ts) return '-';
  const date = ts.toDate ? ts.toDate() : new Date(ts as any);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
