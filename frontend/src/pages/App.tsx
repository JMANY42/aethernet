import { useState } from 'react'
import NetworkMap from '../assets/NetworkMap'
// import reactLogo from '../assets/react.svg'
// import viteLogo from '/vite.svg'
import '../styles/App.css'

function App() {
  //const [count, setCount] = useState(0)

  return (
    <>
      <div className="Map">
        <NetworkMap />
      </div>
    </>
  )
}

export default App
