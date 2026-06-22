'use client';

import { useState, useEffect, useRef } from 'react';
import { Spinner } from '@heroui/react';
import { getLabelSettings, updateLabelSettings, uploadLabelLogo, deleteLabelLogo, uploadLabelLogoDark, deleteLabelLogoDark, type LabelSettings } from '@/lib/api';
import { Card, Eyebrow, AccentButton, OutlineButton } from '@/components/roy/ui';
import { IconCheck } from '@/components/roy/icons';
import { useTheme, ACCENTS } from '@/contexts/ThemeContext';

export default function SettingsPage() {
  const { theme, setTheme, accent, setAccent } = useTheme();
  const [settings, setSettings] = useState<LabelSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputDarkRef = useRef<HTMLInputElement>(null);

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
      setSuccess('Parametres sauvegardes');
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
      setSuccess('Logo uploade');
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
      setSuccess('Logo supprime');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoDarkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setSaving(true);
      setError(null);
      const updated = await uploadLabelLogoDark(file);
      setSettings(updated);
      setSuccess('Logo mode sombre uploade');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'upload');
    } finally {
      setSaving(false);
      if (fileInputDarkRef.current) fileInputDarkRef.current.value = '';
    }
  };

  const handleDeleteLogoDark = async () => {
    try {
      setSaving(true);
      setError(null);
      const updated = await deleteLabelLogoDark();
      setSettings(updated);
      setSuccess('Logo mode sombre supprime');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  const logoSrc = settings?.logo_base64 || settings?.logo_url;
  const logoDarkSrc = settings?.logo_dark_base64;

  const inputClass =
    'w-full h-12 px-4 bg-surface border border-line rounded-[10px] text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong transition-colors';
  const labelClass = 'roy-eyebrow text-[9.5px] mb-1.5 block';

  return (
    <div className="min-h-full bg-app">
      {/* Topbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 lg:px-7 py-5 border-b border-line">
        <div>
          <h1 className="text-[20px] lg:text-[21px] font-bold tracking-[-0.02em] text-ink">Réglages</h1>
          <p className="text-[12.5px] text-ink-faint mt-0.5">Configuration du label et de l&apos;interface</p>
        </div>
        <AccentButton onClick={handleSave} disabled={saving}>
          {saving && <Spinner size="sm" color="white" />}
          {saving ? 'Sauvegarde…' : 'Sauvegarder'}
        </AccentButton>
      </div>

      <div className="px-5 lg:px-7 py-5 lg:py-6 space-y-4 max-w-[1200px]">
        {error && (
          <div className="rounded-[12px] border border-line bg-surface px-4 py-3 flex items-center gap-3">
            <svg className="w-4 h-4 text-neg shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-neg text-[12.5px]">{error}</p>
          </div>
        )}

        {success && (
          <div className="rounded-[12px] border border-line bg-accent-soft px-4 py-3 flex items-center gap-3">
            <svg className="w-4 h-4 text-accent shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-accent text-[12.5px] font-semibold">{success}</p>
          </div>
        )}

        {/* Appearance Section */}
        <Card>
          <h2 className="text-[13.5px] font-semibold text-ink mb-4">Apparence</h2>

          <div className="space-y-5">
            <div>
              <Eyebrow className="mb-2 block">Thème</Eyebrow>
              <div className="flex gap-1 rounded-[10px] border border-line bg-surface p-1 w-fit">
                {([
                  { id: 'light', label: 'Clair' },
                  { id: 'dark', label: 'Sombre' },
                ] as const).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`px-4 py-1.5 rounded-[7px] text-[12px] transition-colors ${
                      theme === t.id ? 'bg-ink text-app font-semibold' : 'text-ink-muted hover:text-ink font-medium'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Eyebrow className="mb-2 block">Couleur d&apos;accent</Eyebrow>
              <div className="flex gap-2.5 flex-wrap">
                {ACCENTS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setAccent(a.id)}
                    aria-label={a.label}
                    className={`relative w-9 h-9 rounded-full transition-transform hover:scale-105 ${
                      accent === a.id ? 'ring-2 ring-offset-2 ring-offset-surface ring-line-strong' : ''
                    }`}
                    style={{ backgroundColor: a.color }}
                  >
                    {accent === a.id && (
                      <span className="absolute inset-0 flex items-center justify-center text-white">
                        <IconCheck size={16} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Logo Section */}
        <Card>
          <h2 className="text-[13.5px] font-semibold text-ink mb-4">Logo</h2>

          <div className="flex items-start gap-6">
            {logoSrc ? (
              <div className="shrink-0">
                <img
                  src={logoSrc}
                  alt="Logo du label"
                  className="w-32 h-32 object-contain border border-line rounded-[12px] bg-surface-2"
                />
              </div>
            ) : (
              <div className="w-32 h-32 border border-dashed border-line-strong rounded-[12px] flex items-center justify-center text-ink-faint text-[13px] bg-surface-2">
                Pas de logo
              </div>
            )}

            <div className="flex flex-col gap-3">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <OutlineButton onClick={() => fileInputRef.current?.click()}>
                {logoSrc ? 'Changer le logo' : 'Ajouter un logo'}
              </OutlineButton>
              {logoSrc && (
                <button
                  onClick={handleDeleteLogo}
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-[10px] border border-line-strong bg-surface px-3.5 py-2 text-[12px] font-semibold text-neg hover:bg-surface-2 disabled:opacity-50 transition-colors"
                >
                  Supprimer
                </button>
              )}
              <p className="text-[11px] text-ink-faint">
                Logo mode clair (PNG, JPG, WEBP). Max 2 Mo.
              </p>
            </div>
          </div>

          {/* Dark mode logo */}
          <div className="mt-6 pt-6 border-t border-line">
            <p className="text-[12.5px] font-semibold text-ink mb-3">Logo mode sombre</p>
            <div className="flex items-start gap-6">
              {logoDarkSrc ? (
                <div className="shrink-0">
                  <img
                    src={logoDarkSrc}
                    alt="Logo mode sombre"
                    className="w-32 h-auto max-h-20 object-contain rounded-[12px] bg-zinc-900 p-2"
                  />
                </div>
              ) : (
                <div className="w-32 h-20 border border-dashed border-line-strong rounded-[12px] flex items-center justify-center text-ink-faint text-[11px] bg-zinc-900">
                  Pas de logo
                </div>
              )}
              <div className="flex flex-col gap-3">
                <input
                  type="file"
                  ref={fileInputDarkRef}
                  accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                  onChange={handleLogoDarkUpload}
                  className="hidden"
                />
                <OutlineButton onClick={() => fileInputDarkRef.current?.click()}>
                  {logoDarkSrc ? 'Changer' : 'Ajouter'}
                </OutlineButton>
                {logoDarkSrc && (
                  <button
                    onClick={handleDeleteLogoDark}
                    disabled={saving}
                    className="inline-flex items-center justify-center rounded-[10px] border border-line-strong bg-surface px-3.5 py-2 text-[12px] font-semibold text-neg hover:bg-surface-2 disabled:opacity-50 transition-colors"
                  >
                    Supprimer
                  </button>
                )}
                <p className="text-[11px] text-ink-faint">
                  Version blanche/claire pour fond sombre.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Information Section */}
        <Card>
          <h2 className="text-[13.5px] font-semibold text-ink mb-4">Informations</h2>

          <div className="space-y-4">
            <div>
              <label className={labelClass}>Nom du label *</label>
              <input
                type="text"
                value={labelName}
                onChange={(e) => setLabelName(e.target.value)}
                placeholder="Mon Label"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@monlabel.com"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Telephone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+33 1 23 45 67 89"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Site web</label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://monlabel.com"
                className={inputClass}
              />
            </div>
          </div>
        </Card>

        {/* Address Section */}
        <Card>
          <h2 className="text-[13.5px] font-semibold text-ink mb-4">Adresse</h2>

          <div className="space-y-4">
            <div>
              <label className={labelClass}>Adresse ligne 1</label>
              <input
                type="text"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="123 rue de la Musique"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Adresse ligne 2</label>
              <input
                type="text"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                placeholder="Batiment A"
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Code postal</label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="75001"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Ville</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Paris"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Pays</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="France"
                className={inputClass}
              />
            </div>
          </div>
        </Card>

        {/* Legal Section */}
        <Card>
          <h2 className="text-[13.5px] font-semibold text-ink mb-4">Informations legales</h2>

          <div className="space-y-4">
            <div>
              <label className={labelClass}>SIRET</label>
              <input
                type="text"
                value={siret}
                onChange={(e) => setSiret(e.target.value)}
                placeholder="123 456 789 00012"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Numero TVA</label>
              <input
                type="text"
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
                placeholder="FR12345678901"
                className={inputClass}
              />
            </div>
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <AccentButton onClick={handleSave} disabled={saving}>
            {saving && <Spinner size="sm" color="white" />}
            {saving ? 'Sauvegarde…' : 'Sauvegarder'}
          </AccentButton>
        </div>
      </div>
    </div>
  );
}
