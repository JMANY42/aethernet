import NavBar from "../components/Navbar"
export default function Home() {
    return (
        <>
        <NavBar />
        <div className="background-home">
            <img src="mmHomepage.png" alt="Description" class="scaled-image"></img>
            <button class="login-btn" onClick={() => window.location.href = '/signup'}>Get Started!</button>    
            <link rel="stylesheet" href="styles.css"></link>
            </div>
        </>
        
    )
}