import randomstring from "randomstring";
import Cron from "cron-converter";
import { Pool } from "pg";
import { logger } from "../server/logger";
import { getPostgresPool } from "../util/persistence/db";
import { backup } from "./backup";
import { KotsApp } from "../kots_app/kots_app";
import { Stores } from "../schema/stores";
import { ScheduledSnapshot } from "./snapshot";

export class SnapshotScheduler {
  constructor(
    private stores: Stores,
    private pool: Pool,
  ) {}
  
  run() {
    setInterval(this.scheduleLoop.bind(this), 60000);
  }

  async scheduleLoop() {
    logger.debug("Snapshot scheduler loop is running");
    try {
      const apps = await this.stores.kotsAppStore.listApps();
      for (const app of apps) {
        if (app.restoreInProgressName) {
          continue;
        }
        await this.handleApp(app);
      }
    } catch (e) {
      logger.error(e);
    }
  }

  async handleApp(app: KotsApp) {
    if (!app.snapshotSchedule) {
      return;
    }
    const [next] = await this.stores.snapshotsStore.listPendingScheduledSnapshots(app.id);
    if (!next) {
      logger.warn(`No pending snapshots scheduled for app ${app.id} with schedule ${app.snapshotSchedule}. Queueing one.`);
      const queued = nextScheduled(app.id, app.snapshotSchedule);
      await this.stores.snapshotsStore.createScheduledSnapshot(queued);
      return;
    }
    if (new Date(next.scheduledTimestamp).valueOf() > Date.now()) {
      logger.debug(`Not yet time to snapshot app ${app.id}`);
      return;
    }

    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      logger.info(`Acquiring lock on scheduled snapshot ${next.id}`);
      const acquiredLock = await this.stores.snapshotsStore.lockScheduledSnapshot(client, next.id);
      if (!acquiredLock) {
        logger.info(`Failed to lock scheduled snapshot ${next.id}`);
        client.query("ROLLBACK");
        return;
      }

      const b = await backup(this.stores, app.id, true);
      await this.stores.snapshotsStore.updateScheduledSnapshot(client, next.id, b.metadata.name!);
      logger.info(`Created backup ${b.metadata.name} from scheduled snapshot ${next.id}`);

      const queued = nextScheduled(app.id, app.snapshotSchedule);
      await this.stores.snapshotsStore.createScheduledSnapshot(queued, client);
      logger.info(`Scheduled next snapshot ${queued.id}`);

      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
};

export function nextScheduled(appId: string, cronExpression: string): ScheduledSnapshot {
  const cron = new Cron();

  return {
    appId,
    id: randomstring.generate({ capitalization: "lowercase" }),
    scheduledTimestamp: cron.fromString(cronExpression).schedule().next(),
  };
}
