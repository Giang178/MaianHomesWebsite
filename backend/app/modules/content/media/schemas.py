from pydantic import BaseModel, Field


class MediaUploadResponse(BaseModel):
    id: str
    url: str
    content_type: str
    size: int
    width: int
    height: int
    checksum: str
    variants: dict[str, str] = Field(default_factory=dict)
