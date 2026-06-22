'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SubmitHubUploadFlow from '@/components/promo/SubmitHubUploadFlow';
import GrooverUploadFlow from '@/components/promo/GrooverUploadFlow';
import ManualPromoForm from '@/components/promo/ManualPromoForm';
import { Card, OutlineButton } from '@/components/roy/ui';
import { IconChart, IconMusic, IconContract, IconChevronRight } from '@/components/roy/icons';

const TABS = [
  {
    key: 'submithub',
    label: 'SubmitHub',
    icon: IconChart,
    title: 'Import SubmitHub CSV',
    desc: 'Exportez votre historique de soumissions depuis SubmitHub et importez le CSV ici.',
  },
  {
    key: 'groover',
    label: 'Groover',
    icon: IconMusic,
    title: 'Import Groover CSV',
    desc: 'Exportez votre historique de campagnes depuis Groover et importez le CSV ici.',
  },
  {
    key: 'manual',
    label: 'Manuel',
    icon: IconContract,
    title: 'Ajout manuel',
    desc: "Ajoutez manuellement un lien promo qui n'est ni sur SubmitHub ni sur Groover.",
  },
] as const;

export default function PromoImportPage() {
  const [selected, setSelected] = useState<string>('submithub');
  const router = useRouter();

  const handleSuccess = () => {
    router.push('/promo/submissions');
  };

  const active = TABS.find((t) => t.key === selected) ?? TABS[0];

  return (
    <div className="min-h-full bg-app">
      {/* Topbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 lg:px-7 py-5 border-b border-line">
        <div>
          <h1 className="text-[20px] lg:text-[21px] font-bold tracking-[-0.02em] text-ink">Import Promo</h1>
          <p className="text-[12.5px] text-ink-faint mt-0.5">
            Importez vos campagnes depuis SubmitHub ou Groover, ou ajoutez des liens manuellement.
          </p>
        </div>
        <OutlineButton onClick={() => router.push('/promo/submissions')}>
          Submissions <IconChevronRight size={14} />
        </OutlineButton>
      </div>

      <div className="px-5 lg:px-7 py-5 lg:py-6 space-y-4 max-w-[1200px]">
        {/* Tab switcher */}
        <div className="flex gap-1 rounded-[11px] border border-line bg-surface p-1 w-fit">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = selected === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setSelected(t.key)}
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12.5px] transition-colors ${
                  isActive ? 'bg-accent-soft text-accent font-semibold' : 'text-ink-muted hover:text-ink font-medium'
                }`}
              >
                <Icon size={15} /> {t.label}
              </button>
            );
          })}
        </div>

        <Card>
          <h2 className="text-[15px] font-bold text-ink">{active.title}</h2>
          <p className="text-[12.5px] text-ink-faint mt-1 mb-5">{active.desc}</p>

          {selected === 'submithub' && <SubmitHubUploadFlow onSuccess={handleSuccess} />}
          {selected === 'groover' && <GrooverUploadFlow onSuccess={handleSuccess} />}
          {selected === 'manual' && <ManualPromoForm onSuccess={handleSuccess} />}
        </Card>
      </div>
    </div>
  );
}
