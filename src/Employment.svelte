<script>
    import  { onMount  } from "svelte";
    export let name;
    export let expanded = false;
    let data = [];
    let tasks = [];
    function toggle() {
        expanded = !expanded;
    }
    
    onMount(async function() {
        let response = await fetch('../employment.json');
        data = await response.json();
        data.forEach((e) => {
           tasks.push(e.task);
        })
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
        background: url('../images/briefcase.svg') no-repeat;
    }
</style>

<h2 class:expanded on:click={toggle}>{name}</h2>

{#if expanded}
    {#each data as {job_title, company_name, city_name, employment_period, task}}
        <div class="profile">
            <h3>{job_title} - {company_name} - {city_name}</h3> 
            <span in:typewriter>{employment_period}</span>
            <p in:typewriter>Responsabilities: </p>
            <ul>  
                {#each task as item}
                <li in:typewriter>{item}</li>
                {/each}
            </ul>
        </div>
    {/each}  
{/if}