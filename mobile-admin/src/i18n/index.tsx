import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Lang = 'fr' | 'en';

type Dict = Record<string, string>;

const FR: Dict = {
  'nav.home': 'Tableau de bord',
  'nav.artists': 'Artistes',
  'nav.royalties': 'Royalties',
  'nav.promo': 'Promo',
  'nav.more': 'Plus',

  'login.title': 'Espace Admin',
  'login.subtitle': 'Connectez-vous au back-office Whales Records',
  'login.email': 'E-mail',
  'login.password': 'Mot de passe',
  'login.submit': 'Se connecter',
  'login.error': 'Identifiants invalides ou accès non autorisé',

  'home.title': 'Tableau de bord',
  'home.revenue': 'Revenus',
  'home.expenses': 'Dépenses',
  'home.payable': 'Royalties à payer',
  'home.net': 'Résultat net',
  'home.outflow': 'Sorties totales',
  'home.bySource': 'Revenus par source',
  'home.byCategory': 'Dépenses par catégorie',
  'home.monthly': 'Évolution mensuelle',
  'home.year': 'Année',
  'home.lastImport': 'Dernier import CSV',
  'home.importPeriod': 'Période couverte',
  'home.importUpToDate': 'À jour',
  'home.importSoon': 'À importer bientôt',
  'home.importLate': 'Import en retard',
  'home.importVeryLate': 'Très en retard',
  'home.importReminder': 'Pensez à importer les CSV pour le calcul des royalties.',
  'home.noImport': 'Aucun import enregistré',

  'artists.title': 'Artistes',
  'artists.search': 'Rechercher un artiste…',
  'artists.count': 'artistes',
  'artists.gross': 'Revenus bruts',
  'artists.streams': 'streams',
  'artists.balance': 'Solde d’avance',
  'artists.advances': 'Avances',
  'artists.recouped': 'Récupéré',
  'artists.payments': 'Versements',
  'artists.collaborations': 'Collaborations',
  'artists.social': 'Réseaux',

  'royalties.title': 'Royalties',
  'royalties.runs': 'Campagnes de calcul',
  'royalties.period': 'Période',
  'royalties.gross': 'Brut',
  'royalties.payable': 'À payer',
  'royalties.artists': 'artistes',
  'royalties.locked': 'Verrouillée',
  'royalties.open': 'Ouverte',
  'royalties.transactions': 'transactions',
  'royalties.detail': 'Détail du calcul',

  'finances.title': 'Finances',
  'finances.expenses': 'Dépenses',
  'finances.payments': 'Paiements royalties',
  'finances.totalExpenses': 'Total dépenses',
  'finances.totalPayable': 'Total à payer',

  'inventory.title': 'Inventaire',
  'inventory.products': 'Produits',
  'inventory.stock': 'Stock total',
  'inventory.lowStock': 'Stock faible',
  'inventory.value': 'Valeur stock',
  'inventory.sold': 'vendus',

  'promo.title': 'Promo',
  'promo.submissions': 'Soumissions',
  'promo.approvals': 'Validations',
  'promo.playlists': 'Playlists',
  'promo.listens': 'Écoutes',
  'promo.campaigns': 'Campagnes Spotify Ads',
  'promo.spend': 'Budget dépensé',
  'promo.byArtist': 'Par artiste',

  'support.title': 'Support',
  'support.tickets': 'Tickets',
  'support.open': 'Ouverts',
  'support.inProgress': 'En cours',
  'support.resolved': 'Résolus',
  'support.closed': 'Fermés',
  'support.reply': 'Répondre…',
  'support.send': 'Envoyer',

  'settings.title': 'Réglages',
  'settings.appearance': 'Apparence',
  'settings.accent': 'Couleur d’accent',
  'settings.darkMode': 'Mode sombre',
  'settings.notifications': 'Notifications',
  'settings.notifImport': 'Rappel d’import des CSV',
  'settings.notifHint': 'Une alerte quand le dernier import date de plus d’un mois.',
  'settings.language': 'Langue',
  'settings.label': 'Label',
  'settings.account': 'Compte',
  'settings.logout': 'Se déconnecter',

  'contracts.title': 'Contrats',
  'contracts.scope.track': 'Titre',
  'contracts.scope.release': 'Release',
  'contracts.scope.catalog': 'Catalogue',
  'contracts.parties': 'Parties',
  'contracts.since': 'Depuis le',
  'contracts.period': 'Période',
  'contracts.noEnd': 'sans échéance',
  'contracts.document': 'Voir le document',
  'contracts.physical': 'Physique',
  'contracts.digital': 'Digital',
  'contracts.streams': 'Streams',
  'contracts.viewArtist': 'Voir les contrats',

  'more.title': 'Plus',
  'more.contracts': 'Contrats',
  'more.finances': 'Finances',
  'more.inventory': 'Inventaire',
  'more.support': 'Support',
  'more.settings': 'Réglages',

  'common.loading': 'Chargement…',
  'common.retry': 'Réessayer',
  'common.error': 'Erreur de chargement',
  'common.empty': 'Aucune donnée',
  'common.seeAll': 'Tout voir',
  'common.search': 'Rechercher…',
  'common.all': 'Tous',
  'common.edit': 'Modifier',
  'common.delete': 'Supprimer',
  'common.save': 'Enregistrer',
  'common.cancel': 'Annuler',

  'cform.newTitle': 'Nouveau contrat',
  'cform.editTitle': 'Modifier le contrat',
  'cform.artist': 'Artiste principal',
  'cform.choose': 'Choisir…',
  'cform.scope': 'Périmètre',
  'cform.scopeId': 'Identifiant (ISRC / UPC)',
  'cform.start': 'Date de début (AAAA-MM-JJ)',
  'cform.end': 'Date de fin (optionnelle)',
  'cform.description': 'Description',
  'cform.parties': 'Parties',
  'cform.addParty': 'Ajouter une partie',
  'cform.type': 'Type',
  'cform.name': 'Nom',
  'cform.share': 'Part %',
  'cform.advanced': 'Parts détaillées (physique / digital)',
  'cform.total': 'Total des parts',
  'cform.mustSum': 'Le total des parts doit faire 100 %.',
  'cform.needArtist': 'Sélectionne l’artiste principal.',
  'cform.needScopeId': 'L’identifiant est requis pour ce périmètre.',
  'cform.needDate': 'Date de début invalide (AAAA-MM-JJ).',
  'cform.saved': 'Contrat enregistré.',
};

