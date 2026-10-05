type GraphQLResponse<T> = {
  data?: T | null;
  errors?: { message: string }[];
};

/**
 * One GraphQL query over HTTP POST, resolving to the response's `data`.
 *
 * Rejects on an HTTP error, on any GraphQL error — even one returned beside
 * partial data — and on a response with no data, so a caller never mistakes
 * half an answer for the whole of one. Replaces graphql-request, whose peer
 * range stopped at graphql 16.
 */
export async function graphqlRequest<T>({
  url,
  query,
  variables,
  headers,
  signal,
}: {
  url: string;
  query: string;
  variables?: Record<string, unknown>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/graphql-response+json, application/json",
      ...headers,
    },
    body: JSON.stringify({ query, variables }),
    signal,
  });
  // A query the server rejects comes back as a 4xx with its reasons in the
  // body, so read the body before judging the status.
  const body = (await response.json().catch(() => ({}))) as GraphQLResponse<T>;
  const messages = body.errors?.map((error) => error.message).join("; ");
  if (!response.ok) {
    throw new Error(
      `GraphQL request failed: ${response.status} ${response.statusText}` +
        (messages ? `: ${messages}` : ""),
    );
  }
  if (messages) {
    throw new Error(messages);
  }
  if (body.data == null) {
    throw new Error("GraphQL response carried no data");
  }
  return body.data;
}
