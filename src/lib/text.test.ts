import { describe, expect, it } from 'vitest';
import { capFirst, tidyName } from './text';

describe('capFirst', () => {
  it('capitalises the first letter and leaves the rest as typed', () => {
    expect(capFirst('store card')).toBe('Store card');
    expect(capFirst('  visa ')).toBe('Visa');
    expect(capFirst('Store Card')).toBe('Store Card');
    expect(capFirst('AMEX')).toBe('AMEX');
    expect(capFirst('')).toBe('');
  });
});

describe('tidyName', () => {
  it('shows a name typed in capitals or lower case with a capital first letter', () => {
    expect(tidyName('AZEDDIN')).toBe('Azeddin');
    expect(tidyName('azeddin')).toBe('Azeddin');
    expect(tidyName('  Azeddin ')).toBe('Azeddin');
    expect(tidyName('MARY ANN')).toBe('Mary Ann');
    expect(tidyName("o'neil")).toBe("O'Neil");
  });

  it('keeps a name that is already mixed case', () => {
    expect(tidyName('McKay')).toBe('McKay');
    expect(tidyName('DeShawn')).toBe('DeShawn');
  });
});
