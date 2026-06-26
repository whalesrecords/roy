"""Electronic signature of a contract by an artist (simple eIDAS signature).

Captures the hand-drawn signature plus the evidence that gives it legal weight:
signer identity, timestamp, IP / device, and a hash of the signed contract.
"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ContractSignature(Base):
    __tablename__ = "contract_signatures"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contract_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    artist_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)

    signer_name: Mapped[str] = mapped_column(String(200), nullable=True)
    signer_email: Mapped[str] = mapped_column(String(255), nullable=True)

    # The drawn signature (base64 PNG data, finger / Apple Pencil).
    signature_image: Mapped[str] = mapped_column(Text, nullable=True)

    # Evidence / audit trail.
    document_hash: Mapped[str] = mapped_column(String(64), nullable=True)  # sha256 of the signed contract snapshot
    ip_address: Mapped[str] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str] = mapped_column(String(400), nullable=True)
    consent: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Generated signature certificate (base64 PDF).
    certificate_pdf: Mapped[str] = mapped_column(Text, nullable=True)

    signed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<ContractSignature contract={self.contract_id} artist={self.artist_id}>"
