import type { Show } from "../../types/Show"
import type { WorshipToolSongSource } from "../../types/WorshipTool"

export function findWorshipToolLayout(show: Show, maxLines: number): string | undefined {
    const source: WorshipToolSongSource | undefined = show.quickAccess?.worshipTool
    const id = source?.layouts?.[String(maxLines)]
    if (id && show.layouts[id]) return id
    // Older imports created only one layout and recorded its line limit.
    const ids = Object.keys(show.layouts)
    if (!source?.layouts && source?.maxLines === maxLines && ids.length === 1) return ids[0]
    return undefined
}

/** Convert local lyric text into input for FreeShow's existing text importer. */
export function worshipToolLocalLyrics(show: Show): string {
    const layout = show.layouts[show.settings.activeLayout] || Object.values(show.layouts)[0]
    return (layout?.slides || [])
        .filter((ref) => !ref.disabled)
        .map((ref) => {
            const parent = show.slides[ref.id]
            if (!parent) return ""
            const lines = [ref.id, ...(parent.children || [])]
                .filter((id) => !ref.children?.[id]?.disabled)
                .flatMap((id) => (show.slides[id]?.items || []).filter((item) => !item.type || item.type === "text").flatMap((item) => (item.lines || []).map((line) => line.text.map((part) => part.value).join(""))))
                .filter((line) => line.trim())
            return lines.length ? `[${parent.group || "歌詞"}]\n${lines.join("\n")}` : ""
        })
        .filter(Boolean)
        .join("\n\n")
}

/** Merge an ordinary converted layout without modifying existing slides or layout selection. */
export function appendWorshipToolPagination(show: Show, converted: Show, maxLines: number): { show: Show; layoutId: string } {
    const layoutId = converted.settings.activeLayout
    const source: WorshipToolSongSource | undefined = show.quickAccess?.worshipTool
    if (!source || !converted.layouts[layoutId]) throw new Error("缺少歌曲來源或版型資料。")
    const mappings = { ...source.layouts }
    if (!source.layouts && source.maxLines !== undefined && Object.keys(show.layouts).length === 1) mappings[String(source.maxLines)] = Object.keys(show.layouts)[0]
    mappings[String(maxLines)] = layoutId
    return {
        layoutId,
        show: {
            ...show,
            slides: { ...show.slides, ...converted.slides },
            layouts: { ...show.layouts, [layoutId]: { ...converted.layouts[layoutId], name: `每頁 ${maxLines} 行` } },
            quickAccess: { ...show.quickAccess, worshipTool: { ...source, layouts: mappings } },
            timestamps: { ...show.timestamps, modified: Math.max(Date.now(), (show.timestamps.modified || 0) + 1) }
        }
    }
}
