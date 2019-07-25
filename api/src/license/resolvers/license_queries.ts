import { Context } from "../../context";
import { Stores } from "../../schema/stores";

export function LicenseQueries(stores: Stores) {
  return {
    async getWatchLicense(root: any, { watchId }, context: Context) {
      const watch = await context.getWatch(watchId);
      return await stores.licenseStore.getWatchLicense(watch.id);
    },
    
    async getLatestWatchLicense(root: any, { licenseId }, context: Context) {
      return await stores.licenseStore.getLatestWatchLicense(licenseId);
    },
  };
}