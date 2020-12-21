import React from "react";
import { App } from "./App";
import TestRenderer from "react-test-renderer";
import { MockedProvider } from "@apollo/client/testing";
import { createHeadlessContext } from "@luma.gl/test-utils";
import gl from "gl";

const mocks = [];

it("renders without crashing", () => {
  createHeadlessContext({ width: 1024, height: 728, gl });
  TestRenderer.create(
    <MockedProvider mocks={mocks} addTypename={false}>
      <App />
    </MockedProvider>
  );
});
