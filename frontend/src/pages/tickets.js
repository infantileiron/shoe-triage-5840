import {download, read, request} from '../api/client.js';
import {badge, classMix, empty, header, measurements, pathList, routeBadge, selectOptions, table} from '../components/common/ui.js';
import {recordFields} from '../components/measurement-form.js';
import {routes} from '../constants/domain.js';
import {edit, notify} from '../hooks/actions.js';
import {escape as h, timestamp} from '../utils/text.js';

const canDispatch = user => user.role === 'owner' || user.role === 'viewer';

function batchCard(batch, dispatch) {
  const outstanding = batch.total - batch.received;
  return `<article class="batch" data-batch="${batch.id}">
    <div class="batch-head"><div><strong class="mono code">批次 #${batch.id}</strong>${routeBadge(batch.station)}</div>
    ${outstanding ? badge(`缺 ${outstanding} 张回执`, 'draft') : badge('回执已齐', 'active')}</div>
    <div class="batch-meta"><span>${h(batch.created_by)} 开立于 ${h(timestamp(batch.created_at))}</span>
    <span>共 <b class="mono">${batch.total}</b> 张 · 已认领 <b class="mono">${batch.received}</b> 张</span></div>
    <div class="button-group">
      <button class="secondary" data-download="${batch.id}">下载派工 CSV</button>
      ${dispatch ? `<button class="secondary" data-receipt="${batch.id}">登记回执</button>` : ''}
      <button class="subtle" data-reconcile="${batch.id}">对账</button>
    </div>
    <div class="batch-detail" hidden></div>
  </article>`;
}

function batchSection(data, user) {
  const dispatch = canDispatch(user);
  const pending = Object.values(data.unbatched).reduce((sum, count) => sum + count, 0);
  return `<section class="sheet batch-sheet">
    <div class="section-top"><h2>派工批次</h2>${badge(`${data.batches.length} 批`)}</div>
    <div class="batch-pending"><span>已签发未分批 ${Object.keys(routes).map(station =>
      `${routes[station]} <b class="mono">${data.unbatched[station] || 0}</b>`).join('<span class="sep">/</span>')}</span>
    ${dispatch ? `<button class="secondary" data-open-batch ${pending ? '' : 'disabled'}>按工位开批</button>` : ''}</div>
    ${data.batches.length ? `<div class="batch-list">${data.batches.map(batch => batchCard(batch, dispatch)).join('')}</div>` :
      empty('暂无派工批次', dispatch ? '有已签发的分诊单后，按工位开立批次，换班各拿各的批号。' : '调度开立批次后可在此对账。')}
  </section>`;
}

function reconcileTable(batch) {
  return table(['分诊单', '团队', '鞋型', '模型建议', '回执状态'], batch.items.map(item => `<tr>
    <td class="mono code">${h(item.code)}</td><td>${h(item.studio)}</td><td>${h(item.shoe)}</td>
    <td>${routeBadge(item.prediction)}</td>
    <td>${item.received_by ? `${badge('已认领', 'active')}<small>${h(item.received_by)} · ${h(timestamp(item.received_at))}</small>` :
      badge('缺回执', 'draft')}</td></tr>`), `批次 #${batch.id} 对账`) +
    `<div class="digest">批次指纹 <code>${h(batch.digest)}</code> · 下载中断后重取本批，内容与此指纹一致</div>`;
}

function receiptOutcome(batchId, result) {
  const codes = list => list.map(code => `<span class="mono code">${h(code)}</span>`).join('、');
  edit(`批次 #${batchId} · 回执登记结果`, `
    <p>新登记 <b class="mono">${result.recorded.length}</b> 张，此前已登记 <b class="mono">${result.duplicate.length}</b> 张（自动跳过，不重复记账）。</p>
    ${result.misplaced.length ? `<p class="error">串批未入账：${result.misplaced.map(item =>
      `<span class="mono code">${h(item.code)}</span> 属批次 #${item.batch}`).join('；')}</p>` : ''}
    ${result.unbatched.length ? `<p class="error">已签发未分批：${codes(result.unbatched)}</p>` : ''}
    ${result.unsigned.length ? `<p class="error">尚未签发：${codes(result.unsigned)}</p>` : ''}
    ${result.unknown.length ? `<p class="error">查无此单：${codes(result.unknown)}</p>` : ''}`,
    '知道了', async () => {});
}

function receiptDialog(batchId, refresh) {
  edit(`批次 #${batchId} · 登记回执`, `<p>按批号登记工位交回的回执，可分次提交、顺序不限；重复提交自动跳过。</p>
    <label>回执单号（每行一张，或用逗号分隔）<textarea name="codes" required placeholder="FZ-0001&#10;FZ-0002"></textarea></label>`,
    '登记回执', async body => {
      const codes = body.codes.split(/[\s,，、;；]+/).filter(Boolean);
      if (!codes.length) throw new Error('请至少填写一张回执单号');
      const result = await request(`/batches/${batchId}/receipts`, {method: 'POST', body: {codes}});
      refresh();
      const missed = result.misplaced.length + result.unbatched.length + result.unsigned.length + result.unknown.length;
      if (missed) setTimeout(() => receiptOutcome(batchId, result), 0);
      else notify(`批次 #${batchId}：新登记 ${result.recorded.length} 张回执` +
        (result.duplicate.length ? `，${result.duplicate.length} 张已登记过` : ''));
    });
}

