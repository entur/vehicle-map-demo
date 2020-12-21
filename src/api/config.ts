const REALTIME_GRAPHQL_ENDPOINT =
  process.env.REACT_APP_REALTIME_GRAPHQL_ENDPOINT;
const REALTIME_SUBSCRIPTIONS_ENDPOINT =
  process.env.REACT_APP_REALTIME_SUBSCRIPTIONS_ENDPOINT;

export const getGraphqlEndpoint = () => {
  if (REALTIME_GRAPHQL_ENDPOINT) {
    return REALTIME_GRAPHQL_ENDPOINT;
  }

  switch (window.location.host) {
    case "vehicle-map.staging.entur.org":
      return "https://api.staging.entur.io/realtime/v1/vehicles/graphql";
    case "vehicle-map.entur.org":
      return "https://api.entur.io/realtime/v1/vehicles/graphql";
    default:
      return "https://api.dev.entur.io/realtime/v1/vehicles/graphql";
  }
};

export const getSubscriptionsEndpoint = () => {
  if (REALTIME_SUBSCRIPTIONS_ENDPOINT) {
    return REALTIME_SUBSCRIPTIONS_ENDPOINT;
  }

  switch (window.location.host) {
    case "vehicle-map.staging.entur.org":
      return "wss://api.staging.entur.io/realtime/v1/vehicles/subscriptions";
    case "vehicle-map.entur.org":
      return "wss://api.entur.io/realtime/v1/vehicles/subscriptions";
    default:
      return "wss://api.dev.entur.io/realtime/v1/vehicles/subscriptions";
  }
};
