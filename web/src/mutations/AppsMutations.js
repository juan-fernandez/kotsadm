import gql from "graphql-tag";

export const createKotsDownstreamRaw = `
  mutation createKotsDownstream($appId: String!, $clusterId: String!) {
    createKotsDownstream(appId: $appId, clusterId: $clusterId)
  }
`;

export const createKotsDownstream = gql(createKotsDownstreamRaw);

export const deleteKotsDownstreamRaw = `
  mutation deleteKotsDownstream($slug: String!, $clusterId: String!) {
    deleteKotsDownstream(slug: $slug, clusterId: $clusterId)
  }
`;

export const deleteKotsDownstream = gql(deleteKotsDownstreamRaw);

export const deleteKotsAppRaw = `
  mutation deleteKotsApp($slug: String!) {
    deleteKotsApp(slug: $slug)
  }
`;

export const deleteKotsApp = gql(deleteKotsAppRaw);

export const checkForKotsUpdatesRaw = `
  mutation checkForKotsUpdates($appId: ID!) {
    checkForKotsUpdates(appId: $appId)
  }
`
export const checkForKotsUpdates = gql(checkForKotsUpdatesRaw);