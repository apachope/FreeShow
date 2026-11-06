import { beforeEach, describe, expect, it, vi } from "vitest"
import axios from "axios"
import { requestWorshipTool, worshipToolBaseUrl } from "./WorshipTool"

vi.mock("axios", () => ({ default: { get: vi.fn(), isAxiosError: (error: any) => error?.isAxiosError === true } }))
const get = vi.mocked(axios.get)
const song = { id: 12, name: "愛祢", content: "[主歌]\n第一行\n\n[副歌]\n第二行", updated_at: "2026-11-06T00:00:00Z" }

beforeEach(() => vi.clearAllMocks())

describe("worship-tool integration", () => {
    it("normalizes a deployment subpath and rejects unsafe or ambiguous URLs", () => {
        expect(worshipToolBaseUrl(" https://example.org/worship/ ")).toBe("https://example.org/worship")
        for (const url of ["file:///tmp/test", "ftp://example.org", "https://user:password@example.org", "https://example.org?q=x", "https://example.org/#fragment"]) {
            expect(() => worshipToolBaseUrl(url)).toThrow()
        }
    })

    it("searches by query with a timeout and returns display data", async () => {
        get.mockResolvedValue({ data: { results: [song] } })
        expect(await requestWorshipTool({ baseUrl: "http://localhost:8000/worship/", query: " 愛祢 " })).toEqual({ results: [song] })
        expect(get).toHaveBeenCalledWith("http://localhost:8000/worship/api/v1/songs/", expect.objectContaining({ params: { q: "愛祢" }, timeout: 10000, maxRedirects: 0 }))
    })

    it("fetches current full lyrics by ID without changing paragraph breaks", async () => {
        get.mockResolvedValue({ data: { song } })
        expect(await requestWorshipTool({ baseUrl: "https://example.org", songId: 12 })).toEqual({ song })
        expect(get.mock.calls[0][0]).toBe("https://example.org/api/v1/songs/12/")
    })

    it("rejects invalid queries and IDs without sending a request", async () => {
        for (const request of [{ query: "" }, { query: "字".repeat(65) }, { songId: -1 }]) {
            expect((await requestWorshipTool({ baseUrl: "https://example.org", ...request })).error).toBeTruthy()
        }
        expect(get).not.toHaveBeenCalled()
    })

    it("distinguishes no matches from an invalid server response", async () => {
        get.mockResolvedValueOnce({ data: { results: [] } }).mockResolvedValueOnce({ data: "<html>Login</html>" })
        expect(await requestWorshipTool({ baseUrl: "https://example.org", query: "歌曲" })).toEqual({ results: [] })
        expect((await requestWorshipTool({ baseUrl: "https://example.org", query: "歌曲" })).error).toBeTruthy()
    })

    it("rejects detail responses for a different song", async () => {
        get.mockResolvedValue({ data: { song: { ...song, id: 13 } } })
        expect((await requestWorshipTool({ baseUrl: "https://example.org", songId: 12 })).error).toBeTruthy()
    })

    it.each([
        [{ isAxiosError: true, code: "ECONNABORTED" }, "逾時"],
        [{ isAxiosError: true, response: { status: 403 } }, "拒絕存取"],
        [{ isAxiosError: true, response: { status: 404 } }, "找不到"],
        [{ isAxiosError: true, code: "ECONNREFUSED" }, "無法連線"]
    ])("reports actionable errors", async (failure, message) => {
        get.mockRejectedValue(failure)
        expect((await requestWorshipTool({ baseUrl: "https://example.org", query: "歌曲" })).error).toContain(message)
    })
})

describe("playlist API adapter", () => {
    const event = { id: 1, name: "主日", date: "2026-11-08", revision: "event-v1", sections: [{ id: 1, name: "敬拜", order: 1, songs: [{ entry_id: 1, order: 1, key_override: "G", song: { ...song, revision: "song-v1" } }] }] }
    it("loads paginated playlist summaries", async () => {
        const summary = { id: 1, name: "主日", date: "2026-11-08", song_count: 2 }
        get.mockResolvedValue({ data: { results: [summary], page: 2, pages: 3 } })
        expect(await requestWorshipTool({ baseUrl: "https://example.org/", resource: "events", page: 2 })).toEqual({ events: [summary], page: 2, pages: 3 })
        expect(get.mock.calls[0][0]).toBe("https://example.org/api/v1/events/")
    })
    it("loads a full playlist snapshot", async () => {
        get.mockResolvedValue({ data: { event } })
        expect(await requestWorshipTool({ baseUrl: "https://example.org", resource: "events", eventId: 1 })).toEqual({ event })
    })
    it("rejects wrong playlist IDs or invalid full lyrics", async () => {
        get.mockResolvedValueOnce({ data: { event: { ...event, id: 2 } } })
        expect((await requestWorshipTool({ baseUrl: "https://example.org", resource: "events", eventId: 1 })).error).toBeTruthy()
        get.mockResolvedValueOnce({ data: { event: { ...event, sections: [{ ...event.sections[0], songs: [{ ...event.sections[0].songs[0], song: { ...song, content: "" } }] }] } } })
        expect((await requestWorshipTool({ baseUrl: "https://example.org", resource: "events", eventId: 1 })).error).toBeTruthy()
    })
    it("rejects duplicate entry identities", async () => {
        get.mockResolvedValue({ data: { event: { ...event, sections: [{ ...event.sections[0], songs: [event.sections[0].songs[0], event.sections[0].songs[0]] }] } } })
        expect((await requestWorshipTool({ baseUrl: "https://example.org", resource: "events", eventId: 1 })).error).toBeTruthy()
    })
    it("rejects invalid page and IDs before sending a request", async () => {
        for (const input of [{ eventId: -1 }, { page: 0 }]) {
            expect((await requestWorshipTool({ baseUrl: "https://example.org", resource: "events", ...input })).error).toBeTruthy()
        }
        expect(get).not.toHaveBeenCalled()
    })
})
