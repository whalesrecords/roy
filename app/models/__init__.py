from app.models.advance_ledger import AdvanceLedgerEntry, LedgerEntryType
from app.models.artist import Artist
from app.models.artist_notification import ArtistNotification, ArtistNotificationType
from app.models.artist_profile import ArtistProfile
from app.models.artist_token import ArtistToken
from app.models.artwork import ReleaseArtwork, TrackArtwork
from app.models.contract import Contract, ContractScope
from app.models.contract_party import ContractParty, PartyType
from app.models.fixed_asset import AssetCategory, AssetStatus, DepreciationMethod, FixedAsset
from app.models.import_model import Import, ImportSource, ImportStatus
from app.models.label_settings import LabelSettings
from app.models.match_suggestion import MatchMethod, MatchStatus, MatchSuggestion
from app.models.notification import Notification, NotificationType
from app.models.product import MovementType, Product, ProductFormat, ProductStatus, StockMovement
from app.models.promo_campaign import CampaignStatus, PromoCampaign
from app.models.promo_submission import PromoSource, PromoSubmission, SubmitHubAction
from app.models.spotify_track_suggestion import SpotifyTrackSuggestion, SuggestionStatus
from app.models.spotify_ad_campaign import SpotifyAdCampaign
from app.models.meta_ad_campaign import MetaAdCampaign
from app.models.royalty_line_item import RoyaltyLineItem
from app.models.royalty_run import RoyaltyRun, RoyaltyRunStatus
from app.models.statement import Statement, StatementStatus
from app.models.ticket import Ticket, TicketCategory, TicketPriority, TicketStatus
from app.models.ticket_message import MessageSender, TicketMessage
from app.models.ticket_participant import TicketParticipant
from app.models.track_artist_link import TrackArtistLink
from app.models.transaction import SaleType, TransactionNormalized
from app.models.label import Label, LabelStatus
from app.models.label_member import LabelMember, LabelRole
from app.models.artist_label import ArtistLabel
from app.models.label_distributor import LabelDistributor, DistributorKind

__all__ = [
    # Multi-tenant
    "Label",
    "LabelStatus",
    "LabelMember",
    "LabelRole",
    "ArtistLabel",
    "LabelDistributor",
    "DistributorKind",
    # Import models
    "Import",
    "ImportSource",
    "ImportStatus",
    "TransactionNormalized",
    "SaleType",
    # Royalty models
    "Artist",
    "Contract",
    "ContractScope",
    "ContractParty",
    "PartyType",
    "AdvanceLedgerEntry",
    "LedgerEntryType",
    "RoyaltyRun",
    "RoyaltyRunStatus",
    "RoyaltyLineItem",
    "Statement",
    "StatementStatus",
    # Artwork
    "ReleaseArtwork",
    "TrackArtwork",
    # Track-Artist Links
    "TrackArtistLink",
    # Settings
    "LabelSettings",
    # Matching
    "MatchSuggestion",
    "MatchMethod",
    "MatchStatus",
    # Artist Profile
    "ArtistProfile",
    # Notifications
    "Notification",
    "NotificationType",
    "ArtistNotification",
    "ArtistNotificationType",
    # Tickets
    "Ticket",
    "TicketStatus",
    "TicketCategory",
    "TicketPriority",
    "TicketMessage",
    "MessageSender",
    "TicketParticipant",
    # Promo
    "PromoSubmission",
    "PromoSource",
    "SubmitHubAction",
    "PromoCampaign",
    "CampaignStatus",
    # Spotify suggestions
    "SpotifyTrackSuggestion",
    "SuggestionStatus",
    # Spotify Ads
    "SpotifyAdCampaign",
    "MetaAdCampaign",
    # Inventory
    "Product",
    "StockMovement",
    "ProductFormat",
    "ProductStatus",
    "MovementType",
    # Fixed assets
    "FixedAsset",
    "AssetCategory",
    "AssetStatus",
    "DepreciationMethod",
    # Artist tokens
    "ArtistToken",
]
