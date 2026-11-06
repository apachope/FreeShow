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
