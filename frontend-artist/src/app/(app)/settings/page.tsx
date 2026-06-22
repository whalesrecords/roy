'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import { getProfile, updateProfile, ArtistProfile, getSocialMedia, updateSocialMedia, SocialMedia, getLabelSettings, LabelSettings } from '@/lib/api';
import { useLanguage, LANGUAGES } from '@/contexts/LanguageContext';
import { useTheme, ACCENTS } from '@/contexts/ThemeContext';
import { Card, Eyebrow, AccentButton } from '@/components/roy/ui';
import { IconUser, IconCard, IconFile, IconCheck } from '@/components/roy/icons';

function FieldInput({ label, placeholder, value, onChange, type = 'text' }: {
  label: string; placeholder: string; value?: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Eyebrow>{label}</Eyebrow>
      <input
        type={type}
        placeholder={placeholder}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-surface border border-line rounded-[12px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong transition-colors text-[14px]"
      />
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="px-[18px] py-3.5 border-b border-line flex items-center gap-2.5">
        <span className="text-ink-muted">{icon}</span>
        <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
      </div>
      <div className="p-[18px] space-y-4">{children}</div>
    </Card>
  );
}

export default function SettingsPage() {
  const { artist, loading: authLoading, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme, accent, setAccent } = useTheme();
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

  return (
    <div className="min-h-screen bg-app">
      {/* Desktop topbar */}
      <div className="hidden lg:flex items-center justify-between px-7 py-[22px] border-b border-line">
        <div>
          <div className="text-[21px] font-bold tracking-[-0.02em] text-ink">{t('settings.title') || 'Réglages'}</div>
          <div className="text-[12.5px] text-ink-faint mt-0.5">Profil, coordonnées bancaires et préférences</div>
        </div>
      </div>

      <main className="px-4 py-4 pb-28 lg:px-7 lg:py-6 lg:pb-10 max-w-lg lg:max-w-none mx-auto space-y-3 lg:space-y-4">
        {(authLoading || loading) && (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" color="primary" />
          </div>
        )}
        {!authLoading && !loading && (
        <>
        {error && (
          <div className="p-3 bg-neg/10 border border-neg/20 rounded-[14px]">
            <p className="text-neg text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="p-3 bg-accent-soft border border-accent/20 rounded-[14px] flex items-center gap-2">
            <span className="text-accent shrink-0"><IconCheck size={16} /></span>
            <p className="text-accent text-sm">{success}</p>
          </div>
        )}

        <div className="lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start space-y-3 lg:space-y-0">
          {/* Profile form */}
          <form onSubmit={handleSubmit} className="space-y-3 lg:space-y-4">
            <Section title={t('settings.contact')} icon={<IconUser size={18} />}>
              <FieldInput label={t('settings.email')} type="email" placeholder="votre@email.com" value={formData.email} onChange={v => handleChange('email', v)} />
              <FieldInput label={t('settings.phone')} type="tel" placeholder="+33 6 12 34 56 78" value={formData.phone} onChange={v => handleChange('phone', v)} />
            </Section>

            <Section title={t('settings.address')} icon={
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
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

            <Section title={t('settings.bankDetails')} icon={<IconCard size={18} />}>
              <FieldInput label={t('settings.accountHolder')} placeholder="Nom complet ou raison sociale" value={formData.account_holder} onChange={v => handleChange('account_holder', v)} />
              <FieldInput label={t('settings.bankName')} placeholder="Crédit Agricole" value={formData.bank_name} onChange={v => handleChange('bank_name', v)} />
              <FieldInput label={t('settings.iban')} placeholder="FR76 1234 5678 9012 3456 7890 123" value={formData.iban} onChange={v => handleChange('iban', v)} />
              <FieldInput label={t('settings.bic')} placeholder="AGRIFRPP" value={formData.bic} onChange={v => handleChange('bic', v)} />
            </Section>

            <Section title={t('settings.legalInfo')} icon={<IconFile size={18} />}>
              <FieldInput label={t('settings.siret')} placeholder="123 456 789 00012" value={formData.siret} onChange={v => handleChange('siret', v)} />
              <FieldInput label={t('settings.vatNumber')} placeholder="FR12345678901" value={formData.vat_number} onChange={v => handleChange('vat_number', v)} />
            </Section>

            <AccentButton type="submit" disabled={saving} className="w-full py-3">
              {saving ? <><Spinner size="sm" color="white" />{t('settings.saving')}</> : t('settings.saveChanges')}
            </AccentButton>
          </form>

          {/* Right column: social + preferences */}
          <div className="space-y-3 lg:space-y-4">
            {/* Social media form */}
            <form onSubmit={handleSocialSubmit} className="space-y-3 lg:space-y-4">
              <Section title={t('settings.socialMedia')} icon={
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              }>
                <p className="text-[12px] text-ink-faint">{t('settings.socialMediaDesc')}</p>
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

              <AccentButton type="submit" disabled={savingSocial} className="w-full py-3">
                {savingSocial ? <><Spinner size="sm" color="white" />{t('settings.saving')}</> : t('settings.saveNetworks')}
              </AccentButton>

              <p className="text-[10.5px] text-ink-faint text-center">
                {t('settings.notificationInfo')} {labelSettings?.label_name || 'label'} {t('settings.forVerification')}
              </p>
            </form>

            {/* Appearance: theme + accent */}
            <Card padded={false} className="overflow-hidden">
              <div className="px-[18px] py-3.5 border-b border-line flex items-center gap-2.5">
                <span className="text-ink-muted">
                  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="4" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
                  </svg>
                </span>
                <h2 className="text-[14px] font-semibold text-ink">Apparence</h2>
              </div>
              <div className="p-[18px] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13.5px] font-medium text-ink">Thème sombre</div>
                    <div className="text-[11.5px] text-ink-faint mt-0.5">Basculer clair / sombre</div>
                  </div>
                  <button
                    type="button"
                    onClick={toggleTheme}
                    aria-label="Basculer le thème"
                    className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${theme === 'dark' ? 'bg-accent' : 'bg-track'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-surface shadow-roy transition-transform ${theme === 'dark' ? 'translate-x-5' : ''}`} />
                  </button>
                </div>
                <div className="space-y-2">
                  <Eyebrow>Accent</Eyebrow>
                  <div className="flex gap-2.5">
                    {ACCENTS.map(a => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setAccent(a.id)}
                        aria-label={a.label}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-transform ${accent === a.id ? 'ring-2 ring-offset-2 ring-offset-surface ring-line-strong scale-105' : ''}`}
                        style={{ backgroundColor: a.color }}
                      >
                        {accent === a.id && <span className="text-white"><IconCheck size={15} /></span>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Language */}
            <Card padded={false} className="overflow-hidden">
              <div className="px-[18px] py-3.5 border-b border-line flex items-center gap-2.5">
                <span className="text-ink-muted">
                  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                  </svg>
                </span>
                <h2 className="text-[14px] font-semibold text-ink">{t('settings.language')}</h2>
              </div>
              <div className="p-[18px] grid grid-cols-2 gap-2">
                {LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-[11px] text-[13px] font-medium transition-colors ${
                      language === lang.code
                        ? 'bg-accent text-accent-ink'
                        : 'bg-surface-2 text-ink hover:bg-surface-2/70'
                    }`}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                  </button>
                ))}
              </div>
            </Card>

            {/* Logout */}
            <button
              onClick={logout}
              className="w-full py-3 text-neg hover:bg-neg/10 rounded-[14px] transition-colors flex items-center justify-center gap-2 text-sm font-medium border border-line bg-surface"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {t('settings.logout')}
            </button>
          </div>
        </div>
        </>
        )}
      </main>
    </div>
  );
}
