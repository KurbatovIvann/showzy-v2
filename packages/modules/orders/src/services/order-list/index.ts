import type {
  ListOrdersInput,
  ListOrdersOutput,
} from "../../actions/list.contract.js";
import { listAggregate } from "./aggregate.js";
import { resolveQueryMatch, type StaffCtx } from "./filter.js";
import { listPage } from "./page.js";

type ListInput = ListOrdersInput;
type ListOutput = ListOrdersOutput;

export async function executeListOrders(
  input: ListInput,
  ctx: StaffCtx,
): Promise<ListOutput> {
  const queryMatch = await resolveQueryMatch(ctx, input.filter?.query);
  if (queryMatch.empty) {
    if (input.kind === "aggregate") {
      return {
        kind: "aggregate",
        orderCount: 0,
        grossByCurrency: [],
        buckets:
          input.groupBy === "none"
            ? [
                {
                  identity: { kind: "none" },
                  label: "",
                  orderCount: 0,
                  grossByCurrency: [],
                },
              ]
            : [],
        bucketsTruncated: false,
        customerMatchTruncated: queryMatch.truncated,
        statusBuckets: [],
      };
    }
    if (input.kind === "page.withLines") {
      return {
        kind: "page.withLines",
        items: [],
        nextCursor: null,
        customerMatchTruncated: queryMatch.truncated,
        linesTruncated: false,
      };
    }
    return {
      kind: "page.summary",
      items: [],
      nextCursor: null,
      customerMatchTruncated: queryMatch.truncated,
    };
  }

  if (input.kind === "aggregate") {
    return listAggregate(ctx, input, queryMatch);
  }
  return listPage(ctx, input, queryMatch);
}
