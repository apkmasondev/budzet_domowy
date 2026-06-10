import { useReadyToAssignData } from "../lib/queries";

export function useReadyToAssign() {
  const { data: readyToAssign = 0 } = useReadyToAssignData();
  return readyToAssign;
}
