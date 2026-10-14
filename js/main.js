/* BDC · Brianna Design & Construction — interacciones
   Sin librerías. Todo lo que se mueve usa transform/opacity
   y un único bucle requestAnimationFrame para el scroll. */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const hasIO = 'IntersectionObserver' in window;

  /* ---------- Entrada del hero (espera a la fuente, máx. 700 ms) ---------- */
  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, new Promise(r => setTimeout(r, 700))]).then(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('ready')));
  });

  /* ---------- Revelado al entrar en pantalla ---------- */
  const revealIO = hasIO ? new IntersectionObserver(entries => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); }
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }) : null;
  $$('.rv').forEach(el => (revealIO ? revealIO.observe(el) : el.classList.add('in')));

  /* ---------- Frase que se "rellena" palabra a palabra ---------- */
  const statement = $('#statement');
  let words = [];
  if (statement) {
    const split = node => {
      Array.from(node.childNodes).forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const s = document.createElement('span');
            s.className = 'w';
            s.textContent = part;
            frag.appendChild(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) split(n);
      });
    };
    split(statement);
    words = $$('.w', statement);
    if (reduce) words.forEach(w => w.classList.add('on'));
  }

  /* ---------- Cabecera + menú móvil ---------- */
  const hdr = $('#hdr');
  const burger = $('.burger');
  const menu = $('#menu');
  let menuOpen = false;
  const setMenu = open => {
    menuOpen = open;
    root.classList.toggle('menu-open', open);
    root.classList.toggle('lock', open);
    burger.setAttribute('aria-expanded', String(open));
    $('.burger__label', burger).textContent = open ? 'Cerrar' : 'Menú';
    menu.setAttribute('aria-hidden', String(!open));
    if (open) hdr.classList.remove('hdr--hide');
  };
  burger.addEventListener('click', () => setMenu(!menuOpen));
  $$('a', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && menuOpen) setMenu(false); });

  /* ---------- Medidas cacheadas (nunca se leen en el scroll) ---------- */
  const hero = $('.hero');
  const slats = $$('.slat');
  const speeds = [0.15, 0.06, 0.21, 0.1, 0.18, 0.04, 0.12];
  const steps = $('#steps');
  const stepsFill = $('.steps__fill');
  const stepItems = $$('.step');
  const fab = $('#fab');
  const contact = $('#contacto');
  const navLinks = $$('.nav a');
  const sections = navLinks.map(a => $(a.getAttribute('href')));
  const pars = reduce ? [] : $$('[data-par]');
  const m = { vh: 0, heroH: 0, desk: false, stepAt: [], secs: [], par: [] };
  const docTop = el => el.getBoundingClientRect().top + window.scrollY;

  function measure() {
    m.vh = window.innerHeight;
    m.heroH = hero.offsetHeight;
    m.desk = window.matchMedia('(min-width: 900px)').matches;
    if (statement) { m.stTop = docTop(statement); m.stH = statement.offsetHeight; }
    if (steps) {
      m.spTop = docTop(steps);
      m.spH = steps.offsetHeight;
      m.stepAt = stepItems.map(s => (m.desk
        ? s.offsetLeft / steps.clientWidth
        : (s.offsetTop + 1) / Math.max(1, steps.clientHeight - 16)));
    }
    if (contact) m.ctTop = docTop(contact);
    m.par = pars.map(el => {
      const box = el.parentNode;
      return { el, top: docTop(box), h: box.offsetHeight, k: Number(el.dataset.par) || 0.1 };
    });
    m.secs =sections.map(s => (s ? { top: docTop(s), bottom: docTop(s) + s.offsetHeight } : null));
  }

  /* ---------- Bucle de scroll ---------- */
  let ticking = false;
  let lastY = window.scrollY;
  let lastN = -1;
  let lastP = -1;
  let lastAct = -2;

  function frame() {
    ticking = false;
    const y = window.scrollY;

    // cabecera: se esconde al bajar, vuelve al subir
    const dy = y - lastY;
    if (!menuOpen && Math.abs(dy) > 6) {
      hdr.classList.toggle('hdr--hide', dy > 0 && y > m.heroH * 0.55);
      lastY = y;
    }
    hdr.classList.toggle('hdr--line', y > 8);

    // lamas del hero: cada una a su velocidad
    if (!reduce && y < m.heroH + 40) {
      const k = m.desk ? 1 : 0.55;
      for (let i = 0; i < slats.length; i++) {
        slats[i].style.transform = 'translate3d(0,' + (-y * speeds[i] * k).toFixed(2) + 'px,0)';
      }
    }

    // fotos con parallax suave dentro de su marco
    for (let i = 0; i < m.par.length; i++) {
      const it = m.par[i];
      if (y + m.vh < it.top - 60 || y > it.top + it.h + 60) continue;
      const d = (y + m.vh / 2) - (it.top + it.h / 2);
      const lim = it.h * 0.11;
      it.el.style.transform = 'translate3d(0,' + clamp(-d * it.k, -lim, lim).toFixed(2) + 'px,0)';
    }

    // frase palabra a palabra
    if (words.length && !reduce) {
      const p = clamp((y - (m.stTop - m.vh * 0.82)) / (m.stH + m.vh * 0.38), 0, 1);
      const n = Math.round(p * words.length);
      if (n !== lastN) {
        for (let i = 0; i < words.length; i++) words[i].classList.toggle('on', i < n);
        lastN = n;
      }
    }

    // línea del proceso
    if (steps) {
      const start = m.spTop - m.vh * 0.8;
      const end = m.spTop + m.spH - m.vh * 0.45;
      const p = reduce ? 1 : clamp((y - start) / Math.max(1, end - start), 0, 1);
      if (Math.abs(p - lastP) > 0.0005) {
        stepsFill.style.setProperty('--p', p.toFixed(4));
        for (let i = 0; i < stepItems.length; i++) stepItems[i].classList.toggle('on', p >= m.stepAt[i] - 0.002);
        lastP = p;
      }
    }

    // botón flotante: visible tras el hero y oculto en contacto
    if (fab) fab.classList.toggle('show', y > m.heroH * 0.7 && y + m.vh < m.ctTop + 140);

    // enlace activo del menú
    const mid = y + m.vh * 0.35;
    let act = -1;
    for (let i = 0; i < m.secs.length; i++) {
      const s = m.secs[i];
      if (s && mid >= s.top && mid < s.bottom) act = i;
    }
    if (act !== lastAct) {
      navLinks.forEach((a, i) => a.classList.toggle('is-active', i === act));
      lastAct = act;
    }
  }

  const onScroll = () => {
    if (!ticking) { ticking = true; requestAnimationFrame(frame); }
  };
  let rRaf = 0;
  const remeasure = () => {
    cancelAnimationFrame(rRaf);
    rRaf = requestAnimationFrame(() => { measure(); lastN = -1; lastP = -1; frame(); syncLB(); });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', remeasure);
  window.addEventListener('load', remeasure);
  fontsReady.then(remeasure);
  if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(document.body);
  measure();
  frame();

  /* ---------- Servicios (acordeón) ---------- */
  $$('.svc__head').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.svc');
      const willOpen = !item.classList.contains('is-open');
      $$('.svc.is-open').forEach(o => {
        if (o === item) return;
        o.classList.remove('is-open');
        $('.svc__head', o).setAttribute('aria-expanded', 'false');
      });
      item.classList.toggle('is-open', willOpen);
      btn.setAttribute('aria-expanded', String(willOpen));
      // si al cerrarse el de arriba el título se sale de la pantalla, lo recolocamos
      if (willOpen) {
        setTimeout(() => {
          const top = btn.getBoundingClientRect().top;
          if (top < hdr.offsetHeight) {
            window.scrollTo({ top: window.scrollY + top - hdr.offsetHeight - 12, behavior: reduce ? 'auto' : 'smooth' });
          }
        }, 680);
      }
    });
  });

  /* ---------- Antes / después ---------- */
  const cmp = $('#compare');
  if (cmp) {
    const knob = $('.compare__knob', cmp);
    let p = 50;
    let raf = 0;
    let rect = null;
    let mode = 0; // 0 nada · 1 decidiendo (táctil) · 2 arrastrando
    let sx = 0;
    let sy = 0;
    let used = false;
    let introRaf = 0;

    const paint = () => {
      raf = 0;
      cmp.style.setProperty('--p', p.toFixed(2));
      knob.setAttribute('aria-valuenow', String(Math.round(p)));
      knob.setAttribute('aria-valuetext', Math.round(p) + ' % antes');
    };
    const set = v => { p = clamp(v, 0, 100); if (!raf) raf = requestAnimationFrame(paint); };
    const fromX = x => ((x - rect.left) / rect.width) * 100;
    const markUsed = () => { if (!used) { used = true; cmp.classList.add('was-used'); } };
    const stopIntro = () => { if (introRaf) { cancelAnimationFrame(introRaf); introRaf = 0; } };

    cmp.addEventListener('pointerdown', e => {
      if (e.button > 0) return;
      rect = cmp.getBoundingClientRect();
      sx = e.clientX; sy = e.clientY;
      stopIntro();
      if (e.pointerType === 'mouse') {
        mode = 2;
        cmp.setPointerCapture(e.pointerId);
        cmp.classList.add('is-drag');
        set(fromX(e.clientX));
        markUsed();
        e.preventDefault();
      } else {
        mode = 1; // esperamos a ver si el gesto es horizontal o es scroll
      }
    });
    cmp.addEventListener('pointermove', e => {
      if (!mode) return;
      if (mode === 1) {
        const dx = Math.abs(e.clientX - sx);
        const dy = Math.abs(e.clientY - sy);
        if (dx > 6 && dx > dy) {
          mode = 2;
          try { cmp.setPointerCapture(e.pointerId); } catch (_) { /* ok */ }
          cmp.classList.add('is-drag');
          markUsed();
        } else {
          if (dy > 10) mode = 0;
          return;
        }
      }
      set(fromX(e.clientX));
    });
    cmp.addEventListener('pointerup', e => {
      if (mode === 1) { set(fromX(e.clientX)); markUsed(); } // toque simple: salta ahí
      mode = 0;
      cmp.classList.remove('is-drag');
    });
    cmp.addEventListener('pointercancel', () => { mode = 0; cmp.classList.remove('is-drag'); });
    cmp.addEventListener('dragstart', e => e.preventDefault());

    knob.addEventListener('keydown', e => {
      const st = e.shiftKey ? 10 : 4;
      const map = { ArrowLeft: -st, ArrowDown: -st, ArrowRight: st, ArrowUp: st, Home: -100, End: 100 };
      if (e.key in map) {
        e.preventDefault();
        stopIntro();
        markUsed();
        set(e.key === 'Home' ? 0 : e.key === 'End' ? 100 : p + map[e.key]);
      }
    });

    // pequeño vaivén la primera vez que aparece, para invitar a arrastrar
    const intro = () => {
      if (reduce || used) return;
      const keys = [50, 30, 70, 50];
      const dur = 720;
      const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      let t0 = 0;
      const tick = now => {
        if (!t0) t0 = now;
        const t = (now - t0) / dur;
        const seg = Math.floor(t);
        if (seg >= keys.length - 1) { set(50); introRaf = 0; return; }
        set(keys[seg] + (keys[seg + 1] - keys[seg]) * ease(t - seg));
        introRaf = requestAnimationFrame(tick);
      };
      introRaf = requestAnimationFrame(tick);
    };
    if (hasIO) {
      const cio = new IntersectionObserver(es => {
        if (es[0].isIntersecting) { cio.disconnect(); setTimeout(intro, 450); }
      }, { threshold: 0.6 });
      cio.observe(cmp);
    }
  }

  /* ---------- Vídeos: solo se reproducen cuando se ven ---------- */
  const vids = $$('video[data-autoplay]');
  if (vids.length && hasIO && !reduce) {
    const vio = new IntersectionObserver(es => es.forEach(e => {
      const v = e.target;
      if (e.isIntersecting) {
        const pr = v.play();
        if (pr && pr.catch) pr.catch(() => {});
      } else if (!v.paused) v.pause();
    }), { threshold: 0.35 });
    vids.forEach(v => { v.muted = true; vio.observe(v); });
  }

  /* ---------- Render: puertas gris / terracota ---------- */
  const render = $('#render');
  if (render) {
    const btns = $$('.toggle button', render);
    btns.forEach(b => b.addEventListener('click', () => {
      render.classList.toggle('is-terracota', b.dataset.c === 'terracota');
      btns.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    }));
  }

  /* ---------- Galería ---------- */
  const G = {
    oficina: {
      t: 'Oficina Brianna · De local a oficina',
      i: [
        ['img/oficina-lamas-1600.jpg', 'Pared de lamas de madera entre dos muros verdes con flores.'],
        ['img/oficina-despues-1400.jpg', 'Después: zona de trabajo con la sala de reuniones al fondo.'],
        ['img/oficina-antes-1400.jpg', 'Antes: el local comercial tal y como lo encontramos.'],
        ['img/oficina-fachada-antes.jpg', 'Antes: la fachada del local.'],
        ['img/oficina-puerta.jpg', 'Puerta de vidrio con las áreas de Brianna: construcción, amianto y mantenimiento.']
      ]
    },
    comunidad: {
      t: 'Comunidad de propietarios · Barcelona',
      i: [
        ['img/comunidad-cubierta.jpg', 'Sustitución de la cubierta del trastero y remate del muro.'],
        ['img/comunidad-lavadero.jpg', 'Baño y lavadero comunitario, totalmente terminado.'],
        ['img/comunidad-bano.jpg', 'Reforma integral del baño y lavadero de uso comunitario.'],
        ['img/comunidad-lucernario.jpg', 'Lucernario del portal limpio: vuelve la luz natural.']
      ]
    },
    masia: {
      t: 'Mas Flassià · Vidreres (Girona)',
      i: [['img/mas-flassia.jpg', 'Comienza la remodelación de un lugar con historia, sin perder su esencia.']]
    },
    melianta: {
      t: 'Habitaciones Melianta',
      i: [
        ['img/melianta-dormitorio.jpg', 'Render: así será el dormitorio.'],
        ['img/melianta-salon.jpg', 'Render: salón comedor con cocina abierta.']
      ]
    }
  };

  const lb = $('#lb');
  const track = $('#lb-track');
  const lbTitle = $('#lb-title');
  const lbCount = $('.lb__count', lb);
  const prevBtn = $('.lb__nav--prev', lb);
  const nextBtn = $('.lb__nav--next', lb);
  const closeBtn = $('.lb__close', lb);
  let cur = null;
  let idx = 0;
  let lastFocus = null;
  let sRaf = 0;
  let closeT = 0;

  function updateLB() {
    const n = cur.i.length;
    lbCount.textContent = (idx + 1) + ' / ' + n;
    lbCount.hidden = n < 2;
    prevBtn.hidden = nextBtn.hidden = n < 2;
    prevBtn.disabled = idx === 0;
    nextBtn.disabled = idx === n - 1;
  }
  function openLB(key, start) {
    const g = G[key];
    if (!g) return;
    clearTimeout(closeT);
    cur = g;
    idx = clamp(start || 0, 0, g.i.length - 1);
    lastFocus = document.activeElement;
    lbTitle.textContent = g.t;
    track.textContent = '';
    g.i.forEach(([src, cap]) => {
      const fig = document.createElement('figure');
      fig.className = 'lb__slide';
      const img = new Image();
      img.decoding = 'async';
      img.alt = cap;
      img.addEventListener('load', () => img.classList.add('ok'));
      img.src = src;
      const fc = document.createElement('figcaption');
      fc.textContent = cap;
      fc.setAttribute('aria-hidden', 'true');
      fig.append(img, fc);
      track.appendChild(fig);
    });
    lb.hidden = false;
    root.classList.add('lock');
    track.scrollLeft = idx * track.clientWidth;
    updateLB();
    requestAnimationFrame(() => requestAnimationFrame(() => lb.classList.add('open')));
    closeBtn.focus({ preventScroll: true });
  }
  function closeLB() {
    if (lb.hidden) return;
    lb.classList.remove('open');
    root.classList.remove('lock');
    closeT = setTimeout(() => { lb.hidden = true; track.textContent = ''; cur = null; }, reduce ? 0 : 420);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  function syncLB() { if (cur && !lb.hidden) track.scrollLeft = idx * track.clientWidth; }
  const go = d => {
    if (!cur) return;
    const n = clamp(idx + d, 0, cur.i.length - 1);
    track.scrollTo({ left: n * track.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
  };

  track.addEventListener('scroll', () => {
    if (sRaf) return;
    sRaf = requestAnimationFrame(() => {
      sRaf = 0;
      if (!cur) return;
      const n = clamp(Math.round(track.scrollLeft / Math.max(1, track.clientWidth)), 0, cur.i.length - 1);
      if (n !== idx) { idx = n; updateLB(); }
    });
  }, { passive: true });
  prevBtn.addEventListener('click', () => go(-1));
  nextBtn.addEventListener('click', () => go(1));
  closeBtn.addEventListener('click', closeLB);
  track.addEventListener('click', e => { if (e.target.classList.contains('lb__slide')) closeLB(); });
  lb.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeLB();
    else if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'Tab') {
      const f = $$('button', lb).filter(b => !b.hidden && !b.disabled && b.offsetParent !== null);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    }
  });
  $$('[data-gallery]').forEach(b => b.addEventListener('click', () => openLB(b.dataset.gallery, Number(b.dataset.index || 0))));

  /* ---------- Formulario → mensaje directo de Instagram ---------- */
  const form = $('#brief');
  const toastEl = $('#toast');
  let toastT = 0;
  const toast = (msg, ms) => {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('show'), ms || 4200);
  };
  const legacyCopy = text => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    ta.remove();
    return ok;
  };
  const copy = text => {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(() => true, () => legacyCopy(text));
    }
    return Promise.resolve(legacyCopy(text));
  };

  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const tipos = $$('input[name="tipo"]:checked', form).map(i => i.value);
      const nombre = form.elements.nombre.value.trim();
      const lugar = form.elements.lugar.value.trim();
      const msg = form.elements.mensaje.value.trim();
      if (!tipos.length && !msg) {
        form.classList.remove('shake');
        void form.offsetWidth;
        form.classList.add('shake');
        toast('Marca qué necesitas o cuéntanos un poco el proyecto.');
        return;
      }
      const text = [
        'Hola BDC, me gustaría pedir presupuesto.',
        tipos.length ? 'Tipo de trabajo: ' + tipos.join(', ') : '',
        lugar ? 'Población: ' + lugar : '',
        msg ? 'Proyecto: ' + msg : '',
        nombre ? 'Mi nombre: ' + nombre : ''
      ].filter(Boolean).join('\n');
      const url = 'https://ig.me/m/_bdcconstruction';

      copy(text).then(ok => toast(ok
        ? 'Mensaje copiado ✓ Pégalo en el chat de Instagram y envíalo.'
        : 'Se abre Instagram: escríbenos allí tu mensaje.', 6500));

      const w = window.open(url, '_blank');
      if (w) { try { w.opener = null; } catch (_) { /* ok */ } }
      else setTimeout(() => { window.location.href = url; }, 900);
    });
  }
})();
