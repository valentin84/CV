<script>
	import  { onMount  } from "svelte";
	import typewriter from '../store.js';
    export let name;
    export let expanded = false;
	let data = [];
	let education = [];
    function toggle() {
        expanded = !expanded;
    }

	onMount(async function() {
        let response = await fetch('./cv.json');
        data = await response.json();
		education = data.education;
    })
</script>

<h2 class:expanded on:click={toggle}>{name}</h2>

{#if expanded}
	{#each education as info}
		<div class="profile">
			<h3 in:typewriter>{info.school_name}</h3> 
			<span in:typewriter>{info.period}</span>
		</div>  
	{/each}	  
{/if}

<style>
    h2, .expanded {
        background: url('../images/education.svg') no-repeat;
    }
</style>