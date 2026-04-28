'use client';

import { SiteAuditWizard } from '@/components/wizard/SiteAuditWizard';

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', background: '#E8E8E8' }}>
      <SiteAuditWizard />
    </div>
  );
}
