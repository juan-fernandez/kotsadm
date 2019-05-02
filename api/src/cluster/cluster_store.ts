import { Service } from "ts-express-decorators";
import { Params } from "../server/params";
import { PostgresWrapper, transaction } from "../util/persistence/db";
import * as jaeger from "jaeger-client";
import { ClusterItem, GitOpsRefInput } from "../generated/types";
import { ReplicatedError } from "../server/errors";
import * as randomstring from "randomstring";
import slugify from "slugify";
import * as _ from "lodash";
import { tracer } from "../server/tracing";

@Service()
export class ClusterStore {
  constructor(private readonly wrapper: PostgresWrapper, private readonly params: Params) {}

  async listClustersForGitHubRepo(ctx: jaeger.SpanContext, owner: string, repo: string): Promise<ClusterItem[]> {
    const q = `select cluster_id from cluster_github where owner = $1 and repo = $2`;
    const v = [
      owner,
      repo,
    ];

    const { rows }: { rows: any[] } = await this.wrapper.query(q, v);
    const clusterIds = rows.map(row => row.cluster_id);

    const clusters: ClusterItem[] = [];

    for (const clusterId of clusterIds) {
      clusters.push(await this.getGitOpsCluster(clusterId));
    }

    return clusters;
  }

  async getFromDeployToken(ctx: jaeger.SpanContext, token: string): Promise<ClusterItem> {
    const span: jaeger.SpanContext = tracer().startSpan("clusterStore.getFromDeployToken");

    const q = `select id from cluster where token = $1`;
    const v = [
      token,
    ];

    const { rows }: { rows: any[] } = await this.wrapper.query(q, v);
    const result = rows.map(row => this.mapCluster(row));

    return this.getCluster(span.context(), result[0].id!);
  }

  async getGitOpsCluster(clusterId: string, watchId?: string): Promise<ClusterItem> {
    const fields = ["id", "title", "slug", "created_at", "updated_at", "cluster_type", "owner", "repo", "branch"]
    if (watchId) {
      fields.push("wc.github_path");
    }
    const q = `
    select ${fields} from cluster
    inner join
      cluster_github on cluster_id = id
    ${watchId ? " left outer join watch_cluster as wc on wc.cluster_id = id where wc.cluster_id = $1 and watch_id = $2" : " where id = $1"}`;
    let v = [clusterId];
    if (watchId) {
      v.push(watchId);
    }

    const { rows }: { rows: any[] }  = await this.wrapper.query(q, v);

    return this.mapCluster(rows[0]);
  }

  async getLocalShipOpsCluster(): Promise<ClusterItem|void> {
    const q = `select id from cluster where cluster_type = $1 and title = $2`;
    const v = [
      "ship",
      "This Cluster",
    ];

    const result = await this.wrapper.query(q, v);
    if (result.rowCount === 0) {
      return;
    }

    return this.getShipOpsCluster(result.rows[0].id);
  }

  async getShipOpsCluster(clusterId: string): Promise<ClusterItem> {
    const q = `select id, title, slug, created_at, updated_at, token, cluster_type from cluster where id = $1`;
    const v = [clusterId];

    const { rows }: { rows: any[] }  = await this.wrapper.query(q, v);

    return this.mapCluster(rows[0]);
  }

  async listAllUsersClusters(ctx: jaeger.SpanContext): Promise<ClusterItem[]> {
    const q = `select id, cluster_type from cluster where is_all_users = true order by created_at, title`;
    const v = [];

    const { rows }: { rows: any[] }  = await this.wrapper.query(q, v);
    const clusters: ClusterItem[] = [];
    for (const row of rows) {
      if (row.cluster_type === "gitops") {
        clusters.push(await this.getGitOpsCluster(row.id));
      } else {
        clusters.push(await this.getShipOpsCluster(row.id));
      }
    }

    return clusters;
  }

  async listClusters(ctx: jaeger.SpanContext, userId: string): Promise<ClusterItem[]> {
    const q = `select id, cluster_type from cluster inner join user_cluster on cluster_id = id where user_cluster.user_id = $1 order by created_at, title`;
    const v = [userId];

    const { rows }: { rows: any[] }  = await this.wrapper.query(q, v);
    const clusters: ClusterItem[] = [];
    for (const row of rows) {
      if (row.cluster_type === "gitops") {
        clusters.push(await this.getGitOpsCluster(row.id));
      } else {
        clusters.push(await this.getShipOpsCluster(row.id));
      }
    }

    return clusters;
  }

