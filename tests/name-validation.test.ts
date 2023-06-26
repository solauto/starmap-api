
import { ParseError } from "libphonenumber-js";
import { RecordType, parseName } from "../";

describe('Testing parseName', () => {
  test('empty string', () => {
    const name = ''
    const { recordType, normalizedName, parseError } = parseName(name);
    const e = new ParseError();
    e.message = 'NOT_A_NUMBER';
    expect(parseError).not.toBeUndefined();
    if (parseError != undefined) {
      expect(parseError.message).toBe(e.message);
    }
  });

  test('invalid basic string', () => {
    const name = 'something'
    const { recordType, normalizedName, parseError } = parseName(name);
    const e = new ParseError();
    e.message = 'NOT_A_NUMBER';
    expect(parseError).not.toBeUndefined();
    if (parseError != undefined) {
      expect(parseError.message).toBe(e.message);
    }
  });

  test('valid phone number string', () => {
    const name = '+1-650-650-6500'
    const { recordType, normalizedName, parseError } = parseName(name);
    const e = new ParseError();
    e.message = '';
    expect(parseError).toBeUndefined();
    expect(recordType).toBe(RecordType.Phone);
    expect(normalizedName).toBe('+16506506500');
  });

  test('valid email string', () => {
    const name = 'b.b@gmail.com'
    const { recordType, normalizedName, parseError } = parseName(name);
    const e = new ParseError();
    e.message = '';
    expect(parseError).toBeUndefined();
    expect(recordType).toBe(RecordType.Email);
    expect(normalizedName).toBe('bb@gmail.com');
  });
});
