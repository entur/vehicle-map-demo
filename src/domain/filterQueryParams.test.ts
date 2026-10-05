import { describe, expect, it } from "vitest";
import { filterFromQueryParams } from "./filterQueryParams.ts";

describe("filterFromQueryParams", () => {
  it("keeps the filter's own keys", () => {
    expect(
      filterFromQueryParams({
        codespaceId: "ATB",
        operatorRef: "ATB:Operator:1",
        maxDataAge: "60",
      }),
    ).toEqual({
      codespaceId: "ATB",
      operatorRef: "ATB:Operator:1",
      maxDataAge: "60",
    });
  });

  it("leaves out keys owned by other hooks", () => {
    expect(
      filterFromQueryParams({
        codespaceId: "ATB",
        mode: "situations",
        view: "2d",
      }),
    ).toEqual({ codespaceId: "ATB" });
  });
});