  async getForWatch(ctx: jaeger.SpanContext, watchId: string): Promise<ClusterItem | void> {
    const q = `select cluster_id, cluster_type from watch_cluster inner join cluster on cluster_id = id where watch_id = $1`;
    const v = [watchId];

    const { rows }: { rows: any[] }  = await this.wrapper.query(q, v);
    if (rows.length === 0) {
      return;
    }
    let cluster: ClusterItem = {}
    if (rows[0].cluster_type === "gitops") {
      cluster = await this.getGitOpsCluster(rows[0].cluster_id, watchId);
    } else {
      cluster = await this.getShipOpsCluster(rows[0].cluster_id);
    }

    return cluster;
  }

  async getCluster(ctx: jaeger.SpanContext, id: string): Promise<ClusterItem> {
    const q = `select id, cluster_type from cluster where id = $1`;
    const v = [id];

    const { rows }: { rows: any[] }  = await this.wrapper.query(q, v);
    const result = rows.map(row => {
      if (row.cluster_type === "gitops") {
        return this.getGitOpsCluster(row.id);
      } else {
        return this.getShipOpsCluster(row.id);
      }
    });

    return result[0];
  }

  async addUserToCluster(ctx: jaeger.SpanContext, clusterId: string, userId: string): Promise<void> {
    const span: jaeger.SpanContext = tracer().startSpan("clusterStore.addUserToCluster");

    await this.wrapper.query("begin");

    try {
      let q = `delete from user_cluster where user_id = $1 and cluster_id = $2`;
      let v: any[] = [
        userId,
        clusterId,
      ];
      await this.wrapper.query(q, v);

      q = `insert into user_cluster (user_id, cluster_id) values ($1, $2)`;
      v = [
        userId,
        clusterId,
      ];
      await this.wrapper.query(q, v);

      await this.wrapper.query("commit");
    } catch (err) {
      await this.wrapper.query("rollback");
      throw err;
    }

    span.finish();
  }

  async createNewCluster(ctx: jaeger.SpanContext, userId: string|undefined, isAllUsers: boolean, title: string, type: string, gitOwner?: string, gitRepo?: string, gitBranch?: string, gitInstallationId?: number): Promise<ClusterItem> {
    const id = randomstring.generate({ capitalization: "lowercase" });

    const slugProposal = `${slugify(title, { lower: true })}`;

    let clusters;

    if (userId) {
      clusters = await this.listClusters(ctx, userId);
    } else {
      clusters = await this.listAllUsersClusters(ctx);
    }

    const existingSlugs = clusters.map(cluster => cluster.slug);
    let finalSlug = slugProposal;

    if (_.includes(existingSlugs, slugProposal)) {
      const maxNumber =
        _(existingSlugs)
          .map(slug => {
            const result = slug!.replace(slugProposal, "").replace("-", "");

            return result ? parseInt(result, 10) : 0;
          })
          .max() || 0;

      finalSlug = `${slugProposal}-${maxNumber + 1}`;
    }

    await transaction(this.wrapper, async (client: PostgresWrapper) => {
      let q = `insert into cluster (id, title, slug, created_at, updated_at, cluster_type, is_all_users) values ($1, $2, $3, $4, $5, $6, $7)`
      let v: any[] = [
        id,
        title,
        finalSlug,
        new Date(),
        null,
        type,
        isAllUsers,
      ];
      await client.query(q, v);

      if (type === "ship") {
        const token = randomstring.generate({ capitalization: "lowercase" });
        q = `update cluster set token = $1 where id = $2`;
        v = [
          token,
          id,
        ];
        await client.query(q, v);
      } else if (type === "gitops") {
        q = `insert into cluster_github (cluster_id, owner, repo, branch, installation_id) values ($1, $2, $3, $4, $5)`;
        v = [
          id,
          gitOwner!,
          gitRepo!,
          gitBranch!,
          gitInstallationId!,
        ];
        await client.query(q, v);
      }

      if (userId) {
        q = `insert into user_cluster (user_id, cluster_id) values ($1, $2)`;
        v = [
          userId,
          id,
        ];
        await client.query(q, v);
      }
    });

    return this.getCluster(ctx, id);
  }

