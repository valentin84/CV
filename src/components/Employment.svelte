<script>
    import  { onMount  } from "svelte";
    import typewriter from '../store.js';
    export let name;
    export let expanded = false;
    let data = [];
    let employment = [];
    let tasks = [];
    function toggle() {
        expanded = !expanded;
    }
    
    onMount(async function() {
        let response = await fetch('./cv.json');
        data = await response.json();
        employment = data.employment;
        employment.forEach((e) => {
           tasks.push(e.task);
        })
    })
</script>

<h2 class:expanded on:click={toggle}>{name}</h2>

{#if expanded}
    {#each employment as {job_title, company_name, city_name, employment_period, task}}
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

<style>
    h2, .expanded {
        background: url('../images/briefcase.svg') no-repeat;
    }
    .profile p {
        margin-bottom: 0;
    }
    .profile ul {
        margin-top: 5px;
    }

    @media screen and (max-width: 900px) {
		.profile ul {
			padding-left: 1rem;
		}
	}
</style>