function openBatchDialog(unbatched, refresh) {
  edit('按工位开批', `<p>把该工位「已签发未分批」的分诊单全部装入新批次；上一批回执未收齐也可开新批。批次内容即冻结，同一张单不会进入两个批次。</p>
    <label>派工工位<select name="station">${Object.entries(routes).map(([id, name]) =>
      `<option value="${id}">${name} · 待分批 ${unbatched[id] || 0} 张</option>`).join('')}</select></label>`,
    '开立批次', async body => {
      const batch = await request('/batches', {method: 'POST', body});
      notify(`批次 #${batch.id} 已开立，共 ${batch.total} 张`);
      refresh();
    });
}

export async function tickets(main, user, refresh) {
  const [list, reports, batchData] = await Promise.all([read('/tickets'), read('/runs'), read('/batches')]);
  const active = reports.find(run => run.publication === 'active');
  const canAdd = user.role === 'analyst' && active;
  const canReview = user.role === 'owner';
  main.innerHTML = header('个案分派', '登记待修鞋，查看规则命中条件，交主管签发最终工序；签发单按工位分批派工。',
    user.role === 'analyst' ? `<div class="button-group"><button data-create ${canAdd ? '' : 'disabled'}>＋ 新建分诊单</button></div>` : '') + `
    <div class="active-strip">${active ? `${badge('生效规则', 'active')} <a href="#runs/${active.id}">${h(active.plan_name)} · #${active.id}</a>` : '暂无生效规则。主管发布评估后即可登记分诊单。'}</div>
    ${batchSection(batchData, user)}
    <section class="ticket-list">${list.length ? list.map(item => `<article class="dispatch sheet">
      <div class="section-top"><div><strong class="mono code">${h(item.code)}</strong><h2>${h(item.studio)} · ${h(item.shoe)}</h2></div>
      ${badge(item.decision ? '已签发' : '待签发', item.decision ? 'active' : 'draft')}</div>
      <div class="dispatch-body"><div><h3>收件测量</h3><p>${measurements(item)}</p>
      <h3>模型建议</h3><p>${routeBadge(item.prediction)} <a class="mono" href="#runs/${item.run_id}">运行 #${item.run_id}</a></p>
      <h3>最终处置</h3>${item.decision ? `<p>${routeBadge(item.decision)}</p><p>${h(item.note)}</p><small>${h(item.reviewed_by)} · ${h(timestamp(item.reviewed_at))}</small>` :
        canReview ? `<button data-sign="${h(item.code)}">签发工序</button>` : '<p class="muted">等待主管签发</p>'}</div>
      <div><h3>命中路径</h3>${pathList(item.path.steps)}<div class="leaf-mix">训练叶样本 <div>${classMix(item.path.counts)}</div></div></div></div>
    </article>`).join('') : `<div class="sheet">${empty('暂无分诊单', active ? '分析员可登记新鞋，主管签发后调度席可查看。' : '先由主管发布一份留出评估。')}</div>`}</section>`;
  const openBatch = main.querySelector('[data-open-batch]');
  if (openBatch) openBatch.onclick = () => openBatchDialog(batchData.unbatched, refresh);
  main.querySelectorAll('[data-download]').forEach(button => {
    button.onclick = () => download(`/batches/${button.dataset.download}/export`,
      `dispatch-batch-${button.dataset.download}.csv`).catch(error => notify(error.message));
  });
  main.querySelectorAll('[data-receipt]').forEach(button => {
    button.onclick = () => receiptDialog(button.dataset.receipt, refresh);
  });
  main.querySelectorAll('[data-reconcile]').forEach(button => {
    button.onclick = async () => {
      const detail = main.querySelector(`[data-batch="${button.dataset.reconcile}"] .batch-detail`);
      if (!detail.hidden) {
        detail.hidden = true;
        button.textContent = '对账';
        return;
      }
      button.disabled = true;
      try {
        const batch = await request(`/batches/${button.dataset.reconcile}`);
        detail.innerHTML = reconcileTable(batch);
        detail.hidden = false;
        button.textContent = '收起对账';
      } catch (error) {
        notify(error.message);
      } finally {
        button.disabled = false;
      }
    };
  });
  if (canAdd) main.querySelector('[data-create]').onclick = () => {
    edit('新建分诊单', recordFields(), '生成分诊建议', async data => {
      await request('/tickets', {method: 'POST', body: {...data, wear: Number(data.wear), glue: Number(data.glue)}});
      notify('已生成建议，等待主管签发');
      refresh();
    });
  };
  main.querySelectorAll('[data-sign]').forEach(button => {
    button.onclick = () => {
      const item = list.find(ticket => ticket.code === button.dataset.sign);
      edit('签发最终工序', `<label>实际派单<select name="decision">${selectOptions(routes, item.prediction)}</select></label>
        <label>签发说明<textarea name="note" minlength="4" maxlength="320" required></textarea></label>`, '确认签发', async body => {
        await request(`/tickets/${item.code}/decision`, {method: 'POST', body});
        notify('工序已签发');
        refresh();
      });
    };
  });
}
