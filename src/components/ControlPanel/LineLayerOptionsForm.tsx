import { memo } from "react";
import { Switch } from "@entur/form";
import { LineLayerOptions } from "model/lineLayerOptions";

type Props = {
  options: LineLayerOptions;
  setOptions: (options: LineLayerOptions) => void;
};

export const LineLayerOptionsForm = memo(({ options, setOptions }: Props) => {
  return (
    <>
      <Switch
        checked={options.includePointsOnLink}
        onChange={(event) => {
          setOptions({
            ...options,
            includePointsOnLink: event.target.checked,
          });
        }}
      >
        Include points-on-link
      </Switch>

      <Switch
        checked={options.showHistoricalPath}
        onChange={(event) =>
          setOptions({ ...options, showHistoricalPath: event.target.checked })
        }
      >
        Show historical path
      </Switch>
    </>
  );
});
