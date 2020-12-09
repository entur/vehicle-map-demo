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
  query VehiclesQuery {
    vehicles {
      ...VehicleFragment
    }
  }
  ${VEHICLE_FRAGMENT}
`;

export const VEHICLE_UPDATES_SUBSCRIPTION = gql`
  subscription VehicleUpdates {
    vehicleUpdates {
      ...VehicleFragment
    }
  }
  ${VEHICLE_FRAGMENT}
`;
