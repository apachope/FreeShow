import axios from "axios"
import type { WorshipToolRequest, WorshipToolResponse, WorshipToolSong, WorshipToolEvent } from "../../types/WorshipTool"

export function worshipToolBaseUrl(input: string): string {
    const url = new URL(input.trim())
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error("請輸入有效的 HTTP / HTTPS 亞太希望工程歌曲管理系統網址。")
    return url.toString().replace(/\/+$/, "")
}

function validSong(song: any): song is WorshipToolSong {
    return song && Number.isSafeInteger(song.id) && song.id > 0 && typeof song.name === "string" && typeof song.updated_at === "string"
}

function validId(value: unknown): value is number {
    return Number.isSafeInteger(value) && (value as number) > 0
}

function validEvent(event: any): event is WorshipToolEvent {
    if (!event || !validId(event.id) || typeof event.name !== "string" || typeof event.date !== "string" || typeof event.revision !== "string" || !Array.isArray(event.sections)) return false
    const sectionIds = new Set<number>()
    const entryIds = new Set<number>()
    return event.sections.every((section: any) => {
        if (!section || !validId(section.id) || sectionIds.has(section.id) || typeof section.name !== "string" || !validId(section.order) || !Array.isArray(section.songs)) return false
        sectionIds.add(section.id)
        return section.songs.every((entry: any) => {
            if (!entry || !validId(entry.entry_id) || entryIds.has(entry.entry_id) || !validId(entry.order) || typeof entry.key_override !== "string" || !validSong(entry.song) || typeof entry.song.content !== "string" || !entry.song.content.trim() || typeof entry.song.revision !== "string" || !entry.song.revision) return false
            entryIds.add(entry.entry_id)
            return true
        })
    })
}

export async function requestWorshipTool(request: WorshipToolRequest): Promise<WorshipToolResponse> {
    try {
        const baseUrl = worshipToolBaseUrl(request.baseUrl)
        if (request.resource === "events") {
            const detail = request.eventId !== undefined
            if (detail && !validId(request.eventId)) return { error: "無效的歌單 ID。" }
            if (!detail && request.page !== undefined && !validId(request.page)) return { error: "無效的頁碼。" }
            const response = await axios.get(`${baseUrl}/api/v1/events/${detail ? `${request.eventId}/` : ""}`, {
                params: detail ? undefined : { page: request.page || 1 },
                timeout: 10000,
                maxRedirects: 0,
                maxContentLength: 8 * 1024 * 1024,
                headers: { Accept: "application/json" }
            })
            if (detail) {
                if (!validEvent(response.data?.event) || response.data.event.id !== request.eventId) throw new Error("Invalid event response")
                return { event: response.data.event }
            }
            const data = response.data
            if (!Array.isArray(data?.results) || !data.results.every((event: any) => event && validId(event.id) && typeof event.name === "string" && typeof event.date === "string" && Number.isSafeInteger(event.song_count) && event.song_count >= 0) || !validId(data.page) || !validId(data.pages)) throw new Error("Invalid event list")
            return { events: data.results, page: data.page, pages: data.pages }
        }
        const detail = request.songId !== undefined
        if (detail && (!Number.isSafeInteger(request.songId) || request.songId! <= 0)) return { error: "無效的歌曲 ID。" }
        const query = (request.query || "").trim()
        if (!detail && (!query || Array.from(query).length > 64)) return { error: "請輸入 1–64 個字的歌名或歌詞。" }
        const response = await axios.get(`${baseUrl}/api/v1/songs/${detail ? `${request.songId}/` : ""}`, {
            params: detail ? undefined : { q: query },
            timeout: 10000,
            maxRedirects: 0,
            maxContentLength: 2 * 1024 * 1024,
            headers: { Accept: "application/json" }
        })
        if (detail) {
            const song = response.data?.song
            if (!validSong(song) || song.id !== request.songId || typeof song.content !== "string") throw new Error("Invalid response")
            return { song }
        }
        const results = response.data?.results
        if (!Array.isArray(results) || !results.every(validSong)) throw new Error("Invalid response")
        return { results }
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const status = error.response?.status
            if (status === 401 || status === 403) return { error: "亞太希望工程歌曲管理系統 拒絕存取，請確認伺服器的存取設定。" }
            if (status === 404) return { error: "找不到歌曲、歌單或 API，請確認網址及 亞太希望工程歌曲管理系統 是否已更新。" }
            if (status === 400) return { error: "搜尋文字不符合要求，請縮短後重試。" }
            if (error.code === "ECONNABORTED") return { error: "連線逾時，請重試。" }
            return { error: "無法連線至 亞太希望工程歌曲管理系統，請確認網址、網路及伺服器狀態。" }
        }
        return { error: "網址或伺服器回應格式不正確，請確認 亞太希望工程歌曲管理系統網址及版本。" }
    }
}
