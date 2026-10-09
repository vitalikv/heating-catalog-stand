if (new URLSearchParams(location.search).has('benchmark')) {
  import('./benchmark').catch((error: unknown) => {
    document.getElementById('info')!.textContent = `Ошибка теста: ${String(error)}`;
  });
} else {
  void import('./main');
}
