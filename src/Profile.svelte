<script>
    import  { onMount  } from "svelte";
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
    function typewriter(node, { speed = 30 }) {
		const valid = (
			node.childNodes.length === 1 &&
			node.childNodes[0].nodeType === Node.TEXT_NODE
		);

		if (!valid) {
			throw new Error(`This transition only works on elements with a single text node child`);
		}

		const text = node.textContent;
		const duration = text.length * speed;

		return {
			duration,
			tick: t => {
				const i = ~~(text.length * t);
				node.textContent = text.slice(0, i);
			}
		};
	}
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