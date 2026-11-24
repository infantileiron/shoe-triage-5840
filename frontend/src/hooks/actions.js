const dialog = document.querySelector('#editor');
let timer;

export function clearNotice() {
  clearTimeout(timer);
  document.querySelector('#notice').textContent = '';
}

export function notify(message) {
  const element = document.querySelector('#notice');
  element.textContent = message;
  clearTimeout(timer);
  timer = setTimeout(clearNotice, 4200);
}

export function edit(title, content, button, submit) {
  dialog.innerHTML = `<form><div class="dialog-head"><h2 id="editor-title">${title}</h2><button type="button" class="subtle close" aria-label="关闭">×</button></div>
    ${content}<p class="error" role="alert" hidden></p><div class="form-actions"><button type="submit">${button}</button></div></form>`;
  dialog.querySelector('.close').onclick = () => dialog.close();
  dialog.querySelector('form').onsubmit = async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const error = form.querySelector('.error');
    const action = form.querySelector('[type=submit]');
    error.hidden = true;
    action.disabled = true;
    try {
      await submit(Object.fromEntries(new FormData(form)));
      dialog.close();
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
    } finally {
      action.disabled = false;
    }
  };
  dialog.showModal();
}
