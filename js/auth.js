const _B1_KEY = 'b1_auth';
const _B1_PW  = 't1-long-';

function checkAuth() {
  if (sessionStorage.getItem(_B1_KEY) !== '1')
    window.location.replace('login.html');
}

function b1Login(pw) {
  if (pw === _B1_PW) {
    sessionStorage.setItem(_B1_KEY, '1');
    return true;
  }
  return false;
}
