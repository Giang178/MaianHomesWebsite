from pydantic import BaseModel, Field


class MediaUpdate(BaseModel):
    display_name: str = Field(min_length=2, max_length=160)
    alt_text: str = Field(min_length=10, max_length=180)
    caption: str | None = Field(default=None, max_length=500)
    credit: str | None = Field(default=None, max_length=300)


class MediaUploadMetadata(MediaUpdate):
    pass
