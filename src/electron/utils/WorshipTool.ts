import axios from "axios"
import type { WorshipToolRequest, WorshipToolResponse, WorshipToolSong } from "../../types/WorshipTool"

export function worshipToolBaseUrl(input: string): string {
    const url = new URL(input.trim())
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error("請輸入有效的 HTTP / HTTPS 亞太希望工程歌曲管理系統網址。")
    return url.toString().replace(/\/+$/, "")
}

function validSong(song: any): song is WorshipToolSong {
    return song && Number.isSafeInteger(song.id) && song.id > 0 && typeof song.name === "string" && typeof song.updated_at === "string"
}

export async function requestWorshipTool(request: WorshipToolRequest): Promise<WorshipToolResponse> {
    try {
        const baseUrl = worshipToolBaseUrl(request.baseUrl)
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
            if (status === 404) return { error: "找不到歌曲或 API，請確認網址及 亞太希望工程歌曲管理系統 是否已更新。" }
            if (status === 400) return { error: "搜尋文字不符合要求，請縮短後重試。" }
            if (error.code === "ECONNABORTED") return { error: "連線逾時，請重試。" }
            return { error: "無法連線至 亞太希望工程歌曲管理系統，請確認網址、網路及伺服器狀態。" }
        }
        return { error: "網址或伺服器回應格式不正確，請確認 亞太希望工程歌曲管理系統網址及版本。" }
    }
}