  async getShipInstallationManifests(ctx: jaeger.SpanContext, clusterId: string): Promise<string> {
    const cluster = await this.getShipOpsCluster(clusterId);

    const manifests = `
apiVersion: v1
kind: List
items:
  - apiVersion: v1
    kind: Namespace
    metadata:
      labels:
        control-plane: controller-manager
        controller-tools.k8s.io: "1.0"
      name: ship-cd-system
  - apiVersion: apiextensions.k8s.io/v1beta1
    kind: CustomResourceDefinition
    metadata:
      creationTimestamp: null
      labels:
        controller-tools.k8s.io: "1.0"
      name: clusters.clusters.replicated.com
    spec:
      group: clusters.replicated.com
      names:
        kind: Cluster
        plural: clusters
      scope: Namespaced
      validation:
        openAPIV3Schema:
          properties:
            apiVersion:
              description: 'APIVersion defines the versioned schema of this representation
                of an object. Servers should convert recognized schemas to the latest
                internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/api-conventions.md#resources'
              type: string
            kind:
              description: 'Kind is a string value representing the REST resource this
                object represents. Servers may infer this from the endpoint the client
                submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/api-conventions.md#types-kinds'
              type: string
            metadata:
              type: object
            spec:
              properties:
                shipApiServer:
                  type: string
                token:
                  type: string
              required:
              - shipApiServer
              - token
              type: object
            status:
              type: object
      version: v1alpha1
    status:
      acceptedNames:
        kind: ""
        plural: ""
      conditions: []
      storedVersions: []
  - apiVersion: rbac.authorization.k8s.io/v1
    kind: ClusterRole
    metadata:
      creationTimestamp: null
      name: ship-cd-manager-role
    rules:
    - apiGroups: ['*']
      resources: ['*']
      verbs: ['*']
    - nonResourceURLs: ['*']
      verbs: ['*']
  - apiVersion: rbac.authorization.k8s.io/v1
    kind: ClusterRole
    metadata:
      name: ship-cd-proxy-role
    rules:
    - apiGroups:
      - authentication.k8s.io
      resources:
      - tokenreviews
      verbs:
      - create
    - apiGroups:
      - authorization.k8s.io
      resources:
      - subjectaccessreviews
      verbs:
      - create
  - apiVersion: rbac.authorization.k8s.io/v1
    kind: ClusterRoleBinding
    metadata:
      creationTimestamp: null
      name: ship-cd-manager-rolebinding
    roleRef:
      apiGroup: rbac.authorization.k8s.io
      kind: ClusterRole
      name: ship-cd-manager-role
    subjects:
    - kind: ServiceAccount
      name: default
      namespace: ship-cd-system
  - apiVersion: rbac.authorization.k8s.io/v1
    kind: ClusterRoleBinding
    metadata:
      name: ship-cd-proxy-rolebinding
    roleRef:
      apiGroup: rbac.authorization.k8s.io
      kind: ClusterRole
      name: ship-cd-proxy-role
    subjects:
    - kind: ServiceAccount
      name: default
      namespace: ship-cd-system
  - apiVersion: v1
    kind: Secret
    metadata:
      name: ship-cd-webhook-server-secret
      namespace: ship-cd-system
  - apiVersion: v1
    kind: Service
    metadata:
      annotations:
        prometheus.io/port: "8443"
        prometheus.io/scheme: https
        prometheus.io/scrape: "true"
      labels:
        control-plane: controller-manager
        controller-tools.k8s.io: "1.0"
      name: ship-cd-controller-manager-metrics-service
      namespace: ship-cd-system
    spec:
      ports:
      - name: https
        port: 8443
        targetPort: https
      selector:
        control-plane: controller-manager
        controller-tools.k8s.io: "1.0"
  - apiVersion: v1
    kind: Service
    metadata:
      labels:
        control-plane: controller-manager
        controller-tools.k8s.io: "1.0"
      name: ship-cd-controller-manager-service
      namespace: ship-cd-system
    spec:
      ports:
      - port: 443
      selector:
        control-plane: controller-manager
        controller-tools.k8s.io: "1.0"
  - apiVersion: apps/v1
    kind: StatefulSet
    metadata:
      labels:
        control-plane: controller-manager
        controller-tools.k8s.io: "1.0"
      name: ship-cd-controller-manager
      namespace: ship-cd-system
    spec:
      selector:
        matchLabels:
          control-plane: controller-manager
          controller-tools.k8s.io: "1.0"
      serviceName: ship-cd-controller-manager-service
      template:
        metadata:
          labels:
            control-plane: controller-manager
            controller-tools.k8s.io: "1.0"
        spec:
          containers:
          - args:
            - --secure-listen-address=0.0.0.0:8443
            - --upstream=http://127.0.0.1:8080/
            - --logtostderr=true
            - --v=10
            image: gcr.io/kubebuilder/kube-rbac-proxy:v0.4.0
            name: kube-rbac-proxy
            ports:
            - containerPort: 8443
              name: https
          - args:
            - --metrics-addr=127.0.0.1:8080
            command:
            - /manager
            env:
            - name: POD_NAMESPACE
              valueFrom:
                fieldRef:
                  fieldPath: metadata.namespace
            - name: SECRET_NAME
              value: ship-cd-webhook-server-secret
            image: replicated/ship-cd:latest
            imagePullPolicy: Always
            name: manager
            ports:
            - containerPort: 9876
              name: webhook-server
              protocol: TCP
            resources:
              limits:
                cpu: 100m
                memory: 500Mi
              requests:
                cpu: 100m
                memory: 500Mi
            volumeMounts:
            - mountPath: /tmp/cert
              name: cert
              readOnly: true
          terminationGracePeriodSeconds: 10
          volumes:
          - name: cert
            secret:
              defaultMode: 420
              secretName: ship-cd-webhook-server-secret
  - apiVersion: clusters.replicated.com/v1alpha1
    kind: Cluster
    metadata:
      labels:
        controller-tools.k8s.io: "1.0"
      name: ${slugify(cluster.title!, { lower: true })}
    spec:
      shipApiServer: ${this.params.apiAdvertiseEndpoint}
      token: ${cluster.shipOpsRef!.token}
`;

    return manifests;
  }

