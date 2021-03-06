import { Context } from "../../context";
import { Stores } from "../../schema/stores";
import { getLatestLicense, verifyAirgapLicense } from "../../kots_app/kots_ffi";
import { ReplicatedError } from "../../server/errors";
import { FilesAsBuffers, TarballPacker } from "../../troubleshoot/util";
import { uploadUpdate } from "../../controllers/kots/KotsAPI";
import { getLicenseInfoFromYaml } from "../../util/utilities";
import { KLicense } from "../klicense";
import yaml from "js-yaml";

export function KotsLicenseMutations(stores: Stores) {
  return {
    async syncAppLicense(root: any, args: any, context: Context): Promise<KLicense> {
      const { appSlug, airgapLicense } = args;
      const appId = await stores.kotsAppStore.getIdFromSlug(appSlug);
      const app = await context.getApp(appId)
      const license = await stores.kotsLicenseStore.getAppLicenseSpec(app.id);

      if (!license) {
        throw new ReplicatedError(`License not found for app with an ID of ${app.id}`);
      }

      let latestLicense;
      if (airgapLicense && airgapLicense !== "") {
        if (!app.isAirgap) {
          throw new ReplicatedError(`Failed to sync license, app with id ${app.id} is not airgap enabled`);
        }
        latestLicense = await verifyAirgapLicense(airgapLicense)
      } else {
        latestLicense = await getLatestLicense(license);
      }

      try {
        // check if any updates are available
        const currentLicenseSequence = yaml.safeLoad(license).spec.licenseSequence;
        const latestLicenseSequence = yaml.safeLoad(latestLicense).spec.licenseSequence;
        if (currentLicenseSequence === latestLicenseSequence) {
          // no changes detected, return current license
          return getLicenseInfoFromYaml(license);
        }
      } catch(err) {
        throw new ReplicatedError(`Failed to parse license: ${err}`)
      }
      
      const paths: string[] = await app.getFilesPaths(`${app.currentSequence!}`);
      const files: FilesAsBuffers = await app.getFiles(`${app.currentSequence!}`, paths);

      let licenseFilePath = "";
      for (const path in files.files) {
        try {
          const content = files.files[path];
          const parsedContent = yaml.safeLoad(content.toString());
          if (!parsedContent) {
            continue;
          }
          if (parsedContent.kind === "License" && parsedContent.apiVersion === "kots.io/v1beta1") {
            licenseFilePath = path;
            break;
          }
        } catch {
          // TODO: this will happen on multi-doc files.
        }
      }

      if (licenseFilePath === "") {
        throw new ReplicatedError(`License file not found in bundle for app id ${app.id}`);
      }

      if (files.files[licenseFilePath] === latestLicense) {
        throw new ReplicatedError("No license changes found");
      }

      files.files[licenseFilePath] = latestLicense;

      const bundlePacker = new TarballPacker();
      const tarGzBuffer: Buffer = await bundlePacker.packFiles(files);

      await uploadUpdate(stores, app.slug, tarGzBuffer, "License Update");

      return getLicenseInfoFromYaml(latestLicense);
    },
  }
}
