<script>
	import Header from './Header.svelte';
	import Profile from './Profile.svelte';
	import Employment from './Employment.svelte';
	import Education from './Education.svelte';
</script>

<style>
	.main {
		box-sizing: border-box;
		border: 1px solid black;
		max-width: 800px;
		width: 95%;
		padding: 4rem;	
	}
	@media screen and (max-width: 900px) {
		.main {
			padding: 1rem;
		}
	}
</style>

<div class="main">
	<Header />
	<Profile name="Profile" />
	<Employment name="Employment History" />
	<Education name="Education" />
</div>
