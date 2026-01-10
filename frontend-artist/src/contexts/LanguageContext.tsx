'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'fr' | 'en';

interface Translations {
  [key: string]: string;
}

const translations: Record<Language, Translations> = {
  fr: {
    // Common
    'app.name': 'Whales Records - Espace Artiste',
    'app.loading': 'Chargement...',
    'app.error': 'Erreur',
    'app.save': 'Enregistrer',
    'app.cancel': 'Annuler',
    'app.back': 'Retour',

    // Navigation
    'nav.home': 'Accueil',
    'nav.releases': 'Releases',
    'nav.stats': 'Stats',
    'nav.payments': 'Paiements',
    'nav.settings': 'Profil',

    // Dashboard
    'dashboard.balance': 'Solde disponible',
    'dashboard.gross': 'Revenus bruts',
    'dashboard.advances': 'Avances',
    'dashboard.streams': 'Streams totaux',
    'dashboard.releases': 'Releases',
    'dashboard.tracks': 'Tracks',
    'dashboard.viewStats': 'Voir les stats',
    'dashboard.byPlatform': 'Par plateforme',
    'dashboard.quarterly': 'Revenus par Trimestre',
    'dashboard.details': 'Details',
    'dashboard.myReleases': 'Mes Releases',
    'dashboard.revenueByAlbum': 'Revenus par album',
    'dashboard.myTracks': 'Mes Tracks',
    'dashboard.revenueByTrack': 'Revenus par titre',
    'dashboard.payments': 'Paiements',
    'dashboard.paymentHistory': 'Historique des versements',
    'dashboard.labelExpenses': 'Frais du Label',
    'dashboard.projectInvestments': 'Investissements sur vos projets',
    'dashboard.myContracts': 'Mes Contrats',
    'dashboard.sharingAgreements': 'Accords de partage',
    'dashboard.requestPayment': 'Demander mon paiement',

    // Payments
    'payments.title': 'Paiements',
    'payments.subtitle': 'Releves et versements',
    'payments.due': 'Royalties dues',
    'payments.totalPaid': 'Total verse',
    'payments.requestPayment': 'Demander mon paiement',
    'payments.statements': 'Releves',
    'payments.transfers': 'Versements',
    'payments.noStatements': 'Aucun releve disponible',
    'payments.noTransfers': 'Aucun versement pour le moment',
    'payments.statementsGeneratedByLabel': 'Les releves seront generes par votre label',
    'payments.gross': 'Revenus bruts',
    'payments.royalties': 'Vos royalties',
    'payments.recouped': 'Avances recuperees',
    'payments.netPayable': 'Net a percevoir',
    'payments.paid': 'Paye',
    'payments.finalized': 'Finalise',
    'payments.draft': 'Brouillon',
    'payments.requestSuccess': 'Demande de paiement envoyee avec succes!',

    // Settings
    'settings.title': 'Parametres',
    'settings.subtitle': 'Coordonnees et informations bancaires',
    'settings.contact': 'Contact',
    'settings.email': 'Email',
    'settings.phone': 'Telephone',
    'settings.address': 'Adresse',
    'settings.addressLine1': 'Adresse ligne 1',
    'settings.addressLine2': 'Adresse ligne 2',
    'settings.postalCode': 'Code postal',
    'settings.city': 'Ville',
    'settings.country': 'Pays',
    'settings.bankDetails': 'Coordonnees bancaires',
    'settings.accountHolder': 'Titulaire du compte',
    'settings.bankName': 'Nom de la banque',
    'settings.iban': 'IBAN',
    'settings.bic': 'BIC / SWIFT',
    'settings.legalInfo': 'Informations legales (optionnel)',
    'settings.legalInfoDesc': 'Si vous avez une structure professionnelle',
    'settings.siret': 'SIRET',
    'settings.vatNumber': 'Numero de TVA',
    'settings.saveChanges': 'Enregistrer les modifications',
    'settings.saving': 'Enregistrement...',
    'settings.profileUpdated': 'Profil mis a jour avec succes',
    'settings.notificationInfo': 'Les modifications de vos coordonnees seront notifiees a',
    'settings.forVerification': 'pour verification.',
    'settings.logout': 'Deconnexion',
    'settings.language': 'Langue',
    'settings.french': 'Francais',
    'settings.english': 'English',

    // Releases
    'releases.title': 'Mes Releases',
    'releases.subtitle': 'Revenus par album',
    'releases.noReleases': 'Aucune release trouvee',
    'releases.tracks': 'tracks',

    // Tracks
    'tracks.title': 'Mes Tracks',
    'tracks.subtitle': 'Revenus par titre',
    'tracks.noTracks': 'Aucun track trouve',

    // Stats
    'stats.title': 'Statistiques',
    'stats.subtitle': 'Revenus par plateforme',
    'stats.noStats': 'Aucune statistique disponible',

    // Contracts
    'contracts.title': 'Mes Contrats',
    'contracts.subtitle': 'Accords de partage des revenus',
    'contracts.noContracts': 'Aucun contrat enregistre',
    'contracts.catalog': 'Tout le catalogue',
    'contracts.release': 'Album',
    'contracts.track': 'Track',
    'contracts.artistShare': 'Part Artiste',
    'contracts.labelShare': 'Part Label',
    'contracts.unlimited': 'Illimite',

    // Expenses
    'expenses.title': 'Frais du Label',
    'expenses.subtitle': 'Investissements sur vos projets',
    'expenses.noExpenses': 'Aucun frais enregistre',

    // Login
    'login.title': 'Espace Artiste',
    'login.subtitle': 'Consultez vos revenus et statistiques',
    'login.accessCode': 'Code d\'acces',
    'login.accessCodePlaceholder': 'Entrez votre code d\'acces',
    'login.connect': 'Se connecter',
    'login.connecting': 'Connexion...',
    'login.contactLabel': 'Contactez votre label pour obtenir votre code d\'acces',
  },
  en: {
    // Common
    'app.name': 'Whales Records - Artist Portal',
    'app.loading': 'Loading...',
    'app.error': 'Error',
    'app.save': 'Save',
    'app.cancel': 'Cancel',
    'app.back': 'Back',

    // Navigation
    'nav.home': 'Home',
    'nav.releases': 'Releases',
    'nav.stats': 'Stats',
    'nav.payments': 'Payments',
    'nav.settings': 'Profile',

    // Dashboard
    'dashboard.balance': 'Available balance',
    'dashboard.gross': 'Gross revenue',
    'dashboard.advances': 'Advances',
    'dashboard.streams': 'Total streams',
    'dashboard.releases': 'Releases',
    'dashboard.tracks': 'Tracks',
    'dashboard.viewStats': 'View stats',
    'dashboard.byPlatform': 'By platform',
    'dashboard.quarterly': 'Quarterly Revenue',
    'dashboard.details': 'Details',
    'dashboard.myReleases': 'My Releases',
    'dashboard.revenueByAlbum': 'Revenue by album',
    'dashboard.myTracks': 'My Tracks',
    'dashboard.revenueByTrack': 'Revenue by track',
    'dashboard.payments': 'Payments',
    'dashboard.paymentHistory': 'Payment history',
    'dashboard.labelExpenses': 'Label Expenses',
    'dashboard.projectInvestments': 'Investments in your projects',
    'dashboard.myContracts': 'My Contracts',
    'dashboard.sharingAgreements': 'Sharing agreements',
    'dashboard.requestPayment': 'Request payment',

    // Payments
    'payments.title': 'Payments',
    'payments.subtitle': 'Statements and transfers',
    'payments.due': 'Royalties due',
    'payments.totalPaid': 'Total paid',
    'payments.requestPayment': 'Request payment',
    'payments.statements': 'Statements',
    'payments.transfers': 'Transfers',
    'payments.noStatements': 'No statements available',
    'payments.noTransfers': 'No transfers yet',
    'payments.statementsGeneratedByLabel': 'Statements will be generated by your label',
    'payments.gross': 'Gross revenue',
    'payments.royalties': 'Your royalties',
    'payments.recouped': 'Recouped advances',
    'payments.netPayable': 'Net payable',
    'payments.paid': 'Paid',
    'payments.finalized': 'Finalized',
    'payments.draft': 'Draft',
    'payments.requestSuccess': 'Payment request sent successfully!',

    // Settings
    'settings.title': 'Settings',
    'settings.subtitle': 'Contact and bank information',
    'settings.contact': 'Contact',
    'settings.email': 'Email',
    'settings.phone': 'Phone',
    'settings.address': 'Address',
    'settings.addressLine1': 'Address line 1',
    'settings.addressLine2': 'Address line 2',
    'settings.postalCode': 'Postal code',
    'settings.city': 'City',
    'settings.country': 'Country',
    'settings.bankDetails': 'Bank details',
    'settings.accountHolder': 'Account holder',
    'settings.bankName': 'Bank name',
    'settings.iban': 'IBAN',
    'settings.bic': 'BIC / SWIFT',
    'settings.legalInfo': 'Legal information (optional)',
    'settings.legalInfoDesc': 'If you have a business structure',
    'settings.siret': 'SIRET',
    'settings.vatNumber': 'VAT number',
    'settings.saveChanges': 'Save changes',
    'settings.saving': 'Saving...',
    'settings.profileUpdated': 'Profile updated successfully',
    'settings.notificationInfo': 'Changes to your information will be notified to',
    'settings.forVerification': 'for verification.',
    'settings.logout': 'Logout',
    'settings.language': 'Language',
    'settings.french': 'Francais',
    'settings.english': 'English',

    // Releases
    'releases.title': 'My Releases',
    'releases.subtitle': 'Revenue by album',
    'releases.noReleases': 'No releases found',
    'releases.tracks': 'tracks',

    // Tracks
    'tracks.title': 'My Tracks',
    'tracks.subtitle': 'Revenue by track',
    'tracks.noTracks': 'No tracks found',

    // Stats
    'stats.title': 'Statistics',
    'stats.subtitle': 'Revenue by platform',
    'stats.noStats': 'No statistics available',

    // Contracts
    'contracts.title': 'My Contracts',
    'contracts.subtitle': 'Revenue sharing agreements',
    'contracts.noContracts': 'No contracts registered',
    'contracts.catalog': 'Full catalog',
    'contracts.release': 'Album',
    'contracts.track': 'Track',
    'contracts.artistShare': 'Artist Share',
    'contracts.labelShare': 'Label Share',
    'contracts.unlimited': 'Unlimited',

    // Expenses
    'expenses.title': 'Label Expenses',
    'expenses.subtitle': 'Investments in your projects',
    'expenses.noExpenses': 'No expenses recorded',

    // Login
    'login.title': 'Artist Portal',
    'login.subtitle': 'View your revenue and statistics',
    'login.accessCode': 'Access code',
    'login.accessCodePlaceholder': 'Enter your access code',
    'login.connect': 'Connect',
    'login.connecting': 'Connecting...',
    'login.contactLabel': 'Contact your label to get your access code',
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    // Load language from localStorage
    const saved = localStorage.getItem('artist-portal-language') as Language;
    if (saved && (saved === 'fr' || saved === 'en')) {
      setLanguageState(saved);
    } else {
      // Detect browser language - default to English, switch to French if browser is French
      const browserLang = navigator.language.toLowerCase();
      if (browserLang.startsWith('fr')) {
        setLanguageState('fr');
      }
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('artist-portal-language', lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
