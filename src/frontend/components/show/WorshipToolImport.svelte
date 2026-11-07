<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte"
    import { Main } from "../../../types/IPC/Main"
    import { DEFAULT_WORSHIP_TOOL_URL, type WorshipToolEvent, type WorshipToolEventSummary } from "../../../types/WorshipTool"
    import { requestMain } from "../../IPC/main"
    import { activePopup, projects, shows, special } from "../../stores"
    import { importWorshipToolEvent } from "../../utils/worshipToolImport"
    import { buildWorshipToolImportPlan } from "../../utils/worshipToolImportPlan"
    import { openProject } from "./project"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../inputs/MaterialDropdown.svelte"
    import MaterialNumberInput from "../inputs/MaterialNumberInput.svelte"

    const dispatch = createEventDispatcher()
    const baseUrl = $special.worshipToolUrl ?? DEFAULT_WORSHIP_TOOL_URL
    let events: WorshipToolEventSummary[] = []
    let event: WorshipToolEvent | null = null
    let loading = false
    let error = ""
    let page = 1
    let pages = 1
    let generation = 0
    let copies: number[] = []
    let maxLines = 2
    $: plan = event ? buildWorshipToolImportPlan(event, baseUrl, $shows, $projects, maxLines) : null
    onDestroy(() => generation++)
    onMount(() => loadEvents(1))

    async function loadEvents(next: number) {
        const current = ++generation
        loading = true
        error = ""
        event = null
        const response = await requestMain(Main.WORSHIP_TOOL, { baseUrl, resource: "events", page: next })
        if (current !== generation) return
        loading = false
        error = response?.error || (!response ? "載入逾時，請重試。" : "")
        if (response?.events) {
            events = response.events
            page = response.page || 1
            pages = response.pages || 1
        }
    }

    async function preview(id: number) {
        const current = ++generation
        loading = true
        error = ""
        copies = []
        const response = await requestMain(Main.WORSHIP_TOOL, { baseUrl, resource: "events", eventId: id })
        if (current !== generation) return
        loading = false
        error = response?.error || (!response ? "載入逾時，請重試。" : "")
        event = response?.event || null
    }

    function close() {
        activePopup.set(null)
        dispatch("close")
    }

    function openExisting() {
        if (!plan?.existingProjectId) return
        openProject(plan.existingProjectId, false)
        close()
    }

    async function confirm() {
        if (!event || loading) return
        const current = ++generation
        loading = true
        error = ""
        try {
            await importWorshipToolEvent(event, baseUrl, copies, maxLines, () => current !== generation)
            if (current !== generation) return
            close()
        } catch (failure) {
            if (current !== generation) return
            error = failure instanceof Error ? failure.message : "匯入失敗，請重試。"
            loading = false
        }
    }
</script>

