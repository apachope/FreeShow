<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte"
    import { Main } from "../../../../../types/IPC/Main"
    import { DEFAULT_WORSHIP_TOOL_URL, type WorshipToolSong } from "../../../../../types/WorshipTool"
    import { requestMain } from "../../../../IPC/main"
    import { special } from "../../../../stores"
    import MaterialButton from "../../../inputs/MaterialButton.svelte"
    import MaterialTextInput from "../../../inputs/MaterialTextInput.svelte"

    export let query: string
    const dispatch = createEventDispatcher()
    const baseUrl = $special.worshipToolUrl ?? DEFAULT_WORSHIP_TOOL_URL
    let searchQuery = query
    let songs: WorshipToolSong[] | null = null
    let error = ""
    let loading = false
    let generation = 0
    onDestroy(() => generation++)
    onMount(() => {
        if (baseUrl.trim()) search()
    })

    function submitOnEnter(event: KeyboardEvent) {
        if (event.isComposing || event.keyCode === 229 || event.key !== "Enter") return
        event.stopPropagation()
        event.preventDefault()
        if (!loading && baseUrl.trim() && searchQuery.trim()) search()
    }

    async function search() {
        const current = ++generation
        loading = true
        error = ""
        songs = null
        const result = await requestMain(Main.WORSHIP_TOOL, { baseUrl, query: searchQuery })
        if (current !== generation) return
        loading = false
        error = result?.error || (!result ? "搜尋逾時，請重試。" : "")
        songs = result?.results || null
    }

    async function selectSong(song: WorshipToolSong) {
        const current = ++generation
        loading = true
        error = ""
        const result = await requestMain(Main.WORSHIP_TOOL, { baseUrl, songId: song.id })
        if (current !== generation) return
        loading = false
        if (result?.error || !result?.song?.content?.trim()) {
            error = result?.error || "無法取得歌詞，請重試。"
            return
        }
        dispatch("update", { title: result.song.name, lyrics: result.song.content, source: "亞太希望工程歌曲管理系統" })
    }
</script>

<div class="search-fields">
    <MaterialTextInput label="歌名或歌詞（最多 64 字）" value={searchQuery} on:input={(event) => (searchQuery = event.detail)} on:keydown={submitOnEnter} />
    <MaterialButton disabled={loading || !baseUrl.trim() || !searchQuery.trim()} on:click={search}>搜尋亞太希望工程歌曲管理系統</MaterialButton>
</div>
{#if !baseUrl.trim()}<p>請先至「設定 → 連線」設定亞太希望工程歌曲管理系統網址。</p>{/if}
{#if loading}<p role="status">載入中…</p>{/if}
{#if error}<p role="alert">{error}</p>{/if}
{#if songs && !loading}
    <div class="results">
        {#each songs as song (song.id)}
            <button class="song-result" on:click={() => selectSong(song)}>
                <strong>{song.name}</strong>
                {#if song.approximate}<small>近似結果</small>{/if}
                <span>{song.snippet_text || ""}</span>
            </button>
        {:else}
            <p role="status">找不到符合的歌曲，請換個歌名或歌詞片段。</p>
        {/each}
    </div>
{/if}

<style>
    .search-fields {
        display: grid;
        gap: 12px;
        margin-top: 16px;
    }
    .results {
        max-height: 280px;
        overflow-y: auto;
        margin-top: 12px;
    }
    .song-result {
        display: block;
        width: 100%;
        padding: 12px;
        text-align: start;
        color: var(--text);
        background: var(--primary-darker);
        border: 0;
        cursor: pointer;
    }
    .song-result:hover {
        background: var(--hover);
    }
    .song-result span {
        display: block;
        margin-top: 4px;
        opacity: 0.8;
        white-space: pre-wrap;
    }
    small {
        margin-left: 10px;
    }
</style>
