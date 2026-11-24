"""Multiclass CART with deterministic weakest-link pruning."""
from collections import Counter
from copy import deepcopy
from fractions import Fraction

from src.constants.domain import FEATURES, LABELS, Sole


def risk(counts):
    total = sum(counts.values())
    return total - Fraction(sum(n * n for n in counts.values()), total) if total else Fraction(0)


def candidates(rows, feature, min_leaf):
    if feature == 'sole':
        for value in Sole:
            left = [row for row in rows if row[feature] == value]
            right = [row for row in rows if row[feature] != value]
            if min(len(left), len(right)) >= min_leaf:
                yield value, risk(Counter(row['label'] for row in left)) + risk(Counter(row['label'] for row in right))
        return

    ordered = sorted(rows, key=lambda row: row[feature])
    left_counts = Counter()
    right_counts = Counter(row['label'] for row in ordered)
    for i, row in enumerate(ordered[:-1], 1):
        label = row['label']
        left_counts[label] += 1
        right_counts[label] -= 1
        current, following = row[feature], ordered[i][feature]
        if min(i, len(rows) - i) >= min_leaf and current < following:
            yield (current + following) / 2, risk(left_counts) + risk(right_counts)


def goes_left(value, feature, threshold):
    return value == threshold if feature == 'sole' else value <= threshold


def grow(rows, features, min_leaf, max_depth, depth=0):
    counts = Counter(row['label'] for row in rows)
    node = {'counts': {label: counts[label] for label in LABELS},
            'prediction': max(reversed(LABELS), key=counts.__getitem__), 'n': len(rows)}
    best_risk = risk(counts)
    if depth >= max_depth or best_risk == 0 or len(rows) < 2 * min_leaf:
        return node

    best = None
    for feature in features:
        for threshold, split_risk in candidates(rows, feature, min_leaf):
            if split_risk < best_risk:
                best = feature, threshold
                best_risk = split_risk
    if best is None:
        return node
    feature, threshold = best
    left, right = [], []
    for row in rows:
        branch = left if goes_left(row[feature], feature, threshold) else right
        branch.append(row)
    node.update(feature=feature, threshold=threshold,
                left=grow(left, features, min_leaf, max_depth, depth + 1),
                right=grow(right, features, min_leaf, max_depth, depth + 1))
    return node


def links(node, total, strengths):
    node_risk = risk(node['counts']) / total
    if 'feature' not in node:
        return node_risk, 1
    left_risk, left_count = links(node['left'], total, strengths)
    right_risk, right_count = links(node['right'], total, strengths)
    subtree_risk, leaves = left_risk + right_risk, left_count + right_count
    strengths[id(node)] = (node_risk - subtree_risk) / (leaves - 1)
    return subtree_risk, leaves


def collapse(node, strengths, weakest):
    if 'feature' not in node:
        return
    if strengths[id(node)] == weakest:
        for key in ('feature', 'threshold', 'left', 'right'):
            del node[key]
        return
    collapse(node['left'], strengths, weakest)
    collapse(node['right'], strengths, weakest)


def prune(tree, alpha):
    working = deepcopy(tree)
    selected = None
    path = []
    step = Fraction(0)
    limit = Fraction(str(alpha))
    while True:
        strengths = {}
        subtree_risk, leaves = links(working, tree['n'], strengths)
        path.append({'alpha': float(step), 'leaves': leaves, 'risk': float(subtree_risk)})
        if step <= limit:
            selected = deepcopy(working)
            selected_index = len(path) - 1
        if not strengths:
            return selected, path, selected_index
        step = min(strengths.values())
        collapse(working, strengths, step)


def classify(tree, measurements):
    path = []
    while 'feature' in tree:
        feature, threshold = tree['feature'], tree['threshold']
        value = measurements[feature]
        left = goes_left(value, feature, threshold)
        operator = ('=' if left else '≠') if feature == 'sole' else ('≤' if left else '>')
        path.append({'feature': feature, 'value': value, 'operator': operator, 'threshold': threshold})
        tree = tree['left'] if left else tree['right']
    return tree['prediction'], path, tree['counts']


def evaluate(rows, plan):
    cutoff = plan['cutoff'].isoformat()
    train = [row for row in rows if row['received'] < cutoff]
    holdout = [row for row in rows if row['received'] >= cutoff]
    if {row['label'] for row in train} != set(LABELS):
        raise ValueError('截止日前的训练集必须包含补胶、换底、报废三种真实处置')
    if {row['label'] for row in holdout} != set(LABELS):
        raise ValueError('截止日及之后的时间留出集必须包含补胶、换底、报废三种真实处置')
    if len(train) < 2 * plan['min_leaf']:
        raise ValueError('训练样本不足，无法满足两侧的最小叶样本数')

    features = [feature for feature in FEATURES if feature in plan['features']]
    full = grow(train, features, plan['min_leaf'], plan['max_depth'])
    tree, pruning, selected = prune(full, plan['alpha'])
    matrix = {true: dict.fromkeys(LABELS, 0) for true in LABELS}
    cases = []
    for row in holdout:
        predicted, path, counts = classify(tree, row)
        matrix[row['label']][predicted] += 1
        cases.append({**row, 'prediction': predicted, 'path': path, 'training_leaf_counts': counts})
    recall = {label: matrix[label][label] / sum(matrix[label].values()) for label in LABELS}
    return {'train_n': len(train), 'holdout_n': len(holdout), 'tree': tree, 'pruning': pruning,
            'selected': selected, 'matrix': matrix, 'recall': recall, 'holdout': cases,
            'accuracy': sum(matrix[label][label] for label in LABELS) / len(holdout),
            'balanced_accuracy': sum(recall.values()) / len(LABELS)}
