'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import Link from 'next/link';
import { getProfile, updateProfile, ArtistProfile, getSocialMedia, updateSocialMedia, SocialMedia, getLabelSettings, LabelSettings } from '@/lib/api';
import { useLanguage, LANGUAGES } from '@/contexts/LanguageContext';

function FieldInput({ label, placeholder, value, onChange, type = 'text' }: {
  label: string; placeholder: string; value?: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-default-500 block uppercase tracking-wide">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-content1 border border-divider rounded-xl text-foreground placeholder:text-default-400 focus:outline-none focus:border-primary transition-colors text-sm"
      />
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-content1 border border-divider rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-divider flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const { artist, loading: authLoading, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [labelSettings, setLabelSettings] = useState<LabelSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSocial, setSavingSocial] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState<ArtistProfile>({
    email: '', phone: '', address_line1: '', address_line2: '',
    city: '', postal_code: '', country: '',
    bank_name: '', account_holder: '', iban: '', bic: '', siret: '', vat_number: '',
  });

  const [socialData, setSocialData] = useState<SocialMedia>({
    instagram_url: '', twitter_url: '', facebook_url: '', tiktok_url: '', youtube_url: '',
  });

  useEffect(() => {
    if (artist) loadData();
  }, [artist]);

  const loadData = async () => {
    try {
      const [profileData, social, settings] = await Promise.all([getProfile(), getSocialMedia(), getLabelSettings()]);
      setLabelSettings(settings);
      setFormData({
        email: profileData.email || '',
        phone: profileData.phone || '',
        address_line1: profileData.address_line1 || '',
        address_line2: profileData.address_line2 || '',
        city: profileData.city || '',
        postal_code: profileData.postal_code || '',
        country: profileData.country || '',
        bank_name: profileData.bank_name || '',
        account_holder: profileData.account_holder || '',
        iban: profileData.iban || '',
        bic: profileData.bic || '',
        siret: profileData.siret || '',
        vat_number: profileData.vat_number || '',
      });
      setSocialData({
        instagram_url: social.instagram_url || '',
        twitter_url: social.twitter_url || '',
        facebook_url: social.facebook_url || '',
        tiktok_url: social.tiktok_url || '',
        youtube_url: social.youtube_url || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('app.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const dataToSend: Partial<ArtistProfile> = {};
      Object.entries(formData).forEach(([key, value]) => {
        if (value && value.trim()) dataToSend[key as keyof ArtistProfile] = value.trim();
      });
      await updateProfile(dataToSend);
      setSuccess(t('settings.profileSaved'));
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('app.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleSocialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSavingSocial(true);
    try {
      const dataToSend: Partial<SocialMedia> = {};
      Object.entries(socialData).forEach(([key, value]) => {
        dataToSend[key as keyof SocialMedia] = value?.trim() || '';
      });
      await updateSocialMedia(dataToSend);
      setSuccess(t('settings.socialSaved'));
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('app.error'));
    } finally {
      setSavingSocial(false);
    }
  };

  const handleChange = (field: keyof ArtistProfile, value: string) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  const handleSocialChange = (field: keyof SocialMedia, value: string) =>
    setSocialData(prev => ({ ...prev, [field]: value }));

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Spinner size="lg" color="primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background safe-top">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-md border-b border-divider">
        <div className="px-4 py-3 flex items-center gap-3 max-w-lg mx-auto">
          <Link href="/" className="p-2 -ml-2 rounded-xl hover:bg-content1 transition-colors">
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1">
            <h1 className="font-semibold text-foreground text-sm">{t('settings.myProfile')}</h1>
            <p className="text-[10px] text-default-400">{artist?.name}</p>
          </div>
          {(labelSettings?.logo_base64 || labelSettings?.logo_url) && (
            <img
              src={labelSettings.logo_base64 || labelSettings.logo_url}
              alt={labelSettings.label_name || 'Label'}
              className="h-7 w-auto max-w-[80px] object-contain opacity-70"
            />
          )}
        </div>
      </header>

      <main className="px-4 py-4 pb-28 max-w-lg mx-auto space-y-4">
        {/* Alerts */}
        {error && (
          <div className="p-3 bg-danger/10 border border-danger/20 rounded-2xl">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-emerald-400 text-sm">{success}</p>
          </div>
        )}

        {/* Profile form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Section title={t('settings.contact')} icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
            </svg>
          }>
            <FieldInput label={t('settings.email')} type="email" placeholder="votre@email.com" value={formData.email} onChange={v => handleChange('email', v)} />
            <FieldInput label={t('settings.phone')} type="tel" placeholder="+33 6 12 34 56 78" value={formData.phone} onChange={v => handleChange('phone', v)} />
          </Section>

          <Section title={t('settings.address')} icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }>
            <FieldInput label={t('settings.addressLine1')} placeholder="123 rue de la Musique" value={formData.address_line1} onChange={v => handleChange('address_line1', v)} />
            <FieldInput label={t('settings.addressLine2')} placeholder="Appartement, bâtiment…" value={formData.address_line2} onChange={v => handleChange('address_line2', v)} />
            <div className="grid grid-cols-2 gap-3">
              <FieldInput label={t('settings.postalCode')} placeholder="75001" value={formData.postal_code} onChange={v => handleChange('postal_code', v)} />
              <FieldInput label={t('settings.city')} placeholder="Paris" value={formData.city} onChange={v => handleChange('city', v)} />
            </div>
            <FieldInput label={t('settings.country')} placeholder="France" value={formData.country} onChange={v => handleChange('country', v)} />
          </Section>

          <Section title={t('settings.bankDetails')} icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          }>
            <FieldInput label={t('settings.accountHolder')} placeholder="Nom complet ou raison sociale" value={formData.account_holder} onChange={v => handleChange('account_holder', v)} />
            <FieldInput label={t('settings.bankName')} placeholder="Crédit Agricole" value={formData.bank_name} onChange={v => handleChange('bank_name', v)} />
            <FieldInput label={t('settings.iban')} placeholder="FR76 1234 5678 9012 3456 7890 123" value={formData.iban} onChange={v => handleChange('iban', v)} />
            <FieldInput label={t('settings.bic')} placeholder="AGRIFRPP" value={formData.bic} onChange={v => handleChange('bic', v)} />
          </Section>

          <Section title={t('settings.legalInfo')} icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }>
            <FieldInput label={t('settings.siret')} placeholder="123 456 789 00012" value={formData.siret} onChange={v => handleChange('siret', v)} />
            <FieldInput label={t('settings.vatNumber')} placeholder="FR12345678901" value={formData.vat_number} onChange={v => handleChange('vat_number', v)} />
          </Section>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-primary text-white font-semibold rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <><Spinner size="sm" color="white" />{t('settings.saving')}</> : t('settings.saveChanges')}
          </button>
        </form>

        {/* Social media form */}
        <form onSubmit={handleSocialSubmit} className="space-y-4">
          <Section title={t('settings.socialMedia')} icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          }>
            <p className="text-xs text-default-400">{t('settings.socialMediaDesc')}</p>
            {[
              { field: 'instagram_url' as keyof SocialMedia, label: 'Instagram', placeholder: 'https://instagram.com/…' },
              { field: 'twitter_url' as keyof SocialMedia, label: 'Twitter / X', placeholder: 'https://x.com/…' },
              { field: 'facebook_url' as keyof SocialMedia, label: 'Facebook', placeholder: 'https://facebook.com/…' },
              { field: 'tiktok_url' as keyof SocialMedia, label: 'TikTok', placeholder: 'https://tiktok.com/@…' },
              { field: 'youtube_url' as keyof SocialMedia, label: 'YouTube', placeholder: 'https://youtube.com/@…' },
            ].map(({ field, label, placeholder }) => (
              <FieldInput
                key={field}
                label={label}
                placeholder={placeholder}
                value={socialData[field]}
                onChange={v => handleSocialChange(field, v)}
                type="url"
              />
            ))}
          </Section>

          <button
            type="submit"
            disabled={savingSocial}
            className="w-full py-3 bg-primary text-white font-semibold rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {savingSocial ? <><Spinner size="sm" color="white" />{t('settings.saving')}</> : t('settings.saveNetworks')}
          </button>

          <p className="text-[10px] text-default-400 text-center">
            {t('settings.notificationInfo')} {labelSettings?.label_name || 'label'} {t('settings.forVerification')}
          </p>
        </form>

        {/* Language */}
        <div className="bg-content1 border border-divider rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-divider flex items-center gap-2">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            <h2 className="text-sm font-semibold text-foreground">{t('settings.language')}</h2>
          </div>
          <div className="p-4 grid grid-cols-2 gap-2">
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  language === lang.code
                    ? 'bg-primary text-white'
                    : 'bg-content2 text-foreground hover:bg-content3'
                }`}
              >
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="w-full py-3 text-danger hover:bg-danger/10 rounded-2xl transition-colors flex items-center justify-center gap-2 text-sm font-medium border border-divider bg-content1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {t('settings.logout')}
        </button>
      </main>
    </div>
  );
}
