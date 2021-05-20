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
        let response = await fetch('./cv.json');
        info = await response.json();
    })
</script>

<h2 class:expanded on:click={toggle}>{name}</h2>

{#if expanded}
<div class="profile">
    <p in:typewriter>{info.profile}</p>
</div>
{/if}

<style>
    h2, .expanded {
        background: url('../images/profile.svg') no-repeat;
    }
</style>