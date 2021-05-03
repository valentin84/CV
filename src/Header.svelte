<script>
    let url = '../images/profilePic.jpg';
</script>

<style>
    header {
        display: flex;
        flex-direction: row;
        justify-content: center;
    }
    .container {
        text-align: center;
    }
    img {
        width: 300px;
        height: 200px;
        border-radius: 50%;
    }
    h1 {
        font-size: 2rem;
    }
    span {
        font-size: 1rem;
        font-style: italic;
        padding: 0 0 0 1rem;
        background-size: 1em 1em;
    }
    .location {
        background: url('../images/location.svg') no-repeat;
        padding: 0 0 0 1rem;
        background-size: 1.2em 1.1em;  
    }
    .phone {
        background: url('../images/phone.svg') no-repeat;
        padding: 0 0 0 1.2rem;
        background-size: 1em 1em;  
    }
    .email {
        background: url('../images/email.svg') no-repeat;
        padding: 0 0 0 1.2rem;
        background-size: 1em 1.2em;  
    }

    @media screen and (min-width: 300px) {
    
    }
</style>


<header>   
    
    <div class="container">
        <img src="{url}" alt="ValentinC">
        <h1>Valentin Ciobanu</h1>
        <span class="profession">Front-end Developer</span>
        <span class="location">Bucharest, Romania</span>
        <span class="phone">+(40)771.280.800</span>
        <span class="email">valentin.ciobanu(at)ciolentin.ro</span>
    </div>
       
</header>