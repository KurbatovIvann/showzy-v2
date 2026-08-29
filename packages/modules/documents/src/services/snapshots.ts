import { CoreInvariantError, ValidationError } from "@showzy/core/errors";
import { z } from "zod";

import {
  buyerDetailsSchema,
  documentCompanyTypeSchema,
  supplierDetailsSchema,
} from "../actions/document-view.contract.js";

export const MISSING_SELLER_LEGAL_MESSAGE =
  "Company legal requisites are required to issue a document.";

export const MISSING_BUYER_MESSAGE =
  "A customer or counterparty is required to issue a document.";

export const COUNTERPARTY_CUSTOMER_MISMATCH_MESSAGE =
  "The counterparty must be linked to the order customer.";

const sellerLegalPresentGate = z.object({
  present: z.literal(true, { error: MISSING_SELLER_LEGAL_MESSAGE }),
});

const orderCustomerPresentGate = z.object({
  present: z.literal(true, { error: MISSING_BUYER_MESSAGE }),
});

const counterpartyCustomerMatchGate = z.object({
  matches: z.literal(true, {
    error: COUNTERPARTY_CUSTOMER_MISMATCH_MESSAGE,
  }),
});

type SupplierDetails = z.output<typeof supplierDetailsSchema>;
export type BuyerDetails = z.output<typeof buyerDetailsSchema>;

export interface SellerLegalFact {
  readonly companyType: string;
  readonly legalName: string | null;
  readonly edrpou: string | null;
  readonly legalAddress: string | null;
  readonly iban: string | null;
  readonly bankName: string | null;
  readonly bankMfo: string | null;
  readonly bankEdrpou: string | null;
  readonly phone: string | null;
  readonly email: string | null;
}

export interface SellerFacts {
  readonly name: string;
  readonly prefix: string;
  readonly legal: SellerLegalFact | null;
}

export interface CounterpartyFact {
  readonly id: string;
  readonly name: string;
  readonly edrpou: string | null;
  readonly legalAddress: string | null;
  readonly iban: string | null;
  readonly bankName: string | null;
  readonly bankMfo: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly notes: string | null;
  readonly customerId: string | null;
}

export function requireSellerLegal(
  legal: SellerLegalFact | null,
): SellerLegalFact {
  const parsed = sellerLegalPresentGate.safeParse({
    present: legal !== null,
  });
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues,
      MISSING_SELLER_LEGAL_MESSAGE,
    );
  }
  if (legal === null) {
    throw new CoreInvariantError(
      "seller legal gate passed with a null legal face",
    );
  }
  return legal;
}

export function requireOrderCustomerId(customerId: string | null): string {
  const parsed = orderCustomerPresentGate.safeParse({
    present: customerId !== null,
  });
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues, MISSING_BUYER_MESSAGE);
  }
  if (customerId === null) {
    throw new CoreInvariantError(
      "order customer gate passed with a null customer id",
    );
  }
  return customerId;
}

export function requireCounterpartyCustomerMatch(
  linkedCustomerId: string | null,
  orderCustomerId: string | null,
): void {
  if (linkedCustomerId === null) {
    return;
  }
  const parsed = counterpartyCustomerMatchGate.safeParse({
    matches: linkedCustomerId === orderCustomerId,
  });
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues,
      COUNTERPARTY_CUSTOMER_MISMATCH_MESSAGE,
    );
  }
}

function parseCompanyType(
  value: string,
): z.output<typeof documentCompanyTypeSchema> {
  const parsed = documentCompanyTypeSchema.safeParse(value);
  if (!parsed.success) {
    throw new CoreInvariantError(
      `seller legal company_type "${value}" is not a snapshot value`,
    );
  }
  return parsed.data;
}

export function snapshotSupplier(seller: SellerFacts): SupplierDetails {
  const legal = requireSellerLegal(seller.legal);
  return {
    kind: "seller",
    name: seller.name,
    prefix: seller.prefix,
    companyType: parseCompanyType(legal.companyType),
    legalName: legal.legalName,
    edrpou: legal.edrpou,
    legalAddress: legal.legalAddress,
    iban: legal.iban,
    bankName: legal.bankName,
    bankMfo: legal.bankMfo,
    bankEdrpou: legal.bankEdrpou,
    phone: legal.phone,
    email: legal.email,
  };
}

export function snapshotCounterpartyBuyer(
  counterparty: CounterpartyFact,
): BuyerDetails {
  return {
    kind: "counterparty",
    name: counterparty.name,
    edrpou: counterparty.edrpou,
    legalAddress: counterparty.legalAddress,
    iban: counterparty.iban,
    bankName: counterparty.bankName,
    bankMfo: counterparty.bankMfo,
    phone: counterparty.phone,
    email: counterparty.email,
    notes: counterparty.notes,
  };
}

export function snapshotCustomerBuyer(displayName: string): BuyerDetails {
  return {
    kind: "customer",
    displayName,
  };
}

export function buyerLabelFromSnapshot(buyer: unknown): string {
  const parsed = buyerDetailsSchema.safeParse(buyer);
  if (!parsed.success) {
    throw new CoreInvariantError("documents row has illegal buyer_details");
  }
  return parsed.data.kind === "counterparty"
    ? parsed.data.name
    : parsed.data.displayName;
}
