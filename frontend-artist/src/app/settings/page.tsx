'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import BottomNav from '@/components/layout/BottomNav';
import { Spinner, Input, Button } from '@heroui/react';
import Link from 'next/link';
import { getProfile, updateProfile, ArtistProfile, getSocialMedia, updateSocialMedia, SocialMedia, getLabelSettings, LabelSettings } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

export default function SettingsPage() {
  const { artist, loading: authLoading, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [profile, setProfile] = useState<ArtistProfile>({});
  const [socialMedia, setSocialMedia] = useState<SocialMedia>({});
  const [labelSettings, setLabelSettings] = useState<LabelSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSocial, setSavingSocial] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<ArtistProfile>({
    email: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    postal_code: '',
    country: '',
    bank_name: '',
    account_holder: '',
    iban: '',
    bic: '',
    siret: '',
    vat_number: '',
  });

  const [socialData, setSocialData] = useState<SocialMedia>({
    instagram_url: '',
    twitter_url: '',
    facebook_url: '',
    tiktok_url: '',
    youtube_url: '',
  });

  useEffect(() => {
    if (artist) {
      loadData();
    }
  }, [artist]);

  const loadData = async () => {
    try {
      const [profileData, socialData, settings] = await Promise.all([
        getProfile(),
        getSocialMedia(),
        getLabelSettings(),
      ]);
      setProfile(profileData);
      setSocialMedia(socialData);
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
        instagram_url: socialData.instagram_url || '',
        twitter_url: socialData.twitter_url || '',
        facebook_url: socialData.facebook_url || '',
        tiktok_url: socialData.tiktok_url || '',
        youtube_url: socialData.youtube_url || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Loading error');
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
      // Only send fields that have values
      const dataToSend: Partial<ArtistProfile> = {};
      Object.entries(formData).forEach(([key, value]) => {
        if (value && value.trim()) {
          dataToSend[key as keyof ArtistProfile] = value.trim();
        }
      });

      const updated = await updateProfile(dataToSend);
      setProfile(updated);
      setSuccess('Profile updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save error');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof ArtistProfile, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSocialChange = (field: keyof SocialMedia, value: string) => {
    setSocialData(prev => ({ ...prev, [field]: value }));
  };

  const handleSocialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSavingSocial(true);

    try {
      // Only send fields that have values
      const dataToSend: Partial<SocialMedia> = {};
      Object.entries(socialData).forEach(([key, value]) => {
        if (value !== undefined) {
          dataToSend[key as keyof SocialMedia] = value.trim() || '';
        }
      });

      const updated = await updateSocialMedia(dataToSend);
      setSocialMedia(updated);
      setSuccess('Social media links updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save error');
    } finally {
      setSavingSocial(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (!artist) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background safe-top safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-divider">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-content2 transition-colors">
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1">
            <h1 className="font-semibold text-foreground">Settings</h1>
            <p className="text-xs text-secondary-500">Contact and bank information</p>
          </div>
          {/* Label Logo */}
          {(labelSettings?.logo_base64 || labelSettings?.logo_url) ? (
            <img
              src={labelSettings.logo_base64 || labelSettings.logo_url}
              alt={labelSettings.label_name || 'Label'}
              className="h-8 w-auto max-w-[100px] object-contain"
            />
          ) : (
            <img
              src="/icon.svg"
              alt="Artist Portal"
              className="h-8 w-auto"
            />
          )}
        </div>
      </header>

      <main className="px-4 py-6 pb-24">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Messages */}
          {error && (
            <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl">
              <p className="text-danger text-sm">{error}</p>
            </div>
          )}
          {success && (
            <div className="p-4 bg-success/10 border border-success/20 rounded-2xl">
              <p className="text-success text-sm">{success}</p>
            </div>
          )}

          {/* Contact Section */}
          <section className="bg-background border border-divider rounded-2xl p-4">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
              </svg>
              Contact
            </h2>
            <div className="space-y-4">
              <Input
                label="Email"
                type="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
              />
              <Input
                label="Phone"
                type="tel"
                placeholder="+1 234 567 8900"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
              />
            </div>
          </section>

          {/* Address Section */}
          <section className="bg-background border border-divider rounded-2xl p-4">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Address
            </h2>
            <div className="space-y-4">
              <Input
                label="Address line 1"
                placeholder="123 Music Street"
                value={formData.address_line1}
                onChange={(e) => handleChange('address_line1', e.target.value)}
              />
              <Input
                label="Address line 2"
                placeholder="Apartment, building..."
                value={formData.address_line2}
                onChange={(e) => handleChange('address_line2', e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Postal code"
                  placeholder="10001"
                  value={formData.postal_code}
                  onChange={(e) => handleChange('postal_code', e.target.value)}
                />
                <Input
                  label="City"
                  placeholder="New York"
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                />
              </div>
              <Input
                label="Country"
                placeholder="United States"
                value={formData.country}
                onChange={(e) => handleChange('country', e.target.value)}
              />
            </div>
          </section>

          {/* Bank Details Section */}
          <section className="bg-background border border-divider rounded-2xl p-4">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              Bank details
            </h2>
            <div className="space-y-4">
              <Input
                label="Account holder"
                placeholder="Full name or business name"
                value={formData.account_holder}
                onChange={(e) => handleChange('account_holder', e.target.value)}
              />
              <Input
                label="Bank name"
                placeholder="Bank of America"
                value={formData.bank_name}
                onChange={(e) => handleChange('bank_name', e.target.value)}
              />
              <Input
                label="IBAN"
                placeholder="US12 3456 7890 1234 5678 9012 345"
                value={formData.iban}
                onChange={(e) => handleChange('iban', e.target.value)}
              />
              <Input
                label="BIC / SWIFT"
                placeholder="BOFAUS3N"
                value={formData.bic}
                onChange={(e) => handleChange('bic', e.target.value)}
              />
            </div>
          </section>

          {/* Legal Section */}
          <section className="bg-background border border-divider rounded-2xl p-4">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Legal information (optional)
            </h2>
            <p className="text-xs text-secondary-500 mb-4">
              If you have a business entity
            </p>
            <div className="space-y-4">
              <Input
                label="Business ID / SIRET"
                placeholder="123 456 789 00012"
                value={formData.siret}
                onChange={(e) => handleChange('siret', e.target.value)}
              />
              <Input
                label="VAT number"
                placeholder="US123456789"
                value={formData.vat_number}
                onChange={(e) => handleChange('vat_number', e.target.value)}
              />
            </div>
          </section>

          {/* Submit Button for Profile */}
          <Button
            type="submit"
            color="primary"
            className="w-full"
            size="lg"
            isLoading={saving}
          >
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </form>

        {/* Social Media Section - Separate form */}
        <form onSubmit={handleSocialSubmit} className="space-y-6 mt-6">
          <section className="bg-background border border-divider rounded-2xl p-4">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Social Media
            </h2>
            <p className="text-xs text-secondary-500 mb-4">
              Share your social media profiles with your label
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Instagram</label>
                <div className="flex items-center gap-2 px-4 py-3 border-2 border-divider rounded-xl focus-within:border-primary transition-colors">
                  <svg className="w-5 h-5 text-secondary-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                  <input
                    type="url"
                    placeholder="https://instagram.com/yourname"
                    value={socialData.instagram_url}
                    onChange={(e) => handleSocialChange('instagram_url', e.target.value)}
                    className="flex-1 bg-transparent outline-none text-foreground placeholder:text-secondary-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Twitter / X</label>
                <div className="flex items-center gap-2 px-4 py-3 border-2 border-divider rounded-xl focus-within:border-primary transition-colors">
                  <svg className="w-5 h-5 text-secondary-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  <input
                    type="url"
                    placeholder="https://twitter.com/yourname"
                    value={socialData.twitter_url}
                    onChange={(e) => handleSocialChange('twitter_url', e.target.value)}
                    className="flex-1 bg-transparent outline-none text-foreground placeholder:text-secondary-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Facebook</label>
                <div className="flex items-center gap-2 px-4 py-3 border-2 border-divider rounded-xl focus-within:border-primary transition-colors">
                  <svg className="w-5 h-5 text-secondary-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  <input
                    type="url"
                    placeholder="https://facebook.com/yourname"
                    value={socialData.facebook_url}
                    onChange={(e) => handleSocialChange('facebook_url', e.target.value)}
                    className="flex-1 bg-transparent outline-none text-foreground placeholder:text-secondary-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">TikTok</label>
                <div className="flex items-center gap-2 px-4 py-3 border-2 border-divider rounded-xl focus-within:border-primary transition-colors">
                  <svg className="w-5 h-5 text-secondary-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
                  </svg>
                  <input
                    type="url"
                    placeholder="https://tiktok.com/@yourname"
                    value={socialData.tiktok_url}
                    onChange={(e) => handleSocialChange('tiktok_url', e.target.value)}
                    className="flex-1 bg-transparent outline-none text-foreground placeholder:text-secondary-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">YouTube</label>
                <div className="flex items-center gap-2 px-4 py-3 border-2 border-divider rounded-xl focus-within:border-primary transition-colors">
                  <svg className="w-5 h-5 text-secondary-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  <input
                    type="url"
                    placeholder="https://youtube.com/@yourname"
                    value={socialData.youtube_url}
                    onChange={(e) => handleSocialChange('youtube_url', e.target.value)}
                    className="flex-1 bg-transparent outline-none text-foreground placeholder:text-secondary-400"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Submit Button for Social Media */}
          <Button
            type="submit"
            color="primary"
            className="w-full"
            size="lg"
            isLoading={savingSocial}
          >
            {savingSocial ? 'Saving...' : 'Save social media'}
          </Button>

          {/* Info notice */}
          <p className="text-xs text-secondary-500 text-center">
            Changes to your information will be sent to {labelSettings?.label_name || 'our team'} for verification.
          </p>
        </form>

        {/* Language Section */}
        <div className="mt-8 pt-6 border-t border-divider">
          <h3 className="text-sm font-semibold text-secondary-500 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            {t('settings.language')}
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setLanguage('fr')}
              className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                language === 'fr'
                  ? 'bg-primary text-white'
                  : 'bg-content2 text-foreground hover:bg-content3'
              }`}
            >
              Francais
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                language === 'en'
                  ? 'bg-primary text-white'
                  : 'bg-content2 text-foreground hover:bg-content3'
              }`}
            >
              English
            </button>
          </div>
        </div>

        {/* Logout Section */}
        <div className="mt-6 pt-6 border-t border-divider">
          <button
            onClick={logout}
            className="w-full py-3 text-danger hover:bg-danger/10 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {t('settings.logout')}
          </button>
        </div>

        {/* Footer with logo */}
        <div className="mt-8 text-center">
          <img
            src="/icon.svg"
            alt="Artist Portal"
            className="h-10 w-auto mx-auto opacity-50"
          />
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
