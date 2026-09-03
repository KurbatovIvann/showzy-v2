import { CoreInvariantError } from "@showzy/core/errors";

const ONES_MASC = [
  "",
  "один",
  "два",
  "три",
  "чотири",
  "п'ять",
  "шість",
  "сім",
  "вісім",
  "дев'ять",
] as const;

const ONES_FEM = [
  "",
  "одна",
  "дві",
  "три",
  "чотири",
  "п'ять",
  "шість",
  "сім",
  "вісім",
  "дев'ять",
] as const;

const TEENS = [
  "десять",
  "одинадцять",
  "дванадцять",
  "тринадцять",
  "чотирнадцять",
  "п'ятнадцять",
  "шістнадцять",
  "сімнадцять",
  "вісімнадцять",
  "дев'ятнадцять",
] as const;

const TENS = [
  "",
  "",
  "двадцять",
  "тридцять",
  "сорок",
  "п'ятдесят",
  "шістдесят",
  "сімдесят",
  "вісімдесят",
  "дев'яносто",
] as const;

const HUNDREDS = [
  "",
  "сто",
  "двісті",
  "триста",
  "чотириста",
  "п'ятсот",
  "шістсот",
  "сімсот",
  "вісімсот",
  "дев'ятсот",
] as const;

const HRYVNIA_FORMS = ["гривень", "гривня", "гривні"] as const;
const KOPIYKA_FORMS = ["копійок", "копійка", "копійки"] as const;
const THOUSAND_FORMS = ["тисяч", "тисяча", "тисячі"] as const;
const MILLION_FORMS = ["мільйонів", "мільйон", "мільйони"] as const;
const BILLION_FORMS = ["мільярдів", "мільярд", "мільярди"] as const;

/** Whole hryvnia part is at most 12 digits (up to 999 billions). */
const MAX_HRN_DIGITS = 12;

type WordGender = "masc" | "fem";

function slavicFormIndex(n: number): 0 | 1 | 2 {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod10 === 1 && mod100 !== 11) {
    return 1;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return 2;
  }
  return 0;
}

function triadWords(n: number, gender: WordGender): string {
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;
  const onesTable = gender === "fem" ? ONES_FEM : ONES_MASC;
  const parts: string[] = [];
  const hundredWord = HUNDREDS[hundreds];
  if (hundredWord !== undefined && hundredWord.length > 0) {
    parts.push(hundredWord);
  }
  if (remainder >= 10 && remainder <= 19) {
    const teen = TEENS[remainder - 10];
    if (teen !== undefined) {
      parts.push(teen);
    }
    return parts.join(" ");
  }
  const tens = Math.floor(remainder / 10);
  const ones = remainder % 10;
  const tensWord = TENS[tens];
  if (tensWord !== undefined && tensWord.length > 0) {
    parts.push(tensWord);
  }
  const onesWord = onesTable[ones];
  if (onesWord !== undefined && onesWord.length > 0) {
    parts.push(onesWord);
  }
  return parts.join(" ");
}

function scaleChunk(
  n: number,
  gender: WordGender,
  forms: readonly [string, string, string],
): string {
  const words = triadWords(n, gender);
  if (words.length === 0) {
    return "";
  }
  const form = forms[slavicFormIndex(n)];
  return `${words} ${form}`;
}

function integerToUkWords(n: number): string {
  if (n === 0) {
    return "нуль";
  }
  const billions = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1_000);
  const rest = n % 1_000;
  const parts: string[] = [];
  const billionChunk = scaleChunk(billions, "masc", BILLION_FORMS);
  if (billionChunk.length > 0) {
    parts.push(billionChunk);
  }
  const millionChunk = scaleChunk(millions, "masc", MILLION_FORMS);
  if (millionChunk.length > 0) {
    parts.push(millionChunk);
  }
  const thousandChunk = scaleChunk(thousands, "fem", THOUSAND_FORMS);
  if (thousandChunk.length > 0) {
    parts.push(thousandChunk);
  }
  const restWords = triadWords(rest, "fem");
  if (restWords.length > 0) {
    parts.push(restWords);
  }
  return parts.join(" ");
}

function capitalizeUk(value: string): string {
  const first = value.charAt(0);
  if (first.length === 0) {
    return value;
  }
  return `${first.toLocaleUpperCase("uk-UA")}${value.slice(1)}`;
}

function twoDigitKopiyky(kopiyky: number): string {
  return String(kopiyky).padStart(2, "0");
}

/**
 * Ukrainian UAH amount in words (hryvnia + kopiyky) from a canonical
 * minor-unit string. Kopiyky stay numeric on the invoice line
 * (`00 копійок`). No Date APIs. Used by branded/parties pages.
 */
export function uahAmountInWords(minor: string): string {
  if (minor.length === 0 || !/^[0-9]+$/.test(minor)) {
    throw new CoreInvariantError(`illegal minor-unit string "${minor}"`);
  }
  const padded = minor.padStart(3, "0");
  const kopiyky = Number(padded.slice(-2));
  const hryvniaDigits = padded.slice(0, -2).replace(/^0+/, "") || "0";
  if (hryvniaDigits.length > MAX_HRN_DIGITS) {
    throw new CoreInvariantError(`minor-unit string too large "${minor}"`);
  }
  const hryvnia = Number(hryvniaDigits);
  const hryvniaWords = integerToUkWords(hryvnia);
  const hryvniaForm = HRYVNIA_FORMS[slavicFormIndex(hryvnia)];
  const kopiykaForm = KOPIYKA_FORMS[slavicFormIndex(kopiyky)];
  return `${capitalizeUk(hryvniaWords)} ${hryvniaForm} ${twoDigitKopiyky(kopiyky)} ${kopiykaForm}`;
}
