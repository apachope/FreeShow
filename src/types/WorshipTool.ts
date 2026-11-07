export const DEFAULT_WORSHIP_TOOL_URL = "https://lyrics.apachope.org/"

export interface WorshipToolSong {
    id: number
    name: string
    snippet_text?: string
    approximate?: boolean
    content?: string
    revision?: string
    updated_at: string
}

export interface WorshipToolRequest {
    baseUrl: string
    query?: string
    songId?: number
    resource?: "events"
    eventId?: number
    page?: number
}

export interface WorshipToolResponse {
    results?: WorshipToolSong[]
    song?: WorshipToolSong
    events?: WorshipToolEventSummary[]
    event?: WorshipToolEvent
    page?: number
    pages?: number
    error?: string
}

export interface WorshipToolEventSummary {
    id: number
    name: string
    date: string
    song_count: number
    updated_at: string
}

export interface WorshipToolEvent {
    id: number
    name: string
    date: string
    revision: string
    sections: {
        id: number
        name: string
        order: number
        songs: { entry_id: number; order: number; key_override: string; song: WorshipToolSong }[]
    }[]
}

export interface WorshipToolSongSource {
    layouts?: Record<string, string>
    maxLines?: number
    server: string
    songId: number
    revision: string
    updatedAt: string
}

export interface WorshipToolProjectSource {
    maxLines?: number
    server: string
    eventId: number
    revision: string
    importedAt: number
}
