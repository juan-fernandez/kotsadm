export const Healthz = `
type Healthz {
  version: String
}
`;
export const Query = `
  type Query {
    healthz: Healthz!

    installationOrganizations(page: Int): GetInstallationsResponse
    orgRepos(org: String!, page: Int): GetForOrgResponse
    repoBranches(owner: String! repo:String! page: Int): [GetBranchesResponseItem]
    githubUser: GithubUser
    userFeatures: [Feature]
    orgMembers(org: String!, page: Int): [GetMembersResponseItem]

    listClusters: [ClusterItem]

    listWatches: [WatchItem]
    searchWatches(watchName: String!): [WatchItem]
    getWatch(slug: String, id: String): WatchItem
    watchContributors(id: String!): [ContributorItem]
    getWatchVersion(id: String!, sequence: Int): VersionItemDetail

    listPendingWatchVersions(watchId: String!): [VersionItem]
    listPastWatchVersions(watchId: String!): [VersionItem]
    getCurrentWatchVersion(watchId: String!): VersionItem

    validateUpstreamURL(upstream: String!): Boolean!

    listNotifications(watchId: String!): [Notification]
    getNotification(notificationId: String!): Notification
    pullRequestHistory(notificationId: String!): [PullRequestHistoryItem]

    imageWatchItems(batchId: String!): [ImageWatchItem]

    getGitHubInstallationId: String!
  }
`;