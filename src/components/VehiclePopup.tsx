import { Popup } from "react-map-gl/maplibre";
import { SelectedVehicle } from "./VehicleMarkers";
import { useVehicleUpdateCompleteSubscription } from "../hooks/useVehicleUpdateCompleteSubscription";
import { FollowButton } from "./Vehicle/FollowButton";
import { DetailsButton } from "./Vehicle/DetailsButton";
import { VehicleInfo } from "./Vehicle/VehicleInfo";

type VehiclePopupProps = {
  vehicle: SelectedVehicle;
  onClose: () => void;
  onFollow: () => void;
  followedVehicle?: SelectedVehicle | null;
};

export function VehiclePopup({
  vehicle,
  onClose,
  onFollow,
  followedVehicle,
}: VehiclePopupProps) {
  const subscriptionData = useVehicleUpdateCompleteSubscription(
    vehicle.properties.id,
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
        onClose={onClose}
        closeOnClick={false}
        className="vehicle-popup"
      >
        <div className="vehicle-popup-content">
          <VehicleInfo vehicleData={subscriptionData} />
          {subscriptionData && (
            <div className="vehicle-popup-actions">
              <FollowButton
                isFollowing={
                  followedVehicle?.properties.id === vehicle.properties.id
                }
                onClick={onFollow}
              />
              <DetailsButton vehicleData={subscriptionData} />
            </div>
          )}
        </div>
      </Popup>
    </>
  );
}
