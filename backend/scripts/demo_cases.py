from datetime import date, timedelta

from src.constants.domain import LABELS, Sole

CUTOFF = date(2026, 11, 10)
SEED_PLAN = '十一月返修 · 基准版'
ACCOUNTS = (
    ('owner', '唐屿', 'owner', 'ShoeOwner5205!'),
    ('analyst', '周芮', 'analyst', 'ShoeAnalyst5205!'),
    ('viewer', '许桥', 'viewer', 'ShoeViewer5205!'),
)
STUDIOS = ('青禾舞社', '临河少年宫', '照台排练组', '岚桥艺校')
SHOES = ('帆布半底鞋', '软底爵士鞋', '双片式练功鞋', '棉布芭蕾鞋')

# wear, glue, sole index, actual repair index. The last 12 form the temporal holdout.
MEASUREMENTS = (
    (14, 19, 0, 0), (49, 27, 1, 1), (88, 23, 2, 2), (22, 34, 0, 0),
    (63, 19, 1, 1), (70, 67, 2, 2), (32, 43, 0, 0), (54, 18, 1, 1),
    (92, 6, 1, 2), (28, 55, 0, 1), (59, 21, 1, 1), (82, 11, 2, 2),
    (18, 35, 0, 0), (43, 17, 0, 0), (87, 42, 1, 2), (34, 38, 0, 0),
    (56, 36, 0, 1), (76, 49, 2, 2), (31, 68, 0, 1), (48, 14, 1, 1),
    (94, 24, 0, 2), (25, 14, 0, 0), (69, 32, 0, 1), (83, 54, 2, 2),
    (45, 23, 1, 1), (27, 28, 0, 0), (84, 23, 1, 2), (19, 42, 0, 0),
    (52, 16, 0, 1), (68, 47, 2, 2), (35, 39, 0, 0), (74, 14, 1, 1),
    (91, 26, 1, 2), (38, 56, 0, 1), (33, 19, 1, 0), (55, 31, 1, 0),
    (21, 31, 0, 0), (51, 27, 1, 1), (89, 43, 2, 2), (30, 36, 0, 0),
    (39, 59, 0, 1), (78, 45, 2, 2), (46, 19, 1, 0), (67, 21, 1, 1),
    (77, 39, 1, 2), (28, 32, 0, 0), (48, 24, 0, 1), (95, 37, 1, 2),
)


def demo_rows():
    for index, (wear, glue, sole, label) in enumerate(MEASUREMENTS):
        yield {'code': f'WX-{index + 1:04}', 'received': date(2026, 10, 5) + timedelta(days=index),
               'studio': STUDIOS[(index + 1) % len(STUDIOS)], 'shoe': SHOES[index % len(SHOES)],
               'wear': wear, 'glue': glue, 'sole': tuple(Sole)[sole], 'label': LABELS[label]}
