import { memo } from "react";
import { Switch, TextField } from "@entur/form";
import { Heading4 } from "@entur/typography";
import { SubscriptionOptions } from "model/subscriptionOptions";

type Props = {
  subscriptionOptions: SubscriptionOptions;
  setSubscriptionOptions: (subscriptionOptions: SubscriptionOptions) => void;
};

export const SubscriptionOptionsForm = memo(
  ({ subscriptionOptions, setSubscriptionOptions }: Props) => {
    return (
      <>
        <Heading4>Live updates</Heading4>
        <Switch
          checked={subscriptionOptions.enableLiveUpdates}
          onChange={(event) =>
            setSubscriptionOptions({
              ...subscriptionOptions,
              enableLiveUpdates: event.target.checked,
            })
          }
        >
          Enable live updates
        </Switch>

        {subscriptionOptions.enableLiveUpdates && (
          <>
            <TextField
              type="number"
              label="Buffer size"
              value={subscriptionOptions.bufferSize}
              onChange={(event) =>
                setSubscriptionOptions({
                  ...subscriptionOptions,
                  bufferSize: parseInt(event.target.value),
                })
              }
            />

            <TextField
              type="number"
              label="Buffer time (ms)"
              value={subscriptionOptions.bufferTime}
              onChange={(event) =>
                setSubscriptionOptions({
                  ...subscriptionOptions,
                  bufferTime: parseInt(event.target.value),
                })
              }
            />
          </>
        )}
      </>
    );
  }
);
