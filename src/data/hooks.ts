import { useQuery, useQueryClient } from "@octanejs/tanstack-query";
import { type Location } from "../config.ts";
import { type Range } from "./providers.ts";
import {
  loadLocation,
  locationQueryKey,
  type Resource,
  type WeatherResult,
} from "./repository.ts";
export function useLocation(
  location: Location,
  range: Range,
  resource: Resource = "weather",
) {
  const client = useQueryClient();
  const key = locationQueryKey(location, range, resource);
  return useQuery<WeatherResult>({
    queryKey: key,
    queryFn: ({ signal }) =>
      loadLocation(location, range, {
        signal,
        resource,
        onData: (data) => client.setQueryData(key, data),
      }),
    retry: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    staleTime: 0,
  });
}
