export const DEFAULT_WORSHIP_TOOL_URL = "https://lyrics.apachope.org/"

export interface WorshipToolSong {
    id: number
    name: string
    snippet_text?: string
    approximate?: boolean
    content?: string
    updated_at: string
}

export interface WorshipToolRequest {
    baseUrl: string
    query?: string
    songId?: number
}

export interface WorshipToolResponse {
    results?: WorshipToolSong[]
    song?: WorshipToolSong
    error?: string
}
