import type { Projects } from "../../types/Projects"
import type { TrimmedShows } from "../../types/Show"
import type { WorshipToolEvent, WorshipToolSong, WorshipToolSongSource } from "../../types/WorshipTool"

export function worshipToolServer(baseUrl: string): string {
    return new URL(baseUrl.trim()).toString().replace(/\/+$/, "")
}

export function worshipToolSongSource(song: WorshipToolSong, baseUrl: string, maxLines?: number): WorshipToolSongSource {
    return { server: worshipToolServer(baseUrl), songId: song.id, revision: song.revision || "", updatedAt: song.updated_at, ...(maxLines === undefined ? {} : { maxLines }) }
}

export interface WorshipToolImportSong {
    song: WorshipToolSong
    status: "new" | "reuse" | "changed"
    existingId?: string
}

export function buildWorshipToolImportPlan(event: WorshipToolEvent, baseUrl: string, library: TrimmedShows, projects: Projects, maxLines?: number) {
    const server = worshipToolServer(baseUrl)
    const existingProjectId = Object.entries(projects).find(([, project]) => !project.deleted && project.worshipTool?.server === server && project.worshipTool.eventId === event.id && (maxLines === undefined || project.worshipTool.maxLines === maxLines))?.[0]
    const unique = new Map<number, WorshipToolSong>()
    event.sections.forEach((section) => section.songs.forEach((entry) => unique.set(entry.song.id, entry.song)))
    const songs: WorshipToolImportSong[] = Array.from(unique.values()).map((song) => {
        const candidates = Object.entries(library).filter(([, show]) => {
            const source: WorshipToolSongSource | undefined = show.quickAccess?.worshipTool
            return source?.server === server && source.songId === song.id
        })
        const matchingRevision = candidates.filter(([, show]) => show.quickAccess?.worshipTool.revision === song.revision)
        const exact = matchingRevision.find(([, show]) => maxLines !== undefined && (show.quickAccess?.worshipTool.layouts?.[String(maxLines)] || show.quickAccess?.worshipTool.maxLines === maxLines)) || matchingRevision[0]
        if (exact) return { song, status: "reuse", existingId: exact[0] }
        if (candidates.length) return { song, status: "changed", existingId: candidates[0][0] }
        return { song, status: "new" }
    })
    return { server, existingProjectId, songs }
}

export function validateWorshipToolMaxLines(value: number): number {
    if (!Number.isInteger(value) || value < 1 || value > 100) throw new Error("每頁最多行數需為 1–100 的整數。")
    return value
}
