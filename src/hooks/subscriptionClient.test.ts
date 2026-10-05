import { describe, expect, it } from "vitest";
import { subscriptionClientFor } from "./subscriptionClient.ts";
import { Config } from "../config/ConfigContext.ts";

function config(overrides: Partial<Config> = {}): Config {
  return {
    "vehicle-positions-graphql-endpoint": "https://example.test/graphql",
    "vehicle-positions-subscriptions-endpoint":
      "wss://example.test/subscriptions",
    "vehicle-positions-et-client-name": "test-client",
    ...overrides,
  };
}

describe("subscriptionClientFor", () => {
  it("shares one client between callers with the same config", () => {
    // Each client owns a WebSocket, so a client per component means a socket
    // per mounted popup, panel and feed.
    expect(subscriptionClientFor(config())).toBe(
      subscriptionClientFor(config()),
    );
  });

  it("keeps separate clients for separate endpoints", () => {
    expect(
      subscriptionClientFor(
        config({
          "vehicle-positions-subscriptions-endpoint":
            "wss://other.test/subscriptions",
        }),
      ),
    ).not.toBe(subscriptionClientFor(config()));
  });

  it("keeps separate clients for separate client names", () => {
    // The name is sent as a connection header, so it is part of the socket.
    expect(
      subscriptionClientFor(
        config({ "vehicle-positions-et-client-name": "another-client" }),
      ),
    ).not.toBe(subscriptionClientFor(config()));
  });
});
