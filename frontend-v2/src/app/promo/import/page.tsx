'use client';

import { useState } from 'react';
import { Tab, Tabs } from '@heroui/react';
import { useRouter } from 'next/navigation';
import SubmitHubUploadFlow from '@/components/promo/SubmitHubUploadFlow';
import GrooverUploadFlow from '@/components/promo/GrooverUploadFlow';
import ManualPromoForm from '@/components/promo/ManualPromoForm';

export default function PromoImportPage() {
  const [selected, setSelected] = useState<string>('submithub');
  const router = useRouter();

  const handleSuccess = () => {
    router.push('/promo/submissions');
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Import Promo</h1>
        <p className="text-gray-600">
          Importez vos campagnes promo depuis SubmitHub ou Groover, ou ajoutez des liens manuellement.
        </p>
      </div>

      <Tabs
        selectedKey={selected}
        onSelectionChange={(key) => setSelected(key as string)}
        classNames={{
          tabList: 'bg-white border border-gray-200 rounded-lg p-1',
          tab: 'text-sm font-medium',
          tabContent: 'group-data-[selected=true]:text-blue-600',
          cursor: 'bg-blue-50 border border-blue-200',
        }}
      >
        <Tab key="submithub" title="📊 SubmitHub">
          <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">Import SubmitHub CSV</h2>
            <p className="text-gray-600 mb-4">
              Exportez votre historique de soumissions depuis SubmitHub et importez le CSV ici.
            </p>

            <SubmitHubUploadFlow onSuccess={handleSuccess} />
          </div>
        </Tab>

        <Tab key="groover" title="🎵 Groover">
          <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">Import Groover CSV</h2>
            <p className="text-gray-600 mb-4">
              Exportez votre historique de campagnes depuis Groover et importez le CSV ici.
            </p>

            <GrooverUploadFlow onSuccess={handleSuccess} />
          </div>
        </Tab>

        <Tab key="manual" title="✍️ Manuel">
          <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">Ajout manuel</h2>
            <p className="text-gray-600 mb-4">
              Ajoutez manuellement un lien promo qui n'est ni sur SubmitHub ni sur Groover.
            </p>

            <ManualPromoForm onSuccess={handleSuccess} />
          </div>
        </Tab>
      </Tabs>
    </div>
  );
}
