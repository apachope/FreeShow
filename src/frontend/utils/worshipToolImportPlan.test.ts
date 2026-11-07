import { describe, expect, it } from "vitest"
import type { Project } from "../../types/Projects"
import type { TrimmedShow } from "../../types/Show"
import type { WorshipToolEvent } from "../../types/WorshipTool"
import { buildWorshipToolImportPlan, validateWorshipToolMaxLines, worshipToolSongSource } from "./worshipToolImportPlan"

const song = { id: 10, name: "愛祢", content: "[主歌]\n歌詞", revision: "new", updated_at: "2026-11-07" }
const event: WorshipToolEvent = {
    id: 1,
    name: "主日",
    date: "2026-11-08",
    revision: "event-v1",
    sections: [
        { id: 2, name: "敬拜", order: 1, songs: [{ entry_id: 1, order: 1, key_override: "", song }] },
        { id: 3, name: "回應", order: 2, songs: [{ entry_id: 2, order: 2, key_override: "G", song }] }
    ]
}
const server = "https://lyrics.apachope.org"
const local = (revision = "new", url = server) => ({ name: song.name, quickAccess: { worshipTool: worshipToolSongSource({ ...song, revision }, url) } }) as TrimmedShow

describe("playlist import planning", () => {
    it("creates one library song for repeated entries without mutating playlist order", () => {
        const original = JSON.stringify(event)
        const plan = buildWorshipToolImportPlan(event, server, {}, {})
        expect(plan.songs).toHaveLength(1)
        expect(plan.songs[0].status).toBe("new")
        expect(JSON.stringify(event)).toBe(original)
    })
    it("reuses identity and revision even when local name or lyrics were changed", () => {
        expect(buildWorshipToolImportPlan(event, server + "/", { local: { ...local(), name: "本機改名" } }, {}).songs[0]).toMatchObject({ status: "reuse", existingId: "local" })
    })
    it("flags source changes and never treats same-name songs or other servers as the same identity", () => {
        expect(buildWorshipToolImportPlan(event, server, { local: local("old") }, {}).songs[0].status).toBe("changed")
        expect(buildWorshipToolImportPlan(event, server, { local: local("new", "https://other.org") }, {}).songs[0].status).toBe("new")
        expect(buildWorshipToolImportPlan(event, server, { local: { name: song.name } as TrimmedShow }, {}).songs[0].status).toBe("new")
    })
    it("prefers an already imported new revision over an older copy", () => {
        expect(buildWorshipToolImportPlan(event, server, { old: local("old"), latest: local() }, {}).songs[0].existingId).toBe("latest")
    })
    it("blocks duplicate event import regardless of event revision, but allows deleted projects", () => {
        const project = { worshipTool: { server, eventId: 1, revision: "old", importedAt: 1 } } as Project
        expect(buildWorshipToolImportPlan(event, server, {}, { project }).existingProjectId).toBe("project")
        expect(buildWorshipToolImportPlan(event, server, {}, { project: { ...project, deleted: true } }).existingProjectId).toBeUndefined()
    })
})

describe("playlist pagination settings", () => {
    const paged = (maxLines: number, revision = "new") => ({ name: song.name, quickAccess: { worshipTool: worshipToolSongSource({ ...song, revision }, server, maxLines) } }) as TrimmedShow
    it("reuses song identity across line limits, preferring a matching existing layout", () => {
        const library = { two: paged(2), one: paged(1) }
        expect(buildWorshipToolImportPlan(event, server, library, {}, 2).songs[0].existingId).toBe("two")
        expect(buildWorshipToolImportPlan(event, server, library, {}, 1).songs[0].existingId).toBe("one")
        expect(buildWorshipToolImportPlan(event, server, library, {}, 3).songs[0]).toMatchObject({ status: "reuse", existingId: "two" })
    })
    it("reuses legacy or search-created songs without assuming their pagination", () => {
        expect(buildWorshipToolImportPlan(event, server, { legacy: local() }, {}, 2).songs[0]).toMatchObject({ status: "reuse", existingId: "legacy" })
    })
    it("only opens a duplicate project with matching line limits", () => {
        const project = { worshipTool: { server, eventId: 1, revision: "old", importedAt: 1, maxLines: 2 } } as Project
        expect(buildWorshipToolImportPlan(event, server, {}, { project }, 2).existingProjectId).toBe("project")
        expect(buildWorshipToolImportPlan(event, server, {}, { project }, 1).existingProjectId).toBeUndefined()
    })
    it("prefers the current song revision even if another pagination must be added", () => {
        const library = { one: paged(1), two: paged(2, "old") }
        expect(buildWorshipToolImportPlan(event, server, library, {}, 2).songs[0]).toMatchObject({ status: "reuse", existingId: "one" })
        expect(buildWorshipToolImportPlan(event, server, library, {}, 1).songs[0]).toMatchObject({ status: "reuse", existingId: "one" })
    })
})

it("validates line limits before any import writes", () => {
    for (const value of [0, -1, 1.5, 101, NaN, Infinity]) expect(() => validateWorshipToolMaxLines(value)).toThrow()
    for (const value of [1, 2, 100]) expect(validateWorshipToolMaxLines(value)).toBe(value)
})
