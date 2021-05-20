<script>
	import Header from './components/Header.svelte';
	import Profile from './components/Profile.svelte';
	import Employment from './components/Employment.svelte';
	import Education from './components/Education.svelte';
	import Footer from './components/Footer.svelte';
</script>

<style>
	main {
		width: 100%;
		position: relative;		
	}
	.content {
		box-sizing: border-box;
		border: 1px solid black;
		max-width: 800px;
		width: 95%;
		padding: 4rem;
		margin: 0 auto;
	}
	footer {
		margin-top: auto;
		text-align: center;
	}
	@media screen and (max-width: 900px) {
		.content {
			padding: 1rem;
		}
	}
</style>

<main>
	<div class="content">
		<Header />
		<Profile name="Profile" />
		<Employment name="Employment History" />
		<Education name="Education" />
	</div>
</main>
<footer>
	<Footer />
</footer>


