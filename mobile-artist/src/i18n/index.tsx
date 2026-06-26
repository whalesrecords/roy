import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Lang = 'fr' | 'en';

type Dict = Record<string, string>;

const FR: Dict = {
  'nav.home': 'Accueil',
  'nav.music': 'Musique',
  'nav.promo': 'Promo',
  'stats.title': 'Statistiques',
  'statements.title': 'Relevés',
  'payments.title': 'Paiements',
  'support.title': 'Support',
  'settings.title': 'Réglages',
  'contracts.title': 'Mes contrats',
  'contracts.signed': 'Signé',
  'contracts.toSign': 'À signer',
  'contracts.sign': 'Signer le contrat',
  'contracts.artistShare': 'Votre part',
  'contracts.period': 'Période',
  'contracts.noEnd': 'sans échéance',
  'contracts.empty': 'Aucun contrat',
  'contracts.consent': 'Je consens à signer ce contrat électroniquement et reconnais que ma signature a valeur d’engagement.',
  'contracts.clear': 'Effacer',
  'contracts.signHint': 'Signez avec le doigt ou l’Apple Pencil dans le cadre ci-dessous.',
  'contracts.signedOn': 'Signé le',
  'contracts.sealed': 'Document scellé (empreinte SHA-256). Un certificat de signature a été généré.',
  'contracts.signError': 'Échec de la signature. Réessayez.',

  'login.title': 'Espace Artiste',
  'login.subtitle': 'Connectez-vous pour voir vos royalties',
  'login.code': "Code d'accès artiste",
  'login.email': 'E-mail',
  'login.password': 'Mot de passe',
  'login.submit': 'Se connecter',
  'login.byCode': 'Par code',
  'login.byEmail': 'Par e-mail',
  'login.error': 'Identifiants invalides',

  'common.available': 'Disponible au versement',
  'common.requestPayment': 'Demander un versement',
  'common.netCumulative': 'Cumul net',
  'common.grossRevenue': 'Revenus bruts',
  'common.streams': 'streams',
  'common.recentActivity': 'Activité récente',
  'common.seeAll': 'Tout voir',
  'common.topTracks': 'Top titres',
  'common.noActivity': 'Aucune activité récente',
  'common.noTrack': 'Aucun titre',
  'common.loading': 'Chargement…',
  'common.retry': 'Réessayer',
  'common.error': 'Erreur de chargement',
  'common.logout': 'Se déconnecter',
  'common.darkMode': 'Mode sombre',
  'common.pendingValidation': 'en cours de validation',
  'common.membersBreakdown': 'Répartition par membre',
};

const EN: Dict = {
  'nav.home': 'Home',
  'nav.music': 'Music',
  'nav.promo': 'Promo',
  'stats.title': 'Statistics',
  'statements.title': 'Statements',
  'payments.title': 'Payments',
  'support.title': 'Support',
  'settings.title': 'Settings',
  'contracts.title': 'My contracts',
  'contracts.signed': 'Signed',
  'contracts.toSign': 'To sign',
  'contracts.sign': 'Sign contract',
  'contracts.artistShare': 'Your share',
  'contracts.period': 'Period',
  'contracts.noEnd': 'no end date',
  'contracts.empty': 'No contract',
  'contracts.consent': 'I consent to sign this contract electronically and acknowledge it is legally binding.',
  'contracts.clear': 'Clear',
  'contracts.signHint': 'Sign with your finger or Apple Pencil in the box below.',
  'contracts.signedOn': 'Signed on',
  'contracts.sealed': 'Document sealed (SHA-256 hash). A signature certificate was generated.',
  'contracts.signError': 'Signing failed. Please try again.',

  'login.title': 'Artist Space',
  'login.subtitle': 'Sign in to view your royalties',
  'login.code': 'Artist access code',
  'login.email': 'Email',
  'login.password': 'Password',
  'login.submit': 'Sign in',
  'login.byCode': 'By code',
  'login.byEmail': 'By email',
  'login.error': 'Invalid credentials',

  'common.available': 'Available for payout',
  'common.requestPayment': 'Request a payout',
  'common.netCumulative': 'Net total',
  'common.grossRevenue': 'Gross revenue',
  'common.streams': 'streams',
  'common.recentActivity': 'Recent activity',
  'common.seeAll': 'See all',
  'common.topTracks': 'Top tracks',
  'common.noActivity': 'No recent activity',
  'common.noTrack': 'No track',
  'common.loading': 'Loading…',
  'common.retry': 'Retry',
  'common.error': 'Loading error',
  'common.logout': 'Sign out',
  'common.darkMode': 'Dark mode',
  'common.pendingValidation': 'pending validation',
  'common.membersBreakdown': 'Breakdown by member',
};

const DICTS: Record<Lang, Dict> = { fr: FR, en: EN };

interface LangContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const LangContext = createContext<LangContextType | undefined>(undefined);
const LANG_KEY = 'artist-lang';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('fr');

  useEffect(() => {
    (async () => {
      const saved = (await AsyncStorage.getItem(LANG_KEY)) as Lang | null;
      if (saved) setLangState(saved);
    })();
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(LANG_KEY, l).catch(() => {});
  };

  const t = (key: string) => DICTS[lang][key] ?? key;

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export function useLanguage(): LangContextType {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
