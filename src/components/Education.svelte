<script>
    export let name;
    export let expanded = false;
    function toggle() {
        expanded = !expanded;
    }

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
        background: url('../images/education.svg') no-repeat;
    }
</style>

<h2 class:expanded on:click={toggle}>{name}</h2>

{#if expanded}
<div class="profile">
    <h3 in:typewriter>Facultatea de Sociologie, Universitatea Bucuresti</h3> 
    <span in:typewriter>2009-2011</span>
</div>    
{/if}