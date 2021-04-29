<script>
    export let name;
    export let expanded = false;
    function toggle() {
        expanded = !expanded;
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
    <h3>Job Title @ company, City</h3> 
    <h4>Period of employment</h4>
    <p>Responsabilities: </p>
    <ul>
        <li>Did 1</li>
        <li>Did 2</li>
        <li>Did 3</li>
    </ul>
</div>
{/if}