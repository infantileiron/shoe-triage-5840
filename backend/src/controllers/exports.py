import csv
from io import StringIO

from fastapi.responses import Response

from src.constants.domain import FEATURE_NAMES, ROUTE_NAMES, SOLE_NAMES


def safe_cell(value):
    if isinstance(value, str) and value.lstrip().startswith(('=', '+', '-', '@')):
        return "'" + value
    return value


def csv_file(filename, header, rows):
    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(header)
    writer.writerows([safe_cell(value) for value in row] for row in rows)
    return Response(buffer.getvalue().encode('utf-8-sig'), media_type='text/csv; charset=utf-8',
                    headers={'Content-Disposition': f'attachment; filename="{filename}"'})


def path_text(steps):
    parts = []
    for step in steps:
        feature = step['feature']
        threshold = SOLE_NAMES[step['threshold']] if feature == 'sole' else step['threshold']
        parts.append(f"{FEATURE_NAMES[feature]} {step['operator']} {threshold}")
    return ' → '.join(parts) or '根叶节点'


def holdout_csv(run):
    rows = run['report']['holdout']
    return csv_file(f'holdout-{run["id"]}.csv',
                    ['运行', '样本指纹', '工票', '日期', '团队', '鞋型', '磨损率 %', '开胶 mm',
                     '鞋底', '实修', '预测', '决策路径'],
                    ((run['id'], run['sample_digest'], row['code'], row['received'], row['studio'],
                      row['shoe'], row['wear'], row['glue'], SOLE_NAMES[row['sole']], ROUTE_NAMES[row['label']],
                      ROUTE_NAMES[row['prediction']], path_text(row['path'])) for row in rows))


def tickets_csv(tickets):
    return csv_file('triage-dispatch.csv', ['分诊单', '规则运行', '团队', '鞋型', '模型建议', '最终处置', '签发说明', '签发工号'],
                    ((row['code'], row['run_id'], row['studio'], row['shoe'], ROUTE_NAMES[row['prediction']],
                      ROUTE_NAMES[row['decision']], row['note'], row['reviewed_by']) for row in tickets))
