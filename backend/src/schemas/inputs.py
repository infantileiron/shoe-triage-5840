from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from src.constants.domain import Route, Sole

ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=70)]
Note = Annotated[str, StringConstraints(strip_whitespace=True, min_length=4, max_length=320)]
Code = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r'^[A-Z0-9][A-Z0-9-]{2,23}$')]
Feature = Literal['wear', 'glue', 'sole']


class Payload(BaseModel):
    model_config = ConfigDict(extra='forbid')


class Credentials(Payload):
    username: Annotated[str, Field(min_length=1, max_length=50)]
    password: Annotated[str, Field(min_length=1, max_length=100)]


class Measurements(Payload):
    studio: ShortText
    shoe: ShortText
    wear: Annotated[int, Field(ge=0, le=100)]
    glue: Annotated[int, Field(ge=0, le=350)]
    sole: Sole


class Sample(Measurements):
    code: Code
    received: date
    label: Route


class Plan(Payload):
    name: ShortText
    cutoff: date
    alpha: Annotated[float, Field(ge=0, le=1, allow_inf_nan=False)]
    min_leaf: Annotated[int, Field(ge=1, le=30)]
    max_depth: Annotated[int, Field(ge=1, le=8)]
    features: Annotated[list[Feature], Field(min_length=1, max_length=3)]

    @field_validator('features')
    @classmethod
    def unique_features(cls, values):
        if len(values) != len(set(values)):
            raise ValueError('特征不可重复')
        return values


class Ticket(Measurements):
    code: Code


class Review(Payload):
    note: Note


class Decision(Review):
    decision: Route


class BatchCreate(Payload):
    station: Route


class Receipts(Payload):
    codes: Annotated[list[Code], Field(min_length=1, max_length=200)]

    @field_validator('codes')
    @classmethod
    def unique_codes(cls, values):
        return list(dict.fromkeys(values))
