'use client';

import { useState, useEffect, useRef } from 'react';
import { getLabelSettings, updateLabelSettings, uploadLabelLogo, deleteLabelLogo, type LabelSettings } from '@/lib/api';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

export default function SettingsPage() {
  const [settings, setSettings] = useState<LabelSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [labelName, setLabelName] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [siret, setSiret] = useState('');
  const [vatNumber, setVatNumber] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await getLabelSettings();
      if (data) {
        setSettings(data);
        setLabelName(data.label_name || '');
        setAddressLine1(data.address_line1 || '');
        setAddressLine2(data.address_line2 || '');
        setCity(data.city || '');
        setPostalCode(data.postal_code || '');
        setCountry(data.country || '');
        setEmail(data.email || '');
        setPhone(data.phone || '');
        setWebsite(data.website || '');
        setSiret(data.siret || '');
        setVatNumber(data.vat_number || '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!labelName.trim()) {
      setError('Le nom du label est obligatoire');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const updated = await updateLabelSettings({
        label_name: labelName,
        address_line1: addressLine1 || undefined,
        address_line2: addressLine2 || undefined,
        city: city || undefined,
        postal_code: postalCode || undefined,
        country: country || undefined,
        email: email || undefined,
        phone: phone || undefined,
        website: website || undefined,
        siret: siret || undefined,
        vat_number: vatNumber || undefined,
      });

      setSettings(updated);
      setSuccess('Paramètres sauvegardés');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setSaving(true);
      setError(null);
      const updated = await uploadLabelLogo(file);
      setSettings(updated);
      setSuccess('Logo uploadé');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'upload');
    } finally {
      setSaving(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteLogo = async () => {
    try {
      setSaving(true);
      setError(null);
      const updated = await deleteLabelLogo();
      setSettings(updated);
      setSuccess('Logo supprimé');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6 text-gray-900">Paramètres</h1>
        <div className="text-gray-600">Chargement...</div>
      </div>
    );
  }

  const logoSrc = settings?.logo_base64 || settings?.logo_url;

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">Paramètres du Label</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded">
          {success}
        </div>
      )}

      {/* Logo Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">Logo</h2>

        <div className="flex items-start gap-6">
          {logoSrc ? (
            <div className="flex-shrink-0">
              <img
                src={logoSrc}
                alt="Logo du label"
                className="w-32 h-32 object-contain border border-gray-200 rounded bg-white"
              />
            </div>
          ) : (
            <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400 text-sm">
              Pas de logo
            </div>
          )}

          <div className="flex flex-col gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleLogoUpload}
              className="hidden"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
            >
              {logoSrc ? 'Changer le logo' : 'Ajouter un logo'}
            </Button>
            {logoSrc && (
              <Button
                variant="danger"
                size="sm"
                onClick={handleDeleteLogo}
                disabled={saving}
              >
                Supprimer
              </Button>
            )}
            <p className="text-xs text-gray-500 mt-1">
              PNG, JPG, WEBP ou GIF. Max 2 Mo.
            </p>
          </div>
        </div>
      </div>

      {/* Information Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">Informations</h2>

        <div className="space-y-4">
          <Input
            label="Nom du label *"
            value={labelName}
            onChange={(e) => setLabelName(e.target.value)}
            placeholder="Mon Label"
          />

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="contact@monlabel.com"
          />

          <Input
            label="Téléphone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+33 1 23 45 67 89"
          />

          <Input
            label="Site web"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://monlabel.com"
          />
        </div>
      </div>

      {/* Address Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">Adresse</h2>

        <div className="space-y-4">
          <Input
            label="Adresse ligne 1"
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
            placeholder="123 rue de la Musique"
          />

          <Input
            label="Adresse ligne 2"
            value={addressLine2}
            onChange={(e) => setAddressLine2(e.target.value)}
            placeholder="Bâtiment A"
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Code postal"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="75001"
            />

            <Input
              label="Ville"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Paris"
            />
          </div>

          <Input
            label="Pays"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="France"
          />
        </div>
      </div>

      {/* Legal Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">Informations légales</h2>

        <div className="space-y-4">
          <Input
            label="SIRET"
            value={siret}
            onChange={(e) => setSiret(e.target.value)}
            placeholder="123 456 789 00012"
          />

          <Input
            label="Numéro TVA"
            value={vatNumber}
            onChange={(e) => setVatNumber(e.target.value)}
            placeholder="FR12345678901"
          />
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </Button>
      </div>
    </div>
  );
}
