/**
 * Seller-legal field caps for the company editor (SHO-225). Numbers
 * match `company-view.contract.ts` / `companies.updateLegal` (SHO-224):
 * counterparty view caps plus `legalName` 300 and `bankEdrpou` 8.
 * Mobile cannot import module contracts; tests prove these against
 * `contractModules.companies.updateLegal.input`.
 */
export const COMPANY_LEGAL_NAME_MAX = 300;
export const COMPANY_LEGAL_EDRPOU_MAX = 10;
export const COMPANY_LEGAL_ADDRESS_MAX = 500;
export const COMPANY_LEGAL_IBAN_MAX = 34;
export const COMPANY_LEGAL_BANK_NAME_MAX = 200;
export const COMPANY_LEGAL_BANK_MFO_MAX = 6;
export const COMPANY_LEGAL_BANK_EDRPOU_MAX = 8;
export const COMPANY_LEGAL_PHONE_MAX = 30;
export const COMPANY_LEGAL_EMAIL_MAX = 200;

/** Canvas CounterpartyEditor legal address `rows={3}` — Class B. */
export const COMPANY_LEGAL_FORM_ADDRESS_LINES = 3;
