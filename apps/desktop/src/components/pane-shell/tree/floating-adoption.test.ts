import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A `placement: 'floating'` pane must never enter the layout tree. Adoption is
// what turns a contribution into a track (and therefore into something that
// steals width from a zone), so this exercises the real `adoptContributedPanes`
// path via `watchContributedPanes` rather than asserting on the filter itself.

describe('floating panes stay out of the layout tree', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.resetModules()
  })

  afterEach(() => {
    vi.resetModules()
  })

  async function setup() {
    const tree = await import('@/components/pane-shell/tree/store')
    const model = await import('@/components/pane-shell/tree/model')
    const { registry } = await import('@/contrib/registry')

    registry.register({
      id: 'workspace',
      area: 'panes',
      title: 'chat',
      data: { placement: 'main' },
      render: () => null
    })

    tree.declareDefaultTree(model.group(['workspace'], { id: 'grp-main' }))

    return { model, registry, tree }
  }

  it('does not adopt a floating pane, while still adopting a docked one', async () => {
    const { model, registry, tree } = await setup()

    registry.register({
      id: 'hud',
      area: 'panes',
      title: 'HUD',
      data: { placement: 'floating', anchor: 'top-right', width: '240px' },
      render: () => null
    })
    registry.register({
      id: 'files',
      area: 'panes',
      title: 'Files',
      data: { placement: 'right' },
      render: () => null
    })

    tree.watchContributedPanes()

    const ids = model.allPaneIds(tree.$layoutTree.get()!)

    expect(ids).not.toContain('hud')
    // Control: a normal placement DOES get adopted through the same pass, so
    // the exclusion is specific to 'floating', not a broken adoption run.
    expect(ids).toContain('files')
  })

  // A restored tab is anchored to ANOTHER tab (a chat stacked beside its
  // sibling), so adoption has to resolve those anchors in dependency order. One
  // pass over a list where a child precedes its anchor met a missing anchor,
  // fell through to the `mainId` fallback, and docked the tab into the main zone
  // — the "tabs come back, but not in the section they were in" report.
  it('docks a tab anchored to another tab into that tab\'s zone, not the main zone', async () => {
    const { model, registry, tree } = await setup()

    // Child-first registration order: the hardest order for a single pass.
    registry.register({
      id: 'session-tile:c',
      area: 'panes',
      title: 'C',
      data: { dock: { before: null, pane: 'session-tile:b', pos: 'center' }, placement: 'main' },
      render: () => null
    })
    registry.register({
      id: 'session-tile:b',
      area: 'panes',
      title: 'B',
      data: { dock: { before: null, pane: 'session-tile:a', pos: 'center' }, placement: 'main' },
      render: () => null
    })
    registry.register({
      id: 'session-tile:a',
      area: 'panes',
      title: 'A',
      data: { dock: { before: null, pane: 'workspace', pos: 'right' }, placement: 'main' },
      render: () => null
    })

    tree.watchContributedPanes()

    const layout = tree.$layoutTree.get()!
    const groupOf = (id: string) => model.findGroupOfPane(layout, id)?.id

    expect(groupOf('session-tile:b')).toBe(groupOf('session-tile:a'))
    expect(groupOf('session-tile:c')).toBe(groupOf('session-tile:a'))
    // And that zone is the one A docked beside workspace — not main.
    expect(groupOf('session-tile:a')).not.toBe(groupOf('workspace'))
  })

  it('survives a registry change without ever adopting the floating pane', async () => {
    const { model, registry, tree } = await setup()

    registry.register({ id: 'hud', area: 'panes', data: { placement: 'floating' }, render: () => null })
    tree.watchContributedPanes()

    // A later registration re-runs adoption via the registry subscription.
    registry.register({ id: 'terminal', area: 'panes', data: { placement: 'bottom' }, render: () => null })

    const ids = model.allPaneIds(tree.$layoutTree.get()!)

    expect(ids).toContain('terminal')
    expect(ids).not.toContain('hud')
  })
})
