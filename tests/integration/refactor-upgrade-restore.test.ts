import { Database } from "bun:sqlite";
import { expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { copyFileSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { toOrmHandle } from "../../src/server/db/connection";
import { ConversationEventRepository } from "../../src/server/db/conversation-event-repository";
import { KnowledgeRepository } from "../../src/server/db/knowledge-repository";
import { createQqScheme } from "../../src/server/db/qq-scheme-repository";
import { recordQqSend } from "../../src/server/db/qq-send-repository";
import { updateQqSettings } from "../../src/server/db/qq-settings-repository";
import {
  createSession,
  DEFAULT_AGENT_ID,
  nowIso,
  prepareTurn,
  saveCompletedAssistantMessage,
} from "../../src/server/db/repositories";
import * as schema from "../../src/server/db/schema";
import {
  BUSINESS_MIGRATION_FILES,
  BUSINESS_SCHEMA_VERSION,
  openBusinessDb,
} from "../../src/server/db/schema-gate";

const digest = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");
const quoted = (name: string) => `"${name.replaceAll('"', '""')}"`;

it("upgrades a backed-up v38 source database without changing old facts and restores the exact backup", () => {
  const dir = mkdtempSync(path.join(realpathSync(tmpdir()), "superstring-refactor-restore-"));
  const original = path.join(dir, "v38.sqlite");
  const backup = path.join(dir, "backup.sqlite");
  const upgraded = path.join(dir, "upgraded.sqlite");
  const restored = path.join(dir, "restored.sqlite");
  let oldDb: Database | undefined;
  let next: ReturnType<typeof openBusinessDb> | undefined;
  try {
    oldDb = new Database(original);
    oldDb.exec("PRAGMA foreign_keys=ON");
    for (const file of BUSINESS_MIGRATION_FILES.slice(0, 38)) {
      oldDb.exec(
        readFileSync(path.join(import.meta.dir, "../../migrations/versions", file), "utf8"),
      );
    }
    oldDb.exec("PRAGMA user_version=38");
    const handle = toOrmHandle(oldDb);
    const session = createSession(handle.orm, "升级保留样例", { modelName: "fixture" });
    const prepared = prepareTurn(handle.orm, session.id, "完整原始提问", "stable-request");
    if (!prepared.generationToken) throw new Error("Missing fixture generation lease");
    saveCompletedAssistantMessage(
      handle.orm,
      session.id,
      "完整原始回答",
      "stable-request",
      prepared.generationToken,
    );
    const knowledge = new KnowledgeRepository(oldDb);
    const document = knowledge.importDocument({
      category_id: "default",
      name: "原文与授权",
      original_text: "第一行\n第二行：不能截断。",
    });
    knowledge.replaceGrants(document.id, document.revision, [DEFAULT_AGENT_ID]);
    updateQqSettings(handle.orm, { accountId: "10001", enabled: true, expectedRevision: 1 });
    const scheme = createQqScheme(handle.orm, {
      name: "所有触发保留",
      triggers: { direct_reply: true, follow_up: true, chiming_in: true, idle_topic: true },
    });
    const bindingId = crypto.randomUUID();
    const now = nowIso();
    const seconds = Math.floor(Date.now() / 1000);
    handle.orm
      .insert(schema.qqBindings)
      .values({
        id: bindingId,
        accountId: "10001",
        conversationKind: "private",
        peerId: "20002",
        agentId: DEFAULT_AGENT_ID,
        schemeId: scheme.id,
        paused: 0,
        shareWebMemory: 0,
        revision: 1,
        authorityRevision: 1,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    handle.orm
      .insert(schema.qqEvents)
      .values({
        eventKey: "fixed-inbound",
        accountId: "10001",
        conversationKind: "private",
        peerId: "20002",
        agentId: DEFAULT_AGENT_ID,
        messageId: "platform-inbound",
        occurredAtSeconds: seconds,
        speakerKind: "member",
        speakerId: "20002",
        addressed: 1,
        recordedAt: now,
      })
      .run();
    oldDb
      .query(
        "INSERT INTO qq_observation_text(event_key,body,occurred_at_seconds,expires_at,recorded_at) VALUES(?,?,?,?,?)",
      )
      .run(
        "fixed-inbound",
        "私聊原文",
        seconds,
        new Date(Date.now() + 14 * 86400_000).toISOString(),
        now,
      );
    recordQqSend(handle.orm, {
      scope: {
        kind: "qq",
        accountId: "10001",
        conversationKind: "private",
        peerId: "20002",
        agentId: DEFAULT_AGENT_ID,
      },
      kind: "direct_reply",
      parts: [{ kind: "text", result: "confirmed", messageId: "platform-confirmed" }],
      text: "已确认回复",
      sentAtSeconds: seconds,
    });

    // Select only baseline columns when comparing: new columns are additive, not lost facts.
    const fixtureDb = oldDb;
    const baseline = (
      oldDb
        .query(
          "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
        )
        .all() as { name: string }[]
    ).map(({ name }) => {
      const columns = (
        fixtureDb.query(`PRAGMA table_info(${quoted(name)})`).all() as { name: string }[]
      ).map((r) => r.name);
      const sql = `SELECT ${columns.map(quoted).join(",")} FROM ${quoted(name)}`;
      return {
        name,
        sql,
        rows: fixtureDb
          .query(sql)
          .all()
          .map((row) => JSON.stringify(row))
          .sort(),
      };
    });
    oldDb.close();
    oldDb = undefined;
    copyFileSync(original, backup);
    copyFileSync(backup, upgraded);
    const beforeHash = digest(backup);
    next = openBusinessDb({ path: upgraded });
    expect(next.db.query("PRAGMA user_version").get()).toEqual({
      user_version: BUSINESS_SCHEMA_VERSION,
    });
    expect(next.db.query("PRAGMA foreign_key_check").all()).toEqual([]);
    for (const table of baseline)
      expect({
        table: table.name,
        rows: next.db
          .query(table.sql)
          .all()
          .map((row) => JSON.stringify(row))
          .sort(),
      }).toEqual({ table: table.name, rows: table.rows });
    const journal = new ConversationEventRepository(next.db);
    journal.backfill();
    const conversation = journal.ensureWeb(session.id);
    if (!conversation) throw new Error("Missing migrated conversation");
    expect(journal.eventsAfter(conversation.id).items.map((e) => e.kind)).toEqual([
      "inbound",
      "outbound",
    ]);
    const first = next.db
      .query("SELECT * FROM conversation_events ORDER BY conversation_id,seq")
      .all();
    journal.backfill();
    expect(
      next.db.query("SELECT * FROM conversation_events ORDER BY conversation_id,seq").all(),
    ).toEqual(first);
    expect(next.db.query("SELECT count(*) AS n FROM agent_runs").get()).toEqual({ n: 0 });
    next.close();
    next = undefined;
    copyFileSync(backup, restored);
    expect(digest(backup)).toBe(beforeHash);
    expect(digest(restored)).toBe(digest(original));
    const restoredDb = new Database(restored, { readonly: true });
    try {
      expect(restoredDb.query("PRAGMA user_version").get()).toEqual({ user_version: 38 });
    } finally {
      restoredDb.close();
    }
  } finally {
    oldDb?.close();
    next?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
