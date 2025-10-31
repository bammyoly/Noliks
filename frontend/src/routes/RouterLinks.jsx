import { Routes, Route } from "react-router-dom"
import Home from "../pages/Home"
import Inbox from "../pages/Inbox"
import ComposeMail from '../pages/ComposeMail'
import Sent from "../pages/Sent"


const RouterLinks = () => {
  return (
    <Routes>
        <Route path="/" element={<Home />} /> 
        <Route path="/compose" element={<ComposeMail />} /> 
        <Route path="/inbox" element={<Inbox />} /> 
        <Route path="/sent" element={<Sent />} /> 
    </Routes>
  )
}

export default RouterLinks