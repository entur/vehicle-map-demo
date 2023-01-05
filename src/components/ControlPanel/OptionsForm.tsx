import { memo } from "react";
import { Switch, TextField } from "@entur/form";
import { Heading4 } from "@entur/typography";
import { Options } from "model/options";

type Props = {
  options: Options;
  setOptions: (options: Options) => void;
};

export const OptionsForm = memo(({ options, setOptions }: Props) => {
  return (
    <>
      <Heading4>Other settings</Heading4>

      <Switch
        checked={options.removeExpired}
        onChange={(event) =>
          setOptions({ ...options, removeExpired: event.target.checked })
        }
      >
        Remove expired vehicles from map
      </Switch>
      <TextField
        style={{ display: !options.removeExpired ? "none" : "block" }}
        type="number"
        label="after N seconds"
        value={options.removeExpiredAfterSeconds}
        onChange={(event) =>
          setOptions({
            ...options,
            removeExpiredAfterSeconds: parseInt(event.target.value),
          })
        }
      />
      <Switch
        checked={options.markInactive}
        onChange={(event) =>
          setOptions({ ...options, markInactive: event.target.checked })
        }
      >
        Mark vehicles as inactive
      </Switch>
      <TextField
        style={{ display: !options.markInactive ? "none" : "block" }}
        type="number"
        label="after N seconds"
        value={options.markInactiveAfterSeconds}
        onChange={(event) =>
          setOptions({
            ...options,
            markInactiveAfterSeconds: parseInt(event.target.value),
          })
        }
      />

      <Switch
        checked={options.hideServiceJourneysWithInvalidIds}
        onChange={(event) => {
          if (event.target.checked) {
            setOptions({
              ...options,
              hideServiceJourneysWithInvalidIds: event.target.checked,
            });
          } else {
            const { hideServiceJourneysWithInvalidIds, ...rest } = options;
            setOptions({ ...rest });
          }
        }}
      >
        Hide service journeys with invalid IDs
      </Switch>
    </>
  );
});
