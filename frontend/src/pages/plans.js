import {read, request} from '../api/client.js';
import {badge, empty, header} from '../components/common/ui.js';
import {fields} from '../constants/domain.js';
import {notify} from '../hooks/actions.js';
import {go} from '../router/routes.js';
import {escape as h} from '../utils/text.js';

export async function plans(main, user, refresh) {
  const list = await read('/plans');
  const allowed = user.role === 'analyst';
  const cutoff = list[0]?.cutoff ?? '';
  main.innerHTML = header('训练方案', '用时间截止日隔开训练样本与后来收件的检验工票。') + `
    <div class="plan-layout"><section class="sheet"><div class="section-top"><h2>方案版本</h2>${badge(`${list.length} 个版本`)}</div>
    ${list.length ? list.map(plan => `<article class="version"><div class="version-title"><span class="mono">V${h(plan.id)}</span><h3>${h(plan.name)}</h3></div>
      <dl><div><dt>留出起始日</dt><dd>${h(plan.cutoff)}</dd></div><div><dt>代价 α</dt><dd>${h(plan.alpha)}</dd></div>
      <div><dt>最小叶样本</dt><dd>${h(plan.min_leaf)}</dd></div><div><dt>深度上限</dt><dd>${h(plan.max_depth)}</dd></div></dl>
      <div class="version-bottom"><div class="features">${plan.features.map(feature => badge(fields[feature])).join('')}</div>
      ${allowed ? `<button type="button" data-run="${h(plan.id)}">冻结样本并运行</button>` : ''}</div></article>`).join('') : empty('暂无可读的方案', '分析员可以创建方案。观察员可在主管发布后查看版本。')}
    </section>
    ${allowed ? `<form id="plan-form" class="ticket-paper plan-form"><div class="ticket-eyebrow mono">TRAINING SPEC</div><h2>新建参数版本</h2>
      <p>版本保存后固定。调整口径时请另存为新版本。</p>
      <label>版本名称<input name="name" required maxlength="70" placeholder="例如 十一月返修 · 修订版"></label>
      <label>留出起始日<input type="date" name="cutoff" value="${h(cutoff)}" required></label>
      <div class="form-grid">
        <label>剪枝 α<input type="number" name="alpha" min="0" max="1" step="any" value="0.026" required></label>
        <label>最小叶样本<input type="number" name="min_leaf" min="1" max="30" value="2" required></label>
      </div>
      <label>深度上限<input type="number" name="max_depth" min="1" max="8" value="5" required></label>
      <fieldset><legend>候选特征</legend><div class="checklist">${Object.entries(fields).map(([id, name]) => `<label><input type="checkbox" name="features" value="${id}" checked>${name}</label>`).join('')}</div></fieldset>
      <p class="error" role="alert" hidden></p><button type="submit">保存参数版本</button>
    </form>` : `<aside class="ticket-paper"><h2>时间留出</h2><p>起始日前的工票用于训练。起始日当天及之后的工票用于评估。</p><p>剪枝只使用训练样本，结果在留出评估页查看。</p></aside>`}</div>`;
  if (!allowed) return;
  main.querySelectorAll('[data-run]').forEach(button => {
    button.onclick = async () => {
      button.disabled = true;
      try {
        const run = await request(`/plans/${button.dataset.run}/runs`, {method: 'POST'});
        go('runs', run.id);
      } catch (error) {
        notify(error.message);
      } finally {
        button.disabled = false;
      }
    };
  });
  const form = main.querySelector('#plan-form');
  form.onsubmit = async event => {
    event.preventDefault();
    const data = new FormData(form);
    const body = {...Object.fromEntries(data), features: data.getAll('features')};
    for (const name of ['alpha', 'min_leaf', 'max_depth']) body[name] = Number(body[name]);
    const button = form.querySelector('button');
    const error = form.querySelector('.error');
    button.disabled = true;
    error.hidden = true;
    try {
      await request('/plans', {method: 'POST', body});
      notify('参数版本已保存');
      refresh();
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
    } finally {
      button.disabled = false;
    }
  };
}
