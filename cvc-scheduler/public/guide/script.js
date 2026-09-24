(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const sidebar = byId('guide-sidebar');
  const toggle = byId('menu-toggle');
  const backdrop = byId('nav-backdrop');
  const isMobile = () => window.innerWidth <= 960;
  function closeNav() {
    document.body.classList.remove('nav-open');
    toggle?.setAttribute('aria-expanded', 'false');
    toggle?.setAttribute('aria-label', 'Open guide navigation');
    if (backdrop) backdrop.hidden = true;
    if (sidebar && isMobile() && sidebar.contains(document.activeElement)) toggle?.focus({ preventScroll: true });
    if (sidebar) sidebar.inert = isMobile();
  }
  function openNav() {
    document.body.classList.add('nav-open');
    toggle?.setAttribute('aria-expanded', 'true');
    toggle?.setAttribute('aria-label', 'Close guide navigation');
    if (backdrop) backdrop.hidden = false;
    if (sidebar) sidebar.inert = false;
    sidebar?.querySelector('.nav-link')?.focus();
  }
  toggle?.addEventListener('click', () => document.body.classList.contains('nav-open') ? closeNav() : openNav());
  byId('menu-close')?.addEventListener('click', () => { closeNav(); toggle?.focus(); });
  backdrop?.addEventListener('click', closeNav);
  sidebar?.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', closeNav));
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('nav-open')) { closeNav(); toggle?.focus(); } });
  window.addEventListener('resize', () => { if (!isMobile()) closeNav(); else if (!document.body.classList.contains('nav-open') && sidebar) sidebar.inert = true; }, { passive: true });
  if (sidebar) sidebar.inert = isMobile();

  // The three scheduling examples share one accessible tab control.
  const tabs = [...document.querySelectorAll('[role="tab"][data-tab]')];
  function activateTab(tab, focus = false) {
    tabs.forEach(button => {
      const selected = button === tab;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      const panel = byId('panel-' + button.dataset.tab);
      if (panel) panel.hidden = !selected;
    });
    if (focus) tab.focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateTab(tab));
    tab.addEventListener('keydown', e => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
      e.preventDefault();
      const i = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      activateTab(tabs[i], true);
    });
  });

  // Screenshot images are optional in this handoff package. Keep missing ones explicit.
  document.querySelectorAll('.shot-button[data-image]').forEach(button => {
    const preview = button.querySelector('img');
    if (!preview) return;
    const markMissing = () => {
      const figure = button.closest('.shot');
      if (!figure || figure.classList.contains('is-missing')) return;
      figure.classList.add('is-missing');
      button.disabled = true;
      const placeholder = document.createElement('span');
      placeholder.className = 'missing-shot';
      placeholder.textContent = 'Screenshot unavailable';
      const filename = document.createElement('small');
      filename.textContent = 'Please check that the guide assets were copied with the page.';
      placeholder.append(filename);
      button.append(placeholder);
    };
    preview.addEventListener('error', markMissing, { once: true });
    if (preview.complete && preview.naturalWidth === 0) markMissing();
  });

  // Screenshot lightbox: images stay local to this folder.
  const dialog = byId('image-dialog');
  const enlarged = byId('dialog-image');
  let lastShot = null;
  document.querySelectorAll('.shot-button[data-image]').forEach(button => button.addEventListener('click', () => {
    if (!dialog || !enlarged || typeof dialog.showModal !== 'function') return;
    lastShot = button;
    const preview = button.querySelector('img');
    enlarged.src = button.dataset.image;
    enlarged.alt = preview?.alt || 'Enlarged Project Local screenshot';
    byId('dialog-caption').textContent = button.dataset.caption || 'Screenshot';
    dialog.showModal();
    byId('dialog-close')?.focus();
  }));
  enlarged?.addEventListener('error', () => { if (dialog?.open) dialog.close(); });
  byId('dialog-close')?.addEventListener('click', () => { if (dialog?.open) dialog.close(); });
  dialog?.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  dialog?.addEventListener('close', () => { enlarged?.removeAttribute('src'); lastShot?.focus(); });
  byId('print-guide')?.addEventListener('click', () => window.print());

  const progress = byId('reading-progress');
  function updateProgress() {
    if (!progress) return;
    const range = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = (range <= 0 ? 100 : Math.max(0,Math.min(100,window.scrollY / range * 100))).toFixed(1) + '%';
  }
  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress, { passive: true });
  updateProgress();
  // Highlight the section the reader is currently looking at. Using a single
  // viewport reference line avoids selecting the preceding section when a card
  // straddles the sticky header and its neighbor has already appeared.
  const sectionLinks = [...document.querySelectorAll('.sidebar-nav .nav-link')];
  const guideSections = [...document.querySelectorAll('.guide-section[id]')];
  let activeFramePending = false;
  function updateActiveSection() {
    activeFramePending = false;
    const line = Math.min(window.innerHeight * 0.27, 260);
    let active = guideSections[0];
    guideSections.forEach(section => {
      if (section.getBoundingClientRect().top <= line) active = section;
    });
    const hash = active ? '#' + active.id : '#welcome';
    sectionLinks.forEach(link => {
      const isActive = link.getAttribute('href') === hash;
      link.classList.toggle('active', isActive);
      if (isActive) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  function queueActiveSection() {
    if (activeFramePending) return;
    activeFramePending = true;
    window.requestAnimationFrame(updateActiveSection);
  }
  window.addEventListener('scroll', queueActiveSection, { passive: true });
  window.addEventListener('resize', queueActiveSection, { passive: true });
  sectionLinks.forEach(link => link.addEventListener('click', () => {
    const hash = link.getAttribute('href');
    const section = hash && document.querySelector(hash);
    if (section) window.requestAnimationFrame(queueActiveSection);
  }));
  queueActiveSection();

})();
