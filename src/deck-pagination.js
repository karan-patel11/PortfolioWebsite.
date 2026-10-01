import { roman } from './numerals.js';

// Partition semantic content before measuring the horizontal track. Nodes are
// Authored nodes retain IDs, links and listeners. Continuation pages repeat
// context headings so a role or paragraph never loses its meaning.
export function initDeckPagination() {
  const track = document.querySelector('[data-horizontal-track]');
  const sources = [...track.children];
  const records = sources.map(panel => ({ panel, blocks: null, parts: [], baseClass: panel.className }));
  const labels = { intro: 'Introduction', about: 'About', education: 'Education', experience: 'Experience', venture: 'Twods Capital: Research & Systems', 'selected-work': 'Selected Work', contact: 'Contact' };
  const group = (...nodes) => {
    const block = document.createElement('div');
    block.className = 'deck-block';
    block.append(...nodes.filter(Boolean));
    return block;
  };
  function blocksFor(panel) {
    const q = selector => panel.querySelector(selector);
    const all = selector => [...panel.querySelectorAll(selector)];
    switch (panel.id) {
      case 'intro': return [group(q('[data-hero-name]'), q('.hero-role')), group(q('.hero-statement')), group(q('.hero-intro'), q('.hero-bottom'))];
      case 'about': {
        const block = group(q('.about-grid'), q('.keywords')); block.classList.add('deck-about');
        return [block];
      }
      case 'education': return all('.education-card').map(card => {
        const block = group(card); block.classList.add('deck-school');
        return block;
      });
      case 'experience': return all('.employer').map(employer => group(employer));
      case 'venture': {
        const identity = group(q('.venture-statement h2'), ...all('.venture-statement > p'));
        identity.classList.add('venture-identity');
        const masthead = group(identity, q('.twods')); masthead.classList.add('venture-masthead');
        const story = group(...all('.venture-story > p')); story.classList.add('venture-narrative');
        const initiative = q('.initiative'), thesisHeading = initiative.querySelector('h4');
        const thesis = group(thesisHeading, thesisHeading.nextElementSibling, q('.principles'));
        thesis.classList.add('venture-thesis');
        const research = group(...initiative.children); research.classList.add('venture-research');
        research.dataset.pageStart = 'always';
        return [masthead, story, group(q('.metrics')), research, thesis];
      }
      case 'selected-work': return [...all('.work-row').map(row => group(row)), group(q('.skills-link'))];
      case 'contact': {
        const paragraphs = all('.lead > p');
        return [group(q('h2')), ...paragraphs.slice(0,-1).map(p => group(p)), group(paragraphs.at(-1), q('.contact-email'), q('footer'))];
      }
      default: return [...panel.children].filter(n => !n.matches('.chapter-head,dialog,noscript')).map(n => group(n));
    }
  }
  function fits(panel) {
    const style = getComputedStyle(panel);
    const edge = panel.getBoundingClientRect().bottom - parseFloat(style.paddingBottom);
    return panel.scrollHeight <= panel.clientHeight + 1 && [...panel.querySelectorAll('p,h1,h2,h3,h4,figure,picture,li,a,dd,button,footer')]
      .filter(n => !n.closest('dialog,noscript,.sr-only,.ticker-track') && !(n.matches('.coursework-label') && getComputedStyle(n).position === 'absolute') && n.getClientRects().length)
      .every(n => n.getBoundingClientRect().bottom <= edge + 1 && n.scrollWidth <= n.clientWidth + 1);
  }
  function partFor(record, index) {
    const part = index === 0 ? record.panel : record.pool?.[index] || document.createElement('section');
    part.className = `${record.baseClass} deck-part`;
    part.id = index ? `${record.panel.id}-part-${index + 1}` : record.panel.id;
    delete part.dataset.fitError;
    part.dataset.horizontalPanel = '';
    part.dataset.chapter = record.panel.id;
    part.dataset.chapterNumber = record.panel.dataset.chapterNumber;
    part.dataset.part = index + 1;
    part.removeAttribute('aria-labelledby');
    part.setAttribute('aria-label', record.panel.id);
    const head = document.createElement('div'); head.className = 'chapter-head';
    const label = document.createElement('p'); label.className = 'deck-part-label'; label.textContent = `${labels[record.panel.id]} — Part ${roman(index + 1)}`;
    const number = document.createElement('p'); number.className = 'label';
    head.append(label, number);
    const content = document.createElement('div'); content.className = 'deck-content';
    part.replaceChildren(head, content, ...(index === 0 ? record.decorations || [] : []));
    if (!part.isConnected) track.append(part);
    return part;
  }
  // A single long paragraph can exceed even a clean slide (landscape or large
  // text). Split at sentence boundaries, falling back to word boundaries.
  function divide(block) {
    // A project/role remains one complete control. Its title, outcome, dates
    // and stack must never become unrelated cells or separate pages.
    if (block.firstElementChild?.matches('.work-row,.experience-role')) return null;
    if (block.matches('.deck-about')) {
      const heading = block.querySelector('h2'), paragraphs = [...block.querySelectorAll('.lead > p')];
      const repeated = document.createElement('h2'); repeated.textContent = heading.textContent;
      return [group(block.querySelector('figure'), heading, paragraphs[0]), group(repeated, ...paragraphs.slice(1), block.querySelector('.keywords'))];
    }
    const employer = block.querySelector(':scope > .employer');
    if (employer) {
      const heading = employer.querySelector('h3');
      return [...employer.querySelectorAll('.experience-role')].map(role => {
        const card = document.createElement('article'); card.className = 'employer';
        const title = document.createElement('h3'); title.textContent = heading.textContent;
        const roles = document.createElement('div'); roles.className = 'roles'; roles.append(role);
        card.append(title, roles); return group(card);
      });
    }
    const school = block.querySelector(':scope > .education-card');
    if (school) return null; // A university and its ticker are one complete slide.
    if (block.matches('.venture-research,.venture-thesis,.deck-about-copy')) {
      const heading = [...block.children].find(n => n.matches('h2,h3,h4'));
      const context = [...block.children].filter(n => n === heading || n.matches('.label,.degree'));
      const body = [...block.children].filter(n => !context.includes(n));
      return body.flatMap((node, index) => {
        const nodes = node.matches('ol') ? [...node.children] : [node];
        return nodes.map((item, itemIndex) => {
          const titles = context.map(n => { const clone = n.cloneNode(true); clone.removeAttribute('id'); return clone; });
          const part = group(...(index === 0 && itemIndex === 0 ? context : titles), item);
          part.classList.add('venture-continuation');
          return part;
        });
      });
    }
    if (block.children.length > 1) return [...block.children].map(node => group(node));
    const element = block.firstElementChild;
    if (!element) return null;
    if (element.matches('p') && !element.querySelector('a,button,time')) {
      const text = element.textContent.trim();
      const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [text];
      const chunks = sentences.length > 1 ? sentences : text.split(/\s+/).reduce((a, word, i) => { const j = Math.floor(i / Math.max(1, Math.ceil(text.split(/\s+/).length / 2))); (a[j] ||= []).push(word); return a; }, []).map(words => words.join(' '));
      if (chunks.length < 2) return null;
      return chunks.map((text, i) => { const p = element.cloneNode(false); if (i) p.removeAttribute('id'); p.textContent = text.trim(); return group(p); });
    }
    if (element.matches('.hero-statement,.metrics,.system-diagram') || element.children.length > 1) {
      return [...element.children].map(node => group(node));
    }
    return null;
  }
  function layout(selectedPanel) {
    const previous = selectedPanel || document.getElementById(document.documentElement.dataset.activeChapter);
    const chapter = previous?.dataset.chapter || previous?.id || 'intro';
    const partNumber = Number(previous?.dataset.part || 1);
    document.documentElement.setAttribute('data-intro-measuring', '');
    const narrow = innerWidth < 1024 || innerHeight < 600;
    for (const record of records) {
      // Once partitioned, keep the semantic nodes and repack them on resize.
      // The unpartitioned desktop composition remains intact if it fits.
      if (!record.blocks && !narrow && record.panel.id === 'intro' && fits(record.panel)) continue;
      if (!record.blocks) {
        const dialogs = [...record.panel.querySelectorAll('dialog')];
        record.blocks = blocksFor(record.panel);
        record.structure = record.blocks.flatMap(block => [block, ...block.querySelectorAll('*')]).map(node => [node, [...node.childNodes]]);
        record.dialogs = dialogs;
        record.decorations = [...record.panel.querySelectorAll(':scope > [data-hero-year],:scope > [data-loading-base-overlay]')];
      }
      // Rebuild the semantic source tree after a small-screen split. A later
      // tablet/laptop reflow must not inherit fragmented phone content.
      if (record.fragmented) record.structure.forEach(([node, children]) => node.replaceChildren(...children));
      record.fragmented = false;
      record.pool = record.parts;
      record.parts = [];
      let part = partFor(record, 0), content = part.querySelector('.deck-content');
      record.parts.push(part);
      const queue = [...record.blocks];
      while (queue.length) {
        const block = queue.shift();
        if((block.dataset.pageStart === 'always' || block.dataset.pageStart === 'narrow' && innerWidth < 768) && content.children.length){
          part=partFor(record,record.parts.length);record.parts.push(part);content=part.querySelector('.deck-content');
        }
        content.append(block);
        if (!fits(part)) {
          block.remove();
          if (content.children.length) {
            part = partFor(record, record.parts.length); record.parts.push(part);
            content = part.querySelector('.deck-content'); content.append(block);
          } else content.append(block);
          if (!fits(part)) {
            block.remove();
            const smaller = divide(block);
            if (smaller?.length) { record.fragmented = true; queue.unshift(...smaller); continue; }
            // Report rather than silently clipping an indivisible control.
            content.append(block); part.dataset.fitError = 'true';
          }
        }
      }
      record.parts = record.parts.filter((page, index) => {
        if (index === 0 || page.querySelector('.deck-content').children.length) return true;
        page.remove(); return false;
      });
      record.pool.filter(part => !record.parts.includes(part)).forEach(part => part.remove());
      record.panel.append(...record.dialogs);
      const label = labels[record.panel.id];
      record.parts.forEach((page, i) => {
        const title = record.parts.length > 1 ? `${label} — Part ${roman(i + 1)}` : label;
        page.querySelector('.deck-part-label').textContent = title;
        page.querySelector('.chapter-head .label').textContent = record.parts.length > 1 ? `${roman(i + 1)} / ${roman(record.parts.length)}` : `Chapter ${roman(Number(record.panel.dataset.chapterNumber))}`;
        page.setAttribute('aria-label', title);
      });
    }
    // Restore canonical chapter order after packing newly-created siblings.
    let cursor = track.firstElementChild;
    records.forEach(record => (record.parts.length ? record.parts : [record.panel]).forEach(part => {
      if (part === cursor) cursor = cursor.nextElementSibling;
      else track.insertBefore(part, cursor);
    }));
    document.documentElement.removeAttribute('data-intro-measuring');
    document.dispatchEvent(new Event('deck-layout'));
    const chapterParts = [...track.children].filter(p => (p.dataset.chapter || p.id) === chapter);
    return chapterParts[Math.min(partNumber - 1, chapterParts.length - 1)] || track.firstElementChild;
  }
  return { layout, needsLayout: () => [...track.children].some(panel => !fits(panel)) };
}

