type Node = Record<string, any>;
type Group = { items: Map<string, Node>; build: (items: Node[]) => Node | null };
const stateKey = Symbol('greastro.schema.sections');
const itemKey = Symbol('greastro.schema.items');
type Locals = Record<string | symbol, any>;

/** Detect two different item descriptions claiming the same identity on a page. */
export function registerItemNode(locals: Locals, node: Node): void {
  const items: Map<string, string> = locals[itemKey] ??= new Map();
  const stable = (value: any): any => Array.isArray(value) ? value.map(stable)
    : value && typeof value === "object"
      ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
      : value;
  const signature = JSON.stringify(stable(node));
  const previous = items.get(node["@id"]);
  if (previous && previous !== signature) throw new Error(`[schema] Conflicting item content for ${node["@id"]}`);
  items.set(node["@id"], signature);
}

/** Request-local state only: a new Astro.locals means an independent graph. */
export function collectSection(locals: Locals, key: string, items: Node[], build: Group['build']) {
  const groups: Map<string, Group> = locals[stateKey] ??= new Map();
  const group = groups.get(key) ?? { items: new Map(), build };
  for (const item of items) {
    const id = item._identity ?? JSON.stringify(item);
    const previous = group.items.get(id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(item)) {
      throw new Error(`[schema] Conflicting section content for ${key}:${id}`);
    }
    group.items.set(id, item);
  }
  groups.set(key, group);
}

export function collectedSections(locals: Locals): Node[] {
  const groups: Map<string, Group> | undefined = locals[stateKey];
  return groups ? [...groups.values()].flatMap(({ items, build }) => {
    const node = build([...items.values()]);
    return node ? node["@graph"] ?? [node] : [];
  }) : [];
}
