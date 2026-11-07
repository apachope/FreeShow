import { describe, expect, it } from "vitest"
import type { Show, Slide } from "../../types/Show"
import { appendWorshipToolPagination, findWorshipToolLayout, worshipToolLocalLyrics } from "./worshipToolPagination"

function slide(text: string, group: string | null = "主歌"): Slide {
    return { group, settings: {}, color: null, notes: "備註", items: [{ type: "text", style: "left:10px;", lines: text.split("\n").map((value) => ({ align: "", text: [{ value, style: "" }] })) }] }
}
function show(): Show {
    return { name: "本機歌名", category: null, settings: { activeLayout: "two", template: "template" }, slides: { a: slide("本機第一行\n本機第二行") }, layouts: { two: { name: "原有版型", notes: "保留", slides: [{ id: "a" }] } }, quickAccess: { worshipTool: { server: "https://example.org", songId: 1, revision: "r1", updatedAt: "date", maxLines: 2 } }, timestamps: { created: 1, modified: null, used: null }, meta: {}, media: {} }
}

describe("native pagination layouts on one shared song", () => {
    it("recognizes legacy line limits only when the layout is unambiguous", () => {
        const original = show()
        expect(findWorshipToolLayout(original, 2)).toBe("two")
        expect(findWorshipToolLayout(original, 1)).toBeUndefined()
        original.layouts.custom = { name: "自訂", slides: [], notes: "" }
        expect(findWorshipToolLayout(original, 2)).toBeUndefined()
    })
    it("appends native layouts and preserves existing slides, notes and active selection", () => {
        const original = show(),
            converted = show()
        converted.settings.activeLayout = "one"
        converted.layouts = { one: { name: "預設", notes: "", slides: [{ id: "b" }] } }
        converted.slides = { b: slide("本機第一行") }
        const before = JSON.stringify(original)
        const result = appendWorshipToolPagination(original, converted, 1)
        expect(JSON.stringify(original)).toBe(before)
        expect(result.show.name).toBe("本機歌名")
        expect(result.show.slides.a).toEqual(original.slides.a)
        expect(result.show.layouts.two).toEqual(original.layouts.two)
        expect(result.show.layouts.one.name).toBe("每頁 1 行")
        expect(result.show.settings.activeLayout).toBe("two")
        expect(result.show.quickAccess.worshipTool.layouts).toEqual({ "1": "one", "2": "two" })
        expect(findWorshipToolLayout(result.show, 1)).toBe("one")
        expect(findWorshipToolLayout(result.show, 2)).toBe("two")
        const restored = JSON.parse(JSON.stringify(result.show)) as Show
        expect(findWorshipToolLayout(restored, 1)).toBe("one")
    })
    it("does not reuse a mapping whose native layout was deleted", () => {
        const original = show()
        original.quickAccess.worshipTool.layouts = { "1": "deleted" }
        expect(findWorshipToolLayout(original, 1)).toBeUndefined()
        original.quickAccess.worshipTool.layouts = { "2": "deleted", "1": "two" }
        expect(findWorshipToolLayout(original, 2)).toBeUndefined()
    })
    it("takes local lyrics in layout order, including child slides and repeated sections", () => {
        const original = show()
        original.slides.a.children = ["b", "c"]
        original.slides.b = slide("本機第三行", null)
        original.slides.c = slide("不顯示", null)
        original.layouts.two.slides = [
            { id: "a", children: { c: { disabled: true } } },
            { id: "a", children: { c: { disabled: true } } }
        ]
        expect(worshipToolLocalLyrics(original)).toBe("[主歌]\n本機第一行\n本機第二行\n本機第三行\n\n[主歌]\n本機第一行\n本機第二行\n本機第三行")
    })
})