  async updateCluster(ctx: jaeger.SpanContext, userId: string, clusterId: string, clusterName: string, gitOpsRef: GitOpsRefInput | null): Promise<boolean> {
    const slugProposal = `${slugify(clusterName, { lower: true })}`;
    const clusters = await this.listClusters(ctx, userId);
    const existingSlugs = clusters.map(cluster => cluster.slug);
    let finalSlug = slugProposal;

    if (_.includes(existingSlugs, slugProposal)) {
      const maxNumber =
        _(existingSlugs)
          .map(slug => {
            const result = slug!.replace(slugProposal, "").replace("-", "");

            return result ? parseInt(result, 10) : 0;
          })
          .max() || 0;

      finalSlug = `${slugProposal}-${maxNumber + 1}`;
    }

    const q = `update cluster set title = $1, slug = $2, updated_at = $3 where id = $4`;
    const v = [clusterName, finalSlug, new Date(), clusterId];
    await this.wrapper.query(q, v);

    if (gitOpsRef) {
      const q = `update cluster_github set owner = $1, repo = $2, branch = $3 where cluster_id = $4`;
      const v = [gitOpsRef.owner, gitOpsRef.repo, gitOpsRef.branch, clusterId];
      await this.wrapper.query(q, v);
    }

    return true;
  }

  async getApplicationCount(clusterId: string): Promise<number> {
    const q = `select count(1) as count from watch_cluster where cluster_id = $1`;
    const v = [clusterId];
    const { rows }: { rows: any[] }  = await this.wrapper.query(q, v);

    return rows[0].count;
  }

  async deleteCluster(ctx: jaeger.SpanContext, userId: string, clusterId: string): Promise<boolean> {
    const q = `select count(1) as count from watch_cluster where cluster_id = $1`;
    const v = [clusterId];
    const { rows }: { rows: any[] }  = await this.wrapper.query(q, v);

    if (rows[0].count > 0) {
      throw new ReplicatedError("This cluster has applications deployed to it so it cannot be deleted.");
    }

    try {
      const cluster = await this.getCluster(ctx, clusterId);

      let q = `delete from cluster where id = $1`;
      let v = [clusterId];
      await this.wrapper.query(q, v);

      q = `delete from user_cluster where user_id = $1 and cluster_id = $2`;
      v = [userId, clusterId];
      await this.wrapper.query(q, v);

      if (cluster.gitOpsRef) {
        const q = `delete from cluster_github where cluster_id = $1`;
        const v = [clusterId];
        await this.wrapper.query(q, v);
      }

      await this.wrapper.query("commit");
    } catch (err) {
      await this.wrapper.query("rollback");
      throw err;
    }

    return true;
  }

  private mapCluster(row: any): ClusterItem {
    let gitOpsRef, shipOpsRef: any = null
    if (row.token) {
      shipOpsRef = {
        token: row.token
      }
    }
    if (row.cluster_type === "gitops") {
      gitOpsRef = {
        owner: row.owner,
        repo: row.repo,
        branch: row.branch,
        path: row.github_path || "",
      }
    }
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      createdOn: row.created_at,
      lastUpdated: row.updated_at,
      gitOpsRef,
      shipOpsRef
    };
  }
}