<section role="dialog" aria-modal="true" aria-label="匯入歌曲管理系統歌單" tabindex="-1" class="import-dialog">
    {#if loading}<p role="status">載入中…</p>{/if}
    {#if error}
        <p role="alert">{error}</p>
        <MaterialButton disabled={loading} on:click={() => (event ? preview(event.id) : loadEvents(page))}>重新載入</MaterialButton>
    {/if}
    {#if event}
        <div class="preview-heading">
            <h4 class="playlist-title">{event.date} {event.name}</h4>
            <div class="line-limit">
                <MaterialNumberInput
                    label="每頁最多行數"
                    value={maxLines}
                    min={1}
                    max={100}
                    maxDecimals={0}
                    disabled={loading}
                    on:change={(event) => {
                        maxLines = Number(event.detail)
                        copies = []
                    }}
                />
            </div>
        </div>
        <div class="preview">
            {#each event.sections as section, sectionIndex}
                <section class="preview-section">
                    <h4>{section.name}</h4>
                    <ol class="preview-songs" role="list">
                        {#each section.songs as entry, songIndex}
                            <li>
                                <span class="song-number">{event.sections.slice(0, sectionIndex).reduce((count, group) => count + group.songs.length, 0) + songIndex + 1}.</span>
                                <span class="song-name">{entry.song.name}{entry.key_override ? `（${entry.key_override}）` : ""}</span>
                            </li>
                        {/each}
                    </ol>
                </section>
            {/each}
        </div>

        {#if plan?.existingProjectId}
            <p>這份歌單已使用相同行數匯入，將開啟既有專案。</p>
            <MaterialButton disabled={loading} on:click={openExisting}>開啟既有專案</MaterialButton>
        {:else}
            {#each plan?.songs || [] as item}
                {#if item.status === "changed"}
                    <MaterialDropdown
                        label={`${item.song.name}：來源歌詞已變更`}
                        value={copies.includes(item.song.id) ? "copy" : "local"}
                        options={[
                            { label: "沿用本機曲目", value: "local" },
                            { label: "匯入新版副本", value: "copy" }
                        ]}
                        on:change={(e) => (copies = e.detail === "copy" ? [...copies.filter((id) => id !== item.song.id), item.song.id] : copies.filter((id) => id !== item.song.id))}
                    />
                {/if}
            {/each}
            <p class="import-summary">新增 {plan?.songs.filter((item) => item.status === "new").length || 0} 首、重用 {plan?.songs.filter((item) => item.status === "reuse").length || 0} 首、來源變更 {plan?.songs.filter((item) => item.status === "changed").length || 0} 首。</p>
            <MaterialButton disabled={loading || !plan?.songs.length || !Number.isInteger(maxLines) || maxLines < 1 || maxLines > 100} on:click={confirm}>匯入為新專案</MaterialButton>
        {/if}
        <MaterialButton
            disabled={loading}
            on:click={() => {
                generation++
                event = null
                error = ""
            }}>返回歌單</MaterialButton
        >
    {:else if !loading && !error}
        <div class="event-list">
            {#each events as summary}
                <button class="event" on:click={() => preview(summary.id)}>
                    <strong>{summary.date} {summary.name}</strong>
                    <span>{summary.song_count} 首歌曲</span>
                </button>
            {:else}
                <p>目前沒有進行中的歌單。</p>
            {/each}
        </div>
        <footer>
            <MaterialButton disabled={page <= 1} on:click={() => loadEvents(page - 1)}>上一頁</MaterialButton>
            <span>{page} / {pages}</span>
            <MaterialButton disabled={page >= pages} on:click={() => loadEvents(page + 1)}>下一頁</MaterialButton>
        </footer>
    {/if}
</section>

<style>
    .import-dialog {
        width: 100%;
        color: var(--text);
    }
    .import-dialog > p {
        white-space: normal;
        overflow-wrap: anywhere;
        overflow: visible;
        line-height: 1.5;
    }
    footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }
    .event-list {
        display: grid;
        gap: 8px;
        margin: 16px 0;
    }
    .event {
        display: grid;
        gap: 6px;
        padding: 14px;
        text-align: start;
        border: 0;
        border-radius: 6px;
        background: var(--primary-darker);
        color: var(--text);
        cursor: pointer;
    }
    .event:hover {
        background: var(--hover);
    }
    .event span {
        opacity: 0.7;
    }
    .preview {
        max-height: min(42vh, 320px);
        display: grid;
        gap: 16px;
        overflow-y: auto;
        padding: 16px;
        box-sizing: border-box;
        background: var(--primary-darker);
        border-radius: 6px;
    }
    .preview-heading {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 11em;
        align-items: center;
        gap: 24px;
        margin-bottom: 20px;
    }
    .line-limit {
        min-width: 0;
    }
    .playlist-title {
        margin: 0;
        overflow-wrap: anywhere;
    }
    .preview-section h4 {
        margin: 0 0 8px;
        overflow-wrap: anywhere;
    }
    .preview-songs {
        margin: 0;
        padding: 0;
        list-style: none;
    }
    .preview-songs li {
        display: grid;
        grid-template-columns: 2.5em minmax(0, 1fr);
        gap: 8px;
        padding: 5px 0;
        line-height: 1.5;
    }
    .song-number {
        font-variant-numeric: tabular-nums;
        opacity: 0.7;
    }
    .song-name {
        min-width: 0;
        overflow-wrap: anywhere;
    }
    .import-summary {
        margin: 16px 0;
        line-height: 1.5;
    }
    @media (max-width: 640px) {
        .preview-heading {
            grid-template-columns: 1fr;
            gap: 16px;
        }
        .line-limit {
            width: min(100%, 14em);
        }
    }
</style>
