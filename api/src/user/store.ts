// @ts-ignore
import { addMinutes } from "date-fns";
import * as jaeger from "jaeger-client";
import * as randomstring from "randomstring";
import * as pg from "pg";
import { GithubNonceModel, ScmLeadModel } from "./models";

export class UserStoreOld {
  constructor(readonly pool: pg.Pool) {}

  async trackScmLead(ctx: jaeger.SpanContext, preference: string, email: string, provider: string): Promise<ScmLeadModel> {
    const id = randomstring.generate({ capitalization: "lowercase" });
    const currentTime = new Date(Date.now()).toUTCString();
    const q = `
      INSERT INTO
        track_scm_leads (id, deployment_type, email_address, scm_provider, created_at)
      VALUES ($1, $2, $3, $4, $5) RETURNING id
      `;
    const v = [id, preference, email, provider, currentTime];
    const { rows }: { rows: ScmLeadModel[] } = await this.pool.query(q, v);
    return rows[0];
  }

  async saveWatchContributor(ctx: jaeger.SpanContext, userId: String, id: String) {
    const q = "INSERT INTO user_watch (user_id, watch_id) VALUES ($1, $2)";

    const v = [userId, id];

    await this.pool.query(q, v);
  }

  async removeExistingWatchContributorsExcept(ctx: jaeger.SpanContext, id: string, userIdToExclude: string) {
    const q = `
    DELETE FROM
      user_watch
    WHERE
      watch_id = $1 AND
      user_id != $2
    `;

    const v = [id, userIdToExclude];

    await this.pool.query(q, v);
  }
}

export class GithubNonceStore {
  constructor(private readonly pool: pg.Pool) {}

  async createNonce(): Promise<GithubNonceModel> {
    const state = randomstring.generate({ capitalization: "lowercase" });

    const currentTime = new Date(Date.now()).toUTCString();

    const q = "INSERT INTO github_nonce (nonce, expire_at) VALUES ($1, $2) RETURNING nonce";
    const v = [state, addMinutes(currentTime, 10)];
    const { rows }: { rows: GithubNonceModel[] } = await this.pool.query(q, v);
    return rows[0];
  }

  async getNonce(nonce: string): Promise<GithubNonceModel> {
    const q = `SELECT * FROM github_nonce WHERE nonce = $1`;
    const v = [nonce];
    const { rows }: { rows: GithubNonceModel[] } = await this.pool.query(q, v);
    return rows[0];
  }

  async deleteNonce(nonce: string): Promise<void> {
    const q = `DELETE FROM github_nonce WHERE nonce = $1`;
    const v = [nonce];
    await this.pool.query(q, v);
  }
}