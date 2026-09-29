import { Popup } from "react-map-gl/maplibre";
import { SelectedVehicle } from "./VehicleMarkers.tsx";
import { useVehicleUpdateCompleteSubscription } from "../../hooks/useVehicleUpdateCompleteSubscription.ts";
import { VehicleActions } from "./VehicleActions.tsx";
import { VehicleInfo } from "./VehicleInfo.tsx";

type VehiclePopupProps = {
  vehicle: SelectedVehicle;
  onClose: () => void;
  onFollow: () => void;
  followedVehicle?: SelectedVehicle | null;
  onChase: () => void;
};

export function VehiclePopup({
  vehicle,
  onClose,
  onFollow,
  followedVehicle,
  onChase,
}: VehiclePopupProps) {
  const subscriptionData = useVehicleUpdateCompleteSubscription(
    vehicle.properties.id,
    vehicle.properties.serviceJourneyId,
  );

  const longitude =
    subscriptionData?.location?.longitude ?? vehicle.coordinates[0];
  const latitude =
    subscriptionData?.location?.latitude ?? vehicle.coordinates[1];

  return (
    <>
      <Popup
        longitude={longitude}
        latitude={latitude}
        anchor="top"
        offset={[0, 15]}
        onClose={onClose}
        closeOnClick={false}
        className="vehicle-popup"
      >
        <div className="vehicle-popup-content">
          <VehicleInfo vehicleData={subscriptionData} />
          {subscriptionData && (
            <div className="vehicle-popup-actions">
              <VehicleActions
                vehicleData={subscriptionData}
                isFollowing={
                  followedVehicle?.properties.id === vehicle.properties.id
                }
                onFollow={onFollow}
                onChase={onChase}
              />
            </div>
          )}
        </div>
      </Popup>
    </>
  );
}
