(() => {
  const toggle = document.querySelector('[data-menu-toggle]');
  const nav = document.querySelector('#main-navigation');
  if (toggle && nav) {
    const closeMenu = () => {nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false');};
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('keydown', e => {if(e.key === 'Escape') closeMenu();});
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  }
  document.querySelectorAll('[data-current-year]').forEach(el => {el.textContent = String(new Date().getFullYear());});
})();
