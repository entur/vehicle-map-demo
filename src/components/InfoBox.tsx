import { Card, CardContent, Typography } from "@mui/material";
import { VehicleModeEnumeration, VehicleUpdate } from "../types.ts";

type InfoBoxProps = {
  data?: VehicleUpdate[];
};

function getNoOfVehicles(
  data: VehicleUpdate[],
  type: VehicleModeEnumeration,
): number {
  return data.filter((vehicle) => vehicle.mode === type).length;
}

function getUpdateFrequencyCounts(data: VehicleUpdate[]): {
  lessThan2: number;
  between2And15: number;
  between15And30: number;
  greaterThan30: number;
} {
  const now = Date.now();
  let lessThan2 = 0;
  let between2And15 = 0;
  let between15And30 = 0;
  let greaterThan30 = 0;

  data.forEach((vehicle) => {
    const lastUpdatedTime = new Date(vehicle.lastUpdated).getTime();
    const diffSeconds = (now - lastUpdatedTime) / 1000; // time difference in seconds

    if (diffSeconds < 2) {
      lessThan2++;
    } else if (diffSeconds < 15) {
      between2And15++;
    } else if (diffSeconds < 30) {
      between15And30++;
    } else {
      greaterThan30++;
    }
  });

  return { lessThan2, between2And15, between15And30, greaterThan30 };
}

export function InfoBox({ data }: InfoBoxProps) {
  const updateFrequency = data ? getUpdateFrequencyCounts(data) : null;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Statistics
        </Typography>
        {data && (
          <>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {"Size of data set: " + data.length}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {"Buses: " + getNoOfVehicles(data, "BUS")}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {"Trains: " + getNoOfVehicles(data, "RAIL")}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {"Trams: " + getNoOfVehicles(data, "TRAM")}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {"Ferries: " + getNoOfVehicles(data, "FERRY")}
            </Typography>
            {updateFrequency && (
              <>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {"Update frequency (<2s): " + updateFrequency.lessThan2}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {"Update frequency (2-15s): " + updateFrequency.between2And15}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {"Update frequency (15-30s): " +
                    updateFrequency.between15And30}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {"Update frequency (>30s): " + updateFrequency.greaterThan30}
                </Typography>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
