import { checkInPath, isPostOpeningClick } from '../src/hooks/useOpenCheckIn';

const element = (controls: string[] = []) => ({ closest: (selector: string) => controls.some(tag => selector.split(', ').includes(tag)) ? {} : null });
const card = (inside = true) => ({ contains: () => inside });
const click = (target: object | null, currentTarget = card(), defaultPrevented = false) =>
  ({ target: target as EventTarget | null, currentTarget, defaultPrevented });

test('a click on plain card content opens the post', () => {
  expect(isPostOpeningClick(click(element()))).toBe(true);
});

test.each(['a', 'button', '[role="button"]', '[role="menuitem"]', '[role="dialog"]', '[data-card-control]'])('a click inside %s keeps its own behaviour', control => {
  expect(isPostOpeningClick(click(element([control])))).toBe(false);
});

test('clicks bubbling from portals outside the card are ignored', () => {
  expect(isPostOpeningClick(click(element(), card(false)))).toBe(false);
});

test('finishing a text selection or a handled click does not open the post', () => {
  expect(isPostOpeningClick(click(element()), 'выделенный текст')).toBe(false);
  expect(isPostOpeningClick(click(element(), card(), true))).toBe(false);
  expect(isPostOpeningClick(click(null))).toBe(false);
});

test('post paths encode the identifier', () => {
  expect(checkInPath('a/b')).toBe('/check-ins/a%2Fb');
});
