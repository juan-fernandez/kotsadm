import gql from "graphql-tag";

export const createNewWatchRaw = `
  mutation createWatch($stateJSON: String!, $owner: String!) {
    createWatch(stateJSON: $stateJSON, owner: $owner) {
      id
      slug
      watchName
      createdOn
      lastUpdated
    }
  }
`;
export const createNewWatch = gql(createNewWatchRaw);

export const deleteWatch = gql`
  mutation deleteWatch($watchId: String!, $childWatchIds: [String]) {
    deleteWatch(watchId: $watchId, childWatchIds: $childWatchIds)
  }
`;

export const updateStateJSON = gql`
  mutation updateStateJSON($slug: String!, $stateJSON: String!) {
    updateStateJSON(slug: $slug, stateJSON: $stateJSON) {
      id
      slug
      stateJSON
    }
  }
`;

export const updateWatch = gql`
  mutation updateWatch($watchId: String!, $watchName: String, $iconUri: String) {
    updateWatch(watchId: $watchId, watchName: $watchName, iconUri: $iconUri) {
      id
      stateJSON
      watchName
      slug
      watchIcon
      createdOn
      lastUpdated
      contributors {
        id
        createdAt
        githubId
        login
        avatar_url
      }
    }
  }
`;

export const deployWatchVersion = gql`
  mutation deployWatchVersion($watchId: String!, $sequence: Int) {
    deployWatchVersion(watchId: $watchId, sequence: $sequence)
  }
`;

export const createInitSessionRaw = `
  mutation createInitSession($upstreamUri: String!, $clusterID: String, $githubPath: String) {
    createInitSession(upstreamUri: $upstreamUri, clusterID: $clusterID, githubPath: $githubPath) {
      id
      upstreamUri
      createdOn
      finishedOn
      result
    }
  }
`
export const createInitSession = gql(createInitSessionRaw);

export const createUnforkSession = gql`
  mutation createUnforkSession($upstreamUri: String!, $forkUri: String!) {
    createUnforkSession(upstreamUri: $upstreamUri, forkUri: $forkUri) {
      id
      upstreamUri
      forkUri
      createdOn
      finishedOn
      result
    }
  }
`

export const createUpdateSession = gql`
  mutation createUpdateSession($watchId: ID!) {
    createUpdateSession(watchId: $watchId) {
      id
      watchId
      createdOn
      finishedOn
      result
    }
  }
`

export const saveWatchContributors = gql`
  mutation saveWatchContributors($id: String!, $contributors: [ContributorItemInput]!) {
    saveWatchContributors(id: $id, contributors: $contributors) {
      id
      createdAt
      githubId
      login
      avatar_url
    }
  }
`

export const deleteNotification = gql`
  mutation deleteNotification ($id: String!, $isPending: Boolean) {
    deleteNotification(id: $id, isPending: $isPending)
  }
`;