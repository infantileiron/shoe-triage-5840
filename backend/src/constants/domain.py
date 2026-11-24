from enum import StrEnum


class Role(StrEnum):
    owner = 'owner'
    analyst = 'analyst'
    viewer = 'viewer'


class Route(StrEnum):
    reglue = 'reglue'
    resole = 'resole'
    retire = 'retire'


class Sole(StrEnum):
    intact = 'intact'
    thin = 'thin'
    cracked = 'cracked'


LABELS = tuple(Route)
ROUTE_NAMES = dict(zip(LABELS, ('补胶', '换底', '报废')))
SOLE_NAMES = dict(zip(Sole, ('完整', '变薄', '裂穿')))
FEATURE_NAMES = {'wear': '磨损率', 'glue': '开胶长度', 'sole': '鞋底状态'}
FEATURES = tuple(FEATURE_NAMES)
