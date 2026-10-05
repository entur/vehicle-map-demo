import { afterEach, describe, expect, it, vi } from "vitest";
import { graphqlRequest } from "./graphqlRequest.ts";

function respondWith(body: unknown, init: ResponseInit = {}) {
  const fetchMock = vi.fn(async () =>
    Response.json(body, { status: 200, ...init }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("graphqlRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the query and variables as JSON with the given headers", async () => {
    const fetchMock = respondWith({ data: { ok: true } });
    const signal = new AbortController().signal;

    await graphqlRequest({
      url: "https://example.test/graphql",
      query: "query ($id: String!) { thing(id: $id) }",
      variables: { id: "a" },
      headers: { "Et-Client-Name": "demo" },
      signal,
    });

    expect(fetchMock).toHaveBeenCalledWith("https://example.test/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/graphql-response+json, application/json",
        "Et-Client-Name": "demo",
      },
      body: JSON.stringify({
        query: "query ($id: String!) { thing(id: $id) }",
        variables: { id: "a" },
      }),
      signal,
    });
  });

  it("resolves to the response's data", async () => {
    respondWith({ data: { operators: [{ operatorRef: "X" }] } });

    await expect(
      graphqlRequest({ url: "https://example.test/graphql", query: "{ x }" }),
    ).resolves.toEqual({ operators: [{ operatorRef: "X" }] });
  });

  it("rejects when the response carries GraphQL errors, even alongside data", async () => {
    respondWith({
      data: { operators: null },
      errors: [{ message: "Bad codespace" }, { message: "Also this" }],
    });

    await expect(
      graphqlRequest({ url: "https://example.test/graphql", query: "{ x }" }),
    ).rejects.toThrow("Bad codespace; Also this");
  });

  it("rejects on an HTTP error status", async () => {
    respondWith({}, { status: 502, statusText: "Bad Gateway" });

    await expect(
      graphqlRequest({ url: "https://example.test/graphql", query: "{ x }" }),
    ).rejects.toThrow("502");
  });

  it("includes the server's GraphQL errors when it rejects a query with an HTTP error", async () => {
    respondWith(
      { errors: [{ message: "Field 'nope' is undefined" }] },
      { status: 400, statusText: "Bad Request" },
    );

    await expect(
      graphqlRequest({ url: "https://example.test/graphql", query: "{ x }" }),
    ).rejects.toThrow("400 Bad Request: Field 'nope' is undefined");
  });

  it("rejects on an HTTP error whose body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>oops</html>", { status: 503 })),
    );

    await expect(
      graphqlRequest({ url: "https://example.test/graphql", query: "{ x }" }),
    ).rejects.toThrow("503");
  });

  it("rejects when the response has no data", async () => {
    respondWith({});

    await expect(
      graphqlRequest({ url: "https://example.test/graphql", query: "{ x }" }),
    ).rejects.toThrow("no data");
  });
});
