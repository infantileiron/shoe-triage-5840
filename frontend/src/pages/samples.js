import {read, request} from '../api/client.js';
import {badge, empty, header, measurements, routeBadge, selectOptions, table} from '../components/common/ui.js';
import {recordFields} from '../components/measurement-form.js';
import {routes} from '../constants/domain.js';
import {edit, notify} from '../hooks/actions.js';
import {escape as h} from '../utils/text.js';
import {load} from '../stores/workbench.js';

const PAGE_SIZE = 10;

export async function samples(main, user, refresh) {
  const allowed = user.role === 'analyst';
  const rows = (await read('/samples')).toReversed();
  const oldest = rows.at(-1)?.received ?? '—';
  const newest = rows[0]?.received ?? '—';
  main.innerHTML = header('历史退修工票', '核对每双鞋的测量值和师傅签回的实际处置。', allowed ? '<button data-create>＋ 登记工票</button>' : '') + `
    <div class="sample-layout">
      <section class="sheet">
        <div class="section-top"><h2>退修登记簿</h2>${badge(`${rows.length} 张工票`)}</div>
        <div class="toolbar"><input type="search" aria-label="搜索工票" placeholder="工票号、送修团队或鞋型">
          <select aria-label="筛选真实处置"><option value="">全部真实处置</option>${selectOptions(routes)}</select></div>
        <div data-ledger></div>
      </section>
      <aside class="ticket-paper"><div class="ticket-eyebrow mono">REPAIR LEDGER</div>
        <h2>归档一览</h2><div class="ticket-total"><strong>${rows.length}</strong><span>张历史工票</span></div>
        <div class="date-span"><span>收件日期</span><b>${oldest}</b><b>— ${newest}</b></div>
        <dl>${Object.entries(routes).map(([label, name]) => `<div><dt>${routeBadge(label)}</dt><dd class="mono">${rows.filter(row => row.label === label).length}</dd></div>`).join('')}</dl>
        <p>磨损率按鞋底面积估读。开胶沿侧缘测量，单位为毫米。真实处置以完修签回为准。</p>
      </aside>
    </div>`;
  const filter = main.querySelector('input');
  const label = main.querySelector('select');
  const ledger = main.querySelector('[data-ledger]');
  let page = 0;
  function draw() {
    const query = filter.value.trim().toLowerCase();
    const fitted = rows.filter(row => (!label.value || row.label === label.value) &&
      [row.code, row.studio, row.shoe].some(value => value.toLowerCase().includes(query)));
    if (!fitted.length) {
      ledger.innerHTML = empty('没有匹配的工票', '试试清空关键词或切换到全部真实处置。');
      return;
    }
    const maxPage = Math.ceil(fitted.length / PAGE_SIZE);
    ledger.innerHTML = table(['工票', '收件日期', '送修团队 / 鞋型', '磨损 / 开胶 / 鞋底', '真实处置', ...(allowed ? ['操作'] : [])],
      fitted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(row => `<tr><td class="mono code">${h(row.code)}</td>
      <td class="mono">${h(row.received)}</td><td><strong>${h(row.studio)}</strong><small>${h(row.shoe)}</small></td>
      <td>${measurements(row)}</td><td>${routeBadge(row.label)}</td>${allowed ? `<td><button class="text-button" data-code="${h(row.code)}">校订</button></td>` : ''}</tr>`), '历史退修工票') +
      `<div class="pagination"><span class="mono">${page + 1} / ${maxPage}</span><div>
      <button class="subtle" data-prev ${page ? '' : 'disabled'}>上一页</button>
      <button class="subtle" data-next ${page + 1 === maxPage ? 'disabled' : ''}>下一页</button></div></div>`;
    ledger.querySelector('[data-prev]').onclick = () => { page -= 1; draw(); };
    ledger.querySelector('[data-next]').onclick = () => { page += 1; draw(); };
    ledger.querySelectorAll('[data-code]').forEach(button => {
      button.onclick = () => editSample(load('/samples').find(row => row.code === button.dataset.code));
    });
  }
  function editSample(row) {
    edit(row ? '校订历史工票' : '登记历史工票', recordFields(row, true), '保存工票', async data => {
      const body = {...data, wear: Number(data.wear), glue: Number(data.glue)};
      await request(row ? `/samples/${row.code}` : '/samples', {method: row ? 'PUT' : 'POST', body});
      notify('历史工票已保存');
      refresh();
    });
  }
  if (allowed) main.querySelector('[data-create]').onclick = () => editSample();
  filter.oninput = label.onchange = () => { page = 0; draw(); };
  draw();
}
