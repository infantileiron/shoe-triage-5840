import {demo, roles} from '../constants/domain.js';
import {paintShoe} from '../components/shoe-diagram.js';
import {request} from '../api/client.js';
import {setSession} from '../stores/session.js';

export function login(root, onLogin) {
  root.innerHTML = `<main class="login-layout">
  <section class="login-cover"><div class="login-brand"><span class="mark" aria-hidden="true">照</span><span>照台舞服</span></div>
    <figure class="diagram"><canvas width="700" height="720" role="img" aria-label="鞋底测量图，标出前掌磨损、侧缘开胶和后掌鞋底状态"></canvas>
      <figcaption>练功鞋鞋底检查图 <span class="mono">SOLE INSPECTION</span></figcaption></figure>
  </section>
  <section class="login-stage"><article class="login-paper">
    <div class="login-index"><span class="mono">REPAIR DESK</span><span>返修工位</span></div>
    <h1>练功鞋<br>返修分诊</h1>
    <p>登录后登记退修、复核分诊规则与签发维修工票。</p>
    <form id="login-form">
      <label>工号<input name="username" autocomplete="username" required placeholder="输入工号"></label>
      <label>密码<input name="password" type="password" autocomplete="current-password" required placeholder="输入密码"></label>
      <p class="error" role="alert" hidden></p>
      <button type="submit">进入返修工位 <span aria-hidden="true">↗</span></button>
    </form>
    <div class="login-demo"><span>演示席位</span><div>${Object.keys(demo).map(id => `<button type="button" class="subtle" data-account="${id}">${roles[id]}</button>`).join('')}</div></div>
  </article></section></main>`;
  paintShoe(root.querySelector('canvas'));
  const form = root.querySelector('form');
  root.querySelectorAll('[data-account]').forEach(button => {
    button.onclick = () => {
      form.elements.username.value = button.dataset.account;
      form.elements.password.value = demo[button.dataset.account];
      form.querySelector('button').focus();
    };
  });
  form.onsubmit = async event => {
    event.preventDefault();
    const action = form.querySelector('button');
    const error = form.querySelector('.error');
    action.disabled = true;
    error.hidden = true;
    try {
      setSession(await request('/auth/login', {method: 'POST', body: Object.fromEntries(new FormData(form))}));
      onLogin();
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
    } finally {
      action.disabled = false;
    }
  };
}
