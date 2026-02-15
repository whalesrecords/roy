'use client';

import { useState, useEffect, useRef } from 'react';
import { Spinner } from '@heroui/react';
import { getLabelSettings, updateLabelSettings, uploadLabelLogo, deleteLabelLogo, type LabelSettings } from '@/lib/api';

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  const logoSrc = settings?.logo_base64 || settings?.logo_url;

  return (
    <>
      {/* Header */}
      <header className="bg-background/80 backdrop-blur-md border-b border-divider sticky top-14 z-30">
        <div className="max-w-2xl mx-auto px-6 py-5">
          <h1 className="text-2xl font-bold text-foreground">Parametres</h1>
          <p className="text-secondary-500 text-sm mt-0.5">Configuration du label</p>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <div className="bg-danger/10 border border-danger/20 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-danger/20 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-success/10 border border-success/20 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-success/20 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-success text-sm">{success}</p>
          </div>
        )}

        {/* Logo Section */}
        <div className="bg-background border border-divider rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4">Logo</h2>

          <div className="flex items-start gap-6">
            {logoSrc ? (
              <div className="shrink-0">
                <img
                  src={logoSrc}
                  alt="Logo du label"
                  className="w-32 h-32 object-contain border border-divider rounded-xl bg-content2"
                />
              </div>
            ) : (
              <div className="w-32 h-32 border-2 border-dashed border-default-300 rounded-xl flex items-center justify-center text-secondary-400 text-sm bg-content2">
                Pas de logo
              </div>
            )}

            <div className="flex flex-col gap-3">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={saving}
                className="px-4 py-2.5 bg-content2 text-foreground font-medium text-sm rounded-full hover:bg-content3 disabled:opacity-50 transition-colors border-2 border-default-200"
              >
                {logoSrc ? 'Changer le logo' : 'Ajouter un logo'}
              </button>
              {logoSrc && (
                <button
                  onClick={handleDeleteLogo}
                  disabled={saving}
                  className="px-4 py-2.5 bg-danger/10 text-danger font-medium text-sm rounded-full hover:bg-danger/20 disabled:opacity-50 transition-colors"
                >
                  Supprimer
                </button>
              )}
              <p className="text-xs text-secondary-500">
                PNG, JPG, WEBP ou GIF. Max 2 Mo.
              </p>
            </div>
          </div>
        </div>

        {/* Information Section */}
        <div className="bg-background border border-divider rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4">Informations</h2>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Nom du label *</label>
              <input
                type="text"
                value={labelName}
                onChange={(e) => setLabelName(e.target.value)}
                placeholder="Mon Label"
                className="w-full h-12 px-4 bg-background border-2 border-default-200 rounded-xl text-foreground placeholder:text-secondary-400 focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@monlabel.com"
                className="w-full h-12 px-4 bg-background border-2 border-default-200 rounded-xl text-foreground placeholder:text-secondary-400 focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Telephone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+33 1 23 45 67 89"
                className="w-full h-12 px-4 bg-background border-2 border-default-200 rounded-xl text-foreground placeholder:text-secondary-400 focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Site web</label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://monlabel.com"
                className="w-full h-12 px-4 bg-background border-2 border-default-200 rounded-xl text-foreground placeholder:text-secondary-400 focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Address Section */}
        <div className="bg-background border border-divider rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4">Adresse</h2>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Adresse ligne 1</label>
              <input
                type="text"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="123 rue de la Musique"
                className="w-full h-12 px-4 bg-background border-2 border-default-200 rounded-xl text-foreground placeholder:text-secondary-400 focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Adresse ligne 2</label>
              <input
                type="text"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                placeholder="Batiment A"
                className="w-full h-12 px-4 bg-background border-2 border-default-200 rounded-xl text-foreground placeholder:text-secondary-400 focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Code postal</label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="75001"
                  className="w-full h-12 px-4 bg-background border-2 border-default-200 rounded-xl text-foreground placeholder:text-secondary-400 focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Ville</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Paris"
                  className="w-full h-12 px-4 bg-background border-2 border-default-200 rounded-xl text-foreground placeholder:text-secondary-400 focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Pays</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="France"
                className="w-full h-12 px-4 bg-background border-2 border-default-200 rounded-xl text-foreground placeholder:text-secondary-400 focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Legal Section */}
        <div className="bg-background border border-divider rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4">Informations legales</h2>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">SIRET</label>
              <input
                type="text"
                value={siret}
                onChange={(e) => setSiret(e.target.value)}
                placeholder="123 456 789 00012"
                className="w-full h-12 px-4 bg-background border-2 border-default-200 rounded-xl text-foreground placeholder:text-secondary-400 focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Numero TVA</label>
              <input
                type="text"
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
                placeholder="FR12345678901"
                className="w-full h-12 px-4 bg-background border-2 border-default-200 rounded-xl text-foreground placeholder:text-secondary-400 focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white font-medium rounded-full shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 disabled:opacity-50 transition-all"
          >
            {saving && <Spinner size="sm" color="white" />}
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </>
  );
}
