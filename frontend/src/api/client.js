import {getSession, setSession} from '../stores/session.js';
import {save} from '../stores/workbench.js';

export async function request(path, {method = 'GET', body, file = false} = {}) {
  const headers = {};
  const token = getSession()?.token;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(`/api${path}`, {method, headers, body: body && JSON.stringify(body)});
  if (!response.ok) {
    if (response.status === 401 && token) {
      setSession(null);
      window.dispatchEvent(new Event('session-ended'));
    }
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `请求未完成（${response.status}）`);
  }
  return file ? response : response.json();
}

export async function read(path) {
  return save(path, await request(path));
}

export async function download(path, filename) {
  const response = await request(path, {file: true});
  const url = URL.createObjectURL(await response.blob());
  const link = Object.assign(document.createElement('a'), {href: url, download: filename});
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
