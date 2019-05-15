import { SessionStore } from "../session/session_store";
import { UserStore } from "../user";
import { ClusterStore } from "../cluster";
import { WatchStore } from "../watch/watch_store";
import { NotificationStore } from "../notification/store";
import { UpdateStore } from "../update/store";
import { UnforkStore } from "../unfork/unfork_store";
import { InitStore } from "../init/init_store";
import { ImageWatchStore } from "../imagewatch/store";
import { FeatureStore } from "../feature/feature_store";
import { GithubNonceStore } from "../user/store";
import { HealthzStore } from "../healthz/store";

export interface Stores {
  sessionStore: SessionStore;
  userStore: UserStore;
  githubNonceStore: GithubNonceStore;
  clusterStore: ClusterStore;
  watchStore: WatchStore,
  notificationStore: NotificationStore,
  updateStore: UpdateStore,
  unforkStore: UnforkStore,
  initStore: InitStore,
  imageWatchStore: ImageWatchStore,
  featureStore: FeatureStore,
  healthzStore: HealthzStore,
}