import validator from 'validator';
import {
  ParseError,
  AsYouType,
  parsePhoneNumberWithError,
} from 'libphonenumber-js';
import { RecordType } from '.';

export type NameParseResult = {
  recordType: RecordType;
  normalizedName: string;
  parseError: ParseError | undefined;
};

export function parseName(input: string): NameParseResult {
  if (validator.isEmail(input)) {
    return {
      recordType: RecordType.Email,
      normalizedName: validator.normalizeEmail(input) || '',
      parseError: undefined,
    };
  }
  if (input.length > 4 && input.toLowerCase().trim().endsWith('.sol')) {
    return {
      recordType: RecordType.Bonfida,
      normalizedName: input.trim(),
      parseError: undefined,
    };
  }
  const testPhone = input.charAt(0) === '+' ? input : `+${input}`;
  try {
    const phoneNumber = parsePhoneNumberWithError(testPhone);
    if (phoneNumber.isValid()) {
      return {
        recordType: RecordType.Phone,
        normalizedName: phoneNumber.number,
        parseError: undefined,
      };
    } else {
      const partialName = `${new AsYouType().input(testPhone)} ...`;
      return {
        recordType: RecordType.Invalid,
        normalizedName: partialName,
        parseError: { message: 'INVALID' },
      };
    }
  } catch (error) {
    if (error instanceof ParseError) {
      return {
        recordType: RecordType.Invalid,
        normalizedName: input,
        parseError: error,
      };
    }
  }
  return {
    recordType: RecordType.Invalid,
    normalizedName: input,
    parseError: { message: 'NOT_A_NUMBER' },
  };
}
