from pydantic import BaseModel, Field


class SetupAccountPayload(BaseModel):
    token: str = Field(min_length=32, max_length=500)
    password: str = Field(min_length=8, max_length=200)
