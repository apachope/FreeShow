import { get } from "svelte/store"
import { uid } from "uid"
import type { Project, ProjectShowRef } from "../../types/Projects"
import type { Show } from "../../types/Show"
import type { WorshipToolEvent } from "../../types/WorshipTool"
import { history } from "../components/helpers/history"
import { openProject } from "../components/show/project"
import { convertText } from "../converters/txt"
import { projects, shows } from "../stores"
import { buildWorshipToolImportPlan, worshipToolSongSource } from "./worshipToolImportPlan"

export function importWorshipToolEvent(event: WorshipToolEvent, baseUrl: string, copySongIds: number[] = []): string {
    const plan = buildWorshipToolImportPlan(event, baseUrl, get(shows), get(projects))
    if (plan.existingProjectId) {
        openProject(plan.existingProjectId, false)
        return plan.existingProjectId
    }
    if (!plan.songs.length) throw new Error("這份歌單沒有歌曲。")
    const ids = new Map<number, string>()
    const newShows: { id: string; show: Show }[] = []
    // Prepare everything before touching stores; reusing a song never changes its local content.
    for (const item of plan.songs) {
        if (item.existingId && (item.status !== "changed" || !copySongIds.includes(item.song.id))) {
            ids.set(item.song.id, item.existingId)
            continue
        }
        if (!item.song.content?.trim() || !item.song.revision) throw new Error(`歌曲「${item.song.name}」缺少歌詞或版本資訊，請重新載入。`)
        const converted = convertText({ name: item.song.name, text: item.song.content, category: null, origin: "亞太希望工程歌曲管理系統", returnData: true, worshipTool: worshipToolSongSource(item.song, baseUrl) })
        if (!converted || !Object.keys(converted.show.slides).length) throw new Error(`歌曲「${item.song.name}」無法轉成投影片。`)
        newShows.push(converted)
        ids.set(item.song.id, converted.id)
    }
    const refs: ProjectShowRef[] = []
    for (const section of [...event.sections].sort((a, b) => a.order - b.order)) {
        refs.push({ id: uid(), type: "section", name: section.name, notes: "", data: { worshipToolSectionId: section.id } })
        for (const entry of [...section.songs].sort((a, b) => a.order - b.order)) {
            refs.push({ id: ids.get(entry.song.id)!, type: "show", notes: entry.key_override ? `本場調性：${entry.key_override}` : "", data: { worshipToolEntryId: entry.entry_id } })
        }
    }
    const now = Date.now()
    const project: Project = { name: `${event.date} ${event.name}`, parent: "/", created: now, modified: now, shows: refs, origin: "亞太希望工程歌曲管理系統", worshipTool: { server: plan.server, eventId: event.id, revision: event.revision, importedAt: now } }
    const id = uid()
    if (newShows.length) history({ id: "SHOWS", newData: { data: newShows }, location: { page: "show" } })
    history({ id: "UPDATE", newData: { data: project }, oldData: { id }, location: { page: "show", id: "project" } })
    openProject(id, false)
    return id
}
