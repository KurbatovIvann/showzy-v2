import { createCompany } from "./actions/create.js";
import { getCompany } from "./actions/get.js";
import { getSellerFacts } from "./actions/get-seller-facts.js";
import { listMine } from "./actions/list-mine.js";
import { updateLegal } from "./actions/update-legal.js";

export { createCompany };
export { getCompany };
export { getSellerFacts };
export { listMine };
export { updateLegal };

export const companiesActions = [
  createCompany,
  getCompany,
  getSellerFacts,
  listMine,
  updateLegal,
] as const;