// Long project/role details use explicit pages in the modal, never an inner
// scrollbar. Keyboard focus, Close, Back and canonical project hashes survive.
export function paginateDetail(dialog) {
  let state = dialog._deckPages;
  if (!state) {
    const copy = dialog.querySelector('.detail-copy');
    const blocks = [];
    [...copy.children].forEach(node => {
      if (node.matches('.detail-section,ul,.skill-grid')) {
        const heading = node.querySelector('h3');
        if (heading) blocks.push(heading);
        [...node.children].filter(n => n !== heading).forEach(child => {
          if (child.matches('li')) { const p = document.createElement('p'); p.textContent = child.textContent; blocks.push(p); }
          else blocks.push(child);
        });
      } else blocks.push(node);
    });
    const pager = document.createElement('nav'); pager.className = 'detail-pager'; pager.setAttribute('aria-label', 'Detail pages');
    const prev = document.createElement('button'); prev.type = 'button'; prev.textContent = '← Previous';
    const status = document.createElement('span'); status.setAttribute('role', 'status');
    const next = document.createElement('button'); next.type = 'button'; next.textContent = 'Next →';
    pager.append(prev, status, next); dialog.append(pager);
    state = dialog._deckPages = { copy, blocks, pages: [], index: 0, pager, prev, status, next };
    const show = index => {
      state.index = index; copy.replaceChildren(...state.pages[index]);
      prev.disabled = index === 0; next.disabled = index === state.pages.length - 1;
      status.textContent = `${index + 1} / ${state.pages.length}`;
      if (document.activeElement?.disabled) (index === 0 ? next : prev).focus({ preventScroll: true });
    };
    prev.addEventListener('click', () => show(Math.max(0, state.index - 1)));
    next.addEventListener('click', () => show(Math.min(state.pages.length - 1, state.index + 1)));
    state.show = show;
  }
  state.pages = [[]]; state.copy.replaceChildren();
  const queue = [...state.blocks], packed = [];
  while (queue.length) {
    const node = queue.shift(); state.copy.append(node);
    if (state.copy.scrollHeight > state.copy.clientHeight + 1) {
      node.remove();
      if (state.pages.at(-1).length) { state.pages.push([]); state.copy.replaceChildren(node); }
      else state.copy.append(node);
      if (state.copy.scrollHeight > state.copy.clientHeight + 1 && node.children.length > 1) {
        node.remove(); queue.unshift(...node.children); continue;
      }
      if (state.copy.scrollHeight > state.copy.clientHeight + 1 && node.matches('p,li') && node.textContent.split(/\s+/).length > 1) {
        const words = node.textContent.split(/\s+/), middle = Math.ceil(words.length / 2);
        const halves = [words.slice(0, middle), words.slice(middle)].map((words, i) => { const p = node.cloneNode(false); if (i) p.removeAttribute('id'); p.textContent = words.join(' '); return p; });
        node.remove(); queue.unshift(...halves); continue;
      }
    }
    state.pages.at(-1).push(node); packed.push(node);
  }
  state.blocks = packed; state.show(0);
}
