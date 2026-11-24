import {escape as h} from '../../utils/text.js';
import {fields, routes, soles, units} from '../../constants/domain.js';

export function badge(label, status = '') {
  return `<span class="badge ${h(status)}">${h(label)}</span>`;
}

export function routeBadge(id) {
  return id ? badge(routes[id], id) : '<span class="muted">—</span>';
}

export function empty(title, context) {
  return `<div class="empty"><strong>${h(title)}</strong><p>${h(context)}</p></div>`;
}

export function header(title, lead, action = '') {
  return `<header class="page-header"><div><h1>${h(title)}</h1><p>${h(lead)}</p></div>${action}</header>`;
}

export function selectOptions(options, chosen) {
  return Object.entries(options).map(([id, name]) => `<option value="${h(id)}" ${id === chosen ? 'selected' : ''}>${h(name)}</option>`).join('');
}

export function table(columns, rows, label) {
  return `<div class="table-scroll"><table aria-label="${h(label)}"><thead><tr>${columns.map(title => `<th scope="col">${h(title)}</th>`).join('')}</tr></thead>
  <tbody>${rows.join('')}</tbody></table></div>`;
}

export function threshold(feature, value) {
  return feature === 'sole' ? soles[value] : `${value}${units[feature]}`;
}

export function measurements(row) {
  return `<span class="mono">${h(row.wear)}%</span><span class="sep">/</span><span class="mono">${h(row.glue)} mm</span><span class="sep">/</span>${h(soles[row.sole])}`;
}

export function pathList(path) {
  if (!path.length) return '<p class="muted">已剪至根叶节点，全部样本进入同一类。</p>';
  return `<ol class="path-list">${path.map(step => `<li><span>${h(fields[step.feature])}</span>
    <strong>${h(threshold(step.feature, step.value))} ${h(step.operator)} ${h(threshold(step.feature, step.threshold))}</strong></li>`).join('')}</ol>`;
}

export function classMix(counts) {
  return Object.entries(routes).map(([id, name]) => `<span>${name} <b class="mono">${h(counts[id])}</b></span>`).join('');
}
