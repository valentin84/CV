<script>
    import  { onMount  } from "svelte";
    import typewriter from '../store.js';
    export let name;
    export let expanded = false;
    
    function toggle() {
        expanded = !expanded;
    }
    let info = [];
    onMount(async function() {
        let response = await fetch('./profile.json');
        info = await response.json();
    })
</script>
<style>
    h2, .expanded {
        background: url('../images/profile.svg') no-repeat;
    }
</style>

<h2 class:expanded on:click={toggle}>{name}</h2>

{#if expanded}
<div class="profile">
    {#each info as data}
        <p in:typewriter>{data.description}</p>
    {/each}
</div>
{/if}