// Acessibilidade (e-MAG / WCAG 2.1 AA) aplicada a todas as telas.
//
// Muitos formulários mostram o rótulo visualmente acima do campo, sem ligação
// técnica com ele; assim, o leitor de tela não anuncia o que é cada campo.
// Este módulo observa a página e:
//  - dá a cada campo sem rótulo associado o texto do rótulo do seu grupo
//    (ou, na falta dele, o placeholder/title) como nome acessível;
//  - dá aos botões que só têm ícone o texto do seu "title" como nome;
//  - torna alcançáveis pelo teclado as áreas com rolagem própria.
// Rótulos explícitos (htmlFor/aria-label) escritos nas telas têm prioridade.

const CONTROLS = 'input:not([type=hidden]), select, textarea';

function hasName(el: Element): boolean {
  if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return true;
  if (el.closest('label')) return true;
  const id = el.getAttribute('id');
  return !!id && !!document.querySelector(`label[for="${CSS.escape(id)}"]`);
}

/** Procura o rótulo do grupo: até 3 níveis acima, um único <label> para um único campo. */
function groupLabel(el: Element): string {
  let node: Element | null = el.parentElement;
  for (let level = 0; node && level < 3; level += 1, node = node.parentElement) {
    const labels = Array.from(node.children).filter(c => c.tagName === 'LABEL');
    const controls = node.querySelectorAll(CONTROLS);
    if (labels.length === 1 && controls.length === 1) return labels[0].textContent?.trim() || '';
    if (controls.length > 1) break;
  }
  return '';
}

function fix(root: ParentNode) {
  root.querySelectorAll(CONTROLS).forEach(el => {
    if (hasName(el)) return;
    const text = groupLabel(el) || el.getAttribute('placeholder') || el.getAttribute('title') || '';
    if (text) el.setAttribute('aria-label', text);
  });
  root.querySelectorAll('button').forEach(b => {
    if (b.getAttribute('aria-label') || b.textContent?.trim()) return;
    const title = b.getAttribute('title');
    if (title) b.setAttribute('aria-label', title);
  });
  root.querySelectorAll('.overflow-y-auto, .overflow-auto').forEach(el => {
    if (el.hasAttribute('tabindex')) return;
    if (el.scrollHeight > el.clientHeight && !el.querySelector('a, button, input, select, textarea, [tabindex]')) {
      el.setAttribute('tabindex', '0');
    }
  });
}

export function startAccessibilityHelpers() {
  let scheduled = false;
  const run = () => { scheduled = false; fix(document); };
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(run);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  run();
}
