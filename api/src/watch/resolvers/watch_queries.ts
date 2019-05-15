import * as _ from "lodash";
import {
  ContributorItem,
  GetWatchQueryArgs,
  SearchWatchesQueryArgs,
  WatchContributorsQueryArgs,
  WatchItem,
  VersionItem,
  ListPendingWatchVersionsQueryArgs,
  GetCurrentWatchVersionQueryArgs,
  VersionItemDetail,
  GetWatchVersionQueryArgs,
} from "../../generated/types";
import { ReplicatedError } from "../../server/errors";
import { Context } from "../../context";
import { tracer } from "../../server/tracing";
import { Feature } from "aws-sdk/clients/alexaforbusiness";
import { Stores } from "../../schema/stores";
import { NotificationQueries } from "../../notification";

export function WatchQueries(stores: Stores) {
  return {
    async getWatchVersion(root: any, args: GetWatchVersionQueryArgs, context: Context): Promise<VersionItemDetail> {
      const span = tracer().startSpan("query.getWatchVersion");

      const watch = await stores.watchStore.getWatch(span.context(), args.id);

      const versionItem = await stores.watchStore.getOneVersion(span.context(), args.id, args.sequence!);
      const params = await stores.watchStore.getLatestGeneratedFileS3Params(span.context(), watch!.id!, args.sequence!);
      const download = await this.downloadService.findDeploymentFile(span.context(), params);

      const versionItemDetail = {
        ...versionItem,
        rendered: download.contents.toString("utf-8"),
      }

      span.finish();

      return versionItemDetail;
    },

    async listWatches(root: any, args: any, context: Context): Promise<WatchItem[]> {
      const watches = await stores.watchStore.listWatches(null, context.session.userId);
      const result = watches.map(watch => toSchemaWatch(watch, root, context, stores));

      return result;
    },

    async searchWatches(root: any, args: SearchWatchesQueryArgs, context: Context): Promise<WatchItem[]> {
      const span = tracer().startSpan("query.searchWatches");

      const { watchName } = args;

      const watches = await stores.watchStore.searchWatches(span, context.session.userId, watchName);

      span.finish();

      return watches.map(watch => toSchemaWatch(watch, root, context, stores));
    },

    async getWatch(root: any, args: GetWatchQueryArgs, context: Context): Promise<WatchItem> {
      const span = tracer().startSpan("query.getWatch");

      const { slug, id } = args;
      if (!id && !slug) {
        throw new ReplicatedError("One of slug or id is required", "bad_request");
      }

      const result = await stores.watchStore.findUserWatch(span.context(), context.session.userId, { slug: slug!, id: id! });

      span.finish();

      return toSchemaWatch(result, root, context, stores);
    },

    async watchContributors(root: any, args: WatchContributorsQueryArgs, context: Context): Promise<ContributorItem[]> {
      const span = tracer().startSpan("query.watchContributors");

      const { id } = args;

      const watch = await stores.watchStore.findUserWatch(span.context(), context.session.userId, { id });

      return stores.watchStore.listWatchContributors(watch.id!);
    },

    async listPendingWatchVersions(root: any, { watchId }: ListPendingWatchVersionsQueryArgs, context: Context): Promise<VersionItem[]> {
      const span = tracer().startSpan("query.listPendingWatchVersions");

      const watch: WatchItem = await stores.watchStore.findUserWatch(span.context(), context.session.userId, { id: watchId });

      const pendingVersions = await stores.watchStore.listPendingVersions(span.context(), watch.id!);

      span.finish();

      return pendingVersions;
    },

    async listPastWatchVersions(root: any, { watchId }: ListPendingWatchVersionsQueryArgs, context: Context): Promise<VersionItem[]> {
      const span = tracer().startSpan("query.listPastWatchVersions");

      const watch: WatchItem = await stores.watchStore.findUserWatch(span.context(), context.session.userId, { id: watchId });

      const pastVersions = await stores.watchStore.listPastVersions(watch.id!)

      span.finish();

      return pastVersions;
    },

    async getCurrentWatchVersion(root: any, args: GetCurrentWatchVersionQueryArgs, context: Context): Promise<VersionItem|undefined> {
      const watch: WatchItem = await stores.watchStore.findUserWatch(null, context.session.userId, { id: args.watchId });
      return stores.watchStore.getCurrentVersion(watch.id!)
    }

  }
}

function toSchemaWatch(watch: WatchItem, root: any, ctx: Context, stores: Stores): any {
  const schemaWatch = {...watch};
  schemaWatch.watches = schemaWatch.watches!.map(childWatch => toSchemaWatch(childWatch!, root, ctx, stores));

  return {
    ...schemaWatch,
    cluster: async () => await stores.clusterStore.getForWatch(null, watch.id!),
    contributors: async () => WatchQueries(stores).watchContributors(root, { id: watch.id! }, ctx),
    notifications: async () => NotificationQueries(stores).listNotifications(root, { watchId: watch.id! }, ctx),
    features: async () => watchFeatures(watch.id!, stores),
    pendingVersions: async () => WatchQueries(stores).listPendingWatchVersions(root, { watchId: watch.id! }, ctx),
    pastVersions: async () => stores.watchStore.listPastVersions(watch.id!),
    currentVersion: async () => stores.watchStore.getCurrentVersion(watch.id!),
  };
}

async function watchFeatures(watchId: string, stores: Stores): Promise<any[]> {
  const features = await stores.featureStore.listWatchFeatures(null, watchId);
  const result = _.map(features, (feature) => {
    return {
      ...feature,
    };
  });

  return result;
}