// A dummy console module (test only, console AC-14): it registers a section, a Listen block, a card action, a search
// document, a command and a setting through ctx.ui.modules, so consoletest.mjs can check that each appears where it
// should and that off() removes them all. Never loaded by the app.
export function registerDemo(ui) {
  const log = [];
  const off = ui.modules.register({
    id: 'demo',
    title: { en: 'Demo module' },
    section: {
      id: 'demo', label: { en: 'Demo' }, icon: 'voice', order: 55,
      badge: () => 'test',
      mount(el, api) {
        el.append(api.h('p.mk-p', { 'data-demo': 'section' }, 'Demo section body'));
        return { show() { log.push('show'); }, hide() { log.push('hide'); }, dispose() { log.push('dispose'); } };
      },
    },
    listen: { order: 5, mount(el, api) { el.append(api.h('p.mk-p', { 'data-demo': 'listen' }, 'Demo listen block')); return { update() {} }; } },
    cardActions: (card) => (card?.kind === 'event' ? [{ id: 'demo-act', label: { en: 'Demo action' }, icon: 'play', run: () => log.push('action') }] : []),
    search: { kind: 'tour', label: { en: 'Tours' }, docs: () => [{ id: 'demo:tour', kind: 'tour', title: { en: 'Zzyzx demo tour' }, keywords: ['zzyzx'] }] },
    commands: [{ id: 'demo.cmd', title: { en: 'Zzyzx demo command' }, keywords: ['zzyzx'], run: () => log.push('command') }],
    settings: [{ key: 'flag', group: 'listen', type: 'bool', label: { en: 'Zzyzx demo flag' }, default: false }],
  });
  return { off, log };
}
