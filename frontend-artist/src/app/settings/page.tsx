'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner, Input, Button } from '@heroui/react';
import Link from 'next/link';
import { getProfile, updateProfile, ArtistProfile, getLabelSettings, LabelSettings } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

export default function SettingsPage() {
  const { artist, loading: authLoading, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [profile, setProfile] = useState<ArtistProfile>({});
  const [labelSettings, setLabelSettings] = useState<LabelSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  useEffect(() => {
    if (artist) {
      loadData();
    }
  }, [artist]);

  const loadData = async () => {
    try {
      const [profileData, settings] = await Promise.all([
        getProfile(),
        getLabelSettings(),
      ]);
      setProfile(profileData);
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
          {labelSettings?.label_logo_url && (
            <img
              src={labelSettings.label_logo_url}
              alt={labelSettings.label_name || 'Label'}
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

          {/* Submit Button */}
          <Button
            type="submit"
            color="primary"
            className="w-full"
            size="lg"
            isLoading={saving}
          >
            {saving ? 'Saving...' : 'Save changes'}
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
        {labelSettings?.label_logo_url && (
          <div className="mt-8 text-center">
            <img
              src={labelSettings.label_logo_url}
              alt={labelSettings.label_name || 'Label'}
              className="h-10 w-auto mx-auto opacity-50"
            />
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-divider safe-bottom">
        <div className="flex items-center justify-around py-2">
          <Link href="/" className="flex flex-col items-center gap-1 px-4 py-2 text-secondary-500 hover:text-primary transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs font-medium">Home</span>
          </Link>
          <Link href="/releases" className="flex flex-col items-center gap-1 px-4 py-2 text-secondary-500 hover:text-primary transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span className="text-xs font-medium">Releases</span>
          </Link>
          <Link href="/stats" className="flex flex-col items-center gap-1 px-4 py-2 text-secondary-500 hover:text-primary transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-xs font-medium">Stats</span>
          </Link>
          <Link href="/settings" className="flex flex-col items-center gap-1 px-4 py-2 text-primary">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs font-medium">Profile</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
