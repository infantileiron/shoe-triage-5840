import {getSession, setSession} from './stores/session.js';
import {reset} from './stores/workbench.js';
import {current, go, pages} from './router/routes.js';
import {roles} from './constants/domain.js';
import {escape as h} from './utils/text.js';
import {empty} from './components/common/ui.js';
import {clearNotice} from './hooks/actions.js';
import {login} from './pages/login.js';
import {samples} from './pages/samples.js';
import {plans} from './pages/plans.js';
import {runs, runDetail} from './pages/runs.js';
import {tickets} from './pages/tickets.js';
import {audit} from './pages/audit.js';

const root = document.querySelector('#app');

function logout() {
  setSession(null);
  reset();
  clearNotice();
  const dialog = document.querySelector('#editor');
  if (dialog.open) dialog.close();
  render();
}

async function render() {
  const session = getSession();
  if (!session) {
    login(root, () => {
      if (location.hash === '#samples') render();
      else go('samples');
    });
    return;
  }
  const user = session.user;
  const {area, id} = current();
  const allowedPages = Object.keys(pages).filter(page => page !== 'audit' || user.role === 'owner');
  root.innerHTML = `<div class="workspace"><aside class="rail"><a class="brand" href="#samples"><span class="mark" aria-hidden="true">照</span><span>照台舞服<small>返修工位</small></span></a>
    <nav aria-label="工作区">${allowedPages.map(page => `<a href="#${page}" ${area === page ? 'aria-current="page"' : ''}><span class="rail-indicator"></span>${pages[page]}</a>`).join('')}</nav>
    <div class="rail-user"><div><strong>${h(user.name)}</strong><small>${h(roles[user.role])}</small></div><button class="logout" data-logout>退出</button></div>
  </aside><div class="desk"><div class="masthead"><span>维修工作台 <i>/</i> ${pages[area]}</span><span class="mono">SHOE TRIAGE</span></div><main id="content" aria-busy="true"></main></div></div>`;
  const main = root.querySelector('main');
  root.querySelector('[data-logout]').onclick = logout;
  const view = {samples, plans, runs: id ? runDetail : runs, tickets, audit: user.role === 'owner' ? audit : samples}[area];
  try {
    await view(main, user, render, id);
  } catch (error) {
    if (!main.isConnected) return;
    main.innerHTML = `<section class="sheet">${empty('页面载入失败', error.message)}<div class="retry"><button>重试</button> <a href="#samples">返回历史退修</a></div></section>`;
    main.querySelector('button').onclick = render;
  } finally {
    main.removeAttribute('aria-busy');
  }
}

addEventListener('hashchange', () => {
  clearNotice();
  window.scrollTo(0, 0);
  render();
});
addEventListener('session-ended', logout);
render();
