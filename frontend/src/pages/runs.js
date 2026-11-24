import {download, read, request} from '../api/client.js';
import {badge, empty, header, measurements, pathList, routeBadge, table} from '../components/common/ui.js';
import {matrix, pruning, rules} from '../components/evaluation.js';
import {publication, states} from '../constants/domain.js';
import {edit, notify} from '../hooks/actions.js';
import {escape as h, percent, timestamp} from '../utils/text.js';

function publicationBadge(run) {
  return run.publication === 'draft' && run.state !== 'succeeded' ? badge('未发布') :
    badge(publication[run.publication], run.publication);
}

export async function runs(main) {
  const list = await read('/runs');
  main.innerHTML = header('留出评估', '检查真实处置与模型建议的差异，再决定能否发到维修工位。') + `
    <section class="sheet"><div class="section-top"><h2>运行记录</h2>${badge(`${list.length} 次运行`)}</div>
    ${list.length ? table(['运行', '参数版本', '截止日', '执行状态', '复核状态', '完成时间'], list.map(run => `<tr>
      <td><a class="mono code" href="#runs/${run.id}">#${run.id}</a></td><td><a class="run-link" href="#runs/${run.id}">${h(run.plan_name)}</a></td>
      <td class="mono">${h(run.cutoff)}</td><td>${badge(states[run.state], run.state)}</td><td>${publicationBadge(run)}</td>
      <td class="mono">${h(timestamp(run.finished_at))}</td></tr>`), '运行记录') : empty('暂无可查看的评估', '分析员可在训练方案页冻结样本并运行。')}
    </section>`;
}

function resultMarkup(run) {
  const report = run.report;
  const errors = report.holdout.filter(item => item.label !== item.prediction);
  const selected = report.pruning[report.selected];
  return `<section class="report-summary" aria-label="评估摘要">
    <div><span>训练 / 留出</span><strong>${report.train_n}<em> / </em>${report.holdout_n}</strong><small>截止日 ${h(run.cutoff)}</small></div>
    <div><span>留出准确率</span><strong>${percent(report.accuracy)}</strong><small>${errors.length} 张分诊与实修不一致</small></div>
    <div><span>宏平均召回</span><strong>${percent(report.balanced_accuracy)}</strong><small>三类召回率等权平均</small></div>
    <div><span>剪枝保留</span><strong>${selected.leaves}<em> / </em>${report.pruning[0].leaves}</strong><small>叶节点 · α ${h(run.alpha)}</small></div>
  </section>
  <div class="report-grid">
    <section class="sheet matrix-sheet"><div class="section-top"><h2>混淆矩阵</h2>${badge(`留出 ${report.holdout_n} 张`)}</div>
      <div class="table-scroll">${matrix(report)}</div>
      <div class="matrix-legend"><span><i class="correct"></i> 一致</span><span><i class="wrong"></i> 误判</span></div>
    </section>
    <section class="ticket-paper pruning-paper"><div class="ticket-eyebrow mono">COST COMPLEXITY</div><h2>剪枝路径</h2>
      <p>选取临界 α 不超过 ${h(run.alpha)} 的最小子树。</p>${pruning(report)}</section>
  </div>
  <section class="sheet error-sheet"><div class="section-top"><h2>误判工票</h2>${badge(`${errors.length} 张`)}</div>
    ${errors.length ? table(['工票', '收件测量', '实修', '模型建议', '决策路径'], errors.map(item => `<tr><td class="mono code">${h(item.code)}</td>
      <td>${measurements(item)}</td><td>${routeBadge(item.label)}</td><td>${routeBadge(item.prediction)}</td>
      <td><details><summary>展开路径</summary>${pathList(item.path)}</details></td></tr>`), '误判工票') : empty('当前留出样本全部一致', '仍可展开规则条件，或导出逐票明细复核。')}
  </section>
  <section class="sheet rules-sheet"><details><summary>查看全部分诊规则（${selected.leaves} 条）</summary>${rules(report.tree)}</details></section>
  <div class="digest">样本指纹 <code>${h(run.sample_digest)}</code></div>`;
}

export async function runDetail(main, user, refresh, id) {
  const run = await read(`/runs/${id}`);
  const ready = run.state === 'succeeded';
  const canPublish = ready && user.role === 'owner' && run.publication === 'draft';
  const processing = run.state === 'queued' || run.state === 'running';
  main.innerHTML = `<a class="back" href="#runs">← 运行记录</a>` + header(run.plan_name,
    `运行 #${run.id} · 参数 V${run.plan_id} · 时间留出评估`, ready ? `<div class="button-group">
    <button class="secondary" data-export>导出留出 CSV</button>${canPublish ? '<button data-publish>复核并发布</button>' : ''}</div>` : '') +
    `<div class="report-state">${badge(states[run.state], run.state)} ${publicationBadge(run)}
    ${run.review_note ? `<span>主管复核 · ${h(run.review_note)}</span>` : ''}</div>` +
    (ready ? resultMarkup(run) : `<section class="sheet"><div class="section-top"><h2>${states[run.state]}</h2></div>
      ${empty(run.error || '维修样本已冻结', processing ? '计算节点正在处理队列，结果将自动更新。' : '请调整截止日或补齐真实处置，再提交新运行。')}
      <div class="digest">样本指纹 <code>${h(run.sample_digest)}</code></div></section>`);
  if (processing) {
    setTimeout(() => { if (main.isConnected) refresh(); }, 1100);
    return;
  }
  if (!ready) return;
  main.querySelector('[data-export]').onclick = () => download(`/runs/${id}/export`, `holdout-${id}.csv`).catch(error => notify(error.message));
  if (canPublish) main.querySelector('[data-publish]').onclick = () => {
    edit('复核并发布', '<p>此运行将用于之后新登记的分诊单。请记录留出表现与可接受的误判。</p><label>主管复核说明<textarea name="note" minlength="4" maxlength="320" required></textarea></label>',
      '发布分诊规则', async body => {
        await request(`/runs/${id}/publish`, {method: 'POST', body});
        notify('规则已发布到维修工位');
        refresh();
      });
  };
}
