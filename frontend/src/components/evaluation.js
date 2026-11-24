import {fields, routes} from '../constants/domain.js';
import {classMix, routeBadge, threshold} from './common/ui.js';
import {escape as h, percent} from '../utils/text.js';

const labels = Object.keys(routes);

export function matrix(report) {
  return `<table class="matrix" aria-label="留出混淆矩阵"><thead><tr><th scope="col">真实 ↓ / 预测 →</th>
  ${labels.map(id => `<th scope="col">${routes[id]}</th>`).join('')}<th scope="col">召回率</th></tr></thead>
  <tbody>${labels.map(actual => `<tr><th scope="row">${routes[actual]}</th>
  ${labels.map(predicted => {
    const n = report.matrix[actual][predicted];
    const tone = actual === predicted ? 'correct' : n ? 'wrong' : 'zero';
    return `<td class="${tone} mono">${n}</td>`;
  }).join('')}<td class="mono">${percent(report.recall[actual])}</td></tr>`).join('')}</tbody></table>`;
}

export function pruning(report) {
  return `<ol class="pruning" aria-label="剪枝路径">${report.pruning.map((step, i) => `<li class="${i === report.selected ? 'chosen' : ''}">
    <span class="mono">${step.alpha.toFixed(4)}</span><span class="prune-track"><span style="--width:${100 * step.leaves / report.pruning[0].leaves}%"></span></span>
    <strong>${step.leaves} 叶</strong>${i === report.selected ? '<span class="selection">采用</span>' : '<span></span>'}
  </li>`).join('')}</ol>`;
}

/** @param {import("../types/domain.js").TreeNode} tree */
function leaves(tree, path = []) {
  if (!tree.feature) return [{tree, path}];
  const feature = tree.feature;
  const value = threshold(feature, tree.threshold);
  return [...leaves(tree.left, [...path, `${fields[feature]} ${feature === 'sole' ? '=' : '≤'} ${value}`]),
    ...leaves(tree.right, [...path, `${fields[feature]} ${feature === 'sole' ? '≠' : '>'} ${value}`])];
}

export function rules(tree) {
  return `<ol class="rules-list">${leaves(tree).map(({tree: leaf, path}) => `<li>
    <div>${routeBadge(leaf.prediction)} <span>${h(path.join(' → ') || '根叶节点')}</span></div>
    <div class="muted">叶样本 ${leaf.n} <span class="sep">·</span> ${classMix(leaf.counts)}</div>
  </li>`).join('')}</ol>`;
}
