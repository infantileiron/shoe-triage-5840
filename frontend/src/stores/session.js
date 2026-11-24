let session = null;
try {
  session = JSON.parse(sessionStorage.getItem('shoe-triage-session'));
} catch {
  sessionStorage.removeItem('shoe-triage-session');
}

export function getSession() {
  return session;
}

export function setSession(value) {
  session = value;
  if (value) sessionStorage.setItem('shoe-triage-session', JSON.stringify(value));
  else sessionStorage.removeItem('shoe-triage-session');
}
