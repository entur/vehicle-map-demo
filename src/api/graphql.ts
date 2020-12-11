import { gql } from "@apollo/client";

const VEHICLE_FRAGMENT = gql`
  fragment VehicleFragment on VehicleUpdate {
    codespaceId
    vehicleId
    direction
    lineName
    lineRef
    serviceJourneyId
    operator
    mode
    lastUpdated
    expiration
    speed
    heading
    monitored
    delay
    location {
      latitude
      longitude
    }
  }
`;

export const VEHICLES_QUERY = gql`
  query VehiclesQuery($codespaceId: String, $lineRef: String) {
    vehicles(codespaceId: $codespaceId, lineRef: $lineRef) {
      ...VehicleFragment
    }
  }
  ${VEHICLE_FRAGMENT}
`;

export const VEHICLE_UPDATES_SUBSCRIPTION = gql`
  subscription VehicleUpdates($codespaceId: String, $lineRef: String) {
    vehicleUpdates(codespaceId: $codespaceId, lineRef: $lineRef) {
      ...VehicleFragment
    }
  }
  ${VEHICLE_FRAGMENT}
`;

export const CODESPACES_QUERY = gql`
  query CodespacesQuery {
    codespaces {
      id
    }
  }
`;

export const LINES_QUERY = gql`
  query LinesQuery($codespaceId: String) {
    lines(codespaceId: $codespaceId) {
      lineRef
      lineName
    }
  }
`;