const EN: Dict = {
  'nav.home': 'Dashboard',
  'nav.artists': 'Artists',
  'nav.royalties': 'Royalties',
  'nav.promo': 'Promo',
  'nav.more': 'More',

  'login.title': 'Admin Space',
  'login.subtitle': 'Sign in to the Whales Records back-office',
  'login.email': 'Email',
  'login.password': 'Password',
  'login.submit': 'Sign in',
  'login.error': 'Invalid credentials or unauthorized access',

  'home.title': 'Dashboard',
  'home.revenue': 'Revenue',
  'home.expenses': 'Expenses',
  'home.payable': 'Royalties payable',
  'home.net': 'Net result',
  'home.outflow': 'Total outflow',
  'home.bySource': 'Revenue by source',
  'home.byCategory': 'Expenses by category',
  'home.monthly': 'Monthly trend',
  'home.year': 'Year',
  'home.lastImport': 'Last CSV import',
  'home.importPeriod': 'Covered period',
  'home.importUpToDate': 'Up to date',
  'home.importSoon': 'Import soon',
  'home.importLate': 'Import overdue',
  'home.importVeryLate': 'Very overdue',
  'home.importReminder': 'Remember to import the CSVs for royalty calculation.',
  'home.noImport': 'No import recorded',

  'artists.title': 'Artists',
  'artists.search': 'Search an artist…',
  'artists.count': 'artists',
  'artists.gross': 'Gross revenue',
  'artists.streams': 'streams',
  'artists.balance': 'Advance balance',
  'artists.advances': 'Advances',
  'artists.recouped': 'Recouped',
  'artists.payments': 'Payments',
  'artists.collaborations': 'Collaborations',
  'artists.social': 'Social',

  'royalties.title': 'Royalties',
  'royalties.runs': 'Calculation runs',
  'royalties.period': 'Period',
  'royalties.gross': 'Gross',
  'royalties.payable': 'Payable',
  'royalties.artists': 'artists',
  'royalties.locked': 'Locked',
  'royalties.open': 'Open',
  'royalties.transactions': 'transactions',
  'royalties.detail': 'Run detail',

  'finances.title': 'Finances',
  'finances.expenses': 'Expenses',
  'finances.payments': 'Royalty payments',
  'finances.totalExpenses': 'Total expenses',
  'finances.totalPayable': 'Total payable',

  'inventory.title': 'Inventory',
  'inventory.products': 'Products',
  'inventory.stock': 'Total stock',
  'inventory.lowStock': 'Low stock',
  'inventory.value': 'Stock value',
  'inventory.sold': 'sold',

  'promo.title': 'Promo',
  'promo.submissions': 'Submissions',
  'promo.approvals': 'Approvals',
  'promo.playlists': 'Playlists',
  'promo.listens': 'Listens',
  'promo.campaigns': 'Spotify Ads campaigns',
  'promo.spend': 'Budget spent',
  'promo.byArtist': 'By artist',

  'support.title': 'Support',
  'support.tickets': 'Tickets',
  'support.open': 'Open',
  'support.inProgress': 'In progress',
  'support.resolved': 'Resolved',
  'support.closed': 'Closed',
  'support.reply': 'Reply…',
  'support.send': 'Send',

  'settings.title': 'Settings',
  'settings.appearance': 'Appearance',
  'settings.accent': 'Accent color',
  'settings.darkMode': 'Dark mode',
  'settings.notifications': 'Notifications',
  'settings.notifImport': 'CSV import reminder',
  'settings.notifHint': 'An alert when the last import is over a month old.',
  'settings.language': 'Language',
  'settings.label': 'Label',
  'settings.account': 'Account',
  'settings.logout': 'Sign out',

  'contracts.title': 'Contracts',
  'contracts.scope.track': 'Track',
  'contracts.scope.release': 'Release',
  'contracts.scope.catalog': 'Catalog',
  'contracts.parties': 'Parties',
  'contracts.since': 'Since',
  'contracts.period': 'Period',
  'contracts.noEnd': 'no end date',
  'contracts.document': 'View document',
  'contracts.physical': 'Physical',
  'contracts.digital': 'Digital',
  'contracts.streams': 'Streams',
  'contracts.viewArtist': 'View contracts',

  'more.title': 'More',
  'more.contracts': 'Contracts',
  'more.finances': 'Finances',
  'more.inventory': 'Inventory',
  'more.support': 'Support',
  'more.settings': 'Settings',

  'common.loading': 'Loading…',
  'common.retry': 'Retry',
  'common.error': 'Loading error',
  'common.empty': 'No data',
  'common.seeAll': 'See all',
  'common.search': 'Search…',
  'common.all': 'All',
  'common.edit': 'Edit',
  'common.delete': 'Delete',
  'common.save': 'Save',
  'common.cancel': 'Cancel',

  'cform.newTitle': 'New contract',
  'cform.editTitle': 'Edit contract',
  'cform.artist': 'Primary artist',
  'cform.choose': 'Choose…',
  'cform.scope': 'Scope',
  'cform.scopeId': 'Identifier (ISRC / UPC)',
  'cform.start': 'Start date (YYYY-MM-DD)',
  'cform.end': 'End date (optional)',
  'cform.description': 'Description',
  'cform.parties': 'Parties',
  'cform.addParty': 'Add a party',
  'cform.type': 'Type',
  'cform.name': 'Name',
  'cform.share': 'Share %',
  'cform.advanced': 'Detailed shares (physical / digital)',
  'cform.total': 'Total shares',
  'cform.mustSum': 'Shares must total 100%.',
  'cform.needArtist': 'Select the primary artist.',
  'cform.needScopeId': 'Identifier is required for this scope.',
  'cform.needDate': 'Invalid start date (YYYY-MM-DD).',
  'cform.saved': 'Contract saved.',
};

const DICTS: Record<Lang, Dict> = { fr: FR, en: EN };

interface LangContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const LangContext = createContext<LangContextType | undefined>(undefined);
const LANG_KEY = 'admin-lang';

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
