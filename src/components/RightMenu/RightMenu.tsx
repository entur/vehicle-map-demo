import { useState } from "react";
import { Filter, VehicleUpdate } from "../../types.ts";
import { Drawer } from "@mui/material";
import { RightMenuButtons } from "./RightMenuButtons.tsx";
import { DrawerContent } from "./DrawerContent.tsx";
import { ContentType } from "./types.ts";

interface RightMenuProps {
  setCurrentFilter: (filter: Filter) => void;
  currentFilter: Filter | null | undefined;
  data: VehicleUpdate[];
}

export const RightMenu = ({
  currentFilter,
  setCurrentFilter,
  data,
}: RightMenuProps) => {
  const [activeContent, setActiveContent] = useState<ContentType | null>(null);

  return (
    <>
      <RightMenuButtons
        activeContent={activeContent}
        setActiveContent={setActiveContent}
      />
      <Drawer
        anchor="right"
        open={!!activeContent}
        onClose={() => setActiveContent(null)}
      >
        {activeContent && (
          <DrawerContent
            activeContent={activeContent}
            currentFilter={currentFilter}
            setCurrentFilter={setCurrentFilter}
            data={data}
          />
        )}
      </Drawer>
    </>
  );
};
