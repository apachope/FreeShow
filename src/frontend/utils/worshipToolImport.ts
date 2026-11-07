import { get } from "svelte/store"
import { uid } from "uid"
import type { Project, ProjectShowRef } from "../../types/Projects"
import type { Show } from "../../types/Show"
import type { WorshipToolEvent } from "../../types/WorshipTool"
import { history } from "../components/helpers/history"
import { loadShows } from "../components/helpers/setShow"
import { openProject } from "../components/show/project"
import { convertText } from "../converters/txt"
import { projects, shows, showsCache } from "../stores"
import { appendWorshipToolPagination, findWorshipToolLayout, worshipToolLocalLyrics } from "./worshipToolPagination"
import { buildWorshipToolImportPlan, validateWorshipToolMaxLines, worshipToolSongSource } from "./worshipToolImportPlan"

export async function importWorshipToolEvent(event: WorshipToolEvent, baseUrl: string, copySongIds: number[] = [], maxLines = 2, isCancelled = () => false): Promise<string> {
    validateWorshipToolMaxLines(maxLines)
    let plan = buildWorshipToolImportPlan(event, baseUrl, get(shows), get(projects), maxLines)
    if (plan.existingProjectId) {
        openProject(plan.existingProjectId, false)
        return plan.existingProjectId
    }
    if (!plan.songs.length) throw new Error("這份歌單沒有歌曲。")
    await loadShows(
        plan.songs.filter((item) => item.existingId && (item.status !== "changed" || !copySongIds.includes(item.song.id))).map((item) => item.existingId!),
        true
    )
    if (isCancelled()) throw new Error("已取消匯入。")
    plan = buildWorshipToolImportPlan(event, baseUrl, get(shows), get(projects), maxLines)
    if (plan.existingProjectId) {
        openProject(plan.existingProjectId, false)
        return plan.existingProjectId
    }
    const ids = new Map<number, string>()
    const layoutIds = new Map<number, string>()
    const updates: { id: string; show: Show }[] = []
    const projectUpdates = new Map<string, ProjectShowRef[]>()
    const newShows: { id: string; show: Show }[] = []
    // Prepare every conversion before writing; existing slides are never replaced.
    for (const item of plan.songs) {
        if (item.existingId && (item.status !== "changed" || !copySongIds.includes(item.song.id))) {
            const local = get(showsCache)[item.existingId]
            if (!local) throw new Error(`無法讀取本機曲目「${item.song.name}」，請重試。`)
            let layoutId = findWorshipToolLayout(local, maxLines)
            if (!layoutId) {
                if (local.locked) throw new Error(`曲目「${local.name}」已鎖定，無法新增版型。`)
                const text = worshipToolLocalLyrics(local)
                if (!text.trim()) throw new Error(`本機曲目「${local.name}」沒有可分頁的歌詞。`)
                const converted = convertText({ name: local.name, text, category: local.category, returnData: true, noFormatting: true, maxLines })
                if (!converted || !Object.keys(converted.show.slides).length) throw new Error(`曲目「${local.name}」無法建立版型。`)
                const appended = appendWorshipToolPagination(local, converted.show, maxLines)
                layoutId = appended.layoutId
                updates.push({ id: item.existingId, show: appended.show })
                // Pin legacy project references before this shared song gains other layouts.
                for (const [projectId, project] of Object.entries(get(projects))) {
                    if (project.deleted) continue
                    const refs = projectUpdates.get(projectId) || project.shows
                    if (!refs.some((ref) => ref.id === item.existingId && !ref.layout && (!ref.type || ref.type === "show"))) continue
                    projectUpdates.set(
                        projectId,
                        refs.map((ref) => (ref.id === item.existingId && !ref.layout && (!ref.type || ref.type === "show") ? { ...ref, layout: local.settings.activeLayout, layoutInfo: { name: local.layouts[local.settings.activeLayout]?.name || "" } } : ref))
                    )
                }
            }
            ids.set(item.song.id, item.existingId)
            layoutIds.set(item.song.id, layoutId)
            continue
        }
        if (!item.song.content?.trim() || !item.song.revision) throw new Error(`歌曲「${item.song.name}」缺少歌詞或版本資訊，請重新載入。`)
        const converted = convertText({ name: item.song.name, text: item.song.content, category: null, origin: "亞太希望工程歌曲管理系統", returnData: true, worshipTool: worshipToolSongSource(item.song, baseUrl), maxLines })
        if (!converted || !Object.keys(converted.show.slides).length) throw new Error(`歌曲「${item.song.name}」無法轉成投影片。`)
        const layoutId = converted.show.settings.activeLayout
        converted.show.layouts[layoutId].name = `每頁 ${maxLines} 行`
        converted.show.quickAccess.worshipTool.layouts = { [String(maxLines)]: layoutId }
        newShows.push(converted)
        ids.set(item.song.id, converted.id)
        layoutIds.set(item.song.id, layoutId)
    }
    const refs: ProjectShowRef[] = []
    for (const section of [...event.sections].sort((a, b) => a.order - b.order)) {
        refs.push({ id: uid(), type: "section", name: section.name, notes: "", data: { worshipToolSectionId: section.id } })
        for (const entry of [...section.songs].sort((a, b) => a.order - b.order)) {
            refs.push({ id: ids.get(entry.song.id)!, type: "show", layout: layoutIds.get(entry.song.id), layoutInfo: { name: `每頁 ${maxLines} 行` }, notes: entry.key_override ? `本場調性：${entry.key_override}` : "", data: { worshipToolEntryId: entry.entry_id } })
        }
    }
    const now = Date.now()
    const project: Project = { name: `${event.date} ${event.name}`, parent: "/", created: now, modified: now, shows: refs, origin: "亞太希望工程歌曲管理系統", worshipTool: { server: plan.server, eventId: event.id, revision: event.revision, importedAt: now, maxLines } }
    const id = uid()
    if (isCancelled()) throw new Error("已取消匯入。")
    for (const [projectId, refs] of projectUpdates) history({ id: "UPDATE", newData: { key: "shows", data: refs }, oldData: { id: projectId }, location: { page: "show", id: "project_key" } })
    for (const update of updates) history({ id: "SHOWS", newData: { data: [update], replace: true }, location: { page: "show" } })
    if (newShows.length) history({ id: "SHOWS", newData: { data: newShows }, location: { page: "show" } })
    history({ id: "UPDATE", newData: { data: project }, oldData: { id }, location: { page: "show", id: "project" } })
    openProject(id, false)
    return id
}
