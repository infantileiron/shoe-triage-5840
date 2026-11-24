import {download, read, request} from '../api/client.js';
import {badge, classMix, empty, header, measurements, pathList, routeBadge, selectOptions} from '../components/common/ui.js';
import {recordFields} from '../components/measurement-form.js';
import {routes} from '../constants/domain.js';
import {edit, notify} from '../hooks/actions.js';
import {escape as h, timestamp} from '../utils/text.js';

export async function tickets(main, user, refresh) {
  const [list, reports] = await Promise.all([read('/tickets'), read('/runs')]);
  const active = reports.find(run => run.publication === 'active');
  const canAdd = user.role === 'analyst' && active;
  const canReview = user.role === 'owner';
  main.innerHTML = header('个案分派', '登记待修鞋，查看规则命中条件，交主管签发最终工序。', `<div class="button-group">
    <button class="secondary" data-export ${list.some(item => item.decision) ? '' : 'disabled'}>导出签发 CSV</button>
    ${user.role === 'analyst' ? `<button data-create ${canAdd ? '' : 'disabled'}>＋ 新建分诊单</button>` : ''}</div>`) + `
    <div class="active-strip">${active ? `${badge('生效规则', 'active')} <a href="#runs/${active.id}">${h(active.plan_name)} · #${active.id}</a>` : '暂无生效规则。主管发布评估后即可登记分诊单。'}</div>
    <section class="ticket-list">${list.length ? list.map(item => `<article class="dispatch sheet">
      <div class="section-top"><div><strong class="mono code">${h(item.code)}</strong><h2>${h(item.studio)} · ${h(item.shoe)}</h2></div>
      ${badge(item.decision ? '已签发' : '待签发', item.decision ? 'active' : 'draft')}</div>
      <div class="dispatch-body"><div><h3>收件测量</h3><p>${measurements(item)}</p>
      <h3>模型建议</h3><p>${routeBadge(item.prediction)} <a class="mono" href="#runs/${item.run_id}">运行 #${item.run_id}</a></p>
      <h3>最终处置</h3>${item.decision ? `<p>${routeBadge(item.decision)}</p><p>${h(item.note)}</p><small>${h(item.reviewed_by)} · ${h(timestamp(item.reviewed_at))}</small>` :
        canReview ? `<button data-sign="${h(item.code)}">签发工序</button>` : '<p class="muted">等待主管签发</p>'}</div>
      <div><h3>命中路径</h3>${pathList(item.path.steps)}<div class="leaf-mix">训练叶样本 <div>${classMix(item.path.counts)}</div></div></div></div>
    </article>`).join('') : `<div class="sheet">${empty('暂无分诊单', active ? '分析员可登记新鞋，主管签发后调度席可查看。' : '先由主管发布一份留出评估。')}</div>`}</section>`;
  main.querySelector('[data-export]').onclick = () => download('/tickets/export', 'triage-dispatch.csv').catch(error => notify(error.message));
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
