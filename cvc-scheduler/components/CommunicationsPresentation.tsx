import type { LucideIcon } from 'lucide-react';
import { communicationStatusTone } from '@/lib/notifications/communicationPresentation';
import styles from './CommunicationsWorkspace.module.css';

export function CommunicationStatus({ state, children }: { state: string; children: React.ReactNode }) {
  return <span className={styles.status} data-tone={communicationStatusTone(state)}><span aria-hidden="true" className={styles.statusDot} />{children}</span>;
}

export function CommunicationIcon({ icon: Icon, tone = 'blue' }: { icon: LucideIcon; tone?: 'blue' | 'teal' | 'lavender' | 'slate' }) {
  return <span className={styles.iconWell} data-tone={tone} aria-hidden="true"><Icon /></span>;
}
