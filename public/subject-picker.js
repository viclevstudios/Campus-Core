// Search lives in the selection control. Only existing subjects can be selected.
export function mountSubjectPicker(root, { subjects, selected, onSelect }) {
  const input = root.querySelector('input');
  const toggle = root.querySelector('button');
  const list = root.querySelector('[role="listbox"]');
  const selectedTitle = () => subjects.find(subject => subject.source === selected)?.title || '';
  let matches = subjects, active = -1, open = false;
  const normalize = value => value.toLocaleLowerCase('de').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  function activeOption(index) {
    active = Math.max(0, Math.min(index, matches.length - 1));
    [...list.querySelectorAll('[role="option"]')].forEach((option, i) => {
      option.classList.toggle('active', i === active);
    });
    const option = list.querySelectorAll('[role="option"]')[active];
    if (option) {
      input.setAttribute('aria-activedescendant', option.id);
      option.scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  }
  function close() {
    open = false; list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    input.value = selectedTitle();
    active = -1;
  }
  function choose(index) {
    const subject = matches[index];
    if (!subject) return;
    close();
    if (subject.source !== selected) onSelect(subject.source);
  }
  function show(query = '') {
    matches = subjects.filter(subject => normalize(subject.title).includes(normalize(query.trim())));
    open = true; list.hidden = false; active = -1;
    input.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-expanded', 'true');
    input.removeAttribute('aria-activedescendant');
    list.replaceChildren();
    if (!matches.length) {
      const empty = document.createElement('div');
      empty.className = 'subject-picker-empty'; empty.setAttribute('role', 'presentation');
      empty.textContent = 'Keine Fächer gefunden'; list.append(empty); return;
    }
    matches.forEach((subject, index) => {
      const option = document.createElement('div');
      option.className = 'subject-picker-option'; option.id = `${list.id}-${index}`;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(subject.source === selected));
      option.textContent = subject.title;
      option.addEventListener('pointerdown', event => event.preventDefault());
      option.addEventListener('click', () => choose(index));
      list.append(option);
    });
  }
  input.value = selectedTitle();
  input.addEventListener('focus', () => { show(); input.select(); });
  input.addEventListener('click', () => { if (!open) { show(); input.select(); } });
  input.addEventListener('input', () => show(input.value));
  input.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); if (!open) show();
      activeOption(active < 0 ? event.key === 'ArrowDown' ? 0 : matches.length - 1 : active + (event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Enter' && open) {
      event.preventDefault(); choose(active < 0 ? 0 : active);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault(); event.stopPropagation(); close();
    } else if (event.key === 'Tab') close();
  });
  input.addEventListener('blur', () => {
    // Option pointerdown keeps focus in the input until selection is committed.
    if (!root.contains(document.activeElement)) close();
  });
  toggle.addEventListener('pointerdown', event => event.preventDefault());
  toggle.addEventListener('click', () => {
    if (open) close();
    else { input.focus(); show(); input.select(); }
  });
  root.addEventListener('focusout', event => {
    if (!root.contains(event.relatedTarget)) close();
  });
  return { focus() { input.focus({ preventScroll: true }); close(); } };
}
