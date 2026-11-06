import type { Projects } from "../../types/Projects"
import type { TrimmedShows } from "../../types/Show"
import type { WorshipToolEvent, WorshipToolSong, WorshipToolSongSource } from "../../types/WorshipTool"

export function worshipToolServer(baseUrl: string): string {
    return new URL(baseUrl.trim()).toString().replace(/\/+$/, "")
}

export function worshipToolSongSource(song: WorshipToolSong, baseUrl: string): WorshipToolSongSource {
    return { server: worshipToolServer(baseUrl), songId: song.id, revision: song.revision || "", updatedAt: song.updated_at }
}

export interface WorshipToolImportSong {
    song: WorshipToolSong
    status: "new" | "reuse" | "changed"
    existingId?: string
}

export function buildWorshipToolImportPlan(event: WorshipToolEvent, baseUrl: string, library: TrimmedShows, projects: Projects) {
    const server = worshipToolServer(baseUrl)
    const existingProjectId = Object.entries(projects).find(([, project]) => !project.deleted && project.worshipTool?.server === server && project.worshipTool.eventId === event.id)?.[0]
    const unique = new Map<number, WorshipToolSong>()
    event.sections.forEach((section) => section.songs.forEach((entry) => unique.set(entry.song.id, entry.song)))
    const songs: WorshipToolImportSong[] = Array.from(unique.values()).map((song) => {
        const candidates = Object.entries(library).filter(([, show]) => {
            const source: WorshipToolSongSource | undefined = show.quickAccess?.worshipTool
            return source?.server === server && source.songId === song.id
        })
        const exact = candidates.find(([, show]) => show.quickAccess?.worshipTool.revision === song.revision)
        if (exact) return { song, status: "reuse", existingId: exact[0] }
        if (candidates.length) return { song, status: "changed", existingId: candidates[0][0] }
        return { song, status: "new" }
    })
    return { server, existingProjectId, songs }
}
