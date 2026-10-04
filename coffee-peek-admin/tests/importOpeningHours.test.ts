import { formatImportOpeningHours } from '../src/utils/importOpeningHours';

describe('imported opening hours display', () => {
  it('localizes full English day names and preserves split hours', () => {
    expect(formatImportOpeningHours('Monday-Friday 08:00-13:00,14:00-22:00; Saturday 09:00-23:00; Sunday closed'))
      .toBe('Пн-Пт 08:00-13:00,14:00-22:00\nСб 09:00-23:00\nВс выходной');
  });

  it('localizes OSM day ranges and exceptions', () => {
    expect(formatImportOpeningHours('Mo-Fr 08:00-22:00; Sa,Su 10:00-20:00; PH off'))
      .toBe('Пн-Пт 08:00-22:00\nСб,Вс 10:00-20:00\nPH выходной');
  });

  it('handles abbreviated mixed-case days and existing line breaks', () => {
    expect(formatImportOpeningHours('MON 07:00-18:00\nTuesday 08:00-19:00\nWed,Thurs,Fri,Sat,Sun 09:00-17:00'))
      .toBe('Пн 07:00-18:00\nВт 08:00-19:00\nСр,Чт,Пт,Сб,Вс 09:00-17:00');
  });

  it('displays around-the-clock hours in Russian', () => {
    expect(formatImportOpeningHours(' 24/7 ')).toBe('Круглосуточно');
  });

  it('keeps Russian labels and other schedule content unchanged', () => {
    expect(formatImportOpeningHours('Пн-Пт 08:00-22:00, по записи')).toBe('Пн-Пт 08:00-22:00, по записи');
    expect(formatImportOpeningHours('unknown')).toBe('unknown');
    expect(formatImportOpeningHours('')).toBe('');
  });
});
