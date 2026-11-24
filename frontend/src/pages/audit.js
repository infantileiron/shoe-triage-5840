import {read} from '../api/client.js';
import {empty, header, table} from '../components/common/ui.js';
import {escape as h, timestamp} from '../utils/text.js';

const actions = {'sample.create': '登记历史工票', 'sample.update': '校订历史工票', 'plan.create': '保存参数版本',
  'run.queue': '提交评估', 'run.publish': '发布规则', 'ticket.create': '生成分诊建议', 'ticket.decide': '签发工序'};

export async function audit(main) {
  const list = await read('/audit');
  main.innerHTML = header('值班日志', '查阅最近 100 条工票、运行和主管签发记录。') + `<section class="sheet">${list.length ?
    table(['时间', '工号', '动作', '对象'], list.map(row => `<tr><td>${h(timestamp(row.happened_at))}</td>
      <td class="mono">${h(row.actor)}</td><td>${h(actions[row.action])}</td><td class="mono">${h(row.subject)}</td></tr>`), '值班日志') :
    empty('暂无值班操作', '登记工票或发布分诊规则后会形成日志。')}</section>`;
}
