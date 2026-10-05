import { useConfig } from "../config/ConfigContext.ts";
import { subscriptionClientFor } from "./subscriptionClient.ts";

export const useSubscriptionClient = () => subscriptionClientFor(useConfig());
