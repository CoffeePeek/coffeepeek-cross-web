import { updatePageMetadata } from '../src/hooks/usePageTitle';

class HeadElement {
  attributes: Record<string, string> = {};
  constructor(public tag: string, private elements: HeadElement[]) {}
  setAttribute(name: string, value: string) { this.attributes[name] = value; }
  getAttribute(name: string) { return this.attributes[name] ?? null; }
  remove() { this.elements.splice(this.elements.indexOf(this), 1); }
}

let elements: HeadElement[];
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
function matching(selector: string) {
  const [, tag, attribute, value] = /^(\w+)\[([^=]+)="([^"]+)"\]$/.exec(selector)!;
  return elements.filter(element => element.tag === tag && element.getAttribute(attribute) === value);
}
function add(tag: string, attributes: Record<string, string>) {
  const element = new HeadElement(tag, elements);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
  elements.push(element);
  return element;
}

beforeEach(() => {
  elements = [];
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    title: '', head: { querySelector: (selector: string) => matching(selector)[0], querySelectorAll: matching, append: (element: HeadElement) => elements.push(element) },
    createElement: (tag: string) => new HeadElement(tag, elements),
  } });
});
afterAll(() => {
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
  else Reflect.deleteProperty(globalThis, 'document');
});

test('home to catalog navigation updates canonical, description and sharing metadata', () => {
  updatePageMetadata('Главная', '/');
  const homeDescription = matching('meta[name="description"]')[0].getAttribute('content');
  add('script', { type: 'application/ld+json' });
  updatePageMetadata('Кофе', '/coffees');
  expect(document.title).toBe('CoffeePeek | Кофе');
  expect(matching('link[rel="canonical"]')[0].getAttribute('href')).toBe('https://coffeepeek.by/coffees');
  expect(matching('meta[name="description"]')[0].getAttribute('content')).toContain('Каталог кофе:');
  expect(matching('meta[name="description"]')[0].getAttribute('content')).not.toBe(homeDescription);
  expect(matching('meta[property="og:url"]')[0].getAttribute('content')).toBe('https://coffeepeek.by/coffees');
  expect(matching('meta[name="twitter:title"]')[0].getAttribute('content')).toBe(document.title);
  expect(matching('script[type="application/ld+json"]')).toHaveLength(0);
  updatePageMetadata('Главная', '/');
  expect(matching('meta[name="description"]')[0].getAttribute('content')).toBe(homeDescription);
});

test('entity metadata replaces duplicate server tags and uses the resolved canonical address', () => {
  add('link', { rel: 'canonical', href: 'https://coffeepeek.by/coffees/blend' });
  add('link', { rel: 'canonical', href: 'https://coffeepeek.by/' });
  add('meta', { name: 'description', content: 'Old' });
  add('meta', { name: 'description', content: 'Duplicate' });
  add('script', { type: 'application/ld+json' });
  updatePageMetadata('Blend', '/coffees/old', { canonicalPath: '/coffees/blend', description: 'Шоколад и орехи' });
  expect(matching('link[rel="canonical"]')).toHaveLength(1);
  expect(matching('link[rel="canonical"]')[0].getAttribute('href')).toBe('https://coffeepeek.by/coffees/blend');
  expect(matching('meta[name="description"]')).toHaveLength(1);
  expect(matching('meta[property="og:description"]')[0].getAttribute('content')).toBe('Шоколад и орехи');
  expect(matching('script[type="application/ld+json"]')).toHaveLength(1);
});
