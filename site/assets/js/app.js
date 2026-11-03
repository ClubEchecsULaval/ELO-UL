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
  // Replace the placeholder chess icon and tagline in the common footer.
  // This is intentionally limited to the footer; no other page content changes.
  document.querySelectorAll('.footer-brand').forEach(brand => {
    const heading = brand.querySelector('h2');
    if (!heading) return;
    const logo = document.createElement('img');
    logo.src = '/assets/images/universite-laval-footer.png';
    logo.alt = 'Université Laval';
    logo.width = 474;
    logo.height = 209;
    logo.decoding = 'async';
    logo.style.cssText = 'display:block;width:min(355px,100%);height:auto;object-fit:contain;object-position:left center;margin:0 0 20px;';
    brand.querySelector('.footer-mark')?.remove();
    heading.replaceWith(logo);
  });
  document.querySelectorAll('[data-current-year]').forEach(el => {el.textContent = String(new Date().getFullYear());});
})